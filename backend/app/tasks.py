from app.core.celery_app import celery_app
from app.services.image_processor import process_image_file
import redis
import os
from app.core.database import SessionLocal
from app.core.config import settings
from app.models import SystemConfig, Image, Video, RawImage, Albums
from app.services.video_processor import process_video_file 
from app.services.raw_image_processor import process_raw_file
from sqlalchemy.ext.mutable import MutableList
from datetime import datetime
import zipfile
import tempfile
import uuid
import csv
import io
from sqlalchemy import inspect, text, create_engine

# Redis Connection for Locking (Same URL as Celery)
redis_client = redis.from_url(settings.REDIS_URL)
LOCK_KEY = "haven_scan_lock"
DOWNLOAD_PATH = settings.DOWNLOAD_PATH

@celery_app.task(name="sentinel_pulse")
def sentinel_pulse():
    """
    Runs every 60s. Checks if HavenVault is connected.
    If yes, triggers a scan (unless one is already running).
    """
    # Import here to avoid circular imports
    from app.services.scanner import scan_directory_flat

    print("💓 [Sentinel] Checking system status...")
    
    db = SessionLocal()
    try:
        # 1. Get Configured Path
        config = db.query(SystemConfig).filter_by(key="storage_path").first()
        if not config or not config.value:
            print("⚪️ [Sentinel] Idle: No storage path configured.")
            return

        storage_path = config.value

        # 2. Check Hardware Connection
        if not os.path.exists(storage_path):
            print(f"🔴 [Sentinel] HavenVault disconnected: {storage_path} not found.")
            # Optional: Write status to Redis for UI to see
            redis_client.set("system_status", "disconnected")
            return
        
        # IMPORTANT: IMPLEMENT SCAN COMPLETION CHECK
        pending_raw = redis_client.get("haven_tasks_pending")
        completed_raw = redis_client.get("haven_tasks_completed")

        if pending_raw and completed_raw:
            # ✅ Convert bytes to int
            try:
                pending = int(pending_raw.decode('utf-8'))
                completed = int(completed_raw.decode('utf-8'))
                if completed < pending:
                    remaining = pending - completed
                    print(f"🟡 [Sentinel] Processing in progress: {completed}/{pending} tasks done ({remaining} remaining)")
                    return
                else:
                    # All tasks complete, clear counters for next scan
                    redis_client.delete("haven_tasks_pending")
                    redis_client.delete("haven_tasks_completed")
                    print(f"✅ [Sentinel] All tasks completed! Ready for new scan.")
            except (ValueError, AttributeError):
                # Invalid data in Redis, clear and proceed
                redis_client.delete("haven_tasks_pending")
                redis_client.delete("haven_tasks_completed")
                

        # 3. HavenVault is Connected! Check Lock.
        # We try to acquire a lock. If it exists, it means a scan is currently running.
        # nx=True (Set if Not Exists), ex=600 (Expire in 10 minutes to prevent deadlocks)
        lock_acquired = redis_client.set(LOCK_KEY, "locked", nx=True, ex=600)

        if not lock_acquired:
            print("🟡 [Sentinel] Scan already in progress. Skipping pulse.")
            return

        try:
            print(f"🟢 [Sentinel] HavenVault Active. Starting Scan on: {storage_path}")
            redis_client.set("system_status", "connected")
            
            # 4. RUN THE TRAFFIC COP
            # This loops through files and dispatches 'process_image' tasks
            scan_directory_flat(storage_path, db)
            
        finally:
            # 5. Release Lock
            redis_client.delete(LOCK_KEY)
            print("🏁 [Sentinel] Pulse complete. Lock released.")

    except Exception as e:
        print(f"❌ [Sentinel] Error: {e}")
    finally:
        db.close()

# --- IMAGE WORKER ---
@celery_app.task(name="process_image", bind=True, max_retries=0)
def task_process_image(self, full_path: str, filename: str):
    """
    Background job to process a single image.
    """
    try:
        print(f"📷 [Worker] Processing Image: {filename}")
        # This calls the logic you already wrote/refactored
        process_image_file(full_path, filename)
        redis_client.incr("haven_tasks_completed")
        return f"Success: {filename}"
    except Exception as e:
        print(f"❌ [Worker] Failed: {filename} | Error: {e}")
        redis_client.incr("haven_tasks_completed")
        raise e

# --- VIDEO WORKER ---
@celery_app.task(bind=True, max_retries=0, name="process_video")
def task_process_video(self, full_path: str, filename: str):
    try:
        print(f"🎥 [Worker] Processing Video: {filename}")
        process_video_file(full_path, filename)
        redis_client.incr("haven_tasks_completed")
        return f"Success: {filename}"
    except Exception as e:
        print(f"❌ [Worker] Video Failed: {filename} | {e}")
        redis_client.incr("haven_tasks_completed")
        raise e

# --- RAW WORKER ---
@celery_app.task(bind=True, max_retries=0, name="process_raw")
def task_process_raw(self, full_path: str, filename: str):
    try:
        print(f"🎞️ [Worker] Processing RAW: {filename}")
        process_raw_file(full_path, filename)
        redis_client.incr("haven_tasks_completed")
        return f"Success: {filename}"
    except Exception as e:
        print(f"❌ [Worker] RAW Failed: {filename} | {e}")
        redis_client.incr("haven_tasks_completed")
        raise e

# --- BATCH ADD TO ALBUM WORKER ---
@celery_app.task(bind=True, name="batch_add_to_album")
def task_batch_add_to_album(self, task_id: str, album_id: int, files: list):
    """
    Background job to add multiple files to an album sequentially.
    Persists progress in Redis.
    
    Args:
        task_id: Unique identifier for this batch operation
        album_id: Album ID to add files to
        files: List of dicts [{"type": "image", "id": 123}, ...]
    """
    
    db = SessionLocal()
    total = len(files)
    completed = 0
    failed = 0
    
    try:
        # Store initial state in Redis
        redis_client.hset(f"batch_task:{task_id}", mapping={
            "status": "in_progress",
            "total": total,
            "completed": 0,
            "failed": 0,
            "album_id": album_id
        })
        redis_client.expire(f"batch_task:{task_id}", 3600)  # Expire after 1 hour
        
        print(f"📦 [Batch Add] Starting: {total} files to album {album_id}")

        if not album_id:
            print(f"❌ [Batch Add] Album ID is required")
            failed += 1
            return {
                "status": "failed",
                "error": "Album ID is required"
            }
        if not files:
            print(f"❌ [Batch Add] Files are required")
            failed += 1
            return {
                "status": "failed",
                "error": "Files are required"
            }
        
        for file_data in files:
            try:
                file_type = file_data["type"]
                file_id = file_data["id"]

                if not file_type:
                    print(f"❌ [Batch Add] File type is required")
                    failed += 1
                    continue
                if not file_id:
                    print(f"❌ [Batch Add] File ID is required")
                    failed += 1
                    continue
                
                # Get album
                album = db.query(Albums).filter(Albums.id == album_id).first()
                if not album:
                    print(f"❌ [Batch Add] Album {album_id} not found")
                    failed += 1
                    continue

            
                
                # Check file exists and not already in album
                if file_type == "image":
                    file_obj = db.query(Image).filter(Image.id == file_id).first()
                    if file_obj and file_id not in (album.album_images_ids or []):
                        if album.album_images_ids is None:
                            album.album_images_ids = []
                        album.album_images_ids = list(album.album_images_ids) + [file_id]
                        album.album_images_count = len(album.album_images_ids)
                elif file_type == "video":
                    file_obj = db.query(Video).filter(Video.id == file_id).first()
                    if file_obj and file_id not in (album.album_videos_ids or []):
                        if album.album_videos_ids is None:
                            album.album_videos_ids = []
                        album.album_videos_ids = list(album.album_videos_ids) + [file_id]
                        album.album_videos_count = len(album.album_videos_ids)
                elif file_type == "raw":
                    file_obj = db.query(RawImage).filter(RawImage.id == file_id).first()
                    if file_obj and file_id not in (album.album_raw_images_ids or []):
                        if album.album_raw_images_ids is None:
                            album.album_raw_images_ids = []
                        album.album_raw_images_ids = list(album.album_raw_images_ids) + [file_id]
                        album.album_raw_images_count = len(album.album_raw_images_ids)
                
                # Update total count and size
                album.album_total_count = (
                    len(album.album_images_ids or []) +
                    len(album.album_videos_ids or []) +
                    len(album.album_raw_images_ids or [])
                )
                
                if file_obj:
                    album.album_size = (album.album_size or 0) + (file_obj.file_size or 0)
                    file_obj.album_ids = list(file_obj.album_ids or []) + [album_id]
                
                if not album.album_cover_id or not album.album_cover_type:
                    album.album_cover_id = file_id
                    album.album_cover_type = file_type
                
                album.album_updated_at = datetime.now()
                
                db.commit()
                completed += 1
                print(f"✅ [Batch Add] Added {file_type} {file_id} ({completed}/{total})")
                
            except Exception as file_error:
                print(f"❌ [Batch Add] Failed to add {file_data}: {file_error}")
                failed += 1
                db.rollback()
            
            # Update progress in Redis
            redis_client.hset(f"batch_task:{task_id}", mapping={
                "completed": completed,
                "failed": failed
            })
        
        # Mark as complete
        redis_client.hset(f"batch_task:{task_id}", "status", "completed")
        print(f"🏁 [Batch Add] Complete: {completed} succeeded, {failed} failed")
        
        return {
            "status": "completed",
            "total": total,
            "completed": completed,
            "failed": failed
        }
        
    except Exception as e:
        print(f"❌ [Batch Add] Critical error: {e}")
        redis_client.hset(f"batch_task:{task_id}", "status", "failed")
        raise e
    finally:
        db.close()

# --- BATCH DELETE ALBUM WORKER ---
@celery_app.task(bind=True, name="batch_delete_album")
def task_batch_delete_album(self, task_id: str, album_id: int):
    """
    Background job to delete an album.
    Persists progress in Redis.
    """
    
    db = SessionLocal()
    
    try:
        # Store initial state in Redis
        redis_client.hset(f"batch_task:{task_id}", mapping={
            "status": "in_progress",
            "total": 1,
            "completed": 0,
            "album_id": album_id
        })
        redis_client.expire(f"batch_task:{task_id}", 3600)
        
        print(f"🗑️ [Delete Album] Starting: album {album_id}")

        if not album_id:
            print(f"❌ [Delete Album] Album ID is required")
            return {
                "status": "failed",
                "error": "Album ID is required"
            }
        
        # Get album
        album = db.query(Albums).filter(Albums.id == album_id).first()
        if not album:
            redis_client.hset(f"batch_task:{task_id}", "status", "failed")
            return {"status": "failed", "error": "Album not found"}
        
        # Remove album from all files
        for file_id in album.album_images_ids or []:
            file_obj = db.query(Image).filter(Image.id == file_id).first()
            if file_obj and file_obj.album_ids:
                file_obj.album_ids = [aid for aid in file_obj.album_ids if aid != album_id]
        
        for file_id in album.album_videos_ids or []:
            file_obj = db.query(Video).filter(Video.id == file_id).first()
            if file_obj and file_obj.album_ids:
                file_obj.album_ids = [aid for aid in file_obj.album_ids if aid != album_id]
        
        for file_id in album.album_raw_images_ids or []:
            file_obj = db.query(RawImage).filter(RawImage.id == file_id).first()
            if file_obj and file_obj.album_ids:
                file_obj.album_ids = [aid for aid in file_obj.album_ids if aid != album_id]
        
        # Delete album
        db.delete(album)
        db.commit()
        
        # Mark as complete
        redis_client.hset(f"batch_task:{task_id}", mapping={
            "status": "completed",
            "completed": 1
        })
        print(f"✅ [Delete Album] Complete: album {album_id}")
        
        return {"status": "completed", "total": 1, "completed": 1}
        
    except Exception as e:
        print(f"❌ [Delete Album] Error: {e}")
        redis_client.hset(f"batch_task:{task_id}", "status", "failed")
        db.rollback()
        raise e
    finally:
        db.close()

# --- ALBUM DOWNLOAD WORKER ---
@celery_app.task(bind=True, name="create_album_zip")
def task_create_album_zip(self, task_id: str, album_id: int, album_name: str):
    """
    Background job to create a zip file for an album.
    Persists progress in Redis.
    
    Args:
        task_id: Unique identifier for this download operation
        album_id: Album ID to download
        album_name: Album name for the zip filename
    """
    import zipfile
    import tempfile
    from pathlib import Path
    
    db = SessionLocal()
    
    try:
        # Get storage paths from database
        storage_config = db.query(SystemConfig).filter_by(key="storage_path").first()
        
        if not storage_config or not storage_config.value:
            raise Exception("Storage paths not configured")
        
        storage_path = storage_config.value
        
        # Get album with all files
        album = db.query(Albums).filter(Albums.id == album_id).first()
        if not album:
            raise Exception("Album not found")
        
        # Collect all files
        all_files = []
        
        # Images
        if album.album_images_ids:
            images = db.query(Image).filter(Image.id.in_(album.album_images_ids)).all()
            for img in images:
                file_path = os.path.join(storage_path, "images", img.filename)
                if os.path.exists(file_path):
                    all_files.append(("images", img.filename, file_path))
        
        # Videos
        if album.album_videos_ids:
            videos = db.query(Video).filter(Video.id.in_(album.album_videos_ids)).all()
            for vid in videos:
                file_path = os.path.join(storage_path, "videos", vid.filename)
                if os.path.exists(file_path):
                    all_files.append(("videos", vid.filename, file_path))
        
        # Raw Images
        if album.album_raw_images_ids:
            raw_images = db.query(RawImage).filter(RawImage.id.in_(album.album_raw_images_ids)).all()
            for raw in raw_images:
                file_path = os.path.join(storage_path, "raw", raw.filename)
                if os.path.exists(file_path):
                    all_files.append(("raw", raw.filename, file_path))
        
        total_files = len(all_files)
        
        if total_files == 0:
            raise Exception("No files found in album")
        
        # Check if task was cancelled before starting (check Redis)
        existing_status = redis_client.hget(f"download_task:{task_id}", "status")
        if existing_status and existing_status.decode('utf-8') == 'cancelled':
            print(f"🛑 [Album Download] Task cancelled before starting")
            return {
                "status": "cancelled",
                "message": "Task cancelled before starting"
            }
        
        # Store initial state in Redis
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "in_progress",
            "total": total_files,
            "completed": 0,
            "album_id": album_id,
            "album_name": album_name
        })
        redis_client.expire(f"download_task:{task_id}", 7200)  # Expire after 2 hours
        
        print(f"📦 [Album Download] Starting: {total_files} files for album '{album_name}'")

        zip_filename = f"album_{album.album_name}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.zip"
        zip_path = os.path.join(DOWNLOAD_PATH, zip_filename)
        
        # Create zip file
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_STORED, allowZip64=True) as zipf:
            for idx, (file_type, filename, file_path) in enumerate(all_files, 1):
                # Check Redis status for cancellation
                task_status = redis_client.hget(f"download_task:{task_id}", "status")
                if task_status and task_status.decode('utf-8') == 'cancelled':
                    print(f"🛑 [Album Download] Task cancelled by user")
                    # Clean up partial zip file
                    if os.path.exists(zip_path):
                        try:
                            os.remove(zip_path)
                            print(f"🗑️ [Album Download] Deleted partial zip file: {zip_path}")
                        except Exception as cleanup_error:
                            print(f"⚠️ [Album Download] Could not delete zip file: {cleanup_error}")
                    return {
                        "status": "cancelled",
                        "message": "Task cancelled by user"
                    }
                
                try:
                    # Add file to zip with folder structure
                    arcname = os.path.join(file_type, filename)
                    zipf.write(file_path, arcname=arcname)
                    
                    # Update progress
                    progress = int((idx / total_files) * 100)
                    redis_client.hset(f"download_task:{task_id}", mapping={
                        "completed": idx,
                        "progress": progress
                    })
                    
                    print(f"✅ [Album Download] Added {filename} ({idx}/{total_files} - {progress}%)")
                    
                except Exception as file_error:
                    print(f"⚠️ [Album Download] Failed to add {filename}: {file_error}")
                    # Continue with other files
        
        # Mark as complete with file path
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "completed",
            "completed": total_files,
            "progress": 100,
            "zip_path": zip_path,
            "zip_filename": f"{album_name}.zip"
        })
        
        print(f"🏁 [Album Download] Complete: {zip_path}")
        
        return {
            "status": "completed",
            "total": total_files,
            "completed": total_files,
            "zip_path": zip_path,
            "zip_filename": f"{album_name}.zip"
        }
        
    except Exception as e:
        print(f"❌ [Album Download] Error: {e}")
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "failed",
            "error": str(e)
        })
        # Clean up zip file on failure
        if 'zip_path' in locals() and os.path.exists(zip_path):
            try:
                os.remove(zip_path)
                print(f"🗑️ Cleaned up failed zip file: {zip_path}")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup error: {cleanup_error}")
        raise e
    finally:
        db.close()

# --- HAVEN VAULT DOWNLOAD WORKER ---
@celery_app.task(bind=True, name="create_haven_vault_zip")
def task_create_haven_vault_zip(self, task_id: str, storage_path: str):
    """
    Background job to create a zip file for the entire Haven Vault storage_path.
    Only processes files from images, videos, and raw directories.
    Persists progress in Redis under download_task:{task_id}
    """
    try:
        if not storage_path or not os.path.exists(storage_path):
            raise Exception("Storage path not configured or not found")

        # Check for cancellation before starting (in case cancelled during initialization)
        task_status = redis_client.hget(f"download_task:{task_id}", "status")
        if task_status and task_status.decode('utf-8') == 'cancelled':
            print(f"🛑 [Vault Download] Task cancelled before starting")
            return {"status": "cancelled", "message": "Task cancelled by user"}

        # Define the three directories to process
        dirs_to_process = ["images", "videos", "raw"]
        
        # Count total files upfront using os.listdir
        total_files = 0
        file_lists = {}
        for dir_name in dirs_to_process:
            dir_path = os.path.join(storage_path, dir_name)
            file_lists[dir_name] = []
            if os.path.exists(dir_path) and os.path.isdir(dir_path):
                # List all files in the directory
                # files = [f for f in os.listdir(dir_path) 
                #         if os.path.isfile(os.path.join(dir_path, f))]
                # file_lists[dir_name] = files
                # total_files += len(files)
                with os.scandir(dir_path) as entries:
                    for entry in entries:
                        if entry.is_file():
                            file_lists[dir_name].append(entry.name)
                            total_files += 1
            else:
                file_lists[dir_name] = []

        if total_files == 0:
            raise Exception("No files found in Haven Vault")

        print(f"📊 [Vault Download] Found {total_files} files to zip")

        # Check for cancellation again after counting files
        task_status = redis_client.hget(f"download_task:{task_id}", "status")
        if task_status and task_status.decode('utf-8') == 'cancelled':
            print(f"🛑 [Vault Download] Task cancelled after file counting")
            return {"status": "cancelled", "message": "Task cancelled by user"}

        # Store initial state in Redis with total count
        zip_filename = f"haven_vault_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.zip"
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "in_progress",
            "total": total_files,
            "completed": 0,
            "progress": 0,
            "zip_filename": zip_filename
        })
        redis_client.expire(f"download_task:{task_id}", 7200)  # 2 hours

        # Prepare zip
        zip_path = os.path.join(DOWNLOAD_PATH, zip_filename)

        # Keep original folder structure inside the zip
        root_name = os.path.basename(os.path.abspath(storage_path.rstrip(os.sep)))
        file_count = 0
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_STORED, allowZip64=True) as zipf:
            # Process each directory
            for dir_name in dirs_to_process:
                dir_path = os.path.join(storage_path, dir_name)
                if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
                    continue

                # Cancellation check before processing each directory
                task_status = redis_client.hget(f"download_task:{task_id}", "status")
                if task_status and task_status.decode('utf-8') == 'cancelled':
                    if os.path.exists(zip_path):
                        try:
                            os.remove(zip_path)
                        except Exception:
                            pass
                    return {"status": "cancelled", "message": "Task cancelled by user"}

                # Process files in this directory
                for filename in file_lists[dir_name]:
                    # Cancellation check before each file
                    task_status = redis_client.hget(f"download_task:{task_id}", "status")
                    if task_status and task_status.decode('utf-8') == 'cancelled':
                        if os.path.exists(zip_path):
                            try:
                                os.remove(zip_path)
                            except Exception:
                                pass
                        return {"status": "cancelled", "message": "Task cancelled by user"}

                    try:
                        full_path = os.path.join(dir_path, filename)
                        # Preserve folder structure: root_name/dir_name/filename
                        arcname = os.path.join(root_name, dir_name, filename)
                        zipf.write(full_path, arcname=arcname)
                        
                        file_count += 1

                        print(f"✅ [Vault Download] Added {dir_name}/{filename} ({file_count}/{total_files})")
                        
                        # Update progress 
                        progress = int((file_count / total_files) * 100)
                        redis_client.hset(f"download_task:{task_id}", mapping={
                            "completed": file_count,
                            "progress": progress
                        })
                    except Exception as file_error:
                        # Skip problematic file but continue
                        print(f"⚠️ [Vault Download] Failed to add {dir_name}/{filename}: {file_error}")

        # Final update with actual total
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "completed",
            "completed": file_count,
            "total": total_files,
            "progress": 100,
            "zip_path": zip_path,
            "zip_filename": zip_filename
        })

        print(f"🏁 [Vault Download] Complete: {file_count}/{total_files} files zipped to {zip_path}")

        return {
            "status": "completed",
            "total": total_files,
            "completed": file_count,
            "zip_path": zip_path,
            "zip_filename": zip_filename
        }

    except Exception as e:
        print(f"❌ [Vault Download] Error: {e}")
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "failed",
            "error": str(e)
        })
        # Clean up zip file on failure
        if 'zip_path' in locals() and os.path.exists(zip_path):
            try:
                os.remove(zip_path)
                print(f"🗑️ Cleaned up failed zip file: {zip_path}")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup error: {cleanup_error}")
        raise e

# --- HAVEN APP DATA DOWNLOAD WORKER ---
@celery_app.task(bind=True, name="create_haven_app_data_zip")
def task_create_haven_app_data_zip(self, task_id: str, storage_path: str):
    """
    Background job to create a zip file for the entire Haven App Data storage_path.
    Persists progress in Redis under download_task:{task_id}
    """
    try:
        if not storage_path or not os.path.exists(storage_path):
            raise Exception("Storage path not configured or not found")

        # Check for cancellation before starting
        task_status = redis_client.hget(f"download_task:{task_id}", "status")
        if task_status and task_status.decode('utf-8') == 'cancelled':
            print(f"🛑 [App Data Download] Task cancelled before starting")
            return {"status": "cancelled", "message": "Task cancelled by user"}

        # Define the three directories to process
        dirs_to_process = ["thumbnails", "raw_previews", "raw_thumbnails", "video_previews", "video_thumbnails"]
        
        # Count total files upfront using os.listdir
        total_files = 0
        file_lists = {}
        for dir_name in dirs_to_process:
            dir_path = os.path.join(storage_path, dir_name)
            file_lists[dir_name] = []
            if os.path.exists(dir_path) and os.path.isdir(dir_path):
                # List all files in the directory
                # files = [f for f in os.listdir(dir_path) 
                #         if os.path.isfile(os.path.join(dir_path, f))]
                # file_lists[dir_name] = files
                # total_files += len(files)
                with os.scandir(dir_path) as entries:
                    for entry in entries:
                        if entry.is_file():
                            file_lists[dir_name].append(entry.name)
                            total_files += 1
            else:
                file_lists[dir_name] = []

        if total_files == 0:
            raise Exception("No files found in Haven App Data")

        print(f"📊 [App Data Download] Found {total_files} files to zip")

        # Check for cancellation again after counting files
        task_status = redis_client.hget(f"download_task:{task_id}", "status")
        if task_status and task_status.decode('utf-8') == 'cancelled':
            print(f"🛑 [App Data Download] Task cancelled after file counting")
            return {"status": "cancelled", "message": "Task cancelled by user"}

        # Store initial state in Redis with total count
        zip_filename = f"haven_app_data_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.zip"
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "in_progress",
            "total": total_files,
            "completed": 0,
            "progress": 0,
            "zip_filename": zip_filename
        })
        redis_client.expire(f"download_task:{task_id}", 7200)  # 2 hours

        # Prepare zip
        zip_path = os.path.join(DOWNLOAD_PATH, zip_filename)

        # Keep original folder structure inside the zip
        root_name = os.path.basename(os.path.abspath(storage_path.rstrip(os.sep)))
        file_count = 0
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_STORED, allowZip64=True) as zipf:
            # Process each directory
            for dir_name in dirs_to_process:
                dir_path = os.path.join(storage_path, dir_name)
                if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
                    continue

                # Cancellation check before processing each directory
                task_status = redis_client.hget(f"download_task:{task_id}", "status")
                if task_status and task_status.decode('utf-8') == 'cancelled':
                    if os.path.exists(zip_path):
                        try:
                            os.remove(zip_path)
                        except Exception:
                            pass
                    return {"status": "cancelled", "message": "Task cancelled by user"}

                # Process files in this directory
                for filename in file_lists[dir_name]:
                    # Cancellation check before each file
                    task_status = redis_client.hget(f"download_task:{task_id}", "status")
                    if task_status and task_status.decode('utf-8') == 'cancelled':
                        if os.path.exists(zip_path):
                            try:
                                os.remove(zip_path)
                            except Exception:
                                pass
                        return {"status": "cancelled", "message": "Task cancelled by user"}

                    try:
                        full_path = os.path.join(dir_path, filename)
                        # Preserve folder structure: root_name/dir_name/filename
                        arcname = os.path.join(root_name, dir_name, filename)
                        zipf.write(full_path, arcname=arcname)
                        
                        file_count += 1

                        print(f"✅ [App Data Download] Added {dir_name}/{filename} ({file_count}/{total_files})")
                        
                        # Update progress 
                        progress = int((file_count / total_files) * 100)
                        redis_client.hset(f"download_task:{task_id}", mapping={
                            "completed": file_count,
                            "progress": progress
                        })
                    except Exception as file_error:
                        # Skip problematic file but continue
                        print(f"⚠️ [App Data Download] Failed to add {dir_name}/{filename}: {file_error}")

        # Final update with actual total
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "completed",
            "completed": file_count,
            "total": total_files,
            "progress": 100,
            "zip_path": zip_path,
            "zip_filename": zip_filename
        })

        print(f"🏁 [App Data Download] Complete: {file_count}/{total_files} files zipped to {zip_path}")

        return {
            "status": "completed",
            "total": total_files,
            "completed": file_count,
            "zip_path": zip_path,
            "zip_filename": zip_filename
        }

    except Exception as e:
        print(f"❌ [App Data Download] Error: {e}")
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "failed",
            "error": str(e)
        })
        # Clean up zip file on failure
        if 'zip_path' in locals() and os.path.exists(zip_path):
            try:
                os.remove(zip_path)
                print(f"🗑️ Cleaned up failed zip file: {zip_path}")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup error: {cleanup_error}")
        raise e


# --- HAVEN METADATA DOWNLOAD WORKER ---
@celery_app.task(bind=True, name="create_haven_metadata_zip")
def task_create_haven_metadata_zip(self, task_id: str):
    """
    Background job to export all database tables to CSV and zip them.
    Persists progress in Redis under download_task:{task_id}
    """
    try:
        # Check for cancellation before starting
        task_status = redis_client.hget(f"download_task:{task_id}", "status")
        if task_status and task_status.decode('utf-8') == 'cancelled':
            print(f"🛑 [Metadata Download] Task cancelled before starting")
            return {"status": "cancelled", "message": "Task cancelled by user"}

        # Setup DB engine
        engine = SessionLocal().get_bind()
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        total_tables = len(table_names)
        if total_tables == 0:
            raise Exception("No tables found in database")

        print(f"📊 [Metadata Download] Found {total_tables} tables to export")

        # Check for cancellation again after getting table list
        task_status = redis_client.hget(f"download_task:{task_id}", "status")
        if task_status and task_status.decode('utf-8') == 'cancelled':
            print(f"🛑 [Metadata Download] Task cancelled after getting table list")
            return {"status": "cancelled", "message": "Task cancelled by user"}

        # Store initial state in Redis
        zip_filename = f"haven_metadata_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.zip"
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "in_progress",
            "total": total_tables,
            "completed": 0,
            "progress": 0,
            "zip_filename": zip_filename
        })
        redis_client.expire(f"download_task:{task_id}", 7200)  # 2 hours

        zip_path = os.path.join(DOWNLOAD_PATH, zip_filename)

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_STORED, allowZip64=True) as zipf:
            for idx, table_name in enumerate(table_names, 1):
                # Cancellation check
                task_status = redis_client.hget(f"download_task:{task_id}", "status")
                if task_status and task_status.decode('utf-8') == 'cancelled':
                    if os.path.exists(zip_path):
                        try:
                            os.remove(zip_path)
                        except Exception:
                            pass
                    return {"status": "cancelled", "message": "Task cancelled by user"}

                try:
                    # Export table to CSV in memory (temp file)
                    temp_csv_fd, temp_csv_path = tempfile.mkstemp(suffix=".csv")
                    os.close(temp_csv_fd)
                    with open(temp_csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                        writer = csv.writer(csvfile)
                        # Write header
                        cols = [col["name"] for col in inspector.get_columns(table_name)]
                        writer.writerow(cols)
                        # Stream rows
                        with engine.connect() as conn:
                            result = conn.execute(text(f"SELECT * FROM \"{table_name}\""))
                            for row in result:
                                writer.writerow(row)
                    # Add to zip
                    zipf.write(temp_csv_path, arcname=f"{table_name}.csv")
                    os.remove(temp_csv_path)

                    progress = int((idx / total_tables) * 100)
                    redis_client.hset(f"download_task:{task_id}", mapping={
                        "completed": idx,
                        "progress": progress
                    })
                    print(f"✅ [Metadata Download] Exported table {table_name} ({idx}/{total_tables})")
                except Exception as file_error:
                    print(f"⚠️ [Metadata Download] Failed to export {table_name}: {file_error}")
                    # continue with other tables

        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "completed",
            "completed": total_tables,
            "total": total_tables,
            "progress": 100,
            "zip_path": zip_path,
            "zip_filename": zip_filename
        })

        print(f"🏁 [Metadata Download] Complete: {total_tables} tables zipped to {zip_path}")

        return {
            "status": "completed",
            "total": total_tables,
            "completed": total_tables,
            "zip_path": zip_path,
            "zip_filename": zip_filename
        }

    except Exception as e:
        print(f"❌ [Metadata Download] Error: {e}")
        redis_client.hset(f"download_task:{task_id}", mapping={
            "status": "failed",
            "error": str(e)
        })
        # Clean up zip file on failure
        if 'zip_path' in locals() and os.path.exists(zip_path):
            try:
                os.remove(zip_path)
                print(f"🗑️ Cleaned up failed zip file: {zip_path}")
            except Exception as cleanup_error:
                print(f"⚠️ Cleanup error: {cleanup_error}")
        raise e
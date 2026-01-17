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

# Redis Connection for Locking (Same URL as Celery)
redis_client = redis.from_url(settings.REDIS_URL)
LOCK_KEY = "haven_scan_lock"

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
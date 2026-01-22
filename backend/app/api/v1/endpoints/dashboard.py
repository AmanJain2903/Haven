from app.core.constants import HOT_STORAGE_FOLDERS
from app.core.database import get_db
from app.core.config import settings
from app.tasks import redis_client
from app import models

from fastapi import Depends, APIRouter, HTTPException
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
import shutil
import uuid
import os

backend_url = settings.HOST_URL

router = APIRouter()

# GET HOT STORAGE PATH
@router.get("/hot_storage_path", response_model=str)
def get_hot_storage_path():
    """
    Gets the hot storage path from the settings.
    """
    return settings.APP_DATA_DIR

# GET STORAGE PATH
@router.get("/storage_path", response_model=str)
def get_storage_path(db: Session = Depends(get_db)):
    """
    Gets the storage path from the database.
    """
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == "storage_path").first()
    if not config:
        return None
    return config.value

# CHECK PATH EXISTENCE
@router.get("/check_path_existence", response_model=bool)
def check_path_existence(path: str):
    """
    Checks if the path exists on the system.
    """
    return os.path.exists(path)

# GET HAVEN VAULT DISK INFORMATION
@router.get("/disk_information", response_model=dict)
def get_disk_information(path: str):
    """
    Gets the disk information for the given path.
    """
    if not path or not os.path.exists(path):
        return {
            "total_space": None,
            "used_space": None,
            "available_space": None
        }
    return {
        "total_space": shutil.disk_usage(path).total,
        "used_space": shutil.disk_usage(path).used,
        "available_space": shutil.disk_usage(path).free
    }

# GET HAVEN APP DATA DISK INFORMATION
@router.get("/app_data_size", response_model=int)
def get_app_data_size():
    """
    Gets the app data disk information for the given path.
    """
    path = settings.APP_DATA_DIR
    if not path or not os.path.exists(path):
        return 0
    total_size = 0
    for folder in HOT_STORAGE_FOLDERS:
        folder_path = os.path.join(path, folder)
        if os.path.exists(folder_path):
            total_size += sum(os.path.getsize(os.path.join(folder_path, file)) for file in os.listdir(folder_path))
    return total_size

# GET DATA BREAKDOWN FROM HAVEN VAULT
@router.get("/data_breakdown", response_model=dict)
def get_data_breakdown(path: str):
    """
    Gets the data breakdown from the haven vault.
    """
    if not path or not os.path.exists(path):
        return {
            "images_count": None,
            "videos_count": None,
            "raw_count": None,
            "total_count": None,
            "images_size": None,
            "videos_size": None,
            "raw_size": None,
            "total_size": None
        }
    images_path = os.path.join(path, "images")
    videos_path = os.path.join(path, "videos")
    raw_path = os.path.join(path, "raw")
    images_count = None
    videos_count = None
    raw_count = None
    total_count = None
    images_size = None
    videos_size = None
    raw_size = None
    total_size = None
    if os.path.exists(images_path):
        images_count = len(os.listdir(images_path))
        images_size = sum(os.path.getsize(os.path.join(images_path, file)) for file in os.listdir(images_path))
    if os.path.exists(videos_path):
        videos_count = len(os.listdir(videos_path))
        videos_size = sum(os.path.getsize(os.path.join(videos_path, file)) for file in os.listdir(videos_path))
    if os.path.exists(raw_path):
        raw_count = len(os.listdir(raw_path))
        raw_size = sum(os.path.getsize(os.path.join(raw_path, file)) for file in os.listdir(raw_path))
    total_count = images_count + videos_count + raw_count
    total_size = images_size + videos_size + raw_size
    return {
        "images_count": images_count,
        "videos_count": videos_count,
        "raw_count": raw_count,
        "total_count": total_count,
        "images_size": images_size,
        "videos_size": videos_size,
        "raw_size": raw_size,
        "total_size": total_size
    }

# GET PROCESSED FILES INFORMATION
@router.get("/processed_files_information", response_model=dict)
def get_processed_files_information(db: Session = Depends(get_db)):
    """
    Gets the processed files information from the haven vault.
    """
        
    try:
        albums_count = db.query(models.Albums).count()
        processed_images_count = db.query(models.Image).count()
        processed_videos_count = db.query(models.Video).count()
        processed_raw_count = db.query(models.RawImage).count()
        processed_total_files_count = processed_images_count + processed_videos_count + processed_raw_count
        images = db.query(models.Image).all()
        videos = db.query(models.Video).all()
        raw_images = db.query(models.RawImage).all()
        processed_total_files_size = sum(image.file_size for image in images) + sum(video.file_size for video in videos) + sum(raw_image.file_size for raw_image in raw_images)
        return {
            "albums_count": albums_count,
            "processed_images_count": processed_images_count,
            "processed_videos_count": processed_videos_count,
            "processed_raw_count": processed_raw_count,
            "processed_total_files_count": processed_total_files_count,
            "processed_total_files_size": processed_total_files_size
        }
    except Exception as e:
        return {
            "albums_count": None,
            "processed_images_count": None,
            "processed_videos_count": None,
            "processed_raw_count": None,
            "processed_total_files_count": None,
            "processed_total_files_size": None
            }

# GET METADATA INFORMATION
@router.get("/metadata_information", response_model=dict)
def get_metadata_information(db: Session = Depends(get_db)):
    engine = db.get_bind()
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    meta = {
        "total_tables": len(table_names),
        "total_size_bytes": 0,
        "tables": {}
    }

    for table_name in table_names:
        # Quote table name safely for Postgres identifiers
        # (this is fine if table_name comes from inspector)
        count = db.execute(text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar() or 0

        # Postgres size on disk (table + indexes + toast)
        size_bytes = db.execute(
            text("SELECT pg_total_relation_size(:relname)"),
            {"relname": f'"{table_name}"'}
        ).scalar() or 0

        meta["tables"][table_name] = {
            "count": int(count),
            "size_bytes": int(size_bytes),
        }
        meta["total_size_bytes"] += int(size_bytes)

    return meta


# START HAVEN DOWNLOAD TASK
@router.post("/download")
def start_download(downloadType: str = "default", db: Session = Depends(get_db)):
    """
    Starts a background task to zip the entire Haven Vault.
    """
    # Fetch storage path
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == "storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=400, detail="Storage path not configured")
    
    storage_path = config.value
    if not os.path.exists(storage_path):
        raise HTTPException(status_code=400, detail="Storage path does not exist")
    
    app_data_path = settings.APP_DATA_DIR
    if not app_data_path or not os.path.exists(app_data_path):
        raise HTTPException(status_code=400, detail="App data path not configured or does not exist")
    
    task_id = str(uuid.uuid4())
    
    # Trigger Celery task
    from app.tasks import task_create_haven_vault_zip, task_create_haven_app_data_zip, task_create_haven_metadata_zip
    if downloadType == "vault":
        task_create_haven_vault_zip.delay(task_id, storage_path)
    elif downloadType == "app_data":
        task_create_haven_app_data_zip.delay(task_id, app_data_path)
    elif downloadType == "metadata":
        task_create_haven_metadata_zip.delay(task_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid download type")
    
    return {"task_id": task_id}

# GET HAVEN DOWNLOAD TASK STATUS
@router.get("/download_task_status/{task_id}")
def get_download_task_status(task_id: str):
    data = redis_client.hgetall(f"download_task:{task_id}")
    if not data:
        return {"status": "not_found"}
    
    def decode(key, default=None, cast_type=None):
        val = data.get(key.encode("utf-8"))
        if val is None:
            return default
        decoded = val.decode("utf-8")
        if cast_type:
            try:
                return cast_type(decoded)
            except Exception:
                return default
        return decoded
    
    return {
        "status": decode("status", "unknown"),
        "total": decode("total", 0, int),
        "completed": decode("completed", 0, int),
        "progress": decode("progress", 0, int),
        "zip_path": decode("zip_path"),
        "zip_filename": decode("zip_filename"),
    }

# CLEANUP HAVEN DOWNLOAD TASK
@router.delete("/cleanup_download/{task_id}")
def cleanup_download(task_id: str):
    """
    Manually cleanup download file and Redis entry. Only use for cancelled/failed tasks.
    """
    data = redis_client.hgetall(f"download_task:{task_id}")
    if data:
        zip_path = data.get(b"zip_path")
        if zip_path:
            zip_path = zip_path.decode("utf-8")
            if os.path.exists(zip_path):
                try:
                    os.remove(zip_path)
                    print(f"🗑️ Cleaned up zip file: {zip_path}")
                except Exception as e:
                    print(f"⚠️ Cleanup error: {e}")
        redis_client.delete(f"download_task:{task_id}")
    return {"status": "cleaned"}

# CANCEL HAVEN DOWNLOAD TASK
@router.post("/cancel_download/{task_id}")
def cancel_download(task_id: str):
    """
    Cancels the download task and cleans up the zip file.
    """
    try:
        from app.core.celery_app import celery_app
        
        # First, update Redis status to cancelled (task will check this)
        data = redis_client.hgetall(f"download_task:{task_id}")
        if data:
            redis_client.hset(f"download_task:{task_id}", "status", "cancelled")
            print(f"📝 [Cancel] Set Redis status to cancelled for task: {task_id}")
            
            # Try to revoke the Celery task
            try:
                # Revoke with terminate=True to kill the task
                celery_app.control.revoke(task_id, terminate=True, signal='SIGTERM')
                print(f"🚫 [Cancel] Revoked Celery task (SIGTERM): {task_id}")
                import time
                time.sleep(0.5)
                celery_app.control.revoke(task_id, terminate=True, signal='SIGKILL')
                print(f"🚫 [Cancel] Revoked Celery task (SIGKILL): {task_id}")
            except Exception as revoke_error:
                print(f"⚠️ [Cancel] Error revoking task (may already be completed): {revoke_error}")
            
            # Clean up partial zip file if exists
            zip_path = data.get(b"zip_path")
            if zip_path:
                zip_path = zip_path.decode("utf-8")
                if os.path.exists(zip_path):
                    try:
                        os.remove(zip_path)
                        print(f"🗑️ [Cancel] Deleted partial zip file: {zip_path}")
                    except Exception as file_error:
                        print(f"⚠️ [Cancel] Could not delete zip file: {file_error}")
            
            # Keep Redis entry for a short time so task can see cancellation
            # Set a short TTL (30 seconds) so it auto-cleans up
            redis_client.expire(f"download_task:{task_id}", 30)
            
        return {"status": "cancelled", "task_id": task_id}
    except Exception as e:
        print(f"❌ [Cancel] Error cancelling vault download: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from app.core.celery_app import celery_app
from app.services.image_processor import process_image_file
import redis
import os
from app.core.database import SessionLocal
from app.core.config import settings
from app.models import SystemConfig
from app.services.video_processor import process_video_file 
# from app.services.raw_processor import process_raw_file      <-- Future

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
@celery_app.task(name="process_image", bind=True, max_retries=3)
def task_process_image(self, full_path: str, filename: str):
    """
    Background job to process a single image.
    """
    try:
        print(f"📷 [Worker] Processing Image: {filename}")
        # This calls the logic you already wrote/refactored
        process_image_file(full_path, filename)
        return f"Success: {filename}"
    except Exception as e:
        print(f"❌ [Worker] Failed: {filename} | Error: {e}")
        # Retry in 10s if it fails (e.g. DB locked)
        self.retry(exc=e, countdown=10)

# --- VIDEO WORKER ---
@celery_app.task(bind=True, max_retries=3, name="process_video")
def task_process_video(self, full_path: str, filename: str):
    try:
        print(f"🎥 [Worker] Processing Video: {filename}")
        process_video_file(full_path, filename)
        return f"Success: {filename}"
    except Exception as e:
        print(f"❌ [Worker] Video Failed: {filename} | {e}")
        self.retry(exc=e, countdown=20)

# --- RAW WORKER (Placeholder) ---
@celery_app.task(name="process_raw")
def task_process_raw(full_path: str, filename: str):
    print(f"🎞️ [Worker] RAW processing not implemented yet: {filename}")
    return "Skipped"
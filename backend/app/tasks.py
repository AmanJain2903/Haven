from app.core.celery_app import celery_app
from app.services.image_processor import process_image_file
# from app.services.video_processor import process_video_file  <-- Future
# from app.services.raw_processor import process_raw_file      <-- Future

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

# --- VIDEO WORKER (Placeholder) ---
@celery_app.task(name="process_video")
def task_process_video(full_path: str, filename: str):
    print(f"🎥 [Worker] Video processing not implemented yet: {filename}")
    return "Skipped"

# --- RAW WORKER (Placeholder) ---
@celery_app.task(name="process_raw")
def task_process_raw(full_path: str, filename: str):
    print(f"🎞️ [Worker] RAW processing not implemented yet: {filename}")
    return "Skipped"
import os
from sqlalchemy.orm import Session
from app.models import Image, Video
from app.tasks import task_process_image, task_process_video, task_process_raw

# Define extensions for routing
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.tiff', '.tif', '.heic', '.heif'}
VIDEO_EXTS = {'.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.mts', '.m2ts', '.3gp', '.3g2', '.wmv', '.flv', '.ogv'}
RAW_EXTS   = {'.arw', '.cr2', '.nef', '.dng'}

def scan_directory_flat(storage_root: str, db: Session):
    """
    Scans the 'images', 'videos', and 'raw' folders.
    Dispatches tasks based on file type.
    """
    # 1. Scan Images Folder
    images_dir = os.path.join(storage_root, "images")
    if os.path.exists(images_dir):
        # Fetch existing filenames to avoid duplicates
        existing_images = {img.filename for img in db.query(Image.filename).all()}
        
        print(f"🚀 Scanning Images: {images_dir}")
        for filename in os.listdir(images_dir):
            ext = os.path.splitext(filename)[1].lower()
            
            if ext in IMAGE_EXTS:
                if filename in existing_images:
                    continue # Skip duplicate
                
                full_path = os.path.join(images_dir, filename)
                # DISPATCH TO CELERY
                task_process_image.delay(full_path, filename)

    # 2. Scan Videos Folder (Placeholder Logic)
    videos_dir = os.path.join(storage_root, "videos")
    if os.path.exists(videos_dir):
        # Get existing video filenames from DB to avoid duplicates
        existing_videos = {v.filename for v in db.query(Video.filename).all()}
        
        print(f"🚀 Scanning Videos: {videos_dir}")
        for filename in os.listdir(videos_dir):
            ext = os.path.splitext(filename)[1].lower()
            if ext in VIDEO_EXTS:
                if filename in existing_videos:
                    continue 
                
                full_path = os.path.join(videos_dir, filename)
                # Dispatch to the video worker
                task_process_video.delay(full_path, filename)

    # 3. Scan RAW Folder (Placeholder Logic)
    raw_dir = os.path.join(storage_root, "raw")
    if os.path.exists(raw_dir):
        print(f"🚀 Scanning RAW: {raw_dir}")
        for filename in os.listdir(raw_dir):
            ext = os.path.splitext(filename)[1].lower()
            if ext in RAW_EXTS:
                full_path = os.path.join(raw_dir, filename)
                task_process_raw.delay(full_path, filename)

    return "Scan Initiated"
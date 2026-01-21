import os
from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, case
from app.core.database import get_db
from app import models
from fastapi.responses import FileResponse
from fastapi import HTTPException
from typing import List
import hashlib
from app.core.config import settings

backend_url = settings.HOST_URL

router = APIRouter()

@router.get("/", response_model=List[dict])
def get_raw_images(response: Response, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Fetch a list of raw images to display in the grid.
    """
    # FORCE NO CACHE for the API JSON list
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    raw_images = db.query(models.RawImage).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    # Transform to JSON
    return [
        {
            "id": raw.id,
            "filename": raw.filename,
            "is_favorite": raw.is_favorite,
            "extension": raw.extension,
            "thumbnail_url": f"{backend_url}/api/v1/raw_images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "preview_url": f"{backend_url}/api/v1/raw_images/preview/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "raw_url": f"{backend_url}/api/v1/raw_images/file/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "date": raw.capture_date,
            "latitude": raw.latitude,
            "longitude": raw.longitude,
            "city": raw.city,
            "state": raw.state,
            "country": raw.country,
            "width": raw.width,
            "height": raw.height,
            "megapixels": raw.megapixels,
            "metadata": {
                "camera_make": raw.camera_make,
                "camera_model": raw.camera_model,
                "lens_make": raw.lens_make,
                "lens_model": raw.lens_model,
                "exposure_time": raw.exposure_time,
                "f_number": raw.f_number,
                "iso": raw.iso,
                "focal_length": raw.focal_length,
                "flash_fired": raw.flash_fired,
                "size_bytes": raw.file_size
            }
        }
        for raw in raw_images
    ]

@router.get("/details/{raw_image_id}", response_model=dict)
def get_raw_image_details(raw_image_id: int, db: Session = Depends(get_db)):
    """
    Fetch detailed info for a specific raw image by ID.
    """
    raw = db.query(models.RawImage).filter(models.RawImage.id == raw_image_id).first()
    
    if not raw:
        raise HTTPException(status_code=404, detail="Raw image not found")
    
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    return {
        "id": raw.id,
        "filename": raw.filename,
        "is_favorite": raw.is_favorite,
        "extension": raw.extension,
        "thumbnail_url": f"{backend_url}/api/v1/raw_images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
        "preview_url": f"{backend_url}/api/v1/raw_images/preview/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
        "raw_url": f"{backend_url}/api/v1/raw_images/file/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
        "date": raw.capture_date,
        "latitude": raw.latitude,
        "longitude": raw.longitude,
        "city": raw.city,
        "state": raw.state,
        "country": raw.country,
        "width": raw.width,
        "height": raw.height,
        "megapixels": raw.megapixels,
        "metadata": {
            "camera_make": raw.camera_make,
            "camera_model": raw.camera_model,
            "lens_make": raw.lens_make,
            "lens_model": raw.lens_model,
            "exposure_time": raw.exposure_time,
            "f_number": raw.f_number,
            "iso": raw.iso,
            "focal_length": raw.focal_length,
            "flash_fired": raw.flash_fired,
            "size_bytes": raw.file_size
        }
    }

@router.get("/file/{raw_image_id}")
def get_raw_image_file(raw_image_id: int, db: Session = Depends(get_db)):
    """
    Serve the actual RAW file for download.
    This sends the original RAW file (e.g., .arw, .cr2, .nef, .dng)
    """
    raw = db.query(models.RawImage).filter(models.RawImage.id == raw_image_id).first()
    
    if not raw:
        raise HTTPException(status_code=404, detail="Raw image not found")
    
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    filePath = os.path.join(config.value, 'raw', raw.filename)
    
    if not os.path.exists(filePath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    # Serve the original RAW file with CORS headers and download disposition
    response = FileResponse(
        filePath,
        media_type="application/octet-stream",
        filename=raw.filename
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Content-Disposition"] = f'attachment; filename="{raw.filename}"'
    return response

@router.get("/preview/{raw_image_id}")
def get_raw_preview_file(raw_image_id: int, db: Session = Depends(get_db)):
    """
    Serve a JPEG preview of the RAW image.
    The processor should have generated a preview during processing.
    If preview doesn't exist, return 404 (don't fallback to RAW as browsers can't display it).
    """
    raw = db.query(models.RawImage).filter(models.RawImage.id == raw_image_id).first()
    
    if not raw:
        raise HTTPException(status_code=404, detail="Raw image not found")
    
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    # Construct expected preview path (e.g., preview_hash.jpg)
    path_hash = hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()
    preview_filename = f"preview_{path_hash}.jpg"
    preview_path = os.path.join(settings.RAW_PREVIEW_DIR, preview_filename)
    
    if os.path.exists(preview_path):
        return FileResponse(preview_path)
    
    # If preview doesn't exist, return 404
    # (Don't fallback to RAW file as browsers can't display it)
    raise HTTPException(status_code=404, detail="Preview not found. File may still be processing.")

@router.get("/thumbnail/{raw_image_id}")
def get_raw_thumbnail_file(raw_image_id: int, db: Session = Depends(get_db)):
    """
    Serve the small thumbnail version of the raw image.
    """
    raw = db.query(models.RawImage).filter(models.RawImage.id == raw_image_id).first()
    
    if not raw:
        raise HTTPException(status_code=404, detail="Raw image not found")
    
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    # Construct expected thumbnail path
    path_hash = hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()
    thumb_filename = f"thumb_{path_hash}.jpg"
    thumb_path = os.path.join(settings.RAW_THUMBNAIL_DIR, thumb_filename)
    
    # If thumbnail exists, serve it
    if os.path.exists(thumb_path):
        return FileResponse(thumb_path)
    
    # Fallback: Return 404 if thumbnail doesn't exist
    # (RAW files can't be displayed directly in browsers)
    raise HTTPException(status_code=404, detail="Thumbnail not found. File may still be processing.")

@router.get("/timeline", response_model=List[dict])
def get_raw_timeline(
    response: Response,
    skip: int = 0, 
    limit: int = 500,
    db: Session = Depends(get_db)
):
    """
    Fetch raw images for timeline view with proper sorting.
    """
    # FORCE NO CACHE 
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

    # Get Total Count
    total_count = db.query(models.RawImage).count()
    response.headers["X-Total-Count"] = str(total_count)
    
    # Sort Logic: Dates first (Newest to Oldest), then Nulls last
    raw_images = db.query(models.RawImage).order_by(
        case(
            (models.RawImage.capture_date != None, 0),
            else_=1
        ),
        desc(models.RawImage.capture_date),
        desc(models.RawImage.id)
    ).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    return [
        {
            "id": raw.id,
            "filename": raw.filename,
            "is_favorite": raw.is_favorite,
            "extension": raw.extension,
            "thumbnail_url": f"{backend_url}/api/v1/raw_images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "preview_url": f"{backend_url}/api/v1/raw_images/preview/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "raw_url": f"{backend_url}/api/v1/raw_images/file/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "date": raw.capture_date,
            "latitude": raw.latitude,
            "longitude": raw.longitude,
            "city": raw.city,
            "state": raw.state,
            "country": raw.country,
            "width": raw.width,
            "height": raw.height,
            "megapixels": raw.megapixels,
            "metadata": {
                "camera_make": raw.camera_make,
                "camera_model": raw.camera_model,
                "lens_make": raw.lens_make,
                "lens_model": raw.lens_model,
                "exposure_time": raw.exposure_time,
                "f_number": raw.f_number,
                "iso": raw.iso,
                "focal_length": raw.focal_length,
                "flash_fired": raw.flash_fired,
                "size_bytes": raw.file_size
            }
        }
        for raw in raw_images
    ]

@router.delete("/delete/{raw_image_id}")
def delete_raw_image(raw_image_id: int, db: Session = Depends(get_db)):
    """
    Delete a raw image file from both cold storage and hot storage (thumbnails & previews), then remove from database.
    Also removes the raw image from any albums it's part of.
    """
    # 1. Get the raw image from database
    raw = db.query(models.RawImage).filter(models.RawImage.id == raw_image_id).first()
    if not raw:
        raise HTTPException(status_code=404, detail="Raw image not found")
    
    # 2. Remove from all albums first
    albums = db.query(models.Albums).filter(models.Albums.album_raw_images_ids.contains([raw_image_id])).all()
    for album in albums:
        # Remove this raw image ID from the array
        album.album_raw_images_ids = [raw_id for raw_id in album.album_raw_images_ids if raw_id != raw_image_id]
        album.album_raw_images_count -=1
        album.album_total_count -=1
        # If this was the cover, clear it
        if album.album_cover_type == 'raw' and album.album_cover_id == raw_image_id:
            album.album_cover_type = None
            album.album_cover_id = None
    db.commit()
    
    # 3. Get storage paths
    cold_storage = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    hot_storage = settings.APP_DATA_DIR
    
    if not cold_storage or not cold_storage.value:
        raise HTTPException(status_code=503, detail="Cold storage path not configured")
    if not hot_storage:
        raise HTTPException(status_code=503, detail="Hot storage path not configured")
    
    # 4. Delete original file from cold storage (storagePath/raw/)
    cold_file_path = os.path.join(cold_storage.value, 'raw', raw.filename)
    if os.path.exists(cold_file_path):
        try:
            os.remove(cold_file_path)
            print(f"Deleted cold storage file: {cold_file_path}")
        except Exception as e:
            print(f"Error deleting cold storage file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete original file: {str(e)}")
    
    # 5. Delete hot storage files (thumbnails and previews)
    # Thumbnails are named: thumb_{hash}.jpg
    # Previews are named: preview_{hash}.jpg (for RAWs, preview is a large JPG)
    path_hash = hashlib.md5(cold_file_path.encode('utf-8')).hexdigest()
    thumb_filename = f"thumb_{path_hash}.jpg"
    preview_filename = f"preview_{path_hash}.jpg"
    
    thumbnail_dir = os.path.join(hot_storage, "raw_thumbnails")
    preview_dir = os.path.join(hot_storage, "raw_previews")
    
    thumb_path = os.path.join(thumbnail_dir, thumb_filename)
    preview_path = os.path.join(preview_dir, preview_filename)
    
    # Delete thumbnail
    if os.path.exists(thumb_path):
        try:
            os.remove(thumb_path)
            print(f"Deleted thumbnail: {thumb_path}")
        except Exception as e:
            print(f"Error deleting thumbnail: {e}")
    
    # Delete preview
    if os.path.exists(preview_path):
        try:
            os.remove(preview_path)
            print(f"Deleted preview: {preview_path}")
        except Exception as e:
            print(f"Error deleting preview: {e}")
    
    # 6. Delete from database
    try:
        db.delete(raw)
        db.commit()
        print(f"Deleted raw image from database: {raw.filename}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete from database: {str(e)}")
    
    return {"success": True, "message": f"Raw image {raw.filename} deleted successfully"}

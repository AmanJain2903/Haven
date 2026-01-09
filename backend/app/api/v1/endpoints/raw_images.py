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
            "extension": raw.extension,
            "thumbnail_url": f"{backend_url}/api/v1/raw-images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "preview_url": f"{backend_url}/api/v1/raw-images/preview/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "raw_url": f"{backend_url}/api/v1/raw-images/file/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
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
        "extension": raw.extension,
        "thumbnail_url": f"{backend_url}/api/v1/raw-images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
        "preview_url": f"{backend_url}/api/v1/raw-images/preview/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
        "raw_url": f"{backend_url}/api/v1/raw-images/file/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
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
    
    # Serve the original RAW file
    return FileResponse(filePath)

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
            "extension": raw.extension,
            "thumbnail_url": f"{backend_url}/api/v1/raw-images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "preview_url": f"{backend_url}/api/v1/raw-images/preview/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "raw_url": f"{backend_url}/api/v1/raw-images/file/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
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

@router.get("/map-data", response_model=List[dict])
def get_raw_map_data(db: Session = Depends(get_db)):
    """
    Fetches ALL geotagged raw images but ONLY the fields needed for map pins.
    Lightweight for rendering thousands of pins.
    """
    # Filter only raw images with GPS
    query = db.query(models.RawImage).filter(
        models.RawImage.latitude != None,
        models.RawImage.longitude != None
    ).order_by(
        case(
            (models.RawImage.capture_date != None, 0),
            else_=1
        ),
        desc(models.RawImage.capture_date),
        desc(models.RawImage.id)
    )
    
    # Select specific columns to reduce payload size
    results = query.with_entities(
        models.RawImage.id,
        models.RawImage.latitude,
        models.RawImage.longitude,
        models.RawImage.filename
    ).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    # Format response
    response = []
    for raw in results:
        response.append({
            "id": raw.id,
            "latitude": raw.latitude,
            "longitude": raw.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/raw-images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
        })
    
    return response
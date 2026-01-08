import os
from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session, load_only
from sqlalchemy import desc, case
from app.core.database import get_db, engine
from app import models
from fastapi.responses import FileResponse
from fastapi import HTTPException
from typing import List
from PIL import Image
import pillow_heif
import io
import hashlib
from app.core.config import settings


backend_url = settings.HOST_URL

router = APIRouter()

@router.get("/", response_model=List[dict])
def get_images(response: Response,skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Fetch a list of images to display in the grid.
    """
    # FORCE NO CACHE for the API JSON list
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    images = db.query(models.Image).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    # Transform to JSON
    return [
        {
            "id": img.id,
            "filename": img.filename,
            "thumbnail_url": f"{backend_url}/api/v1/images/thumbnail/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
            "image_url": f"{backend_url}/api/v1/images/file/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for the full image
            "date": img.capture_date,
            "latitude": img.latitude,
            "longitude": img.longitude,
            "city": img.city,
            "state": img.state,
            "country": img.country,
            "width": img.width,
            "height": img.height,
            "megapixels": img.megapixels,
            "metadata": {
                "camera_make": img.camera_make,
                "camera_model": img.camera_model,
                "exposure_time": img.exposure_time,
                "f_number": img.f_number,
                "iso": img.iso,
                "focal_length": img.focal_length,
                "size_bytes": img.file_size
        }
            
        }
        for img in images
    ]

@router.get("/details/{image_id}", response_model=dict)
def get_image_details(image_id: int, db: Session = Depends(get_db)):
    """
    Fetch detailed info for a specific image by ID.
    """
    img = db.query(models.Image).filter(models.Image.id == image_id).first()
    
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    return {
        "id": img.id,
        "filename": img.filename,
        "thumbnail_url": f"{backend_url}/api/v1/images/thumbnail/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
        "image_url": f"{backend_url}/api/v1/images/file/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for the full image
        "date": img.capture_date,
        "latitude": img.latitude,
        "longitude": img.longitude,
        "city": img.city,
        "state": img.state,
        "country": img.country,
        "width": img.width,
        "height": img.height,
        "megapixels": img.megapixels,
        "metadata": {
            "camera_make": img.camera_make,
            "camera_model": img.camera_model,
            "exposure_time": img.exposure_time,
            "f_number": img.f_number,
            "iso": img.iso,
            "focal_length": img.focal_length,
            "size_bytes": img.file_size
        }
    }

@router.get("/file/{image_id}")
def get_image_file(image_id: int, db: Session = Depends(get_db)):
    """
    Serve the actual image file from the hard drive.
    Convert HEIC or HEIF to JPEG on the fly.
    """
    img = db.query(models.Image).filter(models.Image.id == image_id).first()
    
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    filePath = os.path.join(config.value, 'images', img.filename)
        
    # Check if it is an HEIC file
    if filePath.lower().endswith(('.heic', '.heif')):
        try:
            # 1. Open the HEIC file
            heif_file = pillow_heif.read_heif(filePath)
            image = Image.frombytes(
                heif_file.mode, 
                heif_file.size, 
                heif_file.data,
                "raw",
            )
            
            # 2. Convert to JPEG in memory (don't save to disk)
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG', quality=80)
            img_byte_arr = img_byte_arr.getvalue()

            # 3. Return as a JPEG response
            return Response(content=img_byte_arr, media_type="image/jpeg")
            
        except Exception as e:
            print(f"Error converting HEIC: {e}")
            # Fallback: try sending original if conversion fails
            return FileResponse(filePath)

    # For standard images (JPG, PNG), just send the file directly
    return FileResponse(filePath)

@router.get("/thumbnail/{image_id}")
def get_thumbnail_file(image_id: int, db: Session = Depends(get_db)):
    """
    Serve the small thumbnail version of the image.
    """
    img = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404)
    
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
        
    # Construct expected thumbnail path
    path_hash = hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()
    thumb_filename = f"thumb_{path_hash}.jpg"
    thumb_path = os.path.join(settings.THUMBNAIL_DIR, thumb_filename)
    
    # If thumbnail exists, serve it
    if os.path.exists(thumb_path):
        return FileResponse(thumb_path)
    
    # Fallback: If no thumbnail exists, serve the original
    # This prevents broken images if the scan missed one
    return FileResponse(os.path.join(config.value, 'images', img.filename))

@router.get("/timeline", response_model=List[dict])
def get_timeline(
    response: Response,
    skip: int = 0, 
    limit: int = 500, # Larger chunks for virtualization
    db: Session = Depends(get_db)
):
    # FORCE NO CACHE 
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

    # Get Total Count (Fast count of all images)
    total_count = db.query(models.Image).count()
    response.headers["X-Total-Count"] = str(total_count)
    
    # 1. Sort Logic: Dates first (Newest to Oldest), then Nulls last
    # This SQL trickery ensures clean ordering
    images = db.query(models.Image).order_by(
        case(
            (models.Image.capture_date != None, 0), # Dates first
            else_=1 # Nulls last
        ),
        desc(models.Image.capture_date),
        desc(models.Image.id) # Secondary sort for stability
    ).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    # 2. Return Flat List (Transformation happens on client)
    return [
        {
            "id": img.id,
            "filename": img.filename,
            "thumbnail_url": f"{backend_url}/api/v1/images/thumbnail/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
            "image_url": f"{backend_url}/api/v1/images/file/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for the full image
            "date": img.capture_date,
            "latitude": img.latitude,
            "longitude": img.longitude,
            "city": img.city,
            "state": img.state,
            "country": img.country,
            "width": img.width,
            "height": img.height,
            "megapixels": img.megapixels,
            "metadata": {
                "camera_make": img.camera_make,
                "camera_model": img.camera_model,
                "exposure_time": img.exposure_time,
                "f_number": img.f_number,
                "iso": img.iso,
                "focal_length": img.focal_length,
                "size_bytes": img.file_size
        }
            
        }
        for img in images
    ]

@router.get("/map-data", response_model=List[dict])
def get_map_data(db: Session = Depends(get_db)):
    """
    Fetches ALL geotagged images but ONLY the fields needed for pins.
    This is lightweight so we can load thousands of pins without crashing.
    """
    # 1. Filter only images with GPS
    query = db.query(models.Image).filter(
        models.Image.latitude != None,
        models.Image.longitude != None
    ).order_by(
        case(
            (models.Image.capture_date != None, 0), # Dates first
            else_=1 # Nulls last
        ),
        desc(models.Image.capture_date),
        desc(models.Image.id) # Secondary sort for stability
    )
    
    # 2. Select specific columns to reduce payload size (Optimization)
    # We don't need camera models, megapixels, etc. for the map pins
    results = query.with_entities(
        models.Image.id,
        models.Image.latitude,
        models.Image.longitude,
        models.Image.filename
    ).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    # 3. Format response
    response = []
    for img in results:
        response.append({
            "id": img.id,
            "latitude": img.latitude,
            "longitude": img.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/images/thumbnail/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
        })
    
    return response
from app.core.database import get_db
from app.core.config import settings
from app import models


from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse
from sqlalchemy import desc, case
from fastapi import HTTPException
from datetime import datetime
from typing import List
from PIL import Image
import pillow_heif
import hashlib
import io
import os


backend_url = settings.HOST_URL

router = APIRouter()

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
            "is_favorite": img.is_favorite,
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
        "is_favorite": img.is_favorite,
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

@router.delete("/delete/{image_id}")
def delete_image(image_id: int, db: Session = Depends(get_db)):
    """
    Delete an image file from both cold storage and hot storage, then remove from database.
    Also removes the image from any albums it's part of.
    """
    # 1. Get the image from database
    img = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    cold_storage = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    hot_storage = settings.APP_DATA_DIR
    
    if not cold_storage or not cold_storage.value:
        raise HTTPException(status_code=503, detail="Cold storage path not configured")
    if not hot_storage:
        raise HTTPException(status_code=503, detail="Hot storage path not configured")
    
    # 2. Remove from all albums first
    albums = db.query(models.Albums).filter(models.Albums.album_images_ids.contains([image_id])).all()
    for album in albums:
        # Remove this image ID from the array
        album.album_images_ids = [img_id for img_id in album.album_images_ids if img_id != image_id]
        album.album_images_count -=1
        album.album_total_count -=1
        album.album_size -= img.file_size
        # If this was the cover, clear it
        if album.album_cover_type == 'image' and album.album_cover_id == image_id:
            # Check if there are any other images in the album
            if album.album_images_count > 0:
                album.album_cover_id = album.album_images_ids[0]
                album.album_cover_type = 'image'
            elif album.album_videos_count > 0:
                album.album_cover_id = album.album_videos_ids[0]
                album.album_cover_type = 'video'
            elif album.album_raw_images_count > 0:
                album.album_cover_id = album.album_raw_images_ids[0]
                album.album_cover_type = 'raw'
            else:
                album.album_cover_id = None
                album.album_cover_type = None
        album.album_updated_at = datetime.now()
    db.commit()
    
    # 3. Delete original file from cold storage (storagePath/images/)
    cold_file_path = os.path.join(cold_storage.value, 'images', img.filename)
    if os.path.exists(cold_file_path):
        try:
            os.remove(cold_file_path)
            print(f"Deleted cold storage file: {cold_file_path}")
        except Exception as e:
            print(f"Error deleting cold storage file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete original file: {str(e)}")
    
    # 4. Delete hot storage files (thumbnails)
    # Thumbnails are named: thumb_{hash}.jpg where hash = md5(full_path)
    path_hash = hashlib.md5(cold_file_path.encode('utf-8')).hexdigest()
    thumb_filename = f"thumb_{path_hash}.jpg"
    
    thumbnail_dir = settings.THUMBNAIL_DIR
    thumb_path = os.path.join(thumbnail_dir, thumb_filename)
    
    if os.path.exists(thumb_path):
        try:
            os.remove(thumb_path)
            print(f"Deleted thumbnail: {thumb_path}")
        except Exception as e:
            print(f"Error deleting thumbnail: {e}")
    
    # 5. Delete from database
    try:
        db.delete(img)
        db.commit()
        print(f"Deleted image from database: {img.filename}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete from database: {str(e)}")
    
    return {"success": True, "message": f"Image {img.filename} deleted successfully"}

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

            # 3. Return as a JPEG response with CORS headers
            # Convert HEIC filename to JPG for download
            jpg_filename = os.path.splitext(img.filename)[0] + '.jpg'
            return Response(
                content=img_byte_arr, 
                media_type="application/octet-stream",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Content-Disposition": f'attachment; filename="{jpg_filename}"',
                }
            )
            
        except Exception as e:
            print(f"Error converting HEIC: {e}")
            # Fallback: try sending original if conversion fails
            response = FileResponse(
                filePath,
                media_type="application/octet-stream",
                filename=img.filename
            )
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Content-Disposition"] = f'attachment; filename="{img.filename}"'
            return response

    # For standard images (JPG, PNG), just send the file directly with CORS headers
    response = FileResponse(
        filePath,
        media_type="application/octet-stream",
        filename=img.filename
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Content-Disposition"] = f'attachment; filename="{img.filename}"'
    return response

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

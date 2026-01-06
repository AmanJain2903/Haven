import os
from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session
from app.core.database import get_db, engine
from app import models
from app.services.scanner import scan_directory 
from app.ml.clip_client import generate_embedding
from fastapi.responses import FileResponse
from fastapi import HTTPException
from typing import List
from PIL import Image
import pillow_heif
import io
from app.core.config import settings

backend_url = settings.HOST_URL

router = APIRouter()

@router.post("/scan")
def trigger_scan(path: str, db: Session = Depends(get_db)):
    """
    Trigger a scan of a specific folder path.
    Example payload: /scan?path=/Users/aman/Documents/Work/Haven/test_photos
    """
    try:
        count = scan_directory(path, db)
        return {"status": "success", "images_added": count}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/process")
def process_images(limit: int = 50, db: Session = Depends(get_db)):
    """
    Loops through images that don't have embeddings yet and generates them.
    """
    # 1. Find images where embedding is NULL
    images = db.query(models.Image).filter(models.Image.embedding == None).limit(limit).all()
    
    if not images:
        return {"message": "No new images to process."}

    count = 0
    print(f"Found {len(images)} images to process...")
    
    for img in images:
        # 2. Generate the Vector
        vector = generate_embedding(img.file_path)
        
        if vector:
            # 3. Save to DB
            img.embedding = vector
            img.is_processed = True
            count += 1
            print(f"Processed: {img.filename}")
            
    db.commit()
    return {"status": "success", "processed": count}

@router.get("/", response_model=List[dict])
def get_images(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Fetch a list of images to display in the grid.
    """
    images = db.query(models.Image).offset(skip).limit(limit).all()
    
    # Transform to JSON
    return [
        {
            "id": img.id,
            "filename": img.filename,
            "thumbnail_url": f"{backend_url}/thumbnails/thumb_{img.filename.rsplit('.', 1)[0]}.jpg", # Magic URL for thumbnail
            "image_url": f"/api/v1/images/file/{img.id}", # Magic URL for the full image
            "date": img.capture_date,
            "latitude": img.latitude,
            "longitude": img.longitude
        }
        for img in images
    ]

@router.get("/file/{image_id}")
def get_image_file(image_id: int, db: Session = Depends(get_db)):
    """
    Serve the actual image file from the hard drive.
    Convert HEIC or HEIF to JPEG on the fly.
    """
    img = db.query(models.Image).filter(models.Image.id == image_id).first()
    
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
        
    # Check if it is an HEIC file
    if img.file_path.lower().endswith(('.heic', '.heif')):
        try:
            # 1. Open the HEIC file
            heif_file = pillow_heif.read_heif(img.file_path)
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
            return FileResponse(img.file_path)

    # For standard images (JPG, PNG), just send the file directly
    return FileResponse(img.file_path)

@router.get("/thumbnail/{image_id}")
def get_thumbnail_file(image_id: int, db: Session = Depends(get_db)):
    """
    Serve the small thumbnail version of the image.
    """
    img = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404)
        
    # Construct expected thumbnail path
    name_part = img.filename.rsplit('.', 1)[0]
    thumb_filename = f"thumb_{name_part}.jpg"
    thumb_path = os.path.join(settings.THUMBNAIL_DIR, thumb_filename)
    
    # If thumbnail exists, serve it
    if os.path.exists(thumb_path):
        return FileResponse(thumb_path)
    
    # Fallback: If no thumbnail exists, serve the original
    # This prevents broken images if the scan missed one
    return FileResponse(img.file_path)
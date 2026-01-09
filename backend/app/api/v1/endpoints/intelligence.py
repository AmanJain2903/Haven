from fastapi import Depends, APIRouter, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, case
from typing import List
from app.core.database import get_db, engine
from app import models
from app.ml.clip_client import generate_text_embedding
import hashlib
from app.core.config import settings
import os

backend_url = settings.HOST_URL


router = APIRouter()

@router.post("/search/images")
def search_photos(response: Response, query: str, threshold: float = 0.8, skip: int=0, limit: int=500, db: Session = Depends(get_db)):
    """
    Finds photos based on semantic similarity.
    
    threshold: The cutoff for a "match". 
               0.2 is very strict (exact matches).
               0.3 is standard.
               0.4 is loose (conceptual matches).
    """
    # FORCE NO CACHE for the API JSON list
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"


    # 1. Convert text to vector
    text_vector = generate_text_embedding(query)
    
    if not text_vector:
        return {"error": "Could not generate embedding"}
    
    # Create the base filter (without limit/offset)
    # We use this to count strictly the matching images
    base_query = db.query(models.Image).filter(
        models.Image.embedding.cosine_distance(text_vector) < threshold
    )
    
    # 2. Get Count and set header
    total_match_count = base_query.count()
    response.headers["X-Total-Count"] = str(total_match_count)

    # 2. Use Cosine Distance operator (<=>)
    # We want results where the distance is LOW
    results = db.query(
        models.Image, 
        models.Image.embedding.cosine_distance(text_vector).label("distance")
    ).filter(
        models.Image.embedding.cosine_distance(text_vector) < threshold
    ).order_by(desc(models.Image.capture_date)).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    # 3. Format the output
    response = []
    for img, distance in results:
        # Convert distance to a % score (approximate)
        score = round((1 - distance) * 100, 2)
        
        response.append({
            "id": img.id,
            "filename": img.filename,
            "thumbnail_url": f"{backend_url}/api/v1/images/thumbnail/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
            "image_url": f"{backend_url}/api/v1/images/file/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for the full image
            "score": f"{score}%",
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
        })
        
    return response

@router.post("/search/videos")
def search_videos(response: Response, query: str, threshold: float = 0.8, skip: int=0, limit: int=500, db: Session = Depends(get_db)):
    """
    Finds videos based on semantic similarity.
    
    threshold: The cutoff for a "match". 
               0.2 is very strict (exact matches).
               0.3 is standard.
               0.4 is loose (conceptual matches).
    """
    # FORCE NO CACHE for the API JSON list
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"


    # 1. Convert text to vector
    text_vector = generate_text_embedding(query)
    
    if not text_vector:
        return {"error": "Could not generate embedding"}
    
    # Create the base filter (without limit/offset)
    # We use this to count strictly the matching images
    base_query = db.query(models.Video).filter(
        models.Video.embedding.cosine_distance(text_vector) < threshold
    )
    
    # 2. Get Count and set header
    total_match_count = base_query.count()
    response.headers["X-Total-Count"] = str(total_match_count)

    # 2. Use Cosine Distance operator (<=>)
    # We want results where the distance is LOW
    results = db.query(
        models.Video, 
        models.Video.embedding.cosine_distance(text_vector).label("distance")
    ).filter(
        models.Video.embedding.cosine_distance(text_vector) < threshold
    ).order_by(desc(models.Video.capture_date)).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    # 3. Format the output
    response = []
    for vid, distance in results:
        # Convert distance to a % score (approximate)
        score = round((1 - distance) * 100, 2)
        
        response.append({
            "id": vid.id,
            "filename": vid.filename,
            "thumbnail_url": f"{backend_url}/api/v1/videos/thumbnail/{vid.id}?h={hashlib.md5(os.path.join(config.value, 'videos', vid.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
            "preview_url": f"{backend_url}/api/v1/videos/preview/{vid.id}?h={hashlib.md5(os.path.join(config.value, 'videos', vid.filename).encode('utf-8')).hexdigest()}", # Magic URL for preview
            "video_url": f"{backend_url}/api/v1/videos/file/{vid.id}?h={hashlib.md5(os.path.join(config.value, 'videos', vid.filename).encode('utf-8')).hexdigest()}", # Magic URL for the full video
            "score": f"{score}%",
            "date": vid.capture_date,
            "duration": vid.duration,
            "latitude": vid.latitude,
            "longitude": vid.longitude,
            "city": vid.city,
            "state": vid.state,
            "country": vid.country,
            "metadata": {
                "codec": vid.codec,
                "camera_make": vid.camera_make,
                "camera_model": vid.camera_model,
                "size_bytes": vid.file_size,
                "fps": vid.fps,
                "width": vid.width,
                "height": vid.height,
            }
        })
        
    return response

@router.post("/search/raw-images")
def search_raw_images(response: Response, query: str, threshold: float = 0.8, skip: int=0, limit: int=500, db: Session = Depends(get_db)):
    """
    Finds raw images based on semantic similarity.
    
    threshold: The cutoff for a "match". 
               0.2 is very strict (exact matches).
               0.3 is standard.
               0.4 is loose (conceptual matches).
    """
    # FORCE NO CACHE for the API JSON list
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    # 1. Convert text to vector
    text_vector = generate_text_embedding(query)
    
    if not text_vector:
        return {"error": "Could not generate embedding"}
    
    # Create the base filter (without limit/offset)
    # We use this to count strictly the matching raw images
    base_query = db.query(models.RawImage).filter(
        models.RawImage.embedding.cosine_distance(text_vector) < threshold
    )
    
    # 2. Get Count and set header
    total_match_count = base_query.count()
    response.headers["X-Total-Count"] = str(total_match_count)

    # 3. Use Cosine Distance operator (<=>)
    # We want results where the distance is LOW
    results = db.query(
        models.RawImage, 
        models.RawImage.embedding.cosine_distance(text_vector).label("distance")
    ).filter(
        models.RawImage.embedding.cosine_distance(text_vector) < threshold
    ).order_by(desc(models.RawImage.capture_date)).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    # 4. Format the output
    response = []
    for raw, distance in results:
        # Convert distance to a % score (approximate)
        score = round((1 - distance) * 100, 2)
        
        response.append({
            "id": raw.id,
            "filename": raw.filename,
            "extension": raw.extension,
            "thumbnail_url": f"{backend_url}/api/v1/raw-images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "preview_url": f"{backend_url}/api/v1/raw-images/preview/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "raw_url": f"{backend_url}/api/v1/raw-images/file/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "score": f"{score}%",
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
        })
        
    return response


@router.post("/search/map", response_model=List[dict])
def search_map_points(
    query: str, 
    threshold: float = 0.8,
    limit: int = 2000, # Higher limit for map (since data is small)
    db: Session = Depends(get_db)
):
    """
    Performs Semantic Search but returns ONLY valid GPS points 
    with minimal data for the Map View.
    """
    # 1. Generate Embedding
    text_vector = generate_text_embedding(query)
    if not text_vector:
        return []

    # 2. Query DB: Filter by Similarity + GPS existing
    results = db.query(models.Image).filter(
        models.Image.embedding.cosine_distance(text_vector) < threshold,
        models.Image.latitude != None,
        models.Image.longitude != None
    ).order_by(
        case(
            (models.Image.capture_date != None, 0), # Dates first
            else_=1 # Nulls last
        ),
        desc(models.Image.capture_date),
        desc(models.Image.id) # Secondary sort for stability
    ).limit(limit).with_entities(
        models.Image.id,
        models.Image.latitude,
        models.Image.longitude,
        models.Image.filename
    ).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    # 3. Format Lightweight Response
    response = []
    for img in results:
        response.append({
            "id": img.id,
            "latitude": img.latitude,
            "longitude": img.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/images/thumbnail/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
        })
        
    return response
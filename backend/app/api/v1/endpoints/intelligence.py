from fastapi import Depends, APIRouter, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, case, cast, union_all, literal
from typing import List
from app.core.database import get_db, engine
from app import models
from app.ml.clip_client import generate_text_embedding
import hashlib
from app.core.config import settings
import os
from sqlalchemy.types import Integer, String, Float, Boolean, DateTime, BigInteger
from pgvector.sqlalchemy import Vector
import numpy as np
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy import ARRAY

backend_url = settings.HOST_URL
dimension = settings.CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION


router = APIRouter()

# "Master List" of all possible columns
# Format: ("json_key", "model_attribute_name", "SQL Type")
# If the attribute exists on the model, we use it. If not, we use NULL.
ALL_COLUMNS = [
    # --- Common ---
    ("id", "id", Integer),
    ("filename", "filename", String),
    ("file_size", "file_size", BigInteger),
    ("capture_date", "capture_date", DateTime),
    ("width", "width", Integer),
    ("height", "height", Integer),

    # --- Favorite ---
    ("is_favorite", "is_favorite", Boolean),
    
    # --- Location ---
    ("city", "city", String),
    ("state", "state", String),
    ("country", "country", String),
    ("latitude", "latitude", Float),
    ("longitude", "longitude", Float),

    # --- Exif ---
    ("megapixels", "megapixels", Float),
    ("iso", "iso", Integer),
    ("f_number", "f_number", Float),
    ("exposure_time", "exposure_time", String),
    ("focal_length", "focal_length", Float),
    
    # --- Camera Gear (Commonish) ---
    ("camera_make", "camera_make", String),
    ("camera_model", "camera_model", String),

    # --- Intelligence ---
    ("is_processed", "is_processed", Boolean),
    ("embedding", "embedding", Vector(dimension)),
    
    # --- RAW / Photo Specific ---
    ("lens_make", "lens_make", String),
    ("lens_model", "lens_model", String),
    ("flash_fired", "flash_fired", Boolean),
    ("extension", "extension", String), # Specific to RAW usually
    
    # --- Video Specific ---
    ("duration", "duration", Float),
    ("fps", "fps", Float),
    ("codec", "codec", String),

    # --- System ---
    ("created_at", "created_at", DateTime),

    # --- Album Specific ---
    ("album_ids", "album_ids", MutableList.as_mutable(ARRAY(Integer))),
]

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
            "is_favorite": img.is_favorite,
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
            "is_favorite": vid.is_favorite,
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

@router.post("/search/raw_images")
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
            "is_favorite": raw.is_favorite,
            "extension": raw.extension,
            "thumbnail_url": f"{backend_url}/api/v1/raw_images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "preview_url": f"{backend_url}/api/v1/raw_images/preview/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
            "raw_url": f"{backend_url}/api/v1/raw_images/file/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
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

@router.post("/search/all_media")
def search_all_media(response: Response, query: str, threshold: float = 0.8, skip: int=0, limit: int=500, db: Session = Depends(get_db)):
    """
    Finds all media based on semantic similarity.
    
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

    # --- 1. Helper to build dynamic queries ---
    def build_select(model, media_type_label):
        selection = []
        
        # selection.append(model.id.label("id")) 
        # # Already in ALL_COLUMNS list
        
        for json_key, attr_name, sql_type in ALL_COLUMNS:
            if hasattr(model, attr_name):
                # Column exists in this model (e.g. Image.iso)
                col = getattr(model, attr_name)
                selection.append(col.label(json_key))
            else:
                # Column missing (e.g. Video.iso) -> Return NULL
                selection.append(cast(literal(None), sql_type).label(json_key))
        
        # Inject the 'type' column manually at the end
        selection.append(literal(media_type_label).label("type"))
        
        return db.query(*selection)

    # --- 2. Build the 3 sub-queries ---
    # Python automatically checks which model has which column and fills gaps with None
    q_images = build_select(models.Image, "image")
    q_videos = build_select(models.Video, "video")
    q_raws   = build_select(models.RawImage, "raw")

    # --- 3. Union & Sort ---
    combined_query = union_all(q_images, q_videos, q_raws).alias("media_union")
    
    # Create the base filter (without limit/offset)
    # We use this to count strictly the matching media
    base_query = db.query(combined_query).filter(
        combined_query.c.embedding.cosine_distance(text_vector) < threshold
    )
    
    # 2. Get Count and set header
    total_match_count = base_query.count()
    response.headers["X-Total-Count"] = str(total_match_count)

    # 3. Use Cosine Distance operator (<=>)
    # We want results where the distance is LOW
    results = db.query(
        combined_query, 
        combined_query.c.embedding.cosine_distance(text_vector).label("distance")
    ).filter(
        combined_query.c.embedding.cosine_distance(text_vector) < threshold
    ).order_by(desc(combined_query.c.capture_date)).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    base_path = config.value

    output = []
    for row in results:
        # Extract distance from the row object
        distance = row.distance
        # Convert distance to a % score (approximate)
        score = round((1 - distance) * 100, 2)
        
        # Determine paths based on type
        if row.type == "image":
            folder = "images"
            api_prefix = "images"
        elif row.type == "video":
            folder = "videos"
            api_prefix = "videos"
        elif row.type == "raw":
            folder = "raw" 
            api_prefix = "raw_images"
    
        # Generate Hash for URLs
        full_path = os.path.join(base_path, folder, row.filename)
        path_hash = hashlib.md5(full_path.encode('utf-8')).hexdigest()

        item = {}
        for json_key, _ , _ in ALL_COLUMNS:
            val = getattr(row, json_key)
            if isinstance(val, (np.ndarray, np.generic)):
                val = val.tolist()
            item[json_key] = val
        
        item["type"] = row.type
        item["thumbnail_url"] = f"{backend_url}/api/v1/{api_prefix}/thumbnail/{row.id}?h={path_hash}"
        item["file_url"]      = f"{backend_url}/api/v1/{api_prefix}/file/{row.id}?h={path_hash}"
        item["preview_url"]   = f"{backend_url}/api/v1/{api_prefix}/preview/{row.id}?h={path_hash}"

        if row.type == "image":
            item["image_url"] = item["file_url"]
        elif row.type == "video":
            item["video_url"] = item["file_url"]
        elif row.type == "raw":
            item["raw_url"] = item["file_url"]
        
        item["score"] = f"{score}%"

        output.append(item)

    return [
        {
            "id": item["id"],
            "score": item["score"],
            "filename": item["filename"],
            "is_favorite": item["is_favorite"],
            "type": item["type"],
            "extension": item["extension"],
            "thumbnail_url": item["thumbnail_url"],
            "preview_url": item["preview_url"] if item["type"] == "raw" or item["type"] == "video" else None,
            "image_url": item["image_url"] if item["type"] == "image" else None,
            "video_url": item["video_url"] if item["type"] == "video" else None,
            "raw_url": item["raw_url"] if item["type"] == "raw" else None,
            "date": item["capture_date"],
            "latitude": item["latitude"],
            "longitude": item["longitude"],
            "city": item["city"],
            "state": item["state"],
            "country": item["country"],
            "width": item["width"],
            "height": item["height"],
            "duration": item["duration"],
            "megapixels": item["megapixels"],
            "metadata": {
                "camera_make": item["camera_make"],
                "camera_model": item["camera_model"],
                "lens_make": item["lens_make"],
                "lens_model": item["lens_model"],
                "exposure_time": item["exposure_time"],
                "f_number": item["f_number"],
                "iso": item["iso"],
                "focal_length": item["focal_length"],
                "flash_fired": item["flash_fired"],
                "size_bytes": item["file_size"],
                "fps": item["fps"],
                "codec": item["codec"],
                "width": item["width"],
                "height": item["height"],
            }
        }
        for item in output
    ]

@router.post("/search/favorites")
def search_favorites(response: Response, query: str, threshold: float = 0.8, skip: int=0, limit: int=500, db: Session = Depends(get_db)):
    """
    Finds favorites based on semantic similarity.
    
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

    # --- 1. Helper to build dynamic queries ---
    def build_select(model, media_type_label):
        selection = []
        
        # selection.append(model.id.label("id")) 
        # # Already in ALL_COLUMNS list
        
        for json_key, attr_name, sql_type in ALL_COLUMNS:
            if hasattr(model, attr_name):
                # Column exists in this model (e.g. Image.iso)
                col = getattr(model, attr_name)
                selection.append(col.label(json_key))
            else:
                # Column missing (e.g. Video.iso) -> Return NULL
                selection.append(cast(literal(None), sql_type).label(json_key))
        
        # Inject the 'type' column manually at the end
        selection.append(literal(media_type_label).label("type"))
        
        return db.query(*selection)

    # --- 2. Build the 3 sub-queries ---
    # Python automatically checks which model has which column and fills gaps with None
    q_images = build_select(models.Image, "image").filter(models.Image.is_favorite == True)
    q_videos = build_select(models.Video, "video").filter(models.Video.is_favorite == True)
    q_raws   = build_select(models.RawImage, "raw").filter(models.RawImage.is_favorite == True)

    # --- 3. Union & Sort ---
    combined_query = union_all(q_images, q_videos, q_raws).alias("media_union")
    
    # Create the base filter (without limit/offset)
    # We use this to count strictly the matching favorites
    base_query = db.query(combined_query).filter(
        combined_query.c.embedding.cosine_distance(text_vector) < threshold
    )
    
    # 2. Get Count and set header
    total_match_count = base_query.count()
    response.headers["X-Total-Count"] = str(total_match_count)

    # 3. Use Cosine Distance operator (<=>)
    # We want results where the distance is LOW
    results = db.query(
        combined_query, 
        combined_query.c.embedding.cosine_distance(text_vector).label("distance")
    ).filter(
        combined_query.c.embedding.cosine_distance(text_vector) < threshold
    ).order_by(desc(combined_query.c.capture_date)).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    base_path = config.value

    output = []
    for row in results:
        # Extract distance from the row object
        distance = row.distance
        # Convert distance to a % score (approximate)
        score = round((1 - distance) * 100, 2)
        
        # Determine paths based on type
        if row.type == "image":
            folder = "images"
            api_prefix = "images"
        elif row.type == "video":
            folder = "videos"
            api_prefix = "videos"
        elif row.type == "raw":
            folder = "raw" 
            api_prefix = "raw_images"
    
        # Generate Hash for URLs
        full_path = os.path.join(base_path, folder, row.filename)
        path_hash = hashlib.md5(full_path.encode('utf-8')).hexdigest()

        item = {}
        for json_key, _ , _ in ALL_COLUMNS:
            val = getattr(row, json_key)
            if isinstance(val, (np.ndarray, np.generic)):
                val = val.tolist()
            item[json_key] = val
        
        item["type"] = row.type
        item["thumbnail_url"] = f"{backend_url}/api/v1/{api_prefix}/thumbnail/{row.id}?h={path_hash}"
        item["file_url"]      = f"{backend_url}/api/v1/{api_prefix}/file/{row.id}?h={path_hash}"
        item["preview_url"]   = f"{backend_url}/api/v1/{api_prefix}/preview/{row.id}?h={path_hash}"

        if row.type == "image":
            item["image_url"] = item["file_url"]
        elif row.type == "video":
            item["video_url"] = item["file_url"]
        elif row.type == "raw":
            item["raw_url"] = item["file_url"]
        
        item["score"] = f"{score}%"

        output.append(item)

    return [
        {
            "id": item["id"],
            "score": item["score"],
            "filename": item["filename"],
            "is_favorite": item["is_favorite"],
            "type": item["type"],
            "extension": item["extension"],
            "thumbnail_url": item["thumbnail_url"],
            "preview_url": item["preview_url"] if item["type"] == "raw" or item["type"] == "video" else None,
            "image_url": item["image_url"] if item["type"] == "image" else None,
            "video_url": item["video_url"] if item["type"] == "video" else None,
            "raw_url": item["raw_url"] if item["type"] == "raw" else None,
            "date": item["capture_date"],
            "latitude": item["latitude"],
            "longitude": item["longitude"],
            "city": item["city"],
            "state": item["state"],
            "country": item["country"],
            "width": item["width"],
            "height": item["height"],
            "duration": item["duration"],
            "megapixels": item["megapixels"],
            "metadata": {
                "camera_make": item["camera_make"],
                "camera_model": item["camera_model"],
                "lens_make": item["lens_make"],
                "lens_model": item["lens_model"],
                "exposure_time": item["exposure_time"],
                "f_number": item["f_number"],
                "iso": item["iso"],
                "focal_length": item["focal_length"],
                "flash_fired": item["flash_fired"],
                "size_bytes": item["file_size"],
                "fps": item["fps"],
                "codec": item["codec"],
                "width": item["width"],
                "height": item["height"],
            }
        }
        for item in output
    ]


@router.post("/search/map/images", response_model=List[dict])
def search_map_points_images(
    query: str, 
    threshold: float = 0.8,
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
    ).with_entities(
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
            "type": "image",
            "latitude": img.latitude,
            "longitude": img.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/images/thumbnail/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
        })
        
    return response

@router.post("/search/map/videos", response_model=List[dict])
def search_map_points_videos(
    query: str, 
    threshold: float = 0.8,
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
    results = db.query(models.Video).filter(
        models.Video.embedding.cosine_distance(text_vector) < threshold,
        models.Video.latitude != None,
        models.Video.longitude != None
    ).order_by(
        case(
            (models.Video.capture_date != None, 0), # Dates first
            else_=1 # Nulls last
        ),
        desc(models.Video.capture_date),
        desc(models.Video.id) # Secondary sort for stability
    ).with_entities(
        models.Video.id,
        models.Video.latitude,
        models.Video.longitude,
        models.Video.filename
    ).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    # 3. Format Lightweight Response
    response = []
    for vid in results:
        response.append({
            "id": vid.id,
            "type": "video",
            "latitude": vid.latitude,
            "longitude": vid.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/videos/thumbnail/{vid.id}?h={hashlib.md5(os.path.join(config.value, 'videos', vid.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
        })
        
    return response

@router.post("/search/map/raw_images", response_model=List[dict])
def search_map_points_raw_images(
    query: str, 
    threshold: float = 0.8,
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
    results = db.query(models.RawImage).filter(
        models.RawImage.embedding.cosine_distance(text_vector) < threshold,
        models.RawImage.latitude != None,
        models.RawImage.longitude != None
    ).order_by(
        desc(models.RawImage.capture_date),
        desc(models.RawImage.id) # Secondary sort for stability
    ).with_entities(
        models.RawImage.id,
        models.RawImage.latitude,
        models.RawImage.longitude,
        models.RawImage.filename
    ).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    # 3. Format Lightweight Response
    response = []
    for raw in results:
        response.append({
            "id": raw.id,
            "type": "raw",
            "latitude": raw.latitude,
            "longitude": raw.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/raw_images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
        })
        
    return response

@router.post("/search/map/all_media", response_model=List[dict])
def search_map_points_all_media(
    query: str, 
    threshold: float = 0.8,
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

    # --- 1. Helper to build dynamic queries ---
    def build_select(model, media_type_label):
        selection = []
        
        # selection.append(model.id.label("id")) 
        # # Already in ALL_COLUMNS list
        
        for json_key, attr_name, sql_type in ALL_COLUMNS:
            if hasattr(model, attr_name):
                # Column exists in this model (e.g. Image.iso)
                col = getattr(model, attr_name)
                selection.append(col.label(json_key))
            else:
                # Column missing (e.g. Video.iso) -> Return NULL
                selection.append(cast(literal(None), sql_type).label(json_key))
        
        # Inject the 'type' column manually at the end
        selection.append(literal(media_type_label).label("type"))
        
        return db.query(*selection)

    # --- 2. Build the 3 sub-queries ---
    # Python automatically checks which model has which column and fills gaps with None
    q_images = build_select(models.Image, "image")
    q_videos = build_select(models.Video, "video")
    q_raws   = build_select(models.RawImage, "raw")

    # --- 3. Union & Sort ---
    combined_query = union_all(q_images, q_videos, q_raws).alias("media_union")

    # Query DB: Filter by Similarity + GPS existing
    results = db.query(combined_query).filter(
        combined_query.c.embedding.cosine_distance(text_vector) < threshold,
        combined_query.c.latitude != None,
        combined_query.c.longitude != None
    ).order_by(
        desc(combined_query.c.capture_date),
        desc(combined_query.c.id) # Secondary sort for stability
    ).with_entities(
        combined_query.c.id,
        combined_query.c.latitude,
        combined_query.c.longitude,
        combined_query.c.filename,
        combined_query.c.type
    ).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    
    base_path = config.value

    # 3. Format Lightweight Response
    response = []
    for row in results:
        if row.type == "image":
            folder = "images"
            api_prefix = "images"
        elif row.type == "video":
            folder = "videos"
            api_prefix = "videos"
        elif row.type == "raw":
            folder = "raw" 
            api_prefix = "raw_images"

        # Generate Hash for URLs
        full_path = os.path.join(base_path, folder, row.filename)
        path_hash = hashlib.md5(full_path.encode('utf-8')).hexdigest()
        
        response.append({
            "id": row.id,
            "type": row.type,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/{api_prefix}/thumbnail/{row.id}?h={path_hash}"
        })

    return response

@router.post("/search/albums/{albumId}")
def search_albums(response: Response, albumId: int, query: str, threshold: float = 0.8, skip: int=0, limit: int=500, db: Session = Depends(get_db)):
    """
    Finds all media based on semantic similarity.
    
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

    # --- 1. Helper to build dynamic queries ---
    def build_select(model, media_type_label):
        selection = []
        
        # selection.append(model.id.label("id")) 
        # # Already in ALL_COLUMNS list
        
        for json_key, attr_name, sql_type in ALL_COLUMNS:
            if hasattr(model, attr_name):
                # Column exists in this model (e.g. Image.iso)
                col = getattr(model, attr_name)
                selection.append(col.label(json_key))
            else:
                # Column missing (e.g. Video.iso) -> Return NULL
                selection.append(cast(literal(None), sql_type).label(json_key))
        
        # Inject the 'type' column manually at the end
        selection.append(literal(media_type_label).label("type"))
        
        return db.query(*selection)

    # --- 2. Build the 3 sub-queries ---
    # Python automatically checks which model has which column and fills gaps with None
    q_images = build_select(models.Image, "image")
    q_videos = build_select(models.Video, "video")
    q_raws   = build_select(models.RawImage, "raw")

    # --- 3. Union & Sort ---
    combined_query = union_all(q_images, q_videos, q_raws).alias("media_union")
    
    # Create the base filter (without limit/offset)
    # We use this to count strictly the matching media and filter by album ID
    base_query = db.query(combined_query).filter(
        combined_query.c.embedding.cosine_distance(text_vector) < threshold
    ).filter(combined_query.c.album_ids.contains([albumId]))
    
    # 2. Get Count and set header
    total_match_count = base_query.count()
    response.headers["X-Total-Count"] = str(total_match_count)

    # 3. Use Cosine Distance operator (<=>)
    # We want results where the distance is LOW
    results = db.query(
        combined_query, 
        combined_query.c.embedding.cosine_distance(text_vector).label("distance")
    ).filter(
        combined_query.c.embedding.cosine_distance(text_vector) < threshold
    ).filter(combined_query.c.album_ids.contains([albumId])).order_by(desc(combined_query.c.capture_date)).offset(skip).limit(limit).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    base_path = config.value

    output = []
    for row in results:
        # Extract distance from the row object
        distance = row.distance
        # Convert distance to a % score (approximate)
        score = round((1 - distance) * 100, 2)
        
        # Determine paths based on type
        if row.type == "image":
            folder = "images"
            api_prefix = "images"
        elif row.type == "video":
            folder = "videos"
            api_prefix = "videos"
        elif row.type == "raw":
            folder = "raw" 
            api_prefix = "raw_images"
    
        # Generate Hash for URLs
        full_path = os.path.join(base_path, folder, row.filename)
        path_hash = hashlib.md5(full_path.encode('utf-8')).hexdigest()

        item = {}
        for json_key, _ , _ in ALL_COLUMNS:
            val = getattr(row, json_key)
            if isinstance(val, (np.ndarray, np.generic)):
                val = val.tolist()
            item[json_key] = val
        
        item["type"] = row.type
        item["thumbnail_url"] = f"{backend_url}/api/v1/{api_prefix}/thumbnail/{row.id}?h={path_hash}"
        item["file_url"]      = f"{backend_url}/api/v1/{api_prefix}/file/{row.id}?h={path_hash}"
        item["preview_url"]   = f"{backend_url}/api/v1/{api_prefix}/preview/{row.id}?h={path_hash}"

        if row.type == "image":
            item["image_url"] = item["file_url"]
        elif row.type == "video":
            item["video_url"] = item["file_url"]
        elif row.type == "raw":
            item["raw_url"] = item["file_url"]
        
        item["score"] = f"{score}%"

        output.append(item)

    return [
        {
            "id": item["id"],
            "score": item["score"],
            "filename": item["filename"],
            "is_favorite": item["is_favorite"],
            "type": item["type"],
            "extension": item["extension"],
            "thumbnail_url": item["thumbnail_url"],
            "preview_url": item["preview_url"] if item["type"] == "raw" or item["type"] == "video" else None,
            "image_url": item["image_url"] if item["type"] == "image" else None,
            "video_url": item["video_url"] if item["type"] == "video" else None,
            "raw_url": item["raw_url"] if item["type"] == "raw" else None,
            "date": item["capture_date"],
            "latitude": item["latitude"],
            "longitude": item["longitude"],
            "city": item["city"],
            "state": item["state"],
            "country": item["country"],
            "width": item["width"],
            "height": item["height"],
            "duration": item["duration"],
            "megapixels": item["megapixels"],
            "metadata": {
                "camera_make": item["camera_make"],
                "camera_model": item["camera_model"],
                "lens_make": item["lens_make"],
                "lens_model": item["lens_model"],
                "exposure_time": item["exposure_time"],
                "f_number": item["f_number"],
                "iso": item["iso"],
                "focal_length": item["focal_length"],
                "flash_fired": item["flash_fired"],
                "size_bytes": item["file_size"],
                "fps": item["fps"],
                "codec": item["codec"],
                "width": item["width"],
                "height": item["height"],
            }
        }
        for item in output
    ]
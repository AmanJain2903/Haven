import os
from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session, load_only
from sqlalchemy import desc, case, cast, union_all, literal
from sqlalchemy.types import Integer, String, Float, Boolean, DateTime, BigInteger
from pgvector.sqlalchemy import Vector
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
import numpy as np


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
]

@router.get("/images", response_model=List[dict])
def get_map_data_images(db: Session = Depends(get_db)):
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
            "type": "image",
            "latitude": img.latitude,
            "longitude": img.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/images/thumbnail/{img.id}?h={hashlib.md5(os.path.join(config.value, 'images', img.filename).encode('utf-8')).hexdigest()}", # Magic URL for thumbnail
        })
    
    return response

@router.get("/videos", response_model=List[dict])
def get_map_data_videos(db: Session = Depends(get_db)):
    """
    Fetches ALL geotagged videos for the map.
    """
    query = db.query(models.Video).filter(
        models.Video.latitude != None,
        models.Video.longitude != None
    ).order_by(
        case(
            (models.Video.capture_date != None, 0),
            else_=1
        ),
        desc(models.Video.capture_date),
        desc(models.Video.id)
    )
    
    results = query.with_entities(
        models.Video.id,
        models.Video.latitude,
        models.Video.longitude,
        models.Video.filename
    ).all()

    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")

    response = []
    for vid in results:
        response.append({
            "id": vid.id,
            "type": "video",
            "latitude": vid.latitude,
            "longitude": vid.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/videos/thumbnail/{vid.id}?h={hashlib.md5(os.path.join(config.value, 'videos', vid.filename).encode('utf-8')).hexdigest()}",
        })
    
    return response

@router.get("/raw_images", response_model=List[dict])
def get_map_data_raw_images(db: Session = Depends(get_db)):
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
            "type": "raw",
            "latitude": raw.latitude,
            "longitude": raw.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/raw_images/thumbnail/{raw.id}?h={hashlib.md5(os.path.join(config.value, 'raw', raw.filename).encode('utf-8')).hexdigest()}",
        })
    
    return response

@router.get("/all_media", response_model=List[dict])
def get_map_data_all_media(db: Session = Depends(get_db)):
    """
    Fetches ALL geotagged media for the map.
    """
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

    query = db.query(combined_query).filter(
        combined_query.c.latitude != None,
        combined_query.c.longitude != None
    ).order_by(
        case(
            (combined_query.c.capture_date != None, 0),
            else_=1
        ),
        desc(combined_query.c.capture_date),
        desc(combined_query.c.id)
    )
    
    results = query.with_entities(
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

    response = []
    for row in results:
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

        response.append({
            "id": row.id,
            "type": row.type,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "thumbnail_url": f"{backend_url}/api/v1/{api_prefix}/thumbnail/{row.id}?h={path_hash}"
        })
    
    return response
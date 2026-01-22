from app.core.utils import get_coordinates, get_location_parts
from app.core.database import get_db
from app.core.constants import ALL_COLUMNS
from app.core.constants import FILE_TYPES
from app import models

from sqlalchemy import desc, case, cast, union_all, literal
from fastapi import Depends, APIRouter
from sqlalchemy.orm import Session
from app.core.config import settings
from fastapi import HTTPException
from typing import List
import hashlib
import os

backend_url = settings.HOST_URL
dimension = settings.CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION
router = APIRouter()

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

@router.get("/location/{fileType}/{id}", response_model=dict)
def get_location_data(fileType: str, id: int, db: Session = Depends(get_db)):
    """
    Fetches the location data for a specific media file.
    """
    if not fileType or not id:
        raise HTTPException(status_code=400, detail="File type and ID are required")
    if fileType not in FILE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type")
    if fileType == "image":
        media = db.query(models.Image).filter(models.Image.id == id).first()
    elif fileType == "video":
        media = db.query(models.Video).filter(models.Video.id == id).first()
    elif fileType == "raw":
        media = db.query(models.RawImage).filter(models.RawImage.id == id).first()
    return {
        "city": media.city or None,
        "state": media.state or None,
        "country": media.country or None,
    }

@router.post("/location/{fileType}/{id}", response_model=dict)
def update_location_data(fileType: str, id: int, city: str = None, state: str = None, country: str = None, db: Session = Depends(get_db)):
    """
    Updates the location data for a specific media file.
    """
    if not fileType or not id:
        raise HTTPException(status_code=400, detail="File type and ID are required")
    if fileType not in FILE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type")
    if fileType == "image":
        media = db.query(models.Image).filter(models.Image.id == id).first()
    elif fileType == "video":
        media = db.query(models.Video).filter(models.Video.id == id).first()
    elif fileType == "raw":
        media = db.query(models.RawImage).filter(models.RawImage.id == id).first()
    coordinates = get_coordinates(city, state, country)
    if coordinates:
        media.latitude, media.longitude = coordinates
        locationParts = get_location_parts(media.latitude, media.longitude)
        if locationParts:
            media.city = locationParts.get("city")
            media.state = locationParts.get("state")
            media.country = locationParts.get("country")
        else:
            media.city = city
            media.state = state
            media.country = country
    else:
        media.city = city
        media.state = state
        media.country = country
        media.latitude = None
        media.longitude = None
    db.commit()
    db.refresh(media)
    return {
        "city": media.city or None,
        "state": media.state or None,
        "country": media.country or None,
    }
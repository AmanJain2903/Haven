import os
from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, case, literal, union_all, cast
from app.core.database import get_db
from app import models
from fastapi.responses import FileResponse
from fastapi import HTTPException
from typing import List
import hashlib
from app.core.config import settings
from sqlalchemy.types import Integer, String, Float, Boolean, DateTime, BigInteger
from pgvector.sqlalchemy import Vector
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

@router.get("/timeline", response_model=List[dict])
def get_favorites_timeline(
    response: Response,
    skip: int = 0, 
    limit: int = 100,
    db: Session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

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
    queryImages = build_select(models.Image, "image").filter(models.Image.is_favorite == True)
    queryVideos = build_select(models.Video, "video").filter(models.Video.is_favorite == True)
    queryRawImages = build_select(models.RawImage, "raw").filter(models.RawImage.is_favorite == True)

    combined_query = union_all(queryImages, queryVideos, queryRawImages).alias("media_union")

    total_count = db.query(combined_query).count()
    response.headers["X-Total-Count"] = str(total_count)

    # Sort by Date DESC
    final_query = db.query(combined_query).order_by(
        case(
            (combined_query.c.capture_date != None, 0),
            else_=1
        ),
        desc(combined_query.c.capture_date),
        desc(combined_query.c.id)
    ).offset(skip).limit(limit)

    results = final_query.all()

    # --- 4. Get Config for URL generation ---
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    base_path = config.value

    # --- 5. Map to JSON Response ---
    output = []
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
        # Verify file exists before hashing to avoid crashes? 
        # For speed, we assume DB is in sync. If strict, add os.path.exists check.
        path_hash = hashlib.md5(full_path.encode('utf-8')).hexdigest()

        # Build the dictionary dynamically from our Master List
        item = {}
        for json_key, _ , _ in ALL_COLUMNS:
            val = getattr(row, json_key)
            if isinstance(val, (np.ndarray, np.generic)):
                val = val.tolist()
            item[json_key] = val
        
        # Add the computed fields
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

        output.append(item)

    return [
        {
            "id": item["id"],
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

@router.post("/toggle/{fileType}/{id}", response_model=int)
def toggle_favorite(id: int, fileType: str, db: Session = Depends(get_db)):
    if fileType == "image":
        media = db.query(models.Image).filter(models.Image.id == id).first()
    elif fileType == "video":
        media = db.query(models.Video).filter(models.Video.id == id).first()
    elif fileType == "raw":
        media = db.query(models.RawImage).filter(models.RawImage.id == id).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")
    media.is_favorite = not media.is_favorite
    db.commit()
    return media.id
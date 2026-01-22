from app.tasks import task_batch_add_to_album, task_batch_delete_album, task_create_album_zip
from app.core.utils import get_coordinates, get_location_parts
from app.core.database import get_db
from app.core.constants import ALL_COLUMNS
from app.core.constants import FILE_TYPES
from app.core.config import settings
from app import models

from sqlalchemy import desc, case, literal, union_all, cast
from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from typing import List
import numpy as np
import hashlib
import redis
import uuid
import os

redis_client = redis.from_url(settings.REDIS_URL)

backend_url = settings.HOST_URL
dimension = settings.CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION

router = APIRouter()

@router.post("/create", response_model=dict)
def create_album(albumName: str = None, albumDescription: str = None, albumLocation: str = None, albumCity: str = None, albumState: str = None, albumCountry: str = None, db: Session = Depends(get_db)):
    if not albumName:
        raise HTTPException(status_code=400, detail="Album name is required")
    
    album_latitude = None
    album_longitude = None

    try:
        if albumCity or albumState or albumCountry:
            location = get_coordinates(albumCity, albumState, albumCountry)
            if location:
                album_latitude, album_longitude = location
                location_parts = get_location_parts(album_latitude, album_longitude)
                albumCity = location_parts.get('city')
                albumState = location_parts.get('state')
                albumCountry = location_parts.get('country')
    except:
        pass

    try:
        db_album = models.Albums(
            album_name=albumName,
            album_description=albumDescription,
            album_location=albumLocation,
            album_latitude=album_latitude,
            album_longitude=album_longitude,
            album_city=albumCity,
            album_state=albumState,
            album_country=albumCountry,
            album_created_at=datetime.now(),
            album_updated_at=datetime.now()
        )
        db.add(db_album)
        db.commit()
        return {"message": "Album created successfully", "album": albumName}
    except Exception as e:
        print(f"❌ Error creating album: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.get("/getAlbums", response_model=List[dict])
def get_albums(db: Session = Depends(get_db)):
    try:
        albums = db.query(models.Albums).order_by(models.Albums.album_updated_at.desc()).all()
        return [
            {
                "id": album.id,
                "album_name": album.album_name,
                "album_description": album.album_description,
                "album_size": album.album_size,
                "album_cover_type": album.album_cover_type,
                "album_cover_id": album.album_cover_id,
                "album_images_count": album.album_images_count,
                "album_videos_count": album.album_videos_count,
                "album_raw_images_count": album.album_raw_images_count,
                "album_total_count": album.album_total_count,
                "album_images_ids": album.album_images_ids,
                "album_videos_ids": album.album_videos_ids,
                "album_raw_images_ids": album.album_raw_images_ids,
                "album_location": album.album_location,
                "album_latitude": album.album_latitude,
                "album_longitude": album.album_longitude,
                "album_city": album.album_city,
                "album_state": album.album_state,
                "album_country": album.album_country,
                "album_created_at": album.album_created_at,
                "album_updated_at": album.album_updated_at
            }
            for album in albums
        ]
    except Exception as e:
        print(f"❌ Error getting albums: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.get("/getAlbum/{albumId}", response_model=dict)
def get_album(albumId: int, db: Session = Depends(get_db)):
    if not albumId:
        raise HTTPException(status_code=400, detail="Album ID is required")
    try:
        album = db.query(models.Albums).filter(models.Albums.id == albumId).first()
        return {
                "id": album.id,
                "album_name": album.album_name,
                "album_description": album.album_description,
                "album_size": album.album_size,
                "album_cover_type": album.album_cover_type,
                "album_cover_id": album.album_cover_id,
                "album_images_count": album.album_images_count,
                "album_videos_count": album.album_videos_count,
                "album_raw_images_count": album.album_raw_images_count,
                "album_total_count": album.album_total_count,
                "album_images_ids": album.album_images_ids,
                "album_videos_ids": album.album_videos_ids,
                "album_raw_images_ids": album.album_raw_images_ids,
                "album_location": album.album_location,
                "album_latitude": album.album_latitude,
                "album_longitude": album.album_longitude,
                "album_city": album.album_city,
                "album_state": album.album_state,
                "album_country": album.album_country,
                "album_created_at": album.album_created_at,
                "album_updated_at": album.album_updated_at
            }
    except Exception as e:
        print(f"❌ Error getting album: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.post("/update/{albumId}", response_model=dict)
def update_album(albumId: int, albumName: str = None, albumDescription: str = None, albumLocation: str = None, albumCity: str = None, albumState: str = None, albumCountry: str = None, db: Session = Depends(get_db)):
    if not albumId:
        raise HTTPException(status_code=400, detail="Album ID is required")
    try:
        album = db.query(models.Albums).filter(models.Albums.id == albumId).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        album.album_name = albumName
        album.album_description = albumDescription
        album.album_location = albumLocation
        album.album_city = albumCity
        album.album_state = albumState
        album.album_country = albumCountry
        location = get_coordinates(albumCity, albumState, albumCountry)
        if location:
            album.album_latitude, album.album_longitude = location
            album_location = get_location_parts(album.album_latitude, album.album_longitude)
            album.album_city = album_location.get('city')
            album.album_state = album_location.get('state')
            album.album_country = album_location.get('country')
        else:
            album.album_latitude = None
            album.album_longitude = None
        album.album_updated_at = datetime.now()
        db.commit()
        return {"message": "Album updated successfully", "album": album.id}
    except Exception as e:
        print(f"❌ Error updating album: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.post("/addToAlbum/{albumId}/{fileType}/{id}", response_model=dict)
def add_to_album(fileType: str, id: int, albumId: int, db: Session = Depends(get_db)):
    if not fileType:
        raise HTTPException(status_code=400, detail="File type is required")
    if not id:
        raise HTTPException(status_code=400, detail="File ID is required")
    if not albumId:
        raise HTTPException(status_code=400, detail="Album ID is required")
    if fileType not in ["image", "video", "raw"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    try:
        if fileType == "image":
            file = db.query(models.Image).filter(models.Image.id == id).first()
        elif fileType == "video":
            file = db.query(models.Video).filter(models.Video.id == id).first()
        elif fileType == "raw":
            file = db.query(models.RawImage).filter(models.RawImage.id == id).first()
        else:
            raise HTTPException(status_code=400, detail="Invalid file type")
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        album = db.query(models.Albums).filter(models.Albums.id == albumId).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        if albumId not in file.album_ids:
            file.album_ids.append(albumId)
            if fileType == "image":
                album.album_images_count += 1
                album.album_images_ids.append(file.id)
            elif fileType == "video":
                album.album_videos_count += 1
                album.album_videos_ids.append(file.id)
            elif fileType == "raw":
                album.album_raw_images_count += 1
                album.album_raw_images_ids.append(file.id)
            album.album_total_count += 1
            album.album_size += file.file_size
            if not album.album_cover_id or not album.album_cover_type:
                album.album_cover_id = file.id
                album.album_cover_type = fileType
            album.album_updated_at = datetime.now()
        db.commit()
        return {"message": "File added to album successfully", "file": file.id}
    except Exception as e:
        print(f"❌ Error adding file to album: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.post("/removeFromAlbum/{albumId}/{fileType}/{id}", response_model=dict)
def remove_from_album(fileType: str, id: int, albumId: int, db: Session = Depends(get_db)):
    if not fileType:
        raise HTTPException(status_code=400, detail="File type is required")
    if not id:
        raise HTTPException(status_code=400, detail="File ID is required")
    if not albumId:
        raise HTTPException(status_code=400, detail="Album ID is required")
    if fileType not in ["image", "video", "raw"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    try:
        if fileType == "image":
            file = db.query(models.Image).filter(models.Image.id == id).first()
        elif fileType == "video":
            file = db.query(models.Video).filter(models.Video.id == id).first()
        elif fileType == "raw":
            file = db.query(models.RawImage).filter(models.RawImage.id == id).first()
        else:
            raise HTTPException(status_code=400, detail="Invalid file type")
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        album = db.query(models.Albums).filter(models.Albums.id == albumId).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        if albumId in file.album_ids:
            file.album_ids.remove(albumId)
            if fileType == "image":
                album.album_images_count -= 1
                album.album_images_ids.remove(file.id)
            elif fileType == "video":
                album.album_videos_count -= 1
                album.album_videos_ids.remove(file.id)
            elif fileType == "raw":
                album.album_raw_images_count -= 1
                album.album_raw_images_ids.remove(file.id)
            album.album_total_count -= 1
            album.album_size -= file.file_size
            if album.album_cover_id == file.id and album.album_cover_type == fileType:
                if album.album_images_count > 0:
                    album.album_cover_id = album.album_images_ids[0]
                    album.album_cover_type = "image"
                elif album.album_videos_count > 0:
                    album.album_cover_id = album.album_videos_ids[0]
                    album.album_cover_type = "video"
                elif album.album_raw_images_count > 0:
                    album.album_cover_id = album.album_raw_images_ids[0]
                    album.album_cover_type = "raw"
                else:
                    album.album_cover_id = None
                    album.album_cover_type = None
            album.album_updated_at = datetime.now()
        db.commit()
        return {"message": "File removed from album successfully", "file": file.id}
    except Exception as e:
        print(f"❌ Error removing file from album: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/updateAlbumCover/{albumId}/{fileType}/{id}", response_model=dict)
def update_album_cover(fileType: str, id: int, albumId: int, db: Session = Depends(get_db)):
    if not fileType:
        raise HTTPException(status_code=400, detail="File type is required")
    if not id:
        raise HTTPException(status_code=400, detail="File ID is required")
    if not albumId:
        raise HTTPException(status_code=400, detail="Album ID is required")
    if fileType not in ["image", "video", "raw"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    try:
        if fileType == "image":
            file = db.query(models.Image).filter(models.Image.id == id).first()
        elif fileType == "video":
            file = db.query(models.Video).filter(models.Video.id == id).first()
        elif fileType == "raw":
            file = db.query(models.RawImage).filter(models.RawImage.id == id).first()
        else:
            raise HTTPException(status_code=400, detail="Invalid file type")
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        album = db.query(models.Albums).filter(models.Albums.id == albumId).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        album.album_cover_id = file.id
        album.album_cover_type = fileType
        album.album_updated_at = datetime.now()
        db.commit()

        return {"message": "Album cover updated successfully", "album": album.id}
    except Exception as e:
        print(f"❌ Error updating album cover: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.get("/getAlbumCover/{albumId}", response_model=dict)
def get_album_cover(albumId: int, db: Session = Depends(get_db)):
    if not albumId:
        raise HTTPException(status_code=400, detail="Album ID is required")
    try:
        album = db.query(models.Albums).filter(models.Albums.id == albumId).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        if not album.album_cover_id or not album.album_cover_type:
            raise HTTPException(status_code=404, detail="Album cover not found")
        if album.album_cover_type == "image":
            prefix = "images"
            file = db.query(models.Image).filter(models.Image.id == album.album_cover_id).first()
        elif album.album_cover_type == "video":
            prefix = "videos"
            file = db.query(models.Video).filter(models.Video.id == album.album_cover_id).first()
        elif album.album_cover_type == "raw":
            file = db.query(models.RawImage).filter(models.RawImage.id == album.album_cover_id).first()
            prefix = "raw_images"
        else:
            raise HTTPException(status_code=404, detail="Invalid file type")
        config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
        if not config or not config.value:
            raise HTTPException(status_code=503, detail="Storage not configured")
        base_path = config.value
        path_hash = hashlib.md5(os.path.join(base_path, prefix, file.filename).encode('utf-8')).hexdigest()
        return {
            "album_cover_id": album.album_cover_id, 
            "album_cover_type": album.album_cover_type,
            "album_cover_url": f"{backend_url}/api/v1/{prefix}/thumbnail/{album.album_cover_id}?h={path_hash}"
        }
    except Exception as e:
        print(f"❌ Error getting album cover: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.get("/timeline/{albumId}", response_model=List[dict])
def get_album_timeline(
    response: Response,
    albumId: int,
    skip: int = 0, 
    limit: int = 500,
    mediaFilter: str = "all",
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
    q_images = build_select(models.Image, "image")
    q_videos = build_select(models.Video, "video")
    q_raws   = build_select(models.RawImage, "raw")

    # --- 3. Union & Sort ---
    if mediaFilter == "all":
        combined_query = union_all(q_images, q_videos, q_raws).alias("media_union")
    elif mediaFilter == "videos":
        combined_query = union_all(q_videos).alias("media_union")
    elif mediaFilter == "raw":
        combined_query = union_all(q_raws).alias("media_union")
    elif mediaFilter == "photos":
        combined_query = union_all(q_images).alias("media_union")
    else:
        combined_query = union_all(q_images, q_videos, q_raws).alias("media_union")

    # Base query for counting (without offset/limit)
    base_query = db.query(combined_query).filter(combined_query.c.album_ids.contains([albumId]))
    
    # Calculate total count BEFORE applying offset/limit
    total_count = base_query.count()
    response.headers["X-Total-Count"] = str(total_count)

    # Sort by Date DESC and apply pagination
    final_query = base_query.order_by(
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

@router.get("/getPartOfAlbums/{fileType}/{id}", response_model=dict)
def get_part_of_albums(fileType: str, id: int, db: Session = Depends(get_db)):
    if not fileType:
        raise HTTPException(status_code=400, detail="File type is required")
    if not id:
        raise HTTPException(status_code=400, detail="File ID is required")
    if fileType not in FILE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type")
    try:
        if fileType == "image":
            file = db.query(models.Image).filter(models.Image.id == id).first()
        elif fileType == "video":
            file = db.query(models.Video).filter(models.Video.id == id).first()
        elif fileType == "raw":
            file = db.query(models.RawImage).filter(models.RawImage.id == id).first()
        else:
            raise HTTPException(status_code=400, detail="Invalid file type")
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        albums = file.album_ids
        return {
            "albums": albums
        }
    except Exception as e:
        print(f"❌ Error getting part of albums: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- BATCH OPERATIONS WITH CELERY ---

@router.post("/batch_add_to_album")
def start_batch_add_to_album(
    albumId: int,
    files: List[dict],  # [{"type": "image", "id": 123}, ...]
):
    """
    Start a background batch operation to add multiple files to an album.
    Returns a task_id to track progress.
    """
    try:
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Start Celery task
        task_batch_add_to_album.delay(task_id, albumId, files)
        
        return {
            "task_id": task_id,
            "status": "started",
            "total": len(files)
        }
    except Exception as e:
        print(f"❌ Error starting batch add: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch_delete_album")
def start_batch_delete_album(albumId: int):
    """
    Start a background batch operation to delete an album.
    Returns a task_id to track progress.
    """
    try:
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Start Celery task
        task_batch_delete_album.delay(task_id, albumId)
        
        return {
            "task_id": task_id,
            "status": "started"
        }
    except Exception as e:
        print(f"❌ Error starting batch delete: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batch_task_status/{task_id}")
def get_batch_task_status(task_id: str):
    """
    Get the current status of a batch operation.
    """
    try:
        # Get task info from Redis
        task_data = redis_client.hgetall(f"batch_task:{task_id}")
        
        if not task_data:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Decode bytes to strings
        status_info = {
            key.decode('utf-8'): value.decode('utf-8')
            for key, value in task_data.items()
        }
        
        # Convert numeric fields
        for field in ['total', 'completed', 'failed', 'album_id']:
            if field in status_info:
                status_info[field] = int(status_info[field])
        
        return status_info
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- ALBUM DOWNLOAD ENDPOINTS ---

@router.post("/download_album/{album_id}")
def start_album_download(album_id: int, db: Session = Depends(get_db)):
    """
    Start a background task to create a zip file for an album.
    Returns a task_id to track progress.
    """
    try:
        # Get album to verify it exists and get name
        album = db.query(models.Albums).filter(models.Albums.id == album_id).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Sanitize album name for filename
        album_name = album.album_name.replace(" ", "_").replace("/", "_")
        
        # Start Celery task
        task_create_album_zip.delay(task_id, album_id, album_name)
        
        return {
            "task_id": task_id,
            "status": "started",
            "album_name": album.album_name
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error starting album download: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download_task_status/{task_id}")
def get_download_task_status(task_id: str):
    """
    Get the current status of an album download task.
    """
    try:
        # Get task info from Redis
        task_data = redis_client.hgetall(f"download_task:{task_id}")
        
        if not task_data:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Decode bytes to strings
        status_info = {
            key.decode('utf-8'): value.decode('utf-8')
            for key, value in task_data.items()
        }
        
        # Convert numeric fields
        for field in ['total', 'completed', 'progress', 'album_id']:
            if field in status_info:
                status_info[field] = int(status_info[field])
        
        return status_info
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting download task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/cleanup_download/{task_id}")
def cleanup_download(task_id: str):
    """
    Manually cleanup download file and Redis entry. Only use for cancelled/failed tasks.
    """
    try:
        # Get task info from Redis
        task_data = redis_client.hgetall(f"download_task:{task_id}")
        
        if task_data:
            zip_path = task_data.get(b"zip_path", b"").decode('utf-8')
            
            # Delete zip file
            if zip_path and os.path.exists(zip_path):
                os.remove(zip_path)
                print(f"🗑️ Cleaned up zip file: {zip_path}")
            
            # Delete Redis entry
            redis_client.delete(f"download_task:{task_id}")
            print(f"🗑️ Cleaned up Redis entry: download_task:{task_id}")
        
        return {"status": "cleaned"}
        
    except Exception as e:
        print(f"⚠️ Cleanup error: {e}")
        # Don't raise error, just log it
        return {"status": "error", "message": str(e)}

@router.post("/cancel_download/{task_id}")
def cancel_download(task_id: str):
    """
    Cancel an active download task and clean up resources.
    """
    try:
        from app.core.celery_app import celery_app
        
        # First, update Redis status to cancelled (task will check this)
        redis_client.hset(f"download_task:{task_id}", "status", "cancelled")
        print(f"📝 [Cancel] Set Redis status to cancelled for task: {task_id}")
        
        # Get task info from Redis for cleanup
        task_data = redis_client.hgetall(f"download_task:{task_id}")
        
        # Try to revoke the Celery task
        try:
            # Revoke with terminate=True to kill the task
            celery_app.control.revoke(task_id, terminate=True, signal='SIGTERM')
            print(f"🚫 [Cancel] Revoked Celery task (SIGTERM): {task_id}")
            
            # Give it a moment, then try SIGKILL if still running
            import time
            time.sleep(0.5)
            celery_app.control.revoke(task_id, terminate=True, signal='SIGKILL')
            print(f"🚫 [Cancel] Revoked Celery task (SIGKILL): {task_id}")
        except Exception as revoke_error:
            print(f"⚠️ [Cancel] Error revoking task (may already be completed): {revoke_error}")
        
        # Clean up partial zip file if exists
        if task_data:
            zip_path = task_data.get(b"zip_path", b"").decode('utf-8')
            
            if zip_path and os.path.exists(zip_path):
                try:
                    os.remove(zip_path)
                    print(f"🗑️ [Cancel] Deleted partial zip file: {zip_path}")
                except Exception as file_error:
                    print(f"⚠️ [Cancel] Could not delete zip file: {file_error}")
        
        # Clean up Redis entry
        redis_client.delete(f"download_task:{task_id}")
        print(f"🗑️ [Cancel] Cleaned up Redis entry: download_task:{task_id}")
        
        return {"status": "cancelled", "task_id": task_id}
        
    except Exception as e:
        print(f"❌ [Cancel] Error cancelling download: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
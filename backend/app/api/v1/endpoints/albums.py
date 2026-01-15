import os
from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session, load_only
from sqlalchemy import desc, case, literal, union_all, cast
from app.core.database import get_db, engine
from app import models
from fastapi.responses import FileResponse
from fastapi import HTTPException
from typing import List
from sqlalchemy.types import Integer, String, Float, Boolean, DateTime, BigInteger
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import ARRAY
from PIL import Image
import pillow_heif
import io
import hashlib
from app.core.config import settings
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from datetime import datetime
from sqlalchemy.ext.mutable import MutableList
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

    # --- Album Specific ---
    ("album_ids", "album_ids", MutableList.as_mutable(ARRAY(Integer))),
]

def get_coordinates(city: str = None, state: str = None, country: str = None) -> tuple:
    """
    Forward Geocoding: City, State, Country -> (Latitude, Longitude)
    Returns: (latitude, longitude) as floats, or None if not found.
    """
    try:
        geolocator = Nominatim(user_agent="haven_photo_manager")
        
        # Build a structured query dict (more accurate than a raw string)
        query = {}
        if city: query['city'] = city
        if state: query['state'] = state
        if country: query['country'] = country
        
        if not query:
            return None

        # Perform the lookup
        location = geolocator.geocode(query, timeout=10, language='en')
        
        if location:
            return (location.latitude, location.longitude)
        else:
            print(f"❌ Location not found: {query}")
            return None

    except Exception as e:
        print(f"❌ Error getting coordinates: {e}")
        return None

def get_location_parts(latitude: float, longitude: float) -> dict:
    """
    Reverse geocode coordinates to get a human-readable location label.
    """
    try:
        geolocator = Nominatim(user_agent="haven_photo_manager")
        location = geolocator.reverse(f"{latitude}, {longitude}", timeout=10, language='en')
        
        if not location or not location.raw.get('address'):
            return None
        
        address = location.raw['address']
        parts = {
            'city': None,
            'state': None,
            'country': None
        }
        
        city = address.get('city') or address.get('town') or address.get('village') or address.get('municipality')
        if city: parts['city'] = city
        
        state = address.get('state') or address.get('region')
        if state: parts['state'] = state
        
        country = address.get('country')
        if country: parts['country'] = country
        
        return parts
        
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"Geocoding service error: {e}")
        return None
    except Exception as e:
        print(f"Error reverse geocoding ({latitude}, {longitude}): {e}")
        return None

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
        albums = db.query(models.Albums).all()
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
        if albumName:
            album.album_name = albumName
        if albumDescription:
            album.album_description = albumDescription
        if albumLocation:
            album.album_location = albumLocation
        if albumCity or albumState or albumCountry:
            location = get_coordinates(albumCity, albumState, albumCountry)
            if location:
                album.album_latitude, album.album_longitude = location
                album_location = get_location_parts(album.album_latitude, album.album_longitude)
                album.album_city = album_location.get('city')
                album.album_state = album_location.get('state')
                album.album_country = album_location.get('country')
        album.album_updated_at = datetime.now()
        db.commit()
        return {"message": "Album updated successfully", "album": album.id}
    except Exception as e:
        print(f"❌ Error updating album: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.delete("/delete/{albumId}", response_model=dict)
def delete_album(albumId: int, db: Session = Depends(get_db)):
    if not albumId:
        raise HTTPException(status_code=400, detail="Album ID is required")
    try:
        album = db.query(models.Albums).filter(models.Albums.id == albumId).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        # Remove all images in this album
        for file_id in album.album_images_ids or []:
            remove_from_album("image", file_id, albumId, db)

        # Remove all videos in this album
        for file_id in album.album_videos_ids or []:
            remove_from_album("video", file_id, albumId, db)

        # Remove all raw images in this album
        for file_id in album.album_raw_images_ids or []:
            remove_from_album("raw", file_id, albumId, db)

        db.delete(album)
        db.commit()
        return {"message": "Album deleted successfully", "album": albumId}
    except Exception as e:
        print(f"❌ Error deleting album: {e}")
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
            album.album_updated_at = datetime.now()
            album.album_size += file.file_size
            if not album.album_cover_id or not album.album_cover_type:
                album.album_cover_id = file.id
                album.album_cover_type = fileType
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
            album.album_updated_at = datetime.now()
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
    combined_query = union_all(q_images, q_videos, q_raws).alias("media_union")

    # Sort by Date DESC
    final_query = db.query(combined_query).filter(combined_query.c.album_ids.contains([albumId])).order_by(
        case(
            (combined_query.c.capture_date != None, 0),
            else_=1
        ),
        desc(combined_query.c.capture_date),
        desc(combined_query.c.id)
    ).offset(skip).limit(limit)

    results = final_query.all()

    total_count = final_query.count()
    response.headers["X-Total-Count"] = str(total_count)

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
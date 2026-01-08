import os
from datetime import datetime
from PIL import Image as PILImage, ImageOps, ExifTags
from PIL.ExifTags import TAGS
from pillow_heif import register_heif_opener
from PIL.TiffImagePlugin import IFDRational
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import hashlib

# Database imports
from app.core.database import SessionLocal
from app.models import Image
from app.core.config import settings

from app.ml.clip_client import generate_embedding

# Register HEIC support
register_heif_opener()

THUMBNAIL_DIR = settings.THUMBNAIL_DIR

# --- HELPER FUNCTIONS ---

def get_float(val):
    if isinstance(val, IFDRational):
        return float(val)
    if isinstance(val, tuple) and len(val) == 2 and val[1] != 0:
        return val[0] / val[1]
    if isinstance(val, (int, float)):
        return float(val)
    return None

def ensure_thumbnail_dir():
    """Create thumbnail directory if it doesn't exist"""
    global THUMBNAIL_DIR
    try:
        os.makedirs(THUMBNAIL_DIR, exist_ok=True)
    except PermissionError:
        import tempfile
        THUMBNAIL_DIR = os.path.join(tempfile.gettempdir(), "haven_thumbnails")
        os.makedirs(THUMBNAIL_DIR, exist_ok=True)

def extract_exif_data(img):
    """
    Robustly extracts camera gear and settings from HEIC/JPG.
    """
    data = {
        "make": None, "model": None, 
        "exposure": None, "f_number": None, 
        "iso": None, "focal_length": None
    }
    
    exif = img.getexif()
    if not exif:
        return data

    for tag_id, value in exif.items():
        tag_name = TAGS.get(tag_id, tag_id)
        if tag_name == "Make":
            data["make"] = str(value).strip()
        elif tag_name == "Model":
            data["model"] = str(value).strip()

    try:
        # Tag 0x8769 (34665) holds the technical photo data
        exif_ifd = exif.get_ifd(0x8769) 
        
        for tag_id, value in exif_ifd.items():
            tag_name = TAGS.get(tag_id, tag_id)
            
            if tag_name == "ISOSpeedRatings":
                data["iso"] = value
            elif tag_name == "FNumber":
                value = get_float(value)
                data["f_number"] = round(float(value), 1)
            elif tag_name == "FocalLength":
                value = get_float(value)
                data["focal_length"] = round(float(value), 1)
            elif tag_name == "ExposureTime":
                value = get_float(value)
                if value < 1 and value > 0:
                    data["exposure"] = f"1/{int(round(1/value))}"
                else:
                    data["exposure"] = str(round(value, 1))
                        
    except Exception as e:
        print(f"Error reading ExifIFD: {e}")

    return data

def get_decimal_from_dms(dms, ref):
    """Helper to convert degrees/minutes/seconds format to decimal format."""
    degrees = dms[0]
    minutes = dms[1]
    seconds = dms[2]
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def get_geotagging(img):
    """
    Robust GPS extraction that works for both HEIC and JPEG.
    """
    try:
        exif = img.getexif()
        if not exif:
            return None
            
        gps_info = exif.get_ifd(34853)
        if not gps_info:
            return None

        geotagging = {}
        for key, val in gps_info.items():
            name = ExifTags.GPSTAGS.get(key)
            if name:
                geotagging[name] = val
        return geotagging
    except Exception as e:
        print(f"Error parsing GPS: {e}")
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
        parts = {}
        
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

def ensure_thumbnail(file_path: str, filename: str) -> str:
    """
    Creates a 300px optimized JPEG thumbnail.
    """
    ensure_thumbnail_dir()
    path_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()
    thumb_filename = f"thumb_{path_hash}.jpg"
    thumb_path = os.path.join(THUMBNAIL_DIR, thumb_filename)
    
    if os.path.exists(thumb_path):
        return thumb_filename

    try:
        with PILImage.open(file_path) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            img.thumbnail((300, 300))
            img.save(thumb_path, "JPEG", quality=70)
        return thumb_filename
    except Exception as e:
        print(f"Failed to create thumbnail for {filename}: {e}")
        return None


# --- MAIN WORKER FUNCTION ---

def process_image_file(full_path: str, filename: str):
    """
    The heavy lifting function executed by the Celery Worker.
    1. Generates Thumbnail
    2. Extracts EXIF & GPS
    3. Generates AI Embedding (Vector)
    4. Saves to Database
    """
    db = SessionLocal()
    try:
        # 1. Generate Thumbnail
        ensure_thumbnail(full_path, filename)
        
        width, height = None, None
        mp = None
        
        # 2. Open Image & Process Standard Data
        img = PILImage.open(full_path)
        
        # -- Date Extraction --
        capture_date = None
        exif = img.getexif()
        if exif:
            date_str = exif.get(36867) or exif.get(306)
            if date_str:
                try:
                    capture_date = datetime.strptime(date_str, '%Y:%m:%d %H:%M:%S')
                except:
                    pass 
        
        # -- GPS Extraction --
        lat, lon = None, None
        city, state, country = None, None, None
        geo = get_geotagging(img)
        
        if geo:
            if 'GPSLatitude' in geo and 'GPSLongitude' in geo:
                lat = get_decimal_from_dms(geo['GPSLatitude'], geo['GPSLatitudeRef'])
                lon = get_decimal_from_dms(geo['GPSLongitude'], geo['GPSLongitudeRef'])
                
                if lat and lon:
                    loc = get_location_parts(lat, lon)
                    if loc:
                        city = loc.get('city')
                        state = loc.get('state')
                        country = loc.get('country')

        # -- Dimensions --
        width, height = img.size
        if width and height:
            mp = round((width * height) / 1_000_000, 1)
        
        # -- EXIF Metadata --
        exif_data = extract_exif_data(img)

        # 3. --- NEW STEP: Generate AI Embedding ---
        # We pass the full path so CLIP can read the image
        print(f"🧠 Generating Embedding for: {filename}")
        vector_embedding = generate_embedding(full_path)
        
        if not vector_embedding:
            print(f"⚠️ Warning: Could not generate embedding for {filename}")

        # 4. Save to Database
        db_image = Image(
            filename=filename,
            file_size=os.path.getsize(full_path),
            capture_date=capture_date,
            latitude=lat,
            longitude=lon,
            city=city,
            state=state,
            country=country,
            width=width,
            height=height,
            megapixels=mp,
            camera_make=exif_data.get("make"),
            camera_model=exif_data.get("model"),
            exposure_time=exif_data.get("exposure"),
            f_number=exif_data.get("f_number"),
            iso=exif_data.get("iso"),
            focal_length=exif_data.get("focal_length"),
            
            # Save the Vector!
            embedding=vector_embedding, 
            
            is_processed=True
        )
        db.add(db_image)
        db.commit()
        
        location_str = f" | {city}" if city else ""
        print(f"✅ Processed: {filename} {location_str} | AI Ready: {'Yes' if vector_embedding else 'No'}")

    except Exception as e:
        print(f"❌ Error processing {filename}: {e}")
        # Consider logging e to a file or monitoring service
    finally:
        db.close()
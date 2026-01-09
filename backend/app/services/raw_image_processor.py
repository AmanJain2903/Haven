import os
import rawpy
import exiftool
import numpy as np
from PIL import Image
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import RawImage
from app.core.config import settings
from app.ml.clip_client import generate_embedding
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from geopy.geocoders import Nominatim
import hashlib
import io
from sqlalchemy.exc import IntegrityError
from PIL import ImageOps
import json
import subprocess
import re
from fractions import Fraction

# Directory setup
THUMBNAIL_DIR = settings.RAW_THUMBNAIL_DIR 
PREVIEW_DIR = settings.RAW_PREVIEW_DIR

# Define RAW extensions
RAW_EXTS = {'.arw', '.cr2', '.cr3', '.dng', '.nef', '.orf', '.raf', '.rw2', '.srw', '.x3f'}

def ensure_dirs():
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)

def format_shutter_speed(val):
    """
    Converts decimal exposure (0.00125) to fraction string (1/800).
    """
    if not val:
        return None
    try:
        f_val = float(val)
        if f_val >= 1:
            return str(round(f_val, 1)).replace(".0", "") # e.g. "2" or "0.5" if long exposure
        if f_val <= 0:
            return str(val)
        
        # Calculate denominator
        denom = round(1 / f_val)
        return f"1/{denom}"
    except:
        return str(val)

def parse_iso6709(geo_string):
    """
    Parses ISO6709 string from metadata (e.g., "+37.7749-122.4194/")
    """
    try:
        match = re.match(r'([+-][0-9.]+)([+-][0-9.]+)', geo_string)
        if match:
            return float(match.group(1)), float(match.group(2))
    except:
        pass
    return None, None

def get_location_parts(latitude: float, longitude: float) -> dict:
    """
    Reverse geocode coordinates to get a human-readable location label.
    (Reused from your video processor for consistency)
    """
    try:
        geolocator = Nominatim(user_agent="haven_photo_manager")
        location = geolocator.reverse(f"{latitude}, {longitude}", timeout=10, language='en')
        
        if not location or not location.raw.get('address'):
            return None
        
        address = location.raw['address']
        parts = { 'city': None, 'state': None, 'country': None }
        
        parts['city'] = address.get('city') or address.get('town') or address.get('village')
        parts['state'] = address.get('state') or address.get('region')
        parts['country'] = address.get('country')
        
        return parts
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None

def get_raw_metadata(file_path):
    """
    Extracts metadata using ExifTool with improved fallback for Canon CR3.
    """
    try:
        with exiftool.ExifToolHelper() as et:
            # We fetch everything to ensure we don't miss composite tags
            data = et.get_metadata(file_path)[0]

        # Helper to safely find the first matching key
        def get(keys, default=None):
            for k in keys:
                if k in data:
                    return data[k]
            return default

        # 1. Parse Lens Model (Handling numeric IDs)
        lens_model = get(["EXIF:LensModel", "LensModel", "LensType", "Composite:LensID"])
            
        # 2. Parse Lens Make
        lens_make = get(["EXIF:LensMake", "LensMake"])

        # 3. Parse Exposure Time (Convert 0.00125 -> 1/800)
        raw_exposure = get(["EXIF:ExposureTime", "ExposureTime"])
        formatted_exposure = format_shutter_speed(raw_exposure)

        # 4. Parse GPS
        lat = get(["GPSLatitude", "Composite:GPSLatitude", "EXIF:GPSLatitude", "XMP:GPSLatitude"])
        lon = get(["GPSLongitude", "Composite:GPSLongitude", "EXIF:GPSLongitude", "XMP:GPSLongitude"])

        # 5. Parse Date
        date_obj = None
        date_str = get(["EXIF:DateTimeOriginal", "DateTimeOriginal", "CreateDate"])
        if date_str:
            try:
                # ExifTool standard format: "YYYY:MM:DD HH:MM:SS"
                date_obj = datetime.strptime(str(date_str)[:19], "%Y:%m:%d %H:%M:%S")
            except: pass

        # 6. Flash
        flash_val = str(get(["EXIF:Flash", "Flash"], "")).lower()
        flash_fired = "on" in flash_val or "fired" in flash_val

        return {
            "make": get(["EXIF:Make", "Make"]),
            "model": get(["EXIF:Model", "Model"]),
            "lens_make": lens_make,
            "lens_model": str(lens_model) if lens_model else None,
            "exposure": formatted_exposure,
            "f_number": get(["EXIF:FNumber", "FNumber"]),
            "iso": get(["EXIF:ISO", "ISO"]),
            "focal_length": get(["EXIF:FocalLength", "FocalLength"]),
            "flash_fired": flash_fired,
            "date": date_obj,
            "lat": float(lat) if lat is not None else None,
            "lon": float(lon) if lon is not None else None
        }

    except Exception as e:
        print(f"⚠️ Metadata error (ExifTool) for {file_path}: {e}")
        return {}

def generate_assets_and_embed(file_path, filename):
    """
    1. Extracts embedded JPEG from RAW using rawpy (fast).
    2. Generates Thumbnail and Preview files.
    3. Calculates CLIP embedding on the image data.
    """
    ensure_dirs()
    path_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()
    
    thumb_name = f"thumb_{path_hash}.jpg"
    preview_name = f"preview_{path_hash}.jpg" # For RAWs, preview is a large JPG
    
    thumb_out = os.path.join(THUMBNAIL_DIR, thumb_name)
    preview_out = os.path.join(PREVIEW_DIR, preview_name)

    embedding = None
    width, height = None, None

    try:
        # Open RAW file
        with rawpy.imread(file_path) as raw:
            
            # --- STRATEGY: Extract Embedded Preview (Super Fast) ---
            try:
                thumb = raw.extract_thumb()
            except rawpy.LibRawNoThumbnailError:
                # Fallback: Demosaic the raw data (Slow, ~2-5 seconds)
                print(f"No embedded thumb for {filename}, developing raw data...")
                rgb = raw.postprocess(use_camera_wb=True)
                image = Image.fromarray(rgb)
            else:
                # Determine format of embedded thumb
                if thumb.format == rawpy.ThumbFormat.JPEG:
                    image = Image.open(io.BytesIO(thumb.data))
                elif thumb.format == rawpy.ThumbFormat.BITMAP:
                    image = Image.fromarray(thumb.data)
            
            # Rotate based on EXIF orientation if needed (PIL usually handles this if loaded correctly)
            image = ImageOps.exif_transpose(image)
            image = image.convert("RGB")
            # For simplicity, we assume the embedded thumb is oriented correctly or frontend handles it.

            width, height = image.size

            # 1. Save Large Preview (e.g., max 1920px)
            if not os.path.exists(preview_out):
                preview_img = image.copy()
                preview_img.thumbnail((1920, 1920), Image.LANCZOS)
                preview_img.save(preview_out, "JPEG", quality=85, optimize=True)

            # 2. Save Small Thumbnail (e.g., 400px)
            if not os.path.exists(thumb_out):
                thumb_img = image.copy()
                thumb_img.thumbnail((300, 300), Image.LANCZOS)
                thumb_img.save(thumb_out, "JPEG", quality=70, optimize=True)
            
            # 3. Generate AI Embedding (FIXED)
            # Create a byte buffer, save image to it, then pass to AI
            img_byte_arr = io.BytesIO()
            # Convert to RGB to ensure compatibility (remove alpha if present)
            if image.mode in ("RGBA", "P"): 
                image = image.convert("RGB")
                
            image.save(img_byte_arr, format='JPEG')
            img_byte_arr.seek(0) # Reset pointer to start
            
            # Pass the bytes, not the PIL object
            embedding = generate_embedding(img_byte_arr)

    except Exception as e:
        print(f"Asset generation failed for {filename}: {e}")
        import traceback
        traceback.print_exc()
        return None, None, None, None, None

    return thumb_name, preview_name, embedding, width, height

def process_raw_file(full_path: str, filename: str):
    """
    Worker entry point for RAW images.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in RAW_EXTS:
        print(f"❌ Skipping non-RAW file: {filename}")
        return # Should be filtered by caller, but safety check
    
    db = SessionLocal()
    try:
        # 0. Check duplicate
        existing = db.query(RawImage).filter(RawImage.filename == filename).first()
        if existing:
            print(f"✅ RAW already processed: {filename}")
            return

        # 1. Extract Metadata
        meta = get_raw_metadata(full_path)
        if not meta:
            meta = {} # Continue even if meta fails, we can still process image

        # 2. Generate Assets & Embedding
        # This is combined because we want to open the heavy RAW file only once
        thumb_name, preview_name, embedding, w, h = generate_assets_and_embed(full_path, filename)

        if not thumb_name: 
            print(f"❌ Could not process image data for {filename}")
            return

        # 3. Geocoding
        city, state, country = None, None, None
        if meta.get('lat') and meta.get('lon'):
            loc = get_location_parts(meta['lat'], meta['lon'])
            if loc:
                city, state, country = loc['city'], loc['state'], loc['country']

        # 4. Save to DB
        raw_image = RawImage(
            filename=filename,
            extension=ext.replace('.', '').upper(), # Store "CR3" not ".cr3"
            file_size=os.path.getsize(full_path),
            capture_date=meta.get('date'),
            
            latitude=meta.get('lat'),
            longitude=meta.get('lon'),
            city=city,
            state=state,
            country=country,
            
            width=w,
            height=h,
            megapixels=round((w * h) / 1_000_000, 1) if w and h else 0,
            
            camera_make=meta.get('make'),
            camera_model=meta.get('model'),
            lens_make=meta.get('lens_make'),
            lens_model=meta.get('lens_model'),
            
            exposure_time=meta.get('exposure'),
            f_number=meta.get('f_number'),
            iso=meta.get('iso'),
            focal_length=meta.get('focal_length'),
            flash_fired=meta.get('flash_fired', False),
            
            embedding=embedding,
            is_processed=True
        )

        try:
            db.add(raw_image)
            db.commit()
            print(f"✅ Processed RAW: {filename}")
        except IntegrityError:
            db.rollback()
            print(f"Duplicate detected during insert for {filename}")

    except Exception as e:
        print(f"❌ Error processing RAW {filename}: {e}")
    finally:
        db.close()
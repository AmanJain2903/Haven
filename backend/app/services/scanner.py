import os
from datetime import datetime
from PIL import Image as PILImage, ImageOps, ExifTags
from PIL.ExifTags import TAGS
from PIL import ExifTags
from pillow_heif import register_heif_opener
from sqlalchemy.orm import Session
from app.models import Image
from app.core.config import settings
from PIL.TiffImagePlugin import IFDRational

# Register HEIC support (More images to be supported in later updates of Haven)
register_heif_opener()

THUMBNAIL_DIR = settings.THUMBNAIL_DIR

# Helper to convert ANY format (Tuple, Rational, Float) to a simple float
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
        # In testing environments, use temp directory
        import tempfile
        THUMBNAIL_DIR = os.path.join(tempfile.gettempdir(), "haven_thumbnails")
        os.makedirs(THUMBNAIL_DIR, exist_ok=True)


def extract_exif_data(img):
    """
    Robustly extracts camera gear and settings from HEIC/JPG.
    Traverses the 'ExifOffset' sub-directory for technical tags.
    """
    data = {
        "make": None, "model": None, 
        "exposure": None, "f_number": None, 
        "iso": None, "focal_length": None
    }
    
    # 1. Get the main EXIF object (Works for HEIC & JPG)
    exif = img.getexif()
    if not exif:
        return data

    # 2. Extract Main Tags (Make, Model, Orientation)
    for tag_id, value in exif.items():
        tag_name = TAGS.get(tag_id, tag_id)
        if tag_name == "Make":
            data["make"] = str(value).strip()
        elif tag_name == "Model":
            data["model"] = str(value).strip()

    # 3. Extract Technical Tags (The "Hidden" ExifIFD Sub-directory)
    # Tag 0x8769 (34665) holds the technical photo data
    try:
        exif_ifd = exif.get_ifd(0x8769) 
        
        for tag_id, value in exif_ifd.items():
            tag_name = TAGS.get(tag_id, tag_id)
            
            # ISO
            if tag_name == "ISOSpeedRatings":
                data["iso"] = value

            # Aperture (FNumber)
            elif tag_name == "FNumber":
                # Handles values like 1.8 or (18, 10)
                value = get_float(value)
                data["f_number"] = round(float(value), 1)

            # Focal Length
            elif tag_name == "FocalLength":
                value = get_float(value)
                data["focal_length"] = round(float(value), 1)

            # Shutter Speed (ExposureTime)
            elif tag_name == "ExposureTime":
                value = get_float(value)
                # We want to format 0.005 as "1/200"
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
    Uses modern Pillow get_ifd() for GPS data.
    """
    try:
        exif = img.getexif()
        if not exif:
            return None
            
        # 34853 is the tag ID for GPSInfo in Exif
        gps_info = exif.get_ifd(34853)
        
        if not gps_info:
            return None

        # Convert keys from IDs to Names (1 -> 'GPSLatitudeRef', 2-> 'GPSLatitude', 3 -> 'GPSLongitudeRef', 4 -> 'GPSLongitude')
        geotagging = {}
        for key, val in gps_info.items():
            name = ExifTags.GPSTAGS.get(key)
            if name:
                geotagging[name] = val
        
        return geotagging

    except Exception as e:
        print(f"Error parsing GPS: {e}")
        return None
    
def ensure_thumbnail(file_path: str, filename: str) -> str:
    """
    Creates a 300px optimized JPEG thumbnail.
    """

    # Ensure thumbnail directory exists
    ensure_thumbnail_dir()

    # Create output filename (e.g., thumb_IMG_1234.jpg)
    # rsplit removes the extension safely
    name_part = filename.rsplit('.', 1)[0]
    thumb_filename = f"thumb_{name_part}.jpg"
    thumb_path = os.path.join(THUMBNAIL_DIR, thumb_filename)
    
    # If it already exists, we are good
    if os.path.exists(thumb_path):
        return thumb_filename

    try:
        # Open image (handles HEIC/HEIF automatically)
        with PILImage.open(file_path) as img:
            # Checks EXIF tags and physically rotates the pixels to be upright
            img = ImageOps.exif_transpose(img)
            
            # Convert to RGB (removes Alpha channel if present)
            img = img.convert("RGB")
            
            # Shrink it! (300x300 for a thumbnail on the grid view)
            img.thumbnail((300, 300))
            
            # Save as optimized JPEG
            img.save(thumb_path, "JPEG", quality=70)
            
        return thumb_filename
    except Exception as e:
        print(f"Failed to create thumbnail for {filename}: {e}")
        return None

def scan_directory(directory_path: str, db: Session):
    print(f"Scanning directory: {directory_path}")

    count = 0
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png', '.heic', '.heif')):
                file_path = os.path.join(root, file)
                
                # Skip if already exists
                existing = db.query(Image).filter(Image.filename == file).first()
                if existing:
                    continue

                ensure_thumbnail(file_path, file)

                width, height = None, None
                mp = None

                try:
                    img = PILImage.open(file_path)
                    
                    # 1. Get Date
                    capture_date = datetime.now() # Default
                    # Try getting the standard Exif object
                    exif = img.getexif()
                    if exif:
                        # 36867 = DateTimeOriginal, 306 = DateTime
                        date_str = exif.get(36867) or exif.get(306)
                        if date_str:
                            try:
                                capture_date = datetime.strptime(date_str, '%Y:%m:%d %H:%M:%S')
                            except:
                                pass # Keep default if parse fails - Todays date
                        
                    # 2. Get GPS
                    lat = None
                    lon = None
                    geo = get_geotagging(img) # Pass the image object, not just exif
                    
                    if geo:
                        if 'GPSLatitude' in geo and 'GPSLongitude' in geo:
                            lat = get_decimal_from_dms(geo['GPSLatitude'], geo['GPSLatitudeRef'])
                            lon = get_decimal_from_dms(geo['GPSLongitude'], geo['GPSLongitudeRef'])

                    # 3. Extract Dimensions
                    width, height = img.size
                    if width and height:
                        mp = round((width * height) / 1_000_000, 1)
                    
                    # 4. Extract EXIF Metadata
                    exif_data = extract_exif_data(img)

                    # 5. Save to DB
                    db_image = Image(
                        filename=file,
                        file_path=file_path,
                        file_size=os.path.getsize(file_path),
                        capture_date=capture_date,
                        latitude=lat,
                        longitude=lon,
                        width=width,
                        height=height,
                        megapixels=mp,
                        camera_make=exif_data.get("make"),
                        camera_model=exif_data.get("model"),
                        exposure_time=exif_data.get("exposure"),
                        f_number=exif_data.get("f_number"),
                        iso=exif_data.get("iso"),
                        focal_length=exif_data.get("focal_length"),
                        is_processed=False
                    )
                    db.add(db_image)
                    count += 1
                    print(f"Found: {file} | Date: {capture_date} | GPS: {lat}, {lon}")

                except Exception as e:
                    print(f"Error processing {file}: {e}")

    db.commit() # All or nothing principle follwed here
    return count
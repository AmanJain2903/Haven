import os
from datetime import datetime
from PIL import Image as PILImage
from PIL import ExifTags
from pillow_heif import register_heif_opener
from sqlalchemy.orm import Session
from app.models import Image

# Register HEIC support (More images to be supported in later updates of Haven)
register_heif_opener()

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

                    # 3. Save to DB
                    db_image = Image(
                        filename=file,
                        file_path=file_path,
                        file_size=os.path.getsize(file_path),
                        capture_date=capture_date,
                        latitude=lat,
                        longitude=lon,
                        is_processed=False
                    )
                    db.add(db_image)
                    count += 1
                    print(f"Found: {file} | Date: {capture_date} | GPS: {lat}, {lon}")

                except Exception as e:
                    print(f"Error processing {file}: {e}")

    db.commit() # All or nothing principle follwed here
    return count
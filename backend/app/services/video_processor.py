import os
import json
import subprocess
import re
import numpy as np
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import Video
from app.core.config import settings
from app.ml.clip_client import generate_embedding
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from geopy.geocoders import Nominatim
import hashlib
from sqlalchemy.exc import IntegrityError

# Directory setup
THUMBNAIL_DIR = settings.VIDEO_THUMBNAIL_DIR
PREVIEW_DIR = settings.VIDEO_PREVIEW_DIR

# Define extensions for routing
VIDEO_EXTS = {'.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.mts', '.m2ts', '.3gp', '.3g2', '.wmv', '.flv', '.ogv'}

def ensure_dirs():
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)

def parse_iso6709(geo_string):
    """
    Parses ISO6709 string from video metadata (e.g., "+37.7749-122.4194/")
    Returns (lat, lon)
    """
    try:
        # Regex to find coordinate pairs
        match = re.match(r'([+-][0-9.]+)([+-][0-9.]+)', geo_string)
        if match:
            return float(match.group(1)), float(match.group(2))
    except:
        pass
    return None, None

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

def get_video_metadata(file_path):
    """
    Uses ffprobe to extract technical details and tags.
    Returns None for specific fields if data is missing.
    """
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", file_path
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        data = json.loads(result.stdout)
        
        format_info = data.get("format", {})
        tags = format_info.get("tags", {})
        # Find the first video stream
        video_stream = next((s for s in data.get("streams", []) if s["codec_type"] == "video"), None)
        
        if not video_stream:
            return None

        # Helper to safely convert types
        def safe_float(val):
            try: return float(val)
            except (ValueError, TypeError): return None

        def safe_int(val):
            try: return int(val)
            except (ValueError, TypeError): return None

        # FPS Calculation (handles "30000/1001" format)
        fps = None
        r_frame_rate = video_stream.get("r_frame_rate")
        if r_frame_rate and "/" in r_frame_rate:
            try:
                num, den = map(float, r_frame_rate.split('/'))
                if den > 0:
                    fps = round(num / den, 2)
            except:
                pass

        # 1. Technical Data
        meta = {
            "duration": safe_float(format_info.get("duration")),
            "width": safe_int(video_stream.get("width")),
            "height": safe_int(video_stream.get("height")),
            "codec": video_stream.get("codec_name"), # Returns None if missing
            "fps": fps,
            "size": safe_int(format_info.get("size")),
            "make": tags.get("com.apple.quicktime.make") or tags.get("make") or None,
            "model": tags.get("com.apple.quicktime.model") or tags.get("model") or None,
            "date": None,
            "lat": None,
            "lon": None
        }

        # 2. Date Parsing
        date_str = tags.get("creation_time")
        if date_str:
            try:
                # FFmpeg ISO format: 2025-01-01T12:00:00.000000Z
                meta["date"] = datetime.strptime(date_str.split(".")[0], "%Y-%m-%dT%H:%M:%S")
            except:
                pass

        # 3. GPS Parsing
        location_str = tags.get("com.apple.quicktime.location.ISO6709") or tags.get("location")
        if location_str:
            meta["lat"], meta["lon"] = parse_iso6709(location_str)

        return meta

    except Exception as e:
        print(f"⚠️ Metadata error for {file_path}: {e}")
        return None

def generate_assets(file_path, filename, duration):
    """
    Generates:
    1. Static Thumbnail (JPG)
    2. Hover Preview (Small MP4, 3 seconds)
    """
    ensure_dirs()
    path_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()
    
    thumb_name = f"thumb_{path_hash}.jpg"
    preview_name = f"preview_{path_hash}.mp4"
    
    thumb_out = os.path.join(THUMBNAIL_DIR, thumb_name)
    preview_out = os.path.join(PREVIEW_DIR, preview_name)

    # 1. Generate Thumbnail (at 10% of video or 1s mark)
    seek_time = min(1.0, duration * 0.1)
    if not os.path.exists(thumb_out):
        subprocess.run([
            "ffmpeg", "-y", "-ss", str(seek_time), "-i", file_path,
            "-vframes", "1", "-vf", "scale=400:-1", "-q:v", "5", thumb_out
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 2. Generate Hover Preview (3 seconds, muted, low res)
    # Takes a 3s slice from the 20% mark
    start_preview = min(duration * 0.2, duration - 3 if duration > 3 else 0)
    if not os.path.exists(preview_out):
        subprocess.run([
            "ffmpeg", "-y", "-ss", str(start_preview), "-t", "3", "-i", file_path,
            "-vf", "scale=320:-2", "-an", "-c:v", "libx264", "-preset", "ultrafast", preview_out
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    return thumb_name, preview_name

def extract_smart_frames(file_path, duration, count=4):
    """
    Extracts 4 temp frames spread across the video for AI analysis.
    Returns list of paths to temp images.
    """
    frames = []
    import tempfile
    
    # Calculate timestamps: 20%, 40%, 60%, 80%
    timestamps = [duration * (i + 1) / (count + 1) for i in range(count)]
    
    for i, ts in enumerate(timestamps):
        tmp_name = os.path.join(tempfile.gettempdir(), f"haven_smart_frame_{i}.jpg")
        subprocess.run([
            "ffmpeg", "-y", "-ss", str(ts), "-i", file_path,
            "-vframes", "1", "-vf", "scale=224:-1", "-q:v", "2", tmp_name
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(tmp_name):
            frames.append(tmp_name)
            
    return frames

def process_video_file(full_path: str, filename: str):
    """
    Worker entry point.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in VIDEO_EXTS:
        print(f"❌ Skipping non-video file: {filename}")
        return
    
    db = SessionLocal()
    try:
        # 0. Check if file is already processed
        existing_video = db.query(Video).filter(Video.filename == filename).first()
        if existing_video:
            print(f"✅ Video already processed: {filename}")
            return
        
        # 1. Extract Metadata
        meta = get_video_metadata(full_path)
        if not meta:
            print(f"❌ Failed to parse video: {filename}")
            return

        # 2. Generate Visual Assets (Thumb + Preview)
        thumb_name, preview_name = generate_assets(full_path, filename, meta['duration'])

        # 3. AI Smart Embedding (Multi-Frame Average)
        print(f"🧠 Video Analysis: {filename}...")
        temp_frames = extract_smart_frames(full_path, meta['duration'])
        vectors = []
        
        for frame in temp_frames:
            vec = generate_embedding(frame)
            if vec:
                vectors.append(vec)
            try:
                os.remove(frame) # Clean up
            except: pass
            
        # Average the vectors if we got any
        final_embedding = None
        if vectors:
            # Calculate mean across the 0-th axis (average of 4 vectors)
            final_embedding = np.mean(vectors, axis=0).tolist()
        
        city, state, country = None, None, None
        
        # Get Location Parts
        if meta['lat'] and meta['lon']:
            loc = get_location_parts(meta['lat'], meta['lon'])
            if loc:
                city = loc.get('city')
                state = loc.get('state')
                country = loc.get('country')

        # 4. Save to DB
        db_video = Video(
            filename=filename,
            file_size=meta['size'],
            capture_date=meta['date'],
            latitude=meta['lat'],
            longitude=meta['lon'],
            city=city,
            state=state,
            country=country,
            camera_make=meta['make'],
            camera_model=meta['model'],
            duration=meta['duration'],
            width=meta['width'],
            height=meta['height'],
            fps=meta['fps'],
            codec=meta['codec'],
            embedding=final_embedding,
            is_processed=True,
            # We don't store full paths for thumbnails, just filename
            # The UI knows where to look based on settings
        )
        # Note: You need to add thumbnail_path/preview_path columns to your model
        # if you want to store the hashes. For now, I'll assume they are derived 
        # or you can update the Video model to store `thumbnail_path=thumb_name`.
        
        try:
            db.add(db_video)
            db.commit()
            print(f"✅ Processed Video: {filename}")
        except IntegrityError:
            # 3. Handle Race Conditions (if two threads process same file at specific millisecond)
            db.rollback()
            print(f"Duplicate detected during insert for {filename}")

    except Exception as e:
        print(f"❌ Error processing video {filename}: {e}")
    finally:
        db.close()
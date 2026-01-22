from sqlalchemy.types import Integer, String, Float, Boolean, DateTime, BigInteger
from pgvector.sqlalchemy import Vector
from app.core.config import settings
dimension = settings.CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy import ARRAY

# Required folders for the system
REQUIRED_FOLDERS = ["images", "videos", "raw"]

# Hot storage folders for the system
HOT_STORAGE_FOLDERS = ["thumbnails", "video_thumbnails", "video_previews", "raw_thumbnails", "raw_previews"]

# File types
FILE_TYPES = ["image", "video", "raw"]

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.tiff', '.tif', '.heic', '.heif'}
VIDEO_EXTS = {'.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.mts', '.m2ts', '.3gp', '.3g2', '.wmv', '.flv', '.ogv'}
RAW_EXTS = {'.arw', '.cr2', '.cr3', '.dng', '.nef', '.orf', '.raf', '.rw2', '.srw', '.x3f'}

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
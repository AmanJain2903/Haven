from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.core.database import Base
import os
from sqlalchemy.types import BigInteger

class SystemConfig(Base):
    __tablename__ = "system_config"

    # Key:Value pairs for system-wide settings
    key = Column(String, primary_key=True, index=True, nullable=False)
    value = Column(String, nullable=True)

class Image(Base):
    __tablename__ = "images"

    # File Information
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True, unique=True)
    file_size = Column(Integer)
    capture_date = Column(DateTime(timezone=True), nullable=True)
    
    # GPS Data
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)

    # --- METADATA ---
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    megapixels = Column(Float, nullable=True)
    
    camera_make = Column(String, nullable=True)  # e.g. "Canon"
    camera_model = Column(String, nullable=True) # e.g. "EOS R5"
    
    exposure_time = Column(String, nullable=True) # e.g. "1/200"
    f_number = Column(Float, nullable=True)       # e.g. 1.8
    iso = Column(Integer, nullable=True)          # e.g. 800
    focal_length = Column(Float, nullable=True)   # e.g. 35.0
    # -------------------------

    # AI Embedding Vector (512 dimensions for CLIP ViT-B-32)
    dimension = int(os.getenv("CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION", 512))
    embedding = Column(Vector(dimension))
    
    # Status
    is_processed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Favorite
    is_favorite = Column(Boolean, default=False, server_default=text("FALSE"))

    # Album Information
    album_ids = Column(MutableList.as_mutable(ARRAY(Integer)), nullable=True, server_default=text("'{}'::integer[]")) # Array of album IDs 


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True, unique=True)
    file_size = Column(BigInteger)
    capture_date = Column(DateTime(timezone=True), nullable=True)

    # GPS Data
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)

    # Device Data
    camera_make = Column(String, nullable=True)  # e.g. "Canon"
    camera_model = Column(String, nullable=True) # e.g. "EOS R5"
    
    # Video Specifics
    duration = Column(Float, nullable=True)    # In seconds
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    fps = Column(Float, nullable=True)
    codec = Column(String, nullable=True)      # e.g., 'h264', 'hevc'
    
    # AI Data
    # 1. The searchable vector (averaged from multiple frames)
    dimension = int(os.getenv("CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION", 512))
    embedding = Column(Vector(dimension))
    
    is_processed = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Favorite
    is_favorite = Column(Boolean, default=False, server_default=text("FALSE"))

    # Album Information
    album_ids = Column(MutableList.as_mutable(ARRAY(Integer)), nullable=True, server_default=text("'{}'::integer[]")) # Array of album IDs 

class RawImage(Base):
    __tablename__ = "raw_images"

    # File Information
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True, unique=True)
    extension = Column(String, nullable=True, index=True)
    file_size = Column(Integer)
    capture_date = Column(DateTime(timezone=True), nullable=True)
    
    # GPS Data
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)

    # --- METADATA ---
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    megapixels = Column(Float, nullable=True)
    
    camera_make = Column(String, nullable=True)  # e.g. "Canon"
    camera_model = Column(String, nullable=True) # e.g. "EOS R5"
    lens_make = Column(String, nullable=True)    # e.g. "Canon"
    lens_model = Column(String, nullable=True, index=True)   # e.g. "EF 24-105mm f/4L IS USM"
    
    exposure_time = Column(String, nullable=True) # e.g. "1/200"
    f_number = Column(Float, nullable=True)       # e.g. 1.8
    iso = Column(Integer, nullable=True)          # e.g. 800
    focal_length = Column(Float, nullable=True)   # e.g. 35.0
    flash_fired = Column(Boolean, default=False)
    # -------------------------

    # AI Embedding Vector (512 dimensions for CLIP ViT-B-32)
    dimension = int(os.getenv("CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION", 512))
    embedding = Column(Vector(dimension))
    
    # Status
    is_processed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Favorite
    is_favorite = Column(Boolean, default=False, server_default=text("FALSE"))

    # Album Information
    album_ids = Column(MutableList.as_mutable(ARRAY(Integer)), nullable=True, server_default=text("'{}'::integer[]")) # Array of album IDs 

class Albums(Base):
    __tablename__ = "albums"

    # Album Information
    id = Column(Integer, primary_key=True, index=True)
    album_name = Column(String, index=True, unique=True, nullable=False)
    album_description = Column(String, nullable=True)
    album_size = Column(BigInteger, nullable=True, server_default=text("0"))

    # Album Cover Information
    album_cover_type = Column(String, nullable=True)
    album_cover_id = Column(Integer, nullable=True)

    # Album Content Counts
    album_images_count = Column(Integer, nullable=True, server_default=text("0"))
    album_videos_count = Column(Integer, nullable=True, server_default=text("0"))
    album_raw_images_count = Column(Integer, nullable=True, server_default=text("0"))
    album_total_count = Column(Integer, nullable=True, server_default=text("0"))

    # Album Content IDs
    album_images_ids = Column(MutableList.as_mutable(ARRAY(Integer)), nullable=True, server_default=text("'{}'::integer[]")) # Array of image IDs
    album_videos_ids = Column(MutableList.as_mutable(ARRAY(Integer)), nullable=True, server_default=text("'{}'::integer[]")) # Array of video IDs
    album_raw_images_ids = Column(MutableList.as_mutable(ARRAY(Integer)), nullable=True, server_default=text("'{}'::integer[]")) # Array of raw image IDs

    # Album Location
    album_location = Column(String, nullable=True)
    album_latitude = Column(Float, nullable=True)
    album_longitude = Column(Float, nullable=True)
    album_city = Column(String, nullable=True)
    album_state = Column(String, nullable=True)
    album_country = Column(String, nullable=True)

    # Album Timestamps
    album_created_at = Column(DateTime(timezone=True), server_default=func.now())
    album_updated_at = Column(DateTime(timezone=True), server_default=func.now())
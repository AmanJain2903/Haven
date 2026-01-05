from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.core.database import Base
import os

class Image(Base):
    __tablename__ = "images"

    # File Information
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String, unique=True, index=True)
    file_size = Column(Integer)
    
    # Metadata
    capture_date = Column(DateTime(timezone=True), server_default=func.now())
    camera_model = Column(String, nullable=True)
    
    # GPS Data
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # AI Embedding Vector (512 dimensions for CLIP ViT-B-32)
    dimension = int(os.getenv("CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION", 512))
    embedding = Column(Vector(dimension))
    
    # Status
    is_processed = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
import os
from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path
import platform

class Settings(BaseSettings):

    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "HavenFallback")

    PROJECT_VERSION: str = os.getenv("PROJECT_VERSION", "v0.0.0")

    # PostgreSQL settings
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "haven_admin_fallback")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "secure_password_fallback")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "haven_db_fallback")

    # Redis settings
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

    # Where the raw photos live (NAS/HDD)
    PHOTOS_DIR: str = os.getenv("PHOTOS_DIR", "/photos")

    @staticmethod
    def getDefaultPath() -> tuple[str, str]:
        """Get the default application data directory based on the platform."""
        if platform.system() == "Darwin":
            base = Path.home() / "Library" / "Application Support" 
        elif platform.system() == "Windows":
            base = Path.home() / "AppData" / "Roaming"
        else:
            base = Path.home() / ".local" / "share"
        
        path = base / "Haven" / "HavenData"
        path.mkdir(parents=True, exist_ok=True)
        return str(base), str(path)
    
    # Fallback for APP_DATA_DIR if database is not available
    _SYSTEM_PATH, _APP_DATA_DIR_FALLBACK = getDefaultPath()

    @property
    def SYSTEM_PATH(self) -> str:
        return self._SYSTEM_PATH
    
    @staticmethod
    def getDownloadPath() -> Path:
        return Path.home() / "Downloads" 
    
    DOWNLOAD_PATH: str = str(getDownloadPath())
        

    # AI/ML settings
    CLIP_SERVICE_MODEL: str = os.getenv("CLIP_SERVICE_MODEL", "clip-ViT-B-32")
    CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION: int = int(os.getenv("CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION", "512"))

    # Deployment settings
    HOST_URL: str = os.getenv("HOST_URL", "http://localhost:8000")

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def APP_DATA_DIR(self) -> str:
        """
        Read hot_storage_path from database.
        Falls back to environment variable if database is not available.
        """
        try:
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker
            
            engine = create_engine(self.DATABASE_URL)
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            db = SessionLocal()
            
            try:
                # Import here to avoid circular dependency
                from app import models
                config = db.query(models.SystemConfig).filter_by(key="hot_storage_path").first()
                if config and config.value:
                    return config.value
            finally:
                db.close()
        except Exception as e:
            # Database not available or error occurred, use fallback
            pass
        
        return self._APP_DATA_DIR_FALLBACK
    
    @property
    def THUMBNAIL_DIR(self):
        os.makedirs(os.path.join(self.APP_DATA_DIR, "thumbnails"), exist_ok=True)
        return os.path.join(self.APP_DATA_DIR, "thumbnails")

    @property
    def VIDEO_THUMBNAIL_DIR(self):
        os.makedirs(os.path.join(self.APP_DATA_DIR, "video_thumbnails"), exist_ok=True)
        return os.path.join(self.APP_DATA_DIR, "video_thumbnails")

    @property
    def VIDEO_PREVIEW_DIR(self):
        os.makedirs(os.path.join(self.APP_DATA_DIR, "video_previews"), exist_ok=True)
        return os.path.join(self.APP_DATA_DIR, "video_previews")
    
    @property
    def RAW_THUMBNAIL_DIR(self):
        os.makedirs(os.path.join(self.APP_DATA_DIR, "raw_thumbnails"), exist_ok=True)
        return os.path.join(self.APP_DATA_DIR, "raw_thumbnails")
    
    @property
    def RAW_PREVIEW_DIR(self):
        os.makedirs(os.path.join(self.APP_DATA_DIR, "raw_previews"), exist_ok=True)
        return os.path.join(self.APP_DATA_DIR, "raw_previews")

    class Config:
        env_file = ".env"
        extra = "ignore" 

settings = Settings()
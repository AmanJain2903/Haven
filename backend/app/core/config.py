import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):

    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "HavenFallback")

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
    
    # Where we store generated stuff like Thumbnails, Logs (Server's Internal SSD/HDD)
    APP_DATA_DIR: str = os.getenv("APP_DATA_DIR", "/data")

    # AI/ML settings
    CLIP_SERVICE_MODEL: str = os.getenv("CLIP_SERVICE_MODEL", "clip-ViT-B-32")
    CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION: int = int(os.getenv("CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION", "512"))

    # Deployment settings
    HOST_URL: str = os.getenv("HOST_URL", "http://localhost:8000")

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def THUMBNAIL_DIR(self):
        return os.path.join(self.APP_DATA_DIR, "thumbnails")

    @property
    def VIDEO_THUMBNAIL_DIR(self):
        return os.path.join(self.APP_DATA_DIR, "video_thumbnails")

    @property
    def VIDEO_PREVIEW_DIR(self):
        return os.path.join(self.APP_DATA_DIR, "video_previews")

    class Config:
        env_file = ".env"
        extra = "ignore" 

settings = Settings()
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # PostgreSQL settings
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "HavenFallback")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "haven_admin_fallback")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "secure_password_fallback")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "haven_db_fallback")

    # AI/ML settings
    CLIP_SERVICE_MODEL: str = os.getenv("CLIP_SERVICE_MODEL", "clip-ViT-B-32")
    CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION: int = int(os.getenv("CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION", "512"))

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    class Config:
        env_file = ".env"

settings = Settings()
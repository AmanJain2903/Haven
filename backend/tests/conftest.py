"""
Pytest configuration and shared fixtures for Haven API tests.
"""
import pytest
import os
import tempfile
import shutil
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, PickleType, BigInteger
from sqlalchemy.sql import text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql import func
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.dialects.sqlite import JSON
from unittest.mock import patch, MagicMock, Mock

# Set environment variable to indicate we're in test mode
os.environ["TESTING"] = "1"

# Mock the database engine creation to prevent connecting to PostgreSQL
mock_engine = MagicMock()
mock_engine.connect = MagicMock()

# Patch engine before any imports
with patch('app.core.database.create_engine', return_value=mock_engine):
    pass

# Use in-memory SQLite for testing (fast, isolated)
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

# Create a new Base for testing
TestBase = declarative_base()

# Test version of Image model compatible with SQLite
# Note: Added file_path for test compatibility even though it's not in production model
class Image(TestBase):
    """Test version of Image model compatible with SQLite"""
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    is_favorite = Column(Boolean, default=False, server_default=text("FALSE"))
    file_path = Column(String, unique=True, index=True)  # Added for test compatibility
    file_size = Column(Integer)
    capture_date = Column(DateTime(timezone=True), server_default=func.now())
    camera_make = Column(String, nullable=True)
    camera_model = Column(String, nullable=True)
    exposure_time = Column(String, nullable=True)
    f_number = Column(Float, nullable=True)
    iso = Column(Integer, nullable=True)
    focal_length = Column(Float, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    megapixels = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    embedding = Column(PickleType)  # Use PickleType instead of Vector for SQLite
    is_processed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    album_ids = Column(JSON, nullable=True, default=list)  # SQLite-compatible array


# Test version of Video model
class Video(TestBase):
    """Test version of Video model compatible with SQLite"""
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    is_favorite = Column(Boolean, default=False, server_default=text("FALSE"))
    file_size = Column(BigInteger)
    capture_date = Column(DateTime(timezone=True), server_default=func.now())
    camera_make = Column(String, nullable=True)
    camera_model = Column(String, nullable=True)
    duration = Column(Float, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    fps = Column(Float, nullable=True)
    codec = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    embedding = Column(PickleType)
    is_processed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    album_ids = Column(JSON, nullable=True, default=list)


# Test version of RawImage model
class RawImage(TestBase):
    """Test version of RawImage model compatible with SQLite"""
    __tablename__ = "raw_images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    extension = Column(String, nullable=True)
    is_favorite = Column(Boolean, default=False, server_default=text("FALSE"))
    file_size = Column(Integer)
    capture_date = Column(DateTime(timezone=True), server_default=func.now())
    camera_make = Column(String, nullable=True)
    camera_model = Column(String, nullable=True)
    lens_make = Column(String, nullable=True)
    lens_model = Column(String, nullable=True)
    exposure_time = Column(String, nullable=True)
    f_number = Column(Float, nullable=True)
    iso = Column(Integer, nullable=True)
    focal_length = Column(Float, nullable=True)
    flash_fired = Column(Boolean, default=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    megapixels = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    embedding = Column(PickleType)
    is_processed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    album_ids = Column(JSON, nullable=True, default=list)


# Test version of Albums model
class Albums(TestBase):
    """Test version of Albums model compatible with SQLite"""
    __tablename__ = "albums"

    id = Column(Integer, primary_key=True, index=True)
    album_name = Column(String, index=True, nullable=False)
    album_description = Column(String, nullable=True)
    album_size = Column(BigInteger, nullable=True, server_default=text("0"))
    album_cover_type = Column(String, nullable=True)
    album_cover_id = Column(Integer, nullable=True)
    album_images_count = Column(Integer, nullable=True, server_default=text("0"))
    album_videos_count = Column(Integer, nullable=True, server_default=text("0"))
    album_raw_images_count = Column(Integer, nullable=True, server_default=text("0"))
    album_total_count = Column(Integer, nullable=True, server_default=text("0"))
    album_images_ids = Column(JSON, nullable=True, default=list)
    album_videos_ids = Column(JSON, nullable=True, default=list)
    album_raw_images_ids = Column(JSON, nullable=True, default=list)
    album_location = Column(String, nullable=True)
    album_latitude = Column(Float, nullable=True)
    album_longitude = Column(Float, nullable=True)
    album_city = Column(String, nullable=True)
    album_state = Column(String, nullable=True)
    album_country = Column(String, nullable=True)
    album_created_at = Column(DateTime(timezone=True), server_default=func.now())
    album_updated_at = Column(DateTime(timezone=True), server_default=func.now())


# Test version of SystemConfig model
class SystemConfig(TestBase):
    """Test version of SystemConfig model"""
    __tablename__ = "system_config"

    key = Column(String, primary_key=True, index=True, nullable=False)
    value = Column(String, nullable=True)


# Monkey-patch BEFORE any app imports
import app.models
import app.core.database

# Replace all models
app.models.Image = Image
app.models.Video = Video
app.models.RawImage = RawImage
app.models.Albums = Albums
app.models.SystemConfig = SystemConfig
# Replace the Base to prevent table creation with Vector type
app.models.Base = TestBase

# Mock the engine to prevent actual database connection
import app.core.database as db_module
test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
db_module.engine = test_engine

# Store original get_db for reference
from app.core.database import get_db

# Patch metadata.create_all to prevent it from running during import
with patch.object(TestBase.metadata, 'create_all'):
    # NOW import the FastAPI app (after all patching)
    from app.main import app as fastapi_app

@pytest.fixture(scope="function")
def db_session():
    """
    Creates a fresh database for each test.
    Tears down after test completes.
    """
    # Create fresh engine for each test
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    TestBase.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.close()
        TestBase.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture(scope="function")
def client(db_session):
    """
    FastAPI test client with database dependency override.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def sample_image_data():
    """
    Sample image metadata for testing.
    """
    return {
        "filename": "test_beach.jpg",
        "is_favorite": False,
        "file_path": "/test/photos/test_beach.jpg",
        "file_size": 2048576,
        "latitude": 37.775,
        "longitude": -122.419,
        "is_processed": False
    }


@pytest.fixture
def sample_images(db_session):
    """
    Creates multiple sample images in the database.
    """
    images = [
        Image(
            filename="beach.jpg",
            file_path="/test/beach.jpg",
            is_favorite=False,
            file_size=1024000,
            width=4000,
            height=3000,
            megapixels=12.0,
            camera_make="Canon",
            camera_model="EOS R5",
            exposure_time="1/500",
            f_number=2.8,
            iso=100,
            focal_length=50.0,
            latitude=37.775,
            longitude=-122.419,
            city="San Francisco",
            state="California",
            country="United States",
            is_processed=False
        ),
        Image(
            filename="mountain.jpg",
            file_path="/test/mountain.jpg",
            is_favorite=False,
            file_size=2048000,
            width=3840,
            height=2160,
            megapixels=8.3,
            camera_make="Sony",
            camera_model="A7 III",
            exposure_time="1/250",
            f_number=4.0,
            iso=200,
            focal_length=24.0,
            latitude=40.712,
            longitude=-74.006,
            city="New York",
            state="New York",
            country="United States",
            is_processed=False
        ),
        Image(
            filename="city.heic",
            file_path="/test/city.heic",
            is_favorite=False,
            file_size=3072000,
            width=4032,
            height=3024,
            megapixels=12.2,
            camera_make="Apple",
            camera_model="iPhone 14 Pro",
            exposure_time="1/120",
            f_number=1.8,
            iso=64,
            focal_length=26.0,
            is_processed=True,
            embedding=[0.1] * 512  # Mock embedding
        ),
    ]
    
    for img in images:
        db_session.add(img)
    db_session.commit()
    
    return images


@pytest.fixture
def mock_embedding():
    """
    Returns a mock 512-dimensional embedding vector.
    """
    return [0.5] * 512


@pytest.fixture
def mock_embedding_vector():
    """
    Returns a mock 512-dimensional embedding vector (numpy array compatible).
    """
    import numpy as np
    return np.array([0.5] * 512)


@pytest.fixture
def sample_videos(db_session):
    """Creates multiple sample videos in the database."""
    videos = [
        Video(
            filename="beach_video.mp4",
            is_favorite=False,
            file_size=10485760,
            duration=30.5,
            width=1920,
            height=1080,
            fps=30.0,
            codec="h264",
            camera_make="Canon",
            camera_model="EOS R5",
            latitude=37.775,
            longitude=-122.419,
            city="San Francisco",
            state="California",
            country="United States",
            is_processed=False
        ),
        Video(
            filename="mountain_video.mov",
            is_favorite=True,
            file_size=20971520,
            duration=60.0,
            width=3840,
            height=2160,
            fps=60.0,
            codec="hevc",
            camera_make="Sony",
            camera_model="A7 III",
            latitude=40.712,
            longitude=-74.006,
            city="New York",
            state="New York",
            country="United States",
            is_processed=True,
            embedding=[0.2] * 512
        ),
    ]
    
    for vid in videos:
        db_session.add(vid)
    db_session.commit()
    
    return videos


@pytest.fixture
def sample_raw_images(db_session):
    """Creates multiple sample raw images in the database."""
    raw_images = [
        RawImage(
            filename="beach_raw.arw",
            extension=".arw",
            is_favorite=False,
            file_size=31457280,
            width=6000,
            height=4000,
            megapixels=24.0,
            camera_make="Sony",
            camera_model="A7R IV",
            lens_make="Sony",
            lens_model="FE 24-70mm f/2.8 GM",
            exposure_time="1/500",
            f_number=2.8,
            iso=100,
            focal_length=50.0,
            flash_fired=False,
            latitude=37.775,
            longitude=-122.419,
            city="San Francisco",
            state="California",
            country="United States",
            is_processed=False
        ),
        RawImage(
            filename="portrait_raw.cr2",
            extension=".cr2",
            is_favorite=True,
            file_size=25165824,
            width=5472,
            height=3648,
            megapixels=20.0,
            camera_make="Canon",
            camera_model="EOS 5D Mark IV",
            lens_make="Canon",
            lens_model="EF 85mm f/1.2L USM",
            exposure_time="1/125",
            f_number=1.2,
            iso=400,
            focal_length=85.0,
            flash_fired=True,
            is_processed=True,
            embedding=[0.3] * 512
        ),
    ]
    
    for raw in raw_images:
        db_session.add(raw)
    db_session.commit()
    
    return raw_images


@pytest.fixture
def sample_albums(db_session):
    """Creates sample albums in the database."""
    albums = [
        Albums(
            album_name="Beach Vacation",
            album_description="Photos from beach vacation",
            album_size=10485760,
            album_cover_type="image",
            album_cover_id=1,
            album_images_count=5,
            album_videos_count=2,
            album_raw_images_count=3,
            album_total_count=10,
            album_images_ids=[1, 2, 3, 4, 5],
            album_videos_ids=[1, 2],
            album_raw_images_ids=[1, 2, 3],
            album_city="San Francisco",
            album_state="California",
            album_country="United States",
            album_latitude=37.775,
            album_longitude=-122.419
        ),
        Albums(
            album_name="Mountain Trip",
            album_description="Mountain adventure photos",
            album_size=20971520,
            album_cover_type="video",
            album_cover_id=1,
            album_images_count=3,
            album_videos_count=1,
            album_raw_images_count=0,
            album_total_count=4,
            album_images_ids=[1, 2, 3],
            album_videos_ids=[1],
            album_raw_images_ids=[]
        ),
    ]
    
    for album in albums:
        db_session.add(album)
    db_session.commit()
    
    return albums


@pytest.fixture
def sample_system_config(db_session):
    """Creates sample system configuration."""
    configs = [
        SystemConfig(key="storage_path", value="/tmp/test_storage"),
        SystemConfig(key="hot_storage_path", value="/tmp/test_hot_storage"),
    ]
    
    for config in configs:
        db_session.add(config)
    db_session.commit()
    
    return configs


@pytest.fixture
def temp_storage_dir():
    """Creates a temporary directory for storage testing."""
    temp_dir = tempfile.mkdtemp()
    # Create subdirectories
    os.makedirs(os.path.join(temp_dir, "images"), exist_ok=True)
    os.makedirs(os.path.join(temp_dir, "videos"), exist_ok=True)
    os.makedirs(os.path.join(temp_dir, "raw"), exist_ok=True)
    
    yield temp_dir
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def mock_redis_client():
    """Mock Redis client for testing."""
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = None
    mock_redis.set.return_value = True
    mock_redis.hgetall.return_value = {}
    mock_redis.hset.return_value = True
    mock_redis.delete.return_value = True
    mock_redis.expire.return_value = True
    return mock_redis


@pytest.fixture
def mock_celery_app():
    """Mock Celery app for testing."""
    mock_celery = MagicMock()
    mock_celery.control.ping.return_value = [{"celery@hostname": {"ok": "pong"}}]
    mock_celery.control.revoke.return_value = None
    return mock_celery


@pytest.fixture
def mock_file_response():
    """Mock file response for testing file serving endpoints."""
    from fastapi.responses import FileResponse
    mock_response = MagicMock(spec=FileResponse)
    return mock_response

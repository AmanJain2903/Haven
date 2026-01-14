"""
Pytest configuration and shared fixtures for Haven API tests.
"""
import pytest
import os
import sys
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, PickleType
from sqlalchemy.sql import text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql import func
from unittest.mock import patch, MagicMock

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


# Test version of SystemConfig model
class SystemConfig(TestBase):
    """Test version of SystemConfig model"""
    __tablename__ = "system_config"

    key = Column(String, primary_key=True, index=True, nullable=False)
    value = Column(String, nullable=True)


# Monkey-patch BEFORE any app imports
import app.models
import app.core.database

# Replace the Image model
app.models.Image = Image
# Replace the SystemConfig model
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

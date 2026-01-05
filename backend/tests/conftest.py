"""
Pytest configuration and shared fixtures for Haven API tests.
"""
import pytest
import os
import sys
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, PickleType
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql import func

# Set environment variable to indicate we're in test mode
os.environ["TESTING"] = "1"

# Use in-memory SQLite for testing (fast, isolated)
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

# Create a new Base for testing
TestBase = declarative_base()

# Test version of Image model compatible with SQLite
class Image(TestBase):
    """Test version of Image model compatible with SQLite"""
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String, unique=True, index=True)
    file_size = Column(Integer)
    capture_date = Column(DateTime(timezone=True), server_default=func.now())
    camera_model = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    embedding = Column(PickleType)  # Use PickleType instead of Vector for SQLite
    is_processed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Monkey-patch BEFORE any app imports
import app.models
import app.core.database

# Replace the Image model
app.models.Image = Image
# Replace the Base to prevent table creation with Vector type
app.models.Base = TestBase

# Store original get_db for reference
from app.core.database import get_db

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
            file_size=1024000,
            latitude=37.775,
            longitude=-122.419,
            is_processed=False
        ),
        Image(
            filename="mountain.jpg",
            file_path="/test/mountain.jpg",
            file_size=2048000,
            latitude=40.712,
            longitude=-74.006,
            is_processed=False
        ),
        Image(
            filename="city.heic",
            file_path="/test/city.heic",
            file_size=3072000,
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

"""
Tests for database models.
"""
import pytest
from datetime import datetime
from app.models import Image


class TestImageModel:
    """Test suite for Image model"""

    def test_create_image_minimal(self, db_session):
        """Test creating image with minimal required fields"""
        image = Image(
            filename="test.jpg",
            file_path="/test/test.jpg",
            file_size=1024
        )
        db_session.add(image)
        db_session.commit()
        
        assert image.id is not None
        assert image.filename == "test.jpg"
        assert image.file_path == "/test/test.jpg"
        assert image.file_size == 1024
        assert image.is_processed == False

    def test_create_image_with_gps(self, db_session):
        """Test creating image with GPS coordinates"""
        image = Image(
            filename="vacation.jpg",
            file_path="/test/vacation.jpg",
            file_size=2048000,
            latitude=37.775,
            longitude=-122.419
        )
        db_session.add(image)
        db_session.commit()
        
        assert image.latitude == 37.775
        assert image.longitude == -122.419

    def test_create_image_with_embedding(self, db_session):
        """Test creating image with AI embedding"""
        embedding_vector = [0.1] * 512
        
        image = Image(
            filename="processed.jpg",
            file_path="/test/processed.jpg",
            file_size=1024000,
            embedding=embedding_vector,
            is_processed=True
        )
        db_session.add(image)
        db_session.commit()
        
        # Retrieve and verify
        retrieved = db_session.query(Image).filter(Image.id == image.id).first()
        assert retrieved.embedding == embedding_vector
        assert retrieved.is_processed == True

    def test_image_capture_date_default(self, db_session):
        """Test that capture_date has a default value"""
        image = Image(
            filename="test.jpg",
            file_path="/test/test.jpg",
            file_size=1024
        )
        db_session.add(image)
        db_session.commit()
        
        # Should have a capture date (server default)
        assert image.capture_date is not None
        assert isinstance(image.capture_date, datetime)

    def test_unique_file_path_constraint(self, db_session):
        """Test that file_path must be unique"""
        image1 = Image(
            filename="test1.jpg",
            file_path="/test/duplicate.jpg",
            file_size=1024
        )
        db_session.add(image1)
        db_session.commit()
        
        # Try to add another image with same path
        image2 = Image(
            filename="test2.jpg",
            file_path="/test/duplicate.jpg",
            file_size=2048
        )
        db_session.add(image2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            db_session.commit()

    def test_query_unprocessed_images(self, db_session, sample_images):
        """Test querying for unprocessed images"""
        unprocessed = db_session.query(Image).filter(
            Image.is_processed == False
        ).all()
        
        assert len(unprocessed) >= 2  # From sample_images fixture

    def test_query_images_with_gps(self, db_session, sample_images):
        """Test querying for images with GPS data"""
        with_gps = db_session.query(Image).filter(
            Image.latitude.isnot(None),
            Image.longitude.isnot(None)
        ).all()
        
        assert len(with_gps) >= 2  # From sample_images fixture

    def test_update_image_embedding(self, db_session):
        """Test updating an image with embedding after processing"""
        image = Image(
            filename="to_process.jpg",
            file_path="/test/to_process.jpg",
            file_size=1024,
            is_processed=False
        )
        db_session.add(image)
        db_session.commit()
        
        # Simulate processing
        image.embedding = [0.5] * 512
        image.is_processed = True
        db_session.commit()
        
        # Verify update
        updated = db_session.query(Image).filter(
            Image.id == image.id
        ).first()
        
        assert updated.embedding is not None
        assert updated.is_processed == True
        assert len(updated.embedding) == 512

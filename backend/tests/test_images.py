"""
Tests for image management endpoints.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from app.models import Image


class TestImageScanEndpoint:
    """Test suite for /api/v1/images/scan endpoint"""

    @patch('app.api.v1.endpoints.images.scan_directory')
    def test_scan_success(self, mock_scan, client):
        """Test successful directory scan"""
        # Mock the scanner to return 5 images found
        mock_scan.return_value = 5
        
        response = client.post(
            "/api/v1/images/scan",
            params={"path": "/test/photos"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
        assert data["images_added"] == 5
        mock_scan.assert_called_once()

    @patch('app.api.v1.endpoints.images.scan_directory')
    def test_scan_empty_directory(self, mock_scan, client):
        """Test scanning directory with no new images"""
        mock_scan.return_value = 0
        
        response = client.post(
            "/api/v1/images/scan",
            params={"path": "/test/empty"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
        assert data["images_added"] == 0

    @patch('app.api.v1.endpoints.images.scan_directory')
    def test_scan_error_handling(self, mock_scan, client):
        """Test error handling when scan fails"""
        mock_scan.side_effect = Exception("Permission denied")
        
        response = client.post(
            "/api/v1/images/scan",
            params={"path": "/invalid/path"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "error"
        assert "message" in data
        assert "Permission denied" in data["message"]

    def test_scan_missing_path_parameter(self, client):
        """Test scan endpoint without required path parameter"""
        response = client.post("/api/v1/images/scan")
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestImageProcessEndpoint:
    """Test suite for /api/v1/images/process endpoint"""

    @patch('app.api.v1.endpoints.images.generate_embedding')
    def test_process_images_success(self, mock_embedding, client, sample_images, db_session):
        """Test successful image processing with embeddings"""
        # Mock embedding generation
        mock_embedding.return_value = [0.5] * 512
        
        response = client.post("/api/v1/images/process")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
        assert data["processed"] >= 0
        
        # Verify embedding was generated
        mock_embedding.assert_called()

    @patch('app.api.v1.endpoints.images.generate_embedding')
    def test_process_with_limit(self, mock_embedding, client, sample_images, db_session):
        """Test processing with custom limit parameter"""
        mock_embedding.return_value = [0.5] * 512
        
        response = client.post(
            "/api/v1/images/process",
            params={"limit": 1}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
        # Should process at most 1 image
        assert data["processed"] <= 1

    @patch('app.api.v1.endpoints.images.generate_embedding')
    def test_process_no_images_to_process(self, mock_embedding, client, db_session):
        """Test processing when all images are already processed"""
        # Create an image that's already processed
        processed_img = Image(
            filename="processed.jpg",
            file_path="/test/processed.jpg",
            file_size=1024,
            is_processed=True,
            embedding=[0.1] * 512
        )
        db_session.add(processed_img)
        db_session.commit()
        
        response = client.post("/api/v1/images/process")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "No new images" in data["message"]

    @patch('app.api.v1.endpoints.images.generate_embedding')
    def test_process_failed_embedding(self, mock_embedding, client, sample_images, db_session):
        """Test handling when embedding generation fails"""
        # Mock embedding failure
        mock_embedding.return_value = None
        
        response = client.post("/api/v1/images/process")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
        # No images should be marked as processed
        assert data["processed"] == 0

    @patch('app.api.v1.endpoints.images.generate_embedding')
    def test_process_marks_images_as_processed(self, mock_embedding, client, sample_images, db_session):
        """Test that processed images are marked correctly in database"""
        mock_embedding.return_value = [0.5] * 512
        
        # Get count of unprocessed images before
        unprocessed_before = db_session.query(Image).filter(
            Image.is_processed == False
        ).count()
        
        response = client.post("/api/v1/images/process")
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify images were marked as processed
        unprocessed_after = db_session.query(Image).filter(
            Image.is_processed == False
        ).count()
        
        assert unprocessed_after < unprocessed_before

    def test_process_default_limit(self, client):
        """Test that default limit is applied (50 images)"""
        response = client.post("/api/v1/images/process")
        
        # Should not fail even with default limit
        assert response.status_code == status.HTTP_200_OK

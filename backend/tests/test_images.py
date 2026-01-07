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


class TestGetImagesEndpoint:
    """Test suite for GET /api/v1/images/ endpoint"""

    def test_get_images_empty_database(self, client, db_session):
        """Test getting images when database is empty"""
        response = client.get("/api/v1/images/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_images_returns_list(self, client, sample_images, db_session):
        """Test that endpoint returns list of images"""
        response = client.get("/api/v1/images/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_get_images_structure(self, client, sample_images, db_session):
        """Test the structure of returned image data"""
        response = client.get("/api/v1/images/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check first image has required fields
        first_image = data[0]
        assert "id" in first_image
        assert "filename" in first_image
        assert "thumbnail_url" in first_image
        assert "image_url" in first_image
        assert "date" in first_image
        assert "latitude" in first_image
        assert "longitude" in first_image
        assert "width" in first_image
        assert "height" in first_image
        assert "megapixels" in first_image
        assert "metadata" in first_image
        # Check metadata structure
        metadata = first_image["metadata"]
        assert "camera_make" in metadata
        assert "camera_model" in metadata
        assert "exposure_time" in metadata
        assert "f_number" in metadata
        assert "iso" in metadata
        assert "focal_length" in metadata
        assert "size_bytes" in metadata

    def test_get_images_pagination_skip(self, client, sample_images, db_session):
        """Test pagination with skip parameter"""
        # Get all images
        response_all = client.get("/api/v1/images/")
        all_data = response_all.json()
        
        # Skip first image
        response_skip = client.get("/api/v1/images/?skip=1")
        skip_data = response_skip.json()
        
        if len(all_data) > 1:
            assert len(skip_data) == len(all_data) - 1

    def test_get_images_pagination_limit(self, client, sample_images, db_session):
        """Test pagination with limit parameter"""
        response = client.get("/api/v1/images/?limit=1")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) <= 1


class TestGetImageFileEndpoint:
    """Test suite for GET /api/v1/images/file/{image_id} endpoint"""

    def test_get_image_file_not_found(self, client, db_session):
        """Test requesting non-existent image"""
        response = client.get("/api/v1/images/file/999999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.images.FileResponse')
    def test_get_image_file_jpeg(self, mock_file_response, client, db_session):
        """Test serving a standard JPEG file"""
        # Create a test image
        test_image = Image(
            filename="test.jpg",
            file_path="/test/test.jpg",
            file_size=1024
        )
        db_session.add(test_image)
        db_session.commit()
        
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/images/file/{test_image.id}")
        
        # Should call FileResponse with the file path
        mock_file_response.assert_called_once_with("/test/test.jpg")

    @patch('app.api.v1.endpoints.images.pillow_heif')
    @patch('app.api.v1.endpoints.images.Image')
    def test_get_image_file_heic_conversion(self, mock_pil_image, mock_heif, client, db_session):
        """Test HEIC to JPEG conversion"""
        # Create a HEIC test image
        heic_image = Image(
            filename="test.heic",
            file_path="/test/test.heic",
            file_size=2048
        )
        db_session.add(heic_image)
        db_session.commit()
        
        # Mock pillow_heif
        mock_heif_file = MagicMock()
        mock_heif_file.mode = 'RGB'
        mock_heif_file.size = (1920, 1080)
        mock_heif_file.data = b'fake_image_data'
        mock_heif.read_heif.return_value = mock_heif_file
        
        # Mock PIL Image
        mock_img = MagicMock()
        mock_pil_image.frombytes.return_value = mock_img
        
        response = client.get(f"/api/v1/images/file/{heic_image.id}")
        
        # Should convert and return JPEG
        assert response.status_code == status.HTTP_200_OK
        mock_heif.read_heif.assert_called_once_with("/test/test.heic")
        mock_img.save.assert_called_once()

    @patch('app.api.v1.endpoints.images.pillow_heif')
    @patch('app.api.v1.endpoints.images.FileResponse')
    def test_get_image_file_heic_conversion_fallback(self, mock_file_response, mock_heif, client, db_session):
        """Test HEIC conversion fallback on error"""
        # Create a HEIC test image
        heic_image = Image(
            filename="corrupted.heic",
            file_path="/test/corrupted.heic",
            file_size=2048
        )
        db_session.add(heic_image)
        db_session.commit()
        
        # Mock conversion failure
        mock_heif.read_heif.side_effect = Exception("Conversion failed")
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/images/file/{heic_image.id}")
        
        # Should fallback to FileResponse
        mock_file_response.assert_called_once_with("/test/corrupted.heic")

    @patch('app.api.v1.endpoints.images.FileResponse')
    def test_get_image_file_png(self, mock_file_response, client, db_session):
        """Test serving a PNG file"""
        png_image = Image(
            filename="test.png",
            file_path="/test/test.png",
            file_size=3072
        )
        db_session.add(png_image)
        db_session.commit()
        
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/images/file/{png_image.id}")
        
        mock_file_response.assert_called_once_with("/test/test.png")


class TestGetThumbnailEndpoint:
    """Test suite for GET /api/v1/images/thumbnail/{image_id} endpoint"""

    def test_get_thumbnail_not_found(self, client, db_session):
        """Test requesting thumbnail for non-existent image"""
        response = client.get("/api/v1/images/thumbnail/999999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.images.os.path.exists')
    @patch('app.api.v1.endpoints.images.FileResponse')
    def test_get_thumbnail_exists(self, mock_file_response, mock_exists, client, db_session):
        """Test serving existing thumbnail"""
        test_image = Image(
            filename="photo.jpg",
            file_path="/test/photo.jpg",
            file_size=1024
        )
        db_session.add(test_image)
        db_session.commit()
        
        # Mock thumbnail exists
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/images/thumbnail/{test_image.id}")
        
        # Should serve the thumbnail (hash-based filename)
        mock_file_response.assert_called_once()
        call_args = mock_file_response.call_args[0][0]
        assert "thumb_" in call_args
        assert call_args.endswith(".jpg")

    @patch('app.api.v1.endpoints.images.os.path.exists')
    @patch('app.api.v1.endpoints.images.FileResponse')
    def test_get_thumbnail_fallback_to_original(self, mock_file_response, mock_exists, client, db_session):
        """Test fallback to original image when thumbnail missing"""
        test_image = Image(
            filename="photo.jpg",
            file_path="/test/photo.jpg",
            file_size=1024
        )
        db_session.add(test_image)
        db_session.commit()
        
        # Mock thumbnail doesn't exist
        mock_exists.return_value = False
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/images/thumbnail/{test_image.id}")
        
        # Should serve the original image as fallback
        mock_file_response.assert_called_once_with("/test/photo.jpg")

    @patch('app.api.v1.endpoints.images.os.path.exists')
    @patch('app.api.v1.endpoints.images.FileResponse')
    def test_get_thumbnail_heic_image(self, mock_file_response, mock_exists, client, db_session):
        """Test thumbnail for HEIC image (thumbnail is JPEG)"""
        heic_image = Image(
            filename="photo.heic",
            file_path="/test/photo.heic",
            file_size=2048
        )
        db_session.add(heic_image)
        db_session.commit()
        
        # Mock thumbnail exists (as JPEG)
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/images/thumbnail/{heic_image.id}")
        
        # Thumbnail should be .jpg even though source is .heic (hash-based filename)
        call_args = mock_file_response.call_args[0][0]
        assert "thumb_" in call_args
        assert call_args.endswith(".jpg")

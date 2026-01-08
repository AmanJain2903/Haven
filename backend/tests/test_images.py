import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from app.models import SystemConfig, Image

# Fixture to ensure system_config table and storage_path config exists
@pytest.fixture(autouse=True)
def ensure_system_config(db_session):
    from sqlalchemy import inspect
    inspector = inspect(db_session.bind)
    if "system_config" not in inspector.get_table_names():
        SystemConfig.__table__.create(db_session.bind)
    if not db_session.query(SystemConfig).filter_by(key="storage_path").first():
        db_session.add(SystemConfig(key="storage_path", value="/mock/storage"))
        db_session.commit()

"""
Tests for image management endpoints.
"""

class TestImageScanEndpoint:
    """Test suite for /api/v1/scan endpoint"""

    @patch('app.api.v1.endpoints.scan.os.path.exists')
    @patch('app.api.v1.endpoints.scan.scan_directory')
    def test_scan_success(self, mock_scan, mock_exists, client, db_session):
        """Test successful directory scan"""
        # Mock the scanner to return success message
        mock_scan.return_value = "Scan Initiated"
        # Mock path exists check
        mock_exists.return_value = True
        
        response = client.post(
            "/api/v1/scan/"
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
        assert "Scan started" in data["message"]
        mock_scan.assert_called_once()

    @patch('app.api.v1.endpoints.scan.os.path.exists')
    @patch('app.api.v1.endpoints.scan.scan_directory')
    def test_scan_empty_directory(self, mock_scan, mock_exists, client, db_session):
        """Test scanning directory with no new images"""
        mock_scan.return_value = "Scan Initiated"
        mock_exists.return_value = True
        
        response = client.post(
            "/api/v1/scan/"
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"

    @patch('app.api.v1.endpoints.scan.os.path.exists')
    @patch('app.api.v1.endpoints.scan.scan_directory')
    def test_scan_error_handling(self, mock_scan, mock_exists, client, db_session):
        """Test error handling when scan fails"""
        mock_scan.side_effect = Exception("Permission denied")
        mock_exists.return_value = True
        
        response = client.post(
            "/api/v1/scan/"
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "error"
        
    def test_scan_storage_not_configured(self, client, db_session):
        """Test scan fails when storage path not configured"""
        # Remove storage_path config
        config = db_session.query(SystemConfig).filter_by(key="storage_path").first()
        if config:
            db_session.delete(config)
            db_session.commit()
        
        response = client.post("/api/v1/scan/")
        
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        
    @patch('app.api.v1.endpoints.scan.os.path.exists')
    def test_scan_storage_not_mounted(self, mock_exists, client, db_session):
        """Test scan fails when storage drive not mounted"""
        # Mock path doesn't exist
        mock_exists.return_value = False
        
        response = client.post("/api/v1/scan/")
        
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE




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
        mock_file_response.assert_called_once_with("/mock/storage/images/test.jpg")

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
        mock_file_response.assert_called_once_with("/mock/storage/images/corrupted.heic")

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
        
        # Adjust expected path to match SystemConfig
        mock_file_response.assert_called_once_with("/mock/storage/images/test.png")


class TestGetImageDetailsEndpoint:
    """Test suite for GET /api/v1/images/details/{image_id} endpoint"""

    def test_get_image_details_success(self, client, sample_images, db_session):
        """Test getting detailed image information"""
        image_id = sample_images[0].id
        
        response = client.get(f"/api/v1/images/details/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == image_id
        assert "filename" in data
        assert "thumbnail_url" in data
        assert "image_url" in data
        assert "metadata" in data

    def test_get_image_details_not_found(self, client, db_session):
        """Test getting details for non-existent image"""
        response = client.get("/api/v1/images/details/999999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestGetTimelineEndpoint:
    """Test suite for GET /api/v1/images/timeline endpoint"""

    def test_get_timeline_empty(self, client, db_session):
        """Test timeline with no images"""
        response = client.get("/api/v1/images/timeline")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        assert response.headers["X-Total-Count"] == "0"

    def test_get_timeline_with_images(self, client, sample_images, db_session):
        """Test timeline returns images"""
        response = client.get("/api/v1/images/timeline")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "X-Total-Count" in response.headers

    def test_get_timeline_pagination(self, client, sample_images, db_session):
        """Test timeline pagination"""
        # Get first page
        response1 = client.get("/api/v1/images/timeline?skip=0&limit=1")
        data1 = response1.json()
        
        # Get second page
        response2 = client.get("/api/v1/images/timeline?skip=1&limit=1")
        data2 = response2.json()
        
        assert len(data1) <= 1
        assert len(data2) <= 1
        
        # Ensure they're different images (if enough images exist)
        if len(data1) > 0 and len(data2) > 0:
            assert data1[0]["id"] != data2[0]["id"]

    def test_get_timeline_structure(self, client, sample_images, db_session):
        """Test timeline response structure"""
        response = client.get("/api/v1/images/timeline")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        if len(data) > 0:
            image = data[0]
            assert "id" in image
            assert "filename" in image
            assert "thumbnail_url" in image
            assert "date" in image
            assert "metadata" in image


class TestGetMapDataEndpoint:
    """Test suite for GET /api/v1/images/map-data endpoint"""

    def test_get_map_data_empty(self, client, db_session):
        """Test map data with no geotagged images"""
        response = client.get("/api/v1/images/map-data")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    def test_get_map_data_with_geotagged_images(self, client, sample_images, db_session):
        """Test map data returns only geotagged images"""
        response = client.get("/api/v1/images/map-data")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All returned images should have GPS coordinates
        for point in data:
            assert "latitude" in point
            assert "longitude" in point
            assert point["latitude"] is not None
            assert point["longitude"] is not None
            assert "thumbnail_url" in point

    def test_get_map_data_structure(self, client, sample_images, db_session):
        """Test map data response structure"""
        response = client.get("/api/v1/images/map-data")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        if len(data) > 0:
            point = data[0]
            required_fields = ["id", "latitude", "longitude", "thumbnail_url"]
            for field in required_fields:
                assert field in point


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
        mock_file_response.assert_called_once_with("/mock/storage/images/photo.jpg")

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

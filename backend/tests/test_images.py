"""
Tests for images endpoints.
"""
from unittest.mock import patch, MagicMock, mock_open
from fastapi import status
from datetime import datetime
import os
import tempfile
import shutil
import hashlib
import io


class TestImagesEndpoints:
    """Test suite for /api/v1/images endpoints"""

    def test_get_timeline(self, client, db_session, sample_images, sample_system_config):
        """Test getting image timeline"""
        # Ensure storage_path config exists
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/images/timeline?skip=0&limit=10")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert "X-Total-Count" in response.headers
        assert response.headers["Cache-Control"] == "no-cache, no-store, must-revalidate"

    def test_get_timeline_pagination(self, client, db_session, sample_images, sample_system_config):
        """Test timeline pagination"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/images/timeline?skip=1&limit=1")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) <= 1

    def test_get_timeline_storage_not_configured(self, client, db_session, sample_images):
        """Test timeline when storage not configured"""
        # Remove storage_path config
        from app import models
        db_session.query(models.SystemConfig).filter_by(key="storage_path").delete()
        db_session.commit()
        
        response = client.get("/api/v1/images/timeline")
        
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert "Storage not configured" in response.json()["detail"]

    def test_get_image_details(self, client, db_session, sample_images, sample_system_config):
        """Test getting image details"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        image_id = sample_images[0].id
        response = client.get(f"/api/v1/images/details/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == image_id
        assert "filename" in data
        assert "thumbnail_url" in data
        assert "image_url" in data

    def test_get_image_details_not_found(self, client, db_session, sample_system_config):
        """Test getting details for non-existent image"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/images/details/99999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.images.os.path.exists')
    @patch('app.api.v1.endpoints.images.os.remove')
    @patch('app.api.v1.endpoints.images.settings')
    def test_delete_image(
        self, mock_settings, mock_remove, mock_exists,
        client, db_session, sample_images, sample_system_config
    ):
        """Test deleting an image"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_settings.APP_DATA_DIR = "/tmp/test"
        mock_settings.THUMBNAIL_DIR = "/tmp/test/thumbnails"
        mock_exists.return_value = True
        
        image_id = sample_images[0].id
        response = client.delete(f"/api/v1/images/delete/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True

    def test_delete_image_not_found(self, client, db_session, sample_system_config):
        """Test deleting non-existent image"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.delete("/api/v1/images/delete/99999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.images.FileResponse')
    @patch('app.api.v1.endpoints.images.os.path.exists')
    def test_get_image_file(
        self, mock_exists, mock_file_response, client, db_session, 
        sample_images, sample_system_config, temp_storage_dir
    ):
        """Test getting image file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        # Create test image file
        image = sample_images[0]
        image_path = os.path.join(temp_storage_dir, "images", image.filename)
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        with open(image_path, 'w') as f:
            f.write("test image content")
        
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/images/file/{image.id}")
        
        assert response.status_code == status.HTTP_200_OK

    @patch('app.api.v1.endpoints.images.pillow_heif')
    @patch('app.api.v1.endpoints.images.Image')
    @patch('app.api.v1.endpoints.images.os.path.exists')
    def test_get_image_file_heic(
        self, mock_exists, mock_image, mock_heif, client, db_session,
        sample_images, sample_system_config, temp_storage_dir
    ):
        """Test getting HEIC image file (conversion)"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        # Find or create HEIC image
        heic_image = None
        for img in sample_images:
            if img.filename.endswith('.heic'):
                heic_image = img
                break
        
        if not heic_image:
            from app import models
            heic_image = models.Image(filename="test.heic", file_size=1000)
            db_session.add(heic_image)
            db_session.commit()
        
        image_path = os.path.join(temp_storage_dir, "images", heic_image.filename)
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        with open(image_path, 'w') as f:
            f.write("test heic content")
        
        mock_exists.return_value = True
        mock_heif_file = MagicMock()
        mock_heif_file.mode = "RGB"
        mock_heif_file.size = (100, 100)
        mock_heif_file.data = b"test data"
        mock_heif.read_heif.return_value = mock_heif_file
        
        mock_pil_image = MagicMock()
        mock_image.frombytes.return_value = mock_pil_image
        mock_pil_image.save = MagicMock()
        
        response = client.get(f"/api/v1/images/file/{heic_image.id}")
        
        assert response.status_code == status.HTTP_200_OK

    @patch('app.api.v1.endpoints.images.FileResponse')
    @patch('app.api.v1.endpoints.images.os.path.exists')
    def test_get_thumbnail_file(
        self, mock_exists, mock_file_response, client, db_session,
        sample_images, sample_system_config, temp_storage_dir
    ):
        """Test getting thumbnail file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        image_id = sample_images[0].id
        response = client.get(f"/api/v1/images/thumbnail/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK

    @patch('app.api.v1.endpoints.images.FileResponse')
    @patch('app.api.v1.endpoints.images.os.path.exists')
    @patch('app.api.v1.endpoints.images.settings')
    def test_get_thumbnail_fallback_to_original(
        self, mock_settings, mock_exists, mock_file_response, client, db_session,
        sample_images, sample_system_config, temp_storage_dir
    ):
        """Test thumbnail falls back to original when thumbnail doesn't exist"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        # Thumbnail doesn't exist, but original does
        def exists_side_effect(path):
            if "thumb" in path:
                return False
            return True
        
        mock_exists.side_effect = exists_side_effect
        mock_settings.THUMBNAIL_DIR = "/tmp/thumbnails"
        mock_file_response.return_value = MagicMock()
        
        image_id = sample_images[0].id
        response = client.get(f"/api/v1/images/thumbnail/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK

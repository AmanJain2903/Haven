"""
Tests for raw images endpoints.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
import os


class TestRawImagesEndpoints:
    """Test suite for /api/v1/raw_images endpoints"""

    def test_get_raw_timeline(self, client, db_session, sample_raw_images, sample_system_config):
        """Test getting raw images timeline"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/raw_images/timeline?skip=0&limit=10")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert "X-Total-Count" in response.headers

    def test_get_raw_image_details(self, client, db_session, sample_raw_images, sample_system_config):
        """Test getting raw image details"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        raw_id = sample_raw_images[0].id
        response = client.get(f"/api/v1/raw_images/details/{raw_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == raw_id
        assert "filename" in data
        assert "extension" in data
        assert "thumbnail_url" in data
        assert "preview_url" in data
        assert "raw_url" in data

    def test_get_raw_image_details_not_found(self, client, db_session, sample_system_config):
        """Test getting details for non-existent raw image"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/raw_images/details/99999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.raw_images.os.path.exists')
    @patch('app.api.v1.endpoints.raw_images.os.remove')
    @patch('app.api.v1.endpoints.raw_images.settings')
    def test_delete_raw_image(
        self, mock_settings, mock_remove, mock_exists, 
        client, db_session, sample_raw_images, sample_system_config
    ):
        """Test deleting a raw image"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_settings.APP_DATA_DIR = "/tmp/test"
        mock_settings.RAW_THUMBNAIL_DIR = "/tmp/test/raw_thumbnails"
        mock_settings.RAW_PREVIEW_DIR = "/tmp/test/raw_previews"
        mock_exists.return_value = True
        
        raw_id = sample_raw_images[0].id
        response = client.delete(f"/api/v1/raw_images/delete/{raw_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True

    @patch('app.api.v1.endpoints.raw_images.FileResponse')
    @patch('app.api.v1.endpoints.raw_images.os.path.exists')
    def test_get_raw_image_file(
        self, mock_exists, mock_file_response, client, db_session,
        sample_raw_images, sample_system_config, temp_storage_dir
    ):
        """Test getting raw image file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        raw = sample_raw_images[0]
        raw_path = os.path.join(temp_storage_dir, "raw", raw.filename)
        os.makedirs(os.path.dirname(raw_path), exist_ok=True)
        with open(raw_path, 'w') as f:
            f.write("test raw content")
        
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/raw_images/file/{raw.id}")
        
        assert response.status_code == status.HTTP_200_OK

    def test_get_raw_image_file_not_found(self, client, db_session, sample_system_config):
        """Test getting non-existent raw image file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/raw_images/file/99999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.raw_images.FileResponse')
    @patch('app.api.v1.endpoints.raw_images.os.path.exists')
    @patch('app.api.v1.endpoints.raw_images.settings')
    def test_get_raw_preview_file(
        self, mock_settings, mock_exists, mock_file_response, client, db_session,
        sample_raw_images, sample_system_config, temp_storage_dir
    ):
        """Test getting raw preview file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        mock_settings.RAW_PREVIEW_DIR = "/tmp/test/raw_previews"
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        raw_id = sample_raw_images[0].id
        response = client.get(f"/api/v1/raw_images/preview/{raw_id}")
        
        assert response.status_code == status.HTTP_200_OK

    @patch('app.api.v1.endpoints.raw_images.os.path.exists')
    @patch('app.api.v1.endpoints.raw_images.settings')
    def test_get_raw_preview_not_found(
        self, mock_settings, mock_exists, client, db_session,
        sample_raw_images, sample_system_config, temp_storage_dir
    ):
        """Test getting preview when preview doesn't exist"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        mock_settings.RAW_PREVIEW_DIR = "/tmp/test/raw_previews"
        mock_exists.return_value = False
        
        raw_id = sample_raw_images[0].id
        response = client.get(f"/api/v1/raw_images/preview/{raw_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Preview not found" in response.json()["detail"]

    @patch('app.api.v1.endpoints.raw_images.FileResponse')
    @patch('app.api.v1.endpoints.raw_images.os.path.exists')
    @patch('app.api.v1.endpoints.raw_images.settings')
    def test_get_raw_thumbnail_file(
        self, mock_settings, mock_exists, mock_file_response, client, db_session,
        sample_raw_images, sample_system_config, temp_storage_dir
    ):
        """Test getting raw thumbnail file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        # Create the thumbnail file path that would be expected
        import hashlib
        raw = sample_raw_images[0]
        path_hash = hashlib.md5(os.path.join(temp_storage_dir, 'raw', raw.filename).encode('utf-8')).hexdigest()
        thumb_filename = f"thumb_{path_hash}.jpg"
        
        mock_settings.RAW_THUMBNAIL_DIR = "/tmp/test/raw_thumbnails"
        # Mock exists to return True for the thumbnail path
        def exists_side_effect(path):
            if "thumb" in path or thumb_filename in path:
                return True
            return False
        mock_exists.side_effect = exists_side_effect
        mock_file_response.return_value = MagicMock()
        
        raw_id = sample_raw_images[0].id
        response = client.get(f"/api/v1/raw_images/thumbnail/{raw_id}")
        
        assert response.status_code == status.HTTP_200_OK

    @patch('app.api.v1.endpoints.raw_images.os.path.exists')
    @patch('app.api.v1.endpoints.raw_images.settings')
    def test_get_raw_thumbnail_not_found(
        self, mock_settings, mock_exists, client, db_session,
        sample_raw_images, sample_system_config, temp_storage_dir
    ):
        """Test getting thumbnail when thumbnail doesn't exist"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        mock_settings.RAW_THUMBNAIL_DIR = "/tmp/test/raw_thumbnails"
        mock_exists.return_value = False
        
        raw_id = sample_raw_images[0].id
        response = client.get(f"/api/v1/raw_images/thumbnail/{raw_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Thumbnail not found" in response.json()["detail"]

"""
Tests for videos endpoints.
"""
from unittest.mock import patch, MagicMock
from fastapi import status
import os


class TestVideosEndpoints:
    """Test suite for /api/v1/videos endpoints"""

    def test_get_timeline(self, client, db_session, sample_videos, sample_system_config):
        """Test getting video timeline"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/videos/timeline?skip=0&limit=10")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert "X-Total-Count" in response.headers

    def test_get_video_details(self, client, db_session, sample_videos, sample_system_config):
        """Test getting video details"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        video_id = sample_videos[0].id
        response = client.get(f"/api/v1/videos/details/{video_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == video_id
        assert "filename" in data
        assert "thumbnail_url" in data
        assert "preview_url" in data
        assert "video_url" in data
        assert "duration" in data

    def test_get_video_details_not_found(self, client, db_session, sample_system_config):
        """Test getting details for non-existent video"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/videos/details/99999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.videos.os.path.exists')
    @patch('app.api.v1.endpoints.videos.os.remove')
    @patch('app.api.v1.endpoints.videos.settings')
    def test_delete_video(
        self, mock_settings, mock_remove, mock_exists,
        client, db_session, sample_videos, sample_system_config
    ):
        """Test deleting a video"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_settings.APP_DATA_DIR = "/tmp/test"
        mock_settings.VIDEO_THUMBNAIL_DIR = "/tmp/test/video_thumbnails"
        mock_settings.VIDEO_PREVIEW_DIR = "/tmp/test/video_previews"
        mock_exists.return_value = True
        
        video_id = sample_videos[0].id
        response = client.delete(f"/api/v1/videos/delete/{video_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True

    @patch('app.api.v1.endpoints.videos.FileResponse')
    @patch('app.api.v1.endpoints.videos.os.path.exists')
    def test_get_video_file(
        self, mock_exists, mock_file_response, client, db_session,
        sample_videos, sample_system_config, temp_storage_dir
    ):
        """Test getting video file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        video = sample_videos[0]
        video_path = os.path.join(temp_storage_dir, "videos", video.filename)
        os.makedirs(os.path.dirname(video_path), exist_ok=True)
        with open(video_path, 'w') as f:
            f.write("test video content")
        
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        response = client.get(f"/api/v1/videos/file/{video.id}")
        
        assert response.status_code == status.HTTP_200_OK

    def test_get_video_file_not_found(self, client, db_session, sample_system_config):
        """Test getting non-existent video file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/videos/file/99999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.videos.FileResponse')
    @patch('app.api.v1.endpoints.videos.os.path.exists')
    @patch('app.api.v1.endpoints.videos.settings')
    def test_get_preview_file(
        self, mock_settings, mock_exists, mock_file_response, client, db_session,
        sample_videos, sample_system_config, temp_storage_dir
    ):
        """Test getting video preview file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        mock_settings.VIDEO_PREVIEW_DIR = "/tmp/test/video_previews"
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        video_id = sample_videos[0].id
        response = client.get(f"/api/v1/videos/preview/{video_id}")
        
        assert response.status_code == status.HTTP_200_OK

    @patch('app.api.v1.endpoints.videos.FileResponse')
    @patch('app.api.v1.endpoints.videos.os.path.exists')
    @patch('app.api.v1.endpoints.videos.settings')
    def test_get_thumbnail_file(
        self, mock_settings, mock_exists, mock_file_response, client, db_session,
        sample_videos, sample_system_config, temp_storage_dir
    ):
        """Test getting video thumbnail file"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        mock_settings.VIDEO_THUMBNAIL_DIR = "/tmp/test/video_thumbnails"
        mock_exists.return_value = True
        mock_file_response.return_value = MagicMock()
        
        video_id = sample_videos[0].id
        response = client.get(f"/api/v1/videos/thumbnail/{video_id}")
        
        assert response.status_code == status.HTTP_200_OK

    @patch('app.api.v1.endpoints.videos.os.path.exists')
    @patch('app.api.v1.endpoints.videos.settings')
    def test_get_thumbnail_not_found(
        self, mock_settings, mock_exists, client, db_session,
        sample_videos, sample_system_config, temp_storage_dir
    ):
        """Test getting thumbnail when thumbnail doesn't exist"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        mock_settings.VIDEO_THUMBNAIL_DIR = "/tmp/test/video_thumbnails"
        mock_exists.return_value = False
        
        video_id = sample_videos[0].id
        response = client.get(f"/api/v1/videos/thumbnail/{video_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

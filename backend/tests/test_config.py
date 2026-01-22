"""
Tests for configuration settings.
"""
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
import os
import platform
from pathlib import Path


class TestSettings:
    """Test suite for app.core.config.Settings"""

    def test_default_values(self):
        """Test default configuration values"""
        # Temporarily remove env vars to test defaults
        env_backup = {}
        env_vars_to_remove = ['PROJECT_NAME', 'PROJECT_VERSION', 'POSTGRES_USER', 'HOST_URL', 'REDIS_URL']
        for var in env_vars_to_remove:
            if var in os.environ:
                env_backup[var] = os.environ[var]
                del os.environ[var]
        
        try:
            from app.core.config import Settings
            settings = Settings()
            assert settings.HOST_URL == "http://localhost:8000"
            # PROJECT_NAME might be overridden by env, so check it's a string
            assert isinstance(settings.PROJECT_NAME, str)
            assert settings.REDIS_URL == "redis://127.0.0.1:6379/0"
        finally:
            # Restore env vars
            os.environ.update(env_backup)

    def test_environment_variable_override(self):
        """Test that environment variables override defaults"""
        with patch.dict(os.environ, {
            'HOST_URL': 'http://example.com',
            'PROJECT_VERSION': 'v1.0.0',
            'POSTGRES_USER': 'test_user'
        }):
            from app.core.config import Settings
            settings = Settings()
            assert settings.HOST_URL == "http://example.com"
            assert settings.PROJECT_VERSION == "v1.0.0"
            assert settings.POSTGRES_USER == "test_user"

    def test_get_default_path_darwin(self):
        """Test getDefaultPath on macOS"""
        with patch('platform.system', return_value='Darwin'):
            from app.core.config import Settings
            base, path = Settings.getDefaultPath()
            assert 'Library' in base
            assert 'Application Support' in base
            assert 'Haven' in path
            assert 'HavenData' in path

    def test_get_default_path_windows(self):
        """Test getDefaultPath on Windows"""
        with patch('platform.system', return_value='Windows'):
            from app.core.config import Settings
            base, path = Settings.getDefaultPath()
            assert 'AppData' in base
            assert 'Roaming' in base
            assert 'Haven' in path

    def test_get_default_path_linux(self):
        """Test getDefaultPath on Linux"""
        with patch('platform.system', return_value='Linux'):
            from app.core.config import Settings
            base, path = Settings.getDefaultPath()
            assert '.local' in base
            assert 'share' in base
            assert 'Haven' in path

    def test_get_download_path(self):
        """Test getDownloadPath returns Downloads directory"""
        from app.core.config import Settings
        download_path = Settings.getDownloadPath()
        assert isinstance(download_path, Path)
        assert download_path.name == "Downloads"

    def test_database_url_property(self):
        """Test DATABASE_URL property construction"""
        from app.core.config import Settings
        settings = Settings()
        db_url = settings.DATABASE_URL
        assert "postgresql://" in db_url
        assert settings.POSTGRES_USER in db_url
        assert settings.POSTGRES_PASSWORD in db_url
        assert settings.POSTGRES_SERVER in db_url
        assert settings.POSTGRES_PORT in db_url
        assert settings.POSTGRES_DB in db_url

    @patch('sqlalchemy.create_engine')
    @patch('sqlalchemy.orm.sessionmaker')
    def test_app_data_dir_from_database(self, mock_sessionmaker, mock_create_engine):
        """Test APP_DATA_DIR property reads from database"""
        from app.core.config import Settings
        
        # Mock database connection
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine
        
        mock_session_class = MagicMock()
        mock_db = MagicMock()
        mock_session_class.return_value = mock_db
        mock_sessionmaker.return_value = mock_session_class
        
        mock_config = MagicMock()
        mock_config.key = "hot_storage_path"
        mock_config.value = "/custom/storage/path"
        mock_db.query.return_value.filter_by.return_value.first.return_value = mock_config
        
        settings = Settings()
        result = settings.APP_DATA_DIR
        
        assert result == "/custom/storage/path"
        mock_db.query.assert_called()

    def test_app_data_dir_fallback(self):
        """Test APP_DATA_DIR falls back when database unavailable"""
        from app.core.config import Settings
        
        with patch('sqlalchemy.create_engine', side_effect=Exception("DB error")):
            settings = Settings()
            result = settings.APP_DATA_DIR
            # Should return fallback path
            assert 'HavenData' in result

    def test_thumbnail_dir_property(self):
        """Test THUMBNAIL_DIR property"""
        from app.core.config import Settings
        
        with patch.object(Settings, 'APP_DATA_DIR', new_callable=PropertyMock, return_value="/test/path"):
            settings = Settings()
            result = settings.THUMBNAIL_DIR
            assert result == "/test/path/thumbnails"

    def test_video_thumbnail_dir_property(self):
        """Test VIDEO_THUMBNAIL_DIR property"""
        from app.core.config import Settings
        
        with patch.object(Settings, 'APP_DATA_DIR', new_callable=PropertyMock, return_value="/test/path"):
            settings = Settings()
            result = settings.VIDEO_THUMBNAIL_DIR
            assert result == "/test/path/video_thumbnails"

    def test_video_preview_dir_property(self):
        """Test VIDEO_PREVIEW_DIR property"""
        from app.core.config import Settings
        
        with patch.object(Settings, 'APP_DATA_DIR', new_callable=PropertyMock, return_value="/test/path"):
            settings = Settings()
            result = settings.VIDEO_PREVIEW_DIR
            assert result == "/test/path/video_previews"

    def test_raw_thumbnail_dir_property(self):
        """Test RAW_THUMBNAIL_DIR property"""
        from app.core.config import Settings
        
        with patch.object(Settings, 'APP_DATA_DIR', new_callable=PropertyMock, return_value="/test/path"):
            settings = Settings()
            result = settings.RAW_THUMBNAIL_DIR
            assert result == "/test/path/raw_thumbnails"

    def test_raw_preview_dir_property(self):
        """Test RAW_PREVIEW_DIR property"""
        from app.core.config import Settings
        
        with patch.object(Settings, 'APP_DATA_DIR', new_callable=PropertyMock, return_value="/test/path"):
            settings = Settings()
            result = settings.RAW_PREVIEW_DIR
            assert result == "/test/path/raw_previews"

    def test_clip_service_settings(self):
        """Test CLIP service configuration"""
        from app.core.config import Settings
        settings = Settings()
        
        assert isinstance(settings.CLIP_SERVICE_MODEL, str)
        assert isinstance(settings.CLIP_SERVICE_MODEL_EMBEDDING_DIMENSION, int)
        assert isinstance(settings.CLIP_SERVICE_MODEL_THRESHOLD, float)

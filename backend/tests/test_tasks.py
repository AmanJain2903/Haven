"""
Tests for Celery tasks.
"""
import pytest
from unittest.mock import patch, MagicMock, call
from datetime import datetime
import os
import tempfile
import zipfile


class TestSentinelPulse:
    """Test suite for sentinel_pulse task"""

    @patch('app.services.scanner.scan_directory_flat')
    @patch('app.tasks.redis_client')
    @patch('app.tasks.SessionLocal')
    def test_sentinel_pulse_no_storage_path(self, mock_session_local, mock_redis, mock_scan):
        """Test sentinel pulse when storage path not configured"""
        from app.tasks import sentinel_pulse
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter_by.return_value.first.return_value = None
        mock_session_local.return_value = mock_db
        
        sentinel_pulse()
        
        mock_scan.assert_not_called()

    @patch('app.services.scanner.scan_directory_flat')
    @patch('app.tasks.redis_client')
    @patch('app.tasks.SessionLocal')
    @patch('app.tasks.os.path.exists')
    def test_sentinel_pulse_storage_disconnected(self, mock_exists, mock_session_local, mock_redis, mock_scan):
        """Test sentinel pulse when storage is disconnected"""
        from app.tasks import sentinel_pulse
        
        mock_db = MagicMock()
        mock_config = MagicMock()
        mock_config.value = "/storage/path"
        mock_db.query.return_value.filter_by.return_value.first.return_value = mock_config
        mock_session_local.return_value = mock_db
        mock_exists.return_value = False
        
        sentinel_pulse()
        
        mock_redis.set.assert_called_with("system_status", "disconnected")
        mock_scan.assert_not_called()

    @patch('app.services.scanner.scan_directory_flat')
    @patch('app.tasks.redis_client')
    @patch('app.tasks.SessionLocal')
    @patch('app.tasks.os.path.exists')
    def test_sentinel_pulse_tasks_in_progress(self, mock_exists, mock_session_local, mock_redis, mock_scan):
        """Test sentinel pulse when tasks are in progress"""
        from app.tasks import sentinel_pulse
        
        mock_db = MagicMock()
        mock_config = MagicMock()
        mock_config.value = "/storage/path"
        mock_db.query.return_value.filter_by.return_value.first.return_value = mock_config
        mock_session_local.return_value = mock_db
        mock_exists.return_value = True
        
        # Mock tasks in progress
        mock_redis.get.side_effect = lambda key: {
            "haven_tasks_pending": b"10",
            "haven_tasks_completed": b"5"
        }.get(key)
        
        sentinel_pulse()
        
        mock_scan.assert_not_called()

    @patch('app.services.scanner.scan_directory_flat')
    @patch('app.tasks.redis_client')
    @patch('app.tasks.SessionLocal')
    @patch('app.tasks.os.path.exists')
    def test_sentinel_pulse_scan_already_running(self, mock_exists, mock_session_local, mock_redis, mock_scan):
        """Test sentinel pulse when scan is already running"""
        from app.tasks import sentinel_pulse
        
        mock_db = MagicMock()
        mock_config = MagicMock()
        mock_config.value = "/storage/path"
        mock_db.query.return_value.filter_by.return_value.first.return_value = mock_config
        mock_session_local.return_value = mock_db
        mock_exists.return_value = True
        
        # Mock lock already acquired (scan running)
        mock_redis.get.return_value = None  # No pending tasks
        mock_redis.set.side_effect = lambda key, *args, **kwargs: key == "system_status"  # Lock fails
        
        sentinel_pulse()
        
        mock_scan.assert_not_called()

    @patch('app.services.scanner.scan_directory_flat')
    @patch('app.tasks.redis_client')
    @patch('app.tasks.SessionLocal')
    @patch('app.tasks.os.path.exists')
    def test_sentinel_pulse_successful_scan(self, mock_exists, mock_session_local, mock_redis, mock_scan):
        """Test successful sentinel pulse triggering scan"""
        from app.tasks import sentinel_pulse
        
        mock_db = MagicMock()
        mock_config = MagicMock()
        mock_config.value = "/storage/path"
        mock_db.query.return_value.filter_by.return_value.first.return_value = mock_config
        mock_session_local.return_value = mock_db
        mock_exists.return_value = True
        
        # Mock no pending tasks and lock acquired
        mock_redis.get.return_value = None
        mock_redis.set.side_effect = lambda key, *args, **kwargs: True if key == "haven_scan_lock" else None
        
        sentinel_pulse()
        
        mock_scan.assert_called_once_with("/storage/path", mock_db)
        mock_redis.set.assert_any_call("system_status", "connected")
        mock_redis.delete.assert_called_with("haven_scan_lock")


class TestProcessImageTask:
    """Test suite for task_process_image"""

    @patch('app.tasks.process_image_file')
    @patch('app.tasks.redis_client')
    def test_task_process_image_success(self, mock_redis, mock_process):
        """Test successful image processing task"""
        from app.tasks import task_process_image
        
        mock_process.return_value = None
        
        result = task_process_image("full_path", "image.jpg")
        
        assert result == "Success: image.jpg"
        mock_process.assert_called_once_with("full_path", "image.jpg")
        mock_redis.incr.assert_called_once_with("haven_tasks_completed")

    @patch('app.tasks.process_image_file')
    @patch('app.tasks.redis_client')
    def test_task_process_image_failure(self, mock_redis, mock_process):
        """Test image processing task with failure"""
        from app.tasks import task_process_image
        
        mock_process.side_effect = Exception("Processing error")
        
        with pytest.raises(Exception):
            task_process_image("full_path", "image.jpg")
        
        mock_redis.incr.assert_called_once_with("haven_tasks_completed")


class TestProcessVideoTask:
    """Test suite for task_process_video"""

    @patch('app.tasks.process_video_file')
    @patch('app.tasks.redis_client')
    def test_task_process_video_success(self, mock_redis, mock_process):
        """Test successful video processing task"""
        from app.tasks import task_process_video
        
        mock_process.return_value = None
        
        result = task_process_video("full_path", "video.mp4")
        
        assert result == "Success: video.mp4"
        mock_process.assert_called_once_with("full_path", "video.mp4")
        mock_redis.incr.assert_called_once_with("haven_tasks_completed")

    @patch('app.tasks.process_video_file')
    @patch('app.tasks.redis_client')
    def test_task_process_video_failure(self, mock_redis, mock_process):
        """Test video processing task with failure"""
        from app.tasks import task_process_video
        
        mock_process.side_effect = Exception("Processing error")
        
        with pytest.raises(Exception):
            task_process_video("full_path", "video.mp4")
        
        mock_redis.incr.assert_called_once_with("haven_tasks_completed")


class TestProcessRawTask:
    """Test suite for task_process_raw"""

    @patch('app.tasks.process_raw_file')
    @patch('app.tasks.redis_client')
    def test_task_process_raw_success(self, mock_redis, mock_process):
        """Test successful raw image processing task"""
        from app.tasks import task_process_raw
        
        mock_process.return_value = None
        
        result = task_process_raw("full_path", "raw.arw")
        
        assert result == "Success: raw.arw"
        mock_process.assert_called_once_with("full_path", "raw.arw")
        mock_redis.incr.assert_called_once_with("haven_tasks_completed")

    @patch('app.tasks.process_raw_file')
    @patch('app.tasks.redis_client')
    def test_task_process_raw_failure(self, mock_redis, mock_process):
        """Test raw image processing task with failure"""
        from app.tasks import task_process_raw
        
        mock_process.side_effect = Exception("Processing error")
        
        with pytest.raises(Exception):
            task_process_raw("full_path", "raw.arw")
        
        mock_redis.incr.assert_called_once_with("haven_tasks_completed")


class TestBatchAddToAlbumTask:
    """Test suite for task_batch_add_to_album"""

    @patch('app.tasks.redis_client')
    @patch('app.tasks.SessionLocal')
    def test_batch_add_to_album_success(self, mock_session_local, mock_redis):
        """Test successful batch add to album"""
        from app.tasks import task_batch_add_to_album
        from app import models
        
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        # Mock album
        mock_album = MagicMock()
        mock_album.album_images_ids = []
        mock_album.album_images_count = 0
        mock_album.album_total_count = 0
        mock_album.album_size = 0
        mock_album.album_cover_id = None
        mock_album.album_cover_type = None
        mock_db.query.return_value.filter.return_value.first.return_value = mock_album
        
        # Mock image
        mock_image = MagicMock()
        mock_image.album_ids = []
        mock_image.file_size = 1024
        mock_db.query.return_value.filter.return_value.first.side_effect = [mock_album, mock_image]
        
        files = [{"type": "image", "id": 1}]
        result = task_batch_add_to_album("task_123", 1, files)
        
        assert result["status"] == "completed"
        assert result["completed"] == 1
        mock_redis.hset.assert_called()
        mock_db.commit.assert_called()

    @patch('app.tasks.redis_client')
    @patch('app.tasks.SessionLocal')
    def test_batch_add_to_album_no_album_id(self, mock_session_local, mock_redis):
        """Test batch add with no album ID"""
        from app.tasks import task_batch_add_to_album
        
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        result = task_batch_add_to_album("task_123", None, [])
        
        assert result["status"] == "failed"
        assert "Album ID is required" in result["error"]

    @patch('app.tasks.redis_client')
    @patch('app.tasks.SessionLocal')
    def test_batch_add_to_album_no_files(self, mock_session_local, mock_redis):
        """Test batch add with no files"""
        from app.tasks import task_batch_add_to_album
        
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        result = task_batch_add_to_album("task_123", 1, [])
        
        assert result["status"] == "failed"
        assert "Files are required" in result["error"]


class TestCreateHavenVaultZipTask:
    """Test suite for task_create_haven_vault_zip"""

    @patch('app.tasks.redis_client')
    @patch('app.tasks.os.path.exists')
    @patch('app.tasks.os.path.isdir')
    @patch('app.tasks.os.scandir')
    @patch('app.tasks.zipfile.ZipFile')
    def test_create_haven_vault_zip_success(self, mock_zipfile, mock_scandir, mock_isdir, mock_exists, mock_redis):
        """Test successful Haven Vault zip creation"""
        from app.tasks import task_create_haven_vault_zip
        
        mock_exists.return_value = True
        mock_isdir.return_value = True
        
        # Mock file listing using context manager properly
        mock_entry1 = MagicMock()
        mock_entry1.is_file.return_value = True
        mock_entry1.name = "test1.jpg"
        mock_entry2 = MagicMock()
        mock_entry2.is_file.return_value = True
        mock_entry2.name = "test2.mp4"
        
        mock_scandir_context = MagicMock()
        mock_scandir_context.__enter__.return_value = [mock_entry1, mock_entry2]
        mock_scandir_context.__exit__.return_value = None
        mock_scandir.return_value = mock_scandir_context
        
        # Mock zip file
        mock_zip = MagicMock()
        mock_zip_context = MagicMock()
        mock_zip_context.__enter__.return_value = mock_zip
        mock_zip_context.__exit__.return_value = None
        mock_zipfile.return_value = mock_zip_context
        
        # Mock Redis
        mock_redis.hget.return_value = None  # Not cancelled
        
        result = task_create_haven_vault_zip("task_123", "/storage/path")
        
        assert result["status"] == "completed"
        assert result["total"] > 0
        mock_zip.write.assert_called()

    @patch('app.tasks.redis_client')
    @patch('app.tasks.os.path.exists')
    def test_create_haven_vault_zip_path_not_found(self, mock_exists, mock_redis):
        """Test Haven Vault zip with invalid path"""
        from app.tasks import task_create_haven_vault_zip
        
        mock_exists.return_value = False
        
        with pytest.raises(Exception) as exc_info:
            task_create_haven_vault_zip("task_123", "/nonexistent/path")
        
        assert "Storage path" in str(exc_info.value)

    @patch('app.tasks.redis_client')
    @patch('app.tasks.os.path.exists')
    def test_create_haven_vault_zip_cancelled(self, mock_exists, mock_redis):
        """Test Haven Vault zip when cancelled"""
        from app.tasks import task_create_haven_vault_zip
        
        mock_exists.return_value = True
        mock_redis.hget.return_value = b"cancelled"
        
        result = task_create_haven_vault_zip("task_123", "/storage/path")
        
        assert result["status"] == "cancelled"

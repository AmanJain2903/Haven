"""
Tests for scanner service.
"""
from unittest.mock import patch, MagicMock, call
from fastapi import status
import os
import tempfile
import shutil


class TestScannerService:
    """Test suite for scanner service"""

    @patch('app.services.scanner.task_process_image')
    @patch('app.services.scanner.task_process_video')
    @patch('app.services.scanner.task_process_raw')
    @patch('app.services.scanner.redis.from_url')
    def test_scan_directory_flat_images_only(
        self, mock_redis_from_url, mock_task_raw, mock_task_video, 
        mock_task_image, client, db_session, temp_storage_dir
    ):
        """Test scanning images directory"""
        # Setup
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        
        images_dir = os.path.join(temp_storage_dir, "images")
        os.makedirs(images_dir, exist_ok=True)
        
        # Create test image files
        test_files = ["test1.jpg", "test2.png", "test3.heic"]
        for filename in test_files:
            filepath = os.path.join(images_dir, filename)
            with open(filepath, 'w') as f:
                f.write("test content")
        
        # Mock task delay
        mock_task_image.delay = MagicMock()
        
        # Import and call
        from app.services.scanner import scan_directory_flat
        
        result = scan_directory_flat(temp_storage_dir, db_session)
        
        # Assertions
        assert result == "Scan Initiated"
        assert mock_task_image.delay.call_count == 3
        mock_redis.set.assert_called()

    @patch('app.services.scanner.task_process_image')
    @patch('app.services.scanner.task_process_video')
    @patch('app.services.scanner.task_process_raw')
    @patch('app.services.scanner.redis.from_url')
    def test_scan_directory_flat_skip_duplicates(
        self, mock_redis_from_url, mock_task_raw, mock_task_video,
        mock_task_image, client, db_session, temp_storage_dir, sample_images
    ):
        """Test that duplicate files are skipped"""
        # Setup
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        
        images_dir = os.path.join(temp_storage_dir, "images")
        os.makedirs(images_dir, exist_ok=True)
        
        # Create file with same name as existing image
        existing_file = os.path.join(images_dir, "beach.jpg")
        with open(existing_file, 'w') as f:
            f.write("test content")
        
        # Create new file
        new_file = os.path.join(images_dir, "new_image.jpg")
        with open(new_file, 'w') as f:
            f.write("test content")
        
        mock_task_image.delay = MagicMock()
        
        from app.services.scanner import scan_directory_flat
        
        result = scan_directory_flat(temp_storage_dir, db_session)
        
        # Should only process new_image.jpg, skip beach.jpg (duplicate)
        assert result == "Scan Initiated"
        # Check that delay was called with new_image.jpg
        calls = [call[0][1] for call in mock_task_image.delay.call_args_list]
        assert "new_image.jpg" in calls
        assert "beach.jpg" not in calls

    @patch('app.services.scanner.task_process_image')
    @patch('app.services.scanner.task_process_video')
    @patch('app.services.scanner.task_process_raw')
    @patch('app.services.scanner.redis.from_url')
    def test_scan_directory_flat_videos(
        self, mock_redis_from_url, mock_task_raw, mock_task_video,
        mock_task_image, client, db_session, temp_storage_dir
    ):
        """Test scanning videos directory"""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        
        videos_dir = os.path.join(temp_storage_dir, "videos")
        os.makedirs(videos_dir, exist_ok=True)
        
        test_files = ["test1.mp4", "test2.mov"]
        for filename in test_files:
            filepath = os.path.join(videos_dir, filename)
            with open(filepath, 'w') as f:
                f.write("test content")
        
        mock_task_video.delay = MagicMock()
        
        from app.services.scanner import scan_directory_flat
        
        result = scan_directory_flat(temp_storage_dir, db_session)
        
        assert result == "Scan Initiated"
        assert mock_task_video.delay.call_count == 2

    @patch('app.services.scanner.task_process_image')
    @patch('app.services.scanner.task_process_video')
    @patch('app.services.scanner.task_process_raw')
    @patch('app.services.scanner.redis.from_url')
    def test_scan_directory_flat_raw_images(
        self, mock_redis_from_url, mock_task_raw, mock_task_video,
        mock_task_image, client, db_session, temp_storage_dir
    ):
        """Test scanning raw images directory"""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        
        raw_dir = os.path.join(temp_storage_dir, "raw")
        os.makedirs(raw_dir, exist_ok=True)
        
        test_files = ["test1.arw", "test2.cr2", "test3.nef"]
        for filename in test_files:
            filepath = os.path.join(raw_dir, filename)
            with open(filepath, 'w') as f:
                f.write("test content")
        
        mock_task_raw.delay = MagicMock()
        
        from app.services.scanner import scan_directory_flat
        
        result = scan_directory_flat(temp_storage_dir, db_session)
        
        assert result == "Scan Initiated"
        assert mock_task_raw.delay.call_count == 3

    @patch('app.services.scanner.task_process_image')
    @patch('app.services.scanner.task_process_video')
    @patch('app.services.scanner.task_process_raw')
    @patch('app.services.scanner.redis.from_url')
    def test_scan_directory_flat_no_tasks_dispatched(
        self, mock_redis_from_url, mock_task_raw, mock_task_video,
        mock_task_image, client, db_session, temp_storage_dir
    ):
        """Test scanning when no new files found"""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        
        # Create directories but no files
        os.makedirs(os.path.join(temp_storage_dir, "images"), exist_ok=True)
        os.makedirs(os.path.join(temp_storage_dir, "videos"), exist_ok=True)
        os.makedirs(os.path.join(temp_storage_dir, "raw"), exist_ok=True)
        
        from app.services.scanner import scan_directory_flat
        
        result = scan_directory_flat(temp_storage_dir, db_session)
        
        assert result == "Scan Initiated"
        assert mock_task_image.delay.call_count == 0
        assert mock_task_video.delay.call_count == 0
        assert mock_task_raw.delay.call_count == 0
        # Redis should not be updated when no tasks
        mock_redis.set.assert_not_called()

    @patch('app.services.scanner.task_process_image')
    @patch('app.services.scanner.task_process_video')
    @patch('app.services.scanner.task_process_raw')
    @patch('app.services.scanner.redis.from_url')
    def test_scan_directory_flat_missing_directories(
        self, mock_redis_from_url, mock_task_raw, mock_task_video,
        mock_task_image, client, db_session, temp_storage_dir
    ):
        """Test scanning when directories don't exist"""
        mock_redis = MagicMock()
        mock_redis_from_url.return_value = mock_redis
        
        # Don't create subdirectories
        from app.services.scanner import scan_directory_flat
        
        result = scan_directory_flat(temp_storage_dir, db_session)
        
        assert result == "Scan Initiated"
        # Should handle missing directories gracefully
        assert mock_task_image.delay.call_count == 0
        assert mock_task_video.delay.call_count == 0
        assert mock_task_raw.delay.call_count == 0

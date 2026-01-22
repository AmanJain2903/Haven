"""
Tests for video processing service.
"""
import pytest
from unittest.mock import patch, MagicMock
import os
import tempfile
import json
import numpy as np


class TestVideoProcessor:
    """Test suite for app.services.video_processor"""

    @patch('app.services.video_processor.generate_embedding')
    @patch('app.services.video_processor.SessionLocal')
    @patch('app.services.video_processor.generate_assets')
    @patch('app.services.video_processor.get_video_metadata')
    def test_process_video_file_success(
        self, mock_get_metadata, mock_generate_assets, mock_session_local, mock_generate_embedding
    ):
        """Test successful video processing"""
        from app.services.video_processor import process_video_file
        
        # Setup mocks
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_session_local.return_value = mock_db
        
        mock_get_metadata.return_value = {
            "duration": 30.0,
            "width": 1920,
            "height": 1080,
            "codec": "h264",
            "fps": 30.0,
            "size": 1000000,
            "make": "Apple",
            "model": "iPhone 14",
            "date": None,
            "lat": 37.7749,
            "lon": -122.4194
        }
        
        mock_generate_assets.return_value = ("thumb.jpg", "preview.mp4")
        mock_generate_embedding.return_value = [0.1] * 512
        
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            tmp.write(b"fake video data")
            tmp_path = tmp.name
        
        try:
            with patch('app.services.video_processor.extract_smart_frames', return_value=["/frame1.jpg", "/frame2.jpg"]):
                process_video_file(tmp_path, "test.mp4")
                
                mock_db.add.assert_called_once()
                mock_db.commit.assert_called_once()
        finally:
            os.unlink(tmp_path)

    @patch('app.services.video_processor.SessionLocal')
    def test_process_video_file_already_processed(self, mock_session_local):
        """Test processing video that already exists"""
        from app.services.video_processor import process_video_file
        
        mock_db = MagicMock()
        mock_existing = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_existing
        mock_session_local.return_value = mock_db
        
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            tmp.write(b"fake video data")
            tmp_path = tmp.name
        
        try:
            process_video_file(tmp_path, "test.mp4")
            mock_db.add.assert_not_called()
        finally:
            os.unlink(tmp_path)

    @patch('app.services.video_processor.SessionLocal')
    def test_process_video_file_invalid_extension(self, mock_session_local):
        """Test processing file with invalid extension"""
        from app.services.video_processor import process_video_file
        
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tmp:
            tmp.write(b"not a video")
            tmp_path = tmp.name
        
        try:
            process_video_file(tmp_path, "test.txt")
            mock_db.add.assert_not_called()
        finally:
            os.unlink(tmp_path)

    @patch('app.services.video_processor.subprocess.run')
    def test_get_video_metadata_success(self, mock_subprocess):
        """Test successful video metadata extraction"""
        from app.services.video_processor import get_video_metadata
        
        mock_result = MagicMock()
        mock_result.stdout = json.dumps({
            "format": {
                "duration": "30.0",
                "size": "1000000",
                "tags": {
                    "creation_time": "2024-01-01T12:00:00.000000Z",
                    "com.apple.quicktime.make": "Apple",
                    "com.apple.quicktime.model": "iPhone 14"
                }
            },
            "streams": [{
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1920,
                "height": 1080,
                "r_frame_rate": "30/1"
            }]
        })
        mock_subprocess.return_value = mock_result
        
        result = get_video_metadata("/path/to/video.mp4")
        
        assert result["duration"] == 30.0
        assert result["width"] == 1920
        assert result["height"] == 1080
        assert result["codec"] == "h264"
        assert result["fps"] == 30.0
        assert result["make"] == "Apple"
        assert result["model"] == "iPhone 14"

    @patch('app.services.video_processor.subprocess.run')
    def test_get_video_metadata_exception(self, mock_subprocess):
        """Test metadata extraction with exception"""
        from app.services.video_processor import get_video_metadata
        
        mock_subprocess.side_effect = Exception("ffprobe error")
        
        result = get_video_metadata("/path/to/video.mp4")
        assert result == {}

    @patch('app.services.video_processor.subprocess.run')
    def test_generate_assets_success(self, mock_subprocess):
        """Test successful asset generation"""
        from app.services.video_processor import generate_assets
        
        mock_subprocess.return_value = None
        
        with patch('app.services.video_processor.os.path.exists', return_value=False):
            with patch('app.services.video_processor.os.path.join', side_effect=lambda *args: "/".join(args)):
                with patch('app.services.video_processor.os.makedirs'):
                    result = generate_assets("/path/to/video.mp4", "video.mp4", 30.0)
                    
                    assert result[0] is not None  # thumb_name
                    assert result[1] is not None  # preview_name
                    assert mock_subprocess.call_count == 2  # Thumbnail + preview

    @patch('app.services.video_processor.subprocess.run')
    def test_extract_smart_frames(self, mock_subprocess):
        """Test smart frame extraction"""
        from app.services.video_processor import extract_smart_frames
        
        mock_subprocess.return_value = None
        
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch('app.services.video_processor.os.path.exists', return_value=True):
                result = extract_smart_frames("/path/to/video.mp4", 100.0, count=4, tempDir=tmpdir)
                
                assert len(result) <= 4
                assert mock_subprocess.call_count == len(result)

    @patch('app.services.video_processor.get_duration_cv2')
    @patch('app.services.video_processor.get_video_metadata')
    def test_process_video_file_fallback_duration(self, mock_get_metadata, mock_get_duration):
        """Test video processing with fallback duration"""
        from app.services.video_processor import process_video_file
        
        mock_get_metadata.return_value = {"duration": None}
        mock_get_duration.return_value = 30.0
        
        with patch('app.services.video_processor.SessionLocal') as mock_session_local:
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.first.return_value = None
            mock_session_local.return_value = mock_db
            
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
                tmp.write(b"fake video data")
                tmp_path = tmp.name
            
            try:
                with patch('app.services.video_processor.generate_assets', return_value=("thumb.jpg", "preview.mp4")):
                    with patch('app.services.video_processor.extract_smart_frames', return_value=[]):
                        process_video_file(tmp_path, "test.mp4")
                        
                        mock_get_duration.assert_called_once_with(tmp_path)
            finally:
                os.unlink(tmp_path)

    @patch('app.services.video_processor.get_video_metadata')
    def test_process_video_file_no_duration(self, mock_get_metadata):
        """Test video processing when duration cannot be determined"""
        from app.services.video_processor import process_video_file
        
        mock_get_metadata.return_value = {"duration": None}
        
        with patch('app.services.video_processor.get_duration_cv2', return_value=None):
            with patch('app.services.video_processor.SessionLocal') as mock_session_local:
                mock_db = MagicMock()
                mock_db.query.return_value.filter.return_value.first.return_value = None
                mock_session_local.return_value = mock_db
                
                with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
                    tmp.write(b"fake video data")
                    tmp_path = tmp.name
                
                try:
                    process_video_file(tmp_path, "test.mp4")
                    # Should not process without duration
                    mock_db.add.assert_not_called()
                finally:
                    os.unlink(tmp_path)

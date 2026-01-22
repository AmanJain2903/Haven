"""
Tests for raw image processing service.
"""
import pytest
from unittest.mock import patch, MagicMock
import os
import tempfile


class TestRawImageProcessor:
    """Test suite for app.services.raw_image_processor"""

    @patch('app.services.raw_image_processor.generate_embedding')
    @patch('app.services.raw_image_processor.SessionLocal')
    @patch('app.services.raw_image_processor.generate_assets_and_embed')
    @patch('app.services.raw_image_processor.get_raw_metadata')
    def test_process_raw_file_success(
        self, mock_get_metadata, mock_generate_assets, mock_session_local, mock_generate_embedding
    ):
        """Test successful raw image processing"""
        from app.services.raw_image_processor import process_raw_file
        
        # Setup mocks
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None  # No existing
        mock_session_local.return_value = mock_db
        
        mock_get_metadata.return_value = {
            "make": "Sony",
            "model": "A7R IV",
            "date": None,
            "lat": 37.7749,
            "lon": -122.4194
        }
        
        mock_generate_assets.return_value = ("thumb.jpg", "preview.jpg", [0.1] * 512, 6000, 4000)
        
        with tempfile.NamedTemporaryFile(suffix='.arw', delete=False) as tmp:
            tmp.write(b"fake raw data")
            tmp_path = tmp.name
        
        try:
            process_raw_file(tmp_path, "test.arw")
            
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()
            mock_generate_assets.assert_called_once_with(tmp_path, "test.arw")
        finally:
            os.unlink(tmp_path)

    @patch('app.services.raw_image_processor.SessionLocal')
    def test_process_raw_file_already_processed(self, mock_session_local):
        """Test processing raw image that already exists"""
        from app.services.raw_image_processor import process_raw_file
        
        mock_db = MagicMock()
        mock_existing = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_existing
        mock_session_local.return_value = mock_db
        
        with tempfile.NamedTemporaryFile(suffix='.arw', delete=False) as tmp:
            tmp.write(b"fake raw data")
            tmp_path = tmp.name
        
        try:
            process_raw_file(tmp_path, "test.arw")
            mock_db.add.assert_not_called()
        finally:
            os.unlink(tmp_path)

    @patch('app.services.raw_image_processor.SessionLocal')
    def test_process_raw_file_invalid_extension(self, mock_session_local):
        """Test processing file with invalid extension"""
        from app.services.raw_image_processor import process_raw_file
        
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp.write(b"not a raw file")
            tmp_path = tmp.name
        
        try:
            process_raw_file(tmp_path, "test.jpg")
            mock_db.add.assert_not_called()
        finally:
            os.unlink(tmp_path)

    @patch('app.services.raw_image_processor.exiftool.ExifToolHelper')
    def test_get_raw_metadata_success(self, mock_exiftool):
        """Test successful metadata extraction"""
        from app.services.raw_image_processor import get_raw_metadata
        
        mock_helper = MagicMock()
        mock_helper.__enter__.return_value = mock_helper
        mock_helper.__exit__.return_value = None
        mock_exiftool.return_value = mock_helper
        
        mock_helper.get_metadata.return_value = [{
            "EXIF:Make": "Canon",
            "EXIF:Model": "EOS R5",
            "EXIF:ISO": 400,
            "EXIF:FNumber": 2.8,
            "EXIF:ExposureTime": 0.00125,
            "GPSLatitude": 37.7749,
            "GPSLongitude": -122.4194,
            "EXIF:DateTimeOriginal": "2024:01:01 12:00:00"
        }]
        
        result = get_raw_metadata("/path/to/raw.cr2")
        
        assert result["make"] == "Canon"
        assert result["model"] == "EOS R5"
        assert result["iso"] == 400
        assert result["f_number"] == 2.8
        assert "1/800" in result["exposure"]
        assert result["lat"] == 37.7749
        assert result["lon"] == -122.4194

    @patch('app.services.raw_image_processor.exiftool.ExifToolHelper')
    def test_get_raw_metadata_exception(self, mock_exiftool):
        """Test metadata extraction with exception"""
        from app.services.raw_image_processor import get_raw_metadata
        
        mock_exiftool.side_effect = Exception("ExifTool error")
        
        result = get_raw_metadata("/path/to/raw.cr2")
        assert result == {}

    @patch('app.services.raw_image_processor.rawpy.imread')
    @patch('app.services.raw_image_processor.Image.open')
    @patch('app.services.raw_image_processor.ImageOps.exif_transpose')
    @patch('app.services.raw_image_processor.generate_embedding')
    @patch('app.services.raw_image_processor.os.path.exists')
    @patch('app.services.raw_image_processor.os.path.join')
    @patch('app.services.raw_image_processor.os.makedirs')
    @patch('app.services.raw_image_processor.io.BytesIO')
    @patch('app.services.raw_image_processor.hashlib.md5')
    def test_generate_assets_and_embed_success(
        self, mock_md5, mock_bytesio, mock_makedirs, mock_join, 
        mock_exists, mock_generate_embedding, mock_exif_transpose, mock_pil_open, mock_rawpy
    ):
        """Test successful asset generation and embedding"""
        from app.services.raw_image_processor import generate_assets_and_embed
        from PIL import Image
        import rawpy
        import io
        
        # Mock hash
        mock_hash = MagicMock()
        mock_hash.hexdigest.return_value = "abc123"
        mock_md5.return_value = mock_hash
        
        # Mock rawpy
        mock_raw = MagicMock()
        mock_thumb = MagicMock()
        mock_thumb.format = rawpy.ThumbFormat.JPEG
        mock_thumb.data = b"fake jpeg data"
        mock_raw.extract_thumb.return_value = mock_thumb
        mock_rawpy.return_value.__enter__.return_value = mock_raw
        mock_rawpy.return_value.__exit__.return_value = None
        
        # Mock PIL Image - need to use MagicMock to properly mock methods
        mock_img = MagicMock()
        mock_img.size = (6000, 4000)
        mock_img.mode = 'RGB'
        # Create separate mocks for copied images (preview and thumb)
        mock_preview_img = MagicMock()
        mock_preview_img.thumbnail = MagicMock()
        mock_preview_img.save = MagicMock()
        mock_thumb_img = MagicMock()
        mock_thumb_img.thumbnail = MagicMock()
        mock_thumb_img.save = MagicMock()
        # copy() should return different mocks for different calls
        mock_img.copy = MagicMock(side_effect=[mock_preview_img, mock_thumb_img, mock_img])
        mock_img.save = MagicMock()  # For saving to BytesIO
        mock_img.convert = MagicMock(return_value=mock_img)
        mock_pil_open.return_value = mock_img
        mock_exif_transpose.return_value = mock_img
        
        # Mock file operations
        mock_exists.return_value = False
        mock_join.side_effect = lambda *args: "/".join(args)
        
        # Mock BytesIO for embedding
        mock_bytesio_obj = io.BytesIO()
        mock_bytesio.return_value = mock_bytesio_obj
        
        mock_generate_embedding.return_value = [0.1] * 512
        
        result = generate_assets_and_embed("/path/to/raw.arw", "raw.arw")
        
        assert result[0] is not None  # thumb_name
        assert result[1] is not None  # preview_name
        assert result[2] is not None  # embedding
        assert result[3] == 6000  # width
        assert result[4] == 4000  # height

    @patch('app.services.raw_image_processor.rawpy.imread')
    @patch('app.services.raw_image_processor.Image.fromarray')
    @patch('app.services.raw_image_processor.ImageOps.exif_transpose')
    @patch('app.services.raw_image_processor.generate_embedding')
    @patch('app.services.raw_image_processor.os.path.exists')
    @patch('app.services.raw_image_processor.os.path.join')
    @patch('app.services.raw_image_processor.os.makedirs')
    @patch('app.services.raw_image_processor.io.BytesIO')
    @patch('app.services.raw_image_processor.hashlib.md5')
    def test_generate_assets_and_embed_no_thumbnail(
        self, mock_md5, mock_bytesio, mock_makedirs, mock_join,
        mock_exists, mock_generate_embedding, mock_exif_transpose, mock_fromarray, mock_rawpy
    ):
        """Test asset generation when no embedded thumbnail"""
        from app.services.raw_image_processor import generate_assets_and_embed
        from PIL import Image
        import rawpy
        import numpy as np
        import io
        
        # Mock hash
        mock_hash = MagicMock()
        mock_hash.hexdigest.return_value = "abc123"
        mock_md5.return_value = mock_hash
        
        # Mock rawpy with no thumbnail exception
        mock_raw = MagicMock()
        mock_raw.extract_thumb.side_effect = rawpy.LibRawNoThumbnailError()
        # Mock postprocess to return numpy array
        mock_raw.postprocess.return_value = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_rawpy.return_value.__enter__.return_value = mock_raw
        mock_rawpy.return_value.__exit__.return_value = None
        
        # Mock PIL Image - need to use MagicMock to properly mock methods
        mock_img = MagicMock()
        mock_img.size = (100, 100)
        mock_img.mode = 'RGB'
        # Create separate mocks for copied images (preview and thumb)
        mock_preview_img = MagicMock()
        mock_preview_img.thumbnail = MagicMock()
        mock_preview_img.save = MagicMock()
        mock_thumb_img = MagicMock()
        mock_thumb_img.thumbnail = MagicMock()
        mock_thumb_img.save = MagicMock()
        # copy() should return different mocks for different calls
        mock_img.copy = MagicMock(side_effect=[mock_preview_img, mock_thumb_img, mock_img])
        mock_img.save = MagicMock()  # For saving to BytesIO
        mock_img.convert = MagicMock(return_value=mock_img)
        mock_fromarray.return_value = mock_img
        mock_exif_transpose.return_value = mock_img
        
        # Mock file operations
        mock_exists.return_value = False
        mock_join.side_effect = lambda *args: "/".join(args)
        
        # Mock BytesIO
        mock_bytesio_obj = io.BytesIO()
        mock_bytesio.return_value = mock_bytesio_obj
        
        mock_generate_embedding.return_value = [0.1] * 512
        
        result = generate_assets_and_embed("/path/to/raw.arw", "raw.arw")
        
        # Should still generate assets
        assert result[0] is not None
        assert result[1] is not None

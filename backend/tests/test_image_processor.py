"""
Tests for image processing service.
"""
import pytest
from unittest.mock import patch, MagicMock, Mock
from PIL import Image as PILImage
from PIL.TiffImagePlugin import IFDRational
import os
import tempfile
from datetime import datetime


class TestImageProcessor:
    """Test suite for app.services.image_processor"""

    @patch('app.services.image_processor.generate_embedding')
    @patch('app.services.image_processor.SessionLocal')
    @patch('app.services.image_processor.ensure_thumbnail')
    @patch('app.services.image_processor.PILImage.open')
    @patch('app.services.image_processor.get_geotagging')
    @patch('app.services.image_processor.get_location_parts')
    @patch('app.services.image_processor.os.path.getsize')
    def test_process_image_file_success(
        self, mock_getsize, mock_get_location, mock_get_geotagging, mock_pil_open, 
        mock_ensure_thumbnail, mock_session_local, mock_generate_embedding
    ):
        """Test successful image processing"""
        from app.services.image_processor import process_image_file
        
        mock_getsize.return_value = 1024  # File size
        
        # Setup mocks
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None  # No existing image
        mock_session_local.return_value = mock_db
        
        mock_thumbnail = "thumb_test.jpg"
        mock_ensure_thumbnail.return_value = mock_thumbnail  # Must not be None
        
        # Mock PIL Image - PILImage.open returns image directly
        mock_img = MagicMock()
        mock_img.size = (2000, 1500)
        mock_exif = MagicMock()
        mock_exif.get.return_value = None
        mock_img.getexif.return_value = mock_exif
        mock_pil_open.return_value = mock_img
        
        mock_get_geotagging.return_value = None
        mock_get_location.return_value = None
        
        mock_generate_embedding.return_value = [0.1] * 512
        
        # Create temp file
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp.write(b"fake image data")
            tmp_path = tmp.name
        
        try:
            process_image_file(tmp_path, "test.jpg")
            
            # Verify database operations
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()
            mock_generate_embedding.assert_called_once_with(tmp_path)
        finally:
            os.unlink(tmp_path)

    @patch('app.services.image_processor.SessionLocal')
    def test_process_image_file_already_processed(self, mock_session_local):
        """Test processing image that already exists"""
        from app.services.image_processor import process_image_file
        
        mock_db = MagicMock()
        mock_existing = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_existing
        mock_session_local.return_value = mock_db
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp.write(b"fake image data")
            tmp_path = tmp.name
        
        try:
            process_image_file(tmp_path, "test.jpg")
            
            # Should not add new image
            mock_db.add.assert_not_called()
        finally:
            os.unlink(tmp_path)

    @patch('app.services.image_processor.SessionLocal')
    def test_process_image_file_invalid_extension(self, mock_session_local):
        """Test processing file with invalid extension"""
        from app.services.image_processor import process_image_file
        
        mock_db = MagicMock()
        mock_session_local.return_value = mock_db
        
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as tmp:
            tmp.write(b"not an image")
            tmp_path = tmp.name
        
        try:
            process_image_file(tmp_path, "test.txt")
            
            # Should not process
            mock_db.add.assert_not_called()
        finally:
            os.unlink(tmp_path)

    @patch('app.services.image_processor.generate_embedding')
    @patch('app.services.image_processor.SessionLocal')
    @patch('app.services.image_processor.ensure_thumbnail')
    @patch('app.services.image_processor.PILImage.open')
    @patch('app.services.image_processor.get_geotagging')
    @patch('app.services.image_processor.get_location_parts')
    @patch('app.services.image_processor.os.path.getsize')
    def test_process_image_file_no_embedding(
        self, mock_getsize, mock_get_location, mock_get_geotagging, mock_pil_open,
        mock_ensure_thumbnail, mock_session_local, mock_generate_embedding
    ):
        """Test image processing when embedding generation fails"""
        from app.services.image_processor import process_image_file
        
        mock_getsize.return_value = 1024  # File size
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_session_local.return_value = mock_db
        
        mock_ensure_thumbnail.return_value = "thumb_test.jpg"
        
        mock_img = MagicMock()
        mock_img.size = (2000, 1500)
        mock_exif = MagicMock()
        mock_exif.get.return_value = None
        mock_img.getexif.return_value = mock_exif
        mock_img.__enter__ = MagicMock(return_value=mock_img)
        mock_img.__exit__ = MagicMock(return_value=None)
        mock_pil_open.return_value = mock_img
        
        mock_get_geotagging.return_value = None
        mock_get_location.return_value = None
        
        mock_generate_embedding.return_value = None  # Embedding fails
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp.write(b"fake image data")
            tmp_path = tmp.name
        
        try:
            process_image_file(tmp_path, "test.jpg")
            
            # Should still save image but with is_processed=False
            mock_db.add.assert_called_once()
            added_image = mock_db.add.call_args[0][0]
            assert added_image.is_processed is False
        finally:
            os.unlink(tmp_path)

    def test_extract_exif_data(self):
        """Test EXIF data extraction"""
        from app.services.image_processor import extract_exif_data
        
        mock_img = MagicMock()
        mock_exif = MagicMock()
        mock_exif.items.return_value = [
            (271, "Canon"),  # Make
            (272, "EOS R5")  # Model
        ]
        mock_img.getexif.return_value = mock_exif
        
        # Mock ExifIFD
        mock_exif_ifd = {
            34855: 800,  # ISO
            33437: IFDRational(18, 10),  # FNumber
            37386: IFDRational(50, 1),  # FocalLength
            33434: IFDRational(1, 200)  # ExposureTime
        }
        mock_exif.get_ifd.return_value = mock_exif_ifd
        
        result = extract_exif_data(mock_img)
        
        assert result["make"] == "Canon"
        assert result["model"] == "EOS R5"
        assert result["iso"] == 800
        assert result["f_number"] == 1.8
        assert result["focal_length"] == 50.0
        assert "1/200" in result["exposure"]

    def test_get_geotagging_success(self):
        """Test GPS extraction"""
        from app.services.image_processor import get_geotagging
        
        mock_img = MagicMock()
        mock_exif = MagicMock()
        mock_img.getexif.return_value = mock_exif
        
        # Mock GPS IFD
        mock_gps = {
            1: 'N',  # GPSLatitudeRef
            2: ((37, 1), (46, 1), (29, 1)),  # GPSLatitude
            3: 'W',  # GPSLongitudeRef
            4: ((122, 1), (25, 1), (9, 1))  # GPSLongitude
        }
        mock_exif.get_ifd.return_value = mock_gps
        
        result = get_geotagging(mock_img)
        
        assert result is not None
        assert 'GPSLatitude' in result or 'GPSLongitude' in result

    def test_get_geotagging_no_exif(self):
        """Test GPS extraction with no EXIF"""
        from app.services.image_processor import get_geotagging
        
        mock_img = MagicMock()
        mock_img.getexif.return_value = None
        
        result = get_geotagging(mock_img)
        assert result is None

    @patch('app.services.image_processor.os.path.exists')
    @patch('app.services.image_processor.PILImage.open')
    def test_ensure_thumbnail_creates_thumbnail(self, mock_pil_open, mock_exists):
        """Test thumbnail creation"""
        from app.services.image_processor import ensure_thumbnail
        
        mock_exists.return_value = False  # Thumbnail doesn't exist
        
        mock_img = MagicMock()
        mock_img.size = (2000, 1500)
        mock_pil_open.return_value.__enter__.return_value = mock_img
        mock_pil_open.return_value.__exit__.return_value = None
        
        with patch('app.services.image_processor.ImageOps.exif_transpose', return_value=mock_img):
            with patch('app.services.image_processor.os.path.join', return_value="/thumb/path.jpg"):
                with patch('app.services.image_processor.os.makedirs'):
                    result = ensure_thumbnail("/path/to/image.jpg", "image.jpg")
                    
                    assert result is not None
                    assert result.startswith("thumb_")

    @patch('app.services.image_processor.os.path.exists')
    def test_ensure_thumbnail_existing(self, mock_exists):
        """Test thumbnail when it already exists"""
        from app.services.image_processor import ensure_thumbnail
        
        mock_exists.return_value = True  # Thumbnail exists
        
        with patch('app.services.image_processor.hashlib.md5') as mock_md5:
            mock_md5.return_value.hexdigest.return_value = "abc123"
            result = ensure_thumbnail("/path/to/image.jpg", "image.jpg")
            
            assert result == "thumb_abc123.jpg"

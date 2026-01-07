"""
Tests for the directory scanner service.
"""
import pytest
from unittest.mock import patch, MagicMock, mock_open
from datetime import datetime
from app.services.scanner import get_decimal_from_dms, get_geotagging, scan_directory
from app.models import Image


class TestGetDecimalFromDMS:
    """Test suite for DMS to decimal conversion"""

    def test_convert_north_latitude(self):
        """Test converting northern latitude"""
        result = get_decimal_from_dms((37, 46, 30), 'N')
        assert round(result, 6) == 37.775

    def test_convert_south_latitude(self):
        """Test converting southern latitude"""
        result = get_decimal_from_dms((33, 52, 10), 'S')
        assert round(result, 6) == -33.869444

    def test_convert_east_longitude(self):
        """Test converting eastern longitude"""
        result = get_decimal_from_dms((151, 12, 30), 'E')
        assert round(result, 6) == 151.208333

    def test_convert_west_longitude(self):
        """Test converting western longitude"""
        result = get_decimal_from_dms((122, 25, 10), 'W')
        assert round(result, 6) == -122.419444

    def test_convert_zero_minutes_seconds(self):
        """Test converting coordinates with zero minutes and seconds"""
        result = get_decimal_from_dms((40, 0, 0), 'N')
        assert result == 40.0

    def test_convert_fractional_seconds(self):
        """Test converting with fractional seconds"""
        result = get_decimal_from_dms((37.0, 46.0, 30.5), 'N')
        assert round(result, 7) == 37.7751389


class TestGetGeotagging:
    """Test suite for GPS extraction from EXIF"""

    @patch('PIL.Image.open')
    def test_extract_gps_data(self, mock_open):
        """Test successful GPS extraction"""
        # Mock image with GPS EXIF data
        mock_img = MagicMock()
        mock_exif = MagicMock()
        mock_gps_ifd = {
            1: 'N',
            2: (37.0, 46.0, 30.0),
            3: 'W',
            4: (122.0, 25.0, 10.0)
        }
        
        mock_img.getexif.return_value = mock_exif
        mock_exif.get_ifd.return_value = mock_gps_ifd
        
        with patch('app.services.scanner.ExifTags.GPSTAGS', {
            1: 'GPSLatitudeRef',
            2: 'GPSLatitude',
            3: 'GPSLongitudeRef',
            4: 'GPSLongitude'
        }):
            result = get_geotagging(mock_img)
        
        assert result is not None
        assert result['GPSLatitudeRef'] == 'N'
        assert result['GPSLatitude'] == (37.0, 46.0, 30.0)
        assert result['GPSLongitudeRef'] == 'W'
        assert result['GPSLongitude'] == (122.0, 25.0, 10.0)

    @patch('PIL.Image.open')
    def test_no_exif_data(self, mock_open):
        """Test handling of image with no EXIF data"""
        mock_img = MagicMock()
        mock_img.getexif.return_value = None
        
        result = get_geotagging(mock_img)
        assert result is None

    @patch('PIL.Image.open')
    def test_no_gps_data(self, mock_open):
        """Test handling of image with EXIF but no GPS data"""
        mock_img = MagicMock()
        mock_exif = MagicMock()
        mock_img.getexif.return_value = mock_exif
        mock_exif.get_ifd.return_value = None
        
        result = get_geotagging(mock_img)
        assert result is None

    @patch('PIL.Image.open')
    def test_gps_extraction_error(self, mock_open):
        """Test error handling during GPS extraction"""
        mock_img = MagicMock()
        mock_img.getexif.side_effect = Exception("Corrupted EXIF")
        
        result = get_geotagging(mock_img)
        assert result is None


class TestScanDirectory:
    """Test suite for directory scanning"""

    @patch('app.services.scanner.get_location_parts')
    @patch('app.services.scanner.ensure_thumbnail')
    @patch('app.services.scanner.PILImage.open')
    @patch('app.services.scanner.os.walk')
    @patch('app.services.scanner.os.path.getsize')
    def test_scan_finds_images(self, mock_getsize, mock_walk, mock_pil, mock_thumbnail, mock_location, db_session):
        """Test that scan finds and processes images"""
        # Mock directory structure
        mock_walk.return_value = [
            ('/test', [], ['photo1.jpg', 'photo2.png', 'document.txt'])
        ]
        mock_getsize.return_value = 1024000
        mock_thumbnail.return_value = 'thumb_test123.jpg'
        mock_location.return_value = None
        
        # Mock PIL image with size property
        mock_img = MagicMock()
        mock_img.size = (4000, 3000)  # width, height
        mock_exif = MagicMock()
        mock_img.getexif.return_value = mock_exif
        mock_exif.get.return_value = None
        mock_exif.get_ifd.return_value = None
        mock_pil.return_value = mock_img
        
        count = scan_directory('/test', db_session)
        
        assert count == 2  # Should find 2 images, skip .txt
        
        # Verify images were added to database
        images = db_session.query(Image).all()
        assert len(images) == 2

    @patch('app.services.scanner.get_location_parts')
    @patch('app.services.scanner.ensure_thumbnail')
    @patch('app.services.scanner.PILImage.open')
    @patch('app.services.scanner.os.walk')
    @patch('app.services.scanner.os.path.getsize')
    def test_scan_with_gps_data(self, mock_getsize, mock_walk, mock_pil, mock_thumbnail, mock_location, db_session):
        """Test scanning image with GPS data"""
        mock_walk.return_value = [('/test', [], ['gps_photo.jpg'])]
        mock_getsize.return_value = 2048000
        mock_thumbnail.return_value = 'thumb_gps_photo.jpg'
        mock_location.return_value = {'city': 'San Francisco', 'state': 'California', 'country': 'United States'}
        
        # Mock image with GPS
        mock_img = MagicMock()
        mock_img.size = (3840, 2160)  # width, height
        mock_exif = MagicMock()
        mock_gps_ifd = {
            1: 'N',
            2: (37.0, 46.0, 30.0),
            3: 'W',
            4: (122.0, 25.0, 10.0)
        }
        
        mock_img.getexif.return_value = mock_exif
        mock_exif.get.return_value = None
        mock_exif.get_ifd.return_value = mock_gps_ifd
        mock_pil.return_value = mock_img
        
        with patch('app.services.scanner.ExifTags.GPSTAGS', {
            1: 'GPSLatitudeRef',
            2: 'GPSLatitude',
            3: 'GPSLongitudeRef',
            4: 'GPSLongitude'
        }):
            count = scan_directory('/test', db_session)
        
        assert count == 1
        
        image = db_session.query(Image).first()
        assert image.latitude is not None
        assert image.longitude is not None
        assert image.city == 'San Francisco'
        assert image.state == 'California'
        assert image.country == 'United States'
        mock_location.assert_called_once()

    @patch('app.services.scanner.PILImage.open')
    @patch('app.services.scanner.os.walk')
    @patch('app.services.scanner.os.path.getsize')
    def test_scan_skips_duplicates(self, mock_getsize, mock_walk, mock_pil, db_session):
        """Test that scan skips already indexed images"""
        # Add existing image to database
        existing = Image(
            filename='existing.jpg',
            file_path='/test/existing.jpg',
            file_size=1024
        )
        db_session.add(existing)
        db_session.commit()
        
        mock_walk.return_value = [('/test', [], ['existing.jpg'])]
        mock_getsize.return_value = 1024000
        mock_pil.return_value = MagicMock()
        
        count = scan_directory('/test', db_session)
        
        assert count == 0  # Should skip the duplicate
        
        # Should still only have 1 image in database
        images = db_session.query(Image).all()
        assert len(images) == 1

    @patch('app.services.scanner.get_location_parts')
    @patch('app.services.scanner.ensure_thumbnail')
    @patch('app.services.scanner.PILImage.open')
    @patch('app.services.scanner.os.walk')
    def test_scan_handles_errors_gracefully(self, mock_walk, mock_pil, mock_thumbnail, mock_location, db_session):
        """Test that scan continues after encountering errors"""
        mock_walk.return_value = [
            ('/test', [], ['good.jpg', 'corrupted.jpg', 'another_good.png'])
        ]
        mock_location.return_value = None
        
        # Mock thumbnail creation to succeed
        mock_thumbnail.return_value = 'thumb_test456.jpg'
        
        # Create mock images with size property
        mock_img1 = MagicMock()
        mock_img1.size = (4000, 3000)
        mock_img1.getexif.return_value = MagicMock(
            get=MagicMock(return_value=None),
            get_ifd=MagicMock(return_value=None)
        )
        
        mock_img3 = MagicMock()
        mock_img3.size = (3840, 2160)
        mock_img3.getexif.return_value = MagicMock(
            get=MagicMock(return_value=None),
            get_ifd=MagicMock(return_value=None)
        )
        
        # First call succeeds, second fails, third succeeds
        mock_pil.side_effect = [
            mock_img1,
            Exception("Corrupted file"),
            mock_img3
        ]
        
        with patch('app.services.scanner.os.path.getsize', return_value=1024):
            count = scan_directory('/test', db_session)
        
        # Should process 2 out of 3 images
        assert count == 2

    @patch('app.services.scanner.get_location_parts')
    @patch('app.services.scanner.ensure_thumbnail')
    @patch('app.services.scanner.PILImage.open')
    @patch('app.services.scanner.os.walk')
    @patch('app.services.scanner.os.path.getsize')
    def test_scan_extracts_capture_date(self, mock_getsize, mock_walk, mock_pil, mock_thumbnail, mock_location, db_session):
        """Test extraction of capture date from EXIF"""
        mock_walk.return_value = [('/test', [], ['dated.jpg'])]
        mock_getsize.return_value = 1024000
        mock_thumbnail.return_value = 'thumb_dated789.jpg'
        mock_location.return_value = None
        
        # Mock image with date
        mock_img = MagicMock()
        mock_img.size = (4000, 3000)
        mock_exif = MagicMock()
        mock_exif.get.return_value = '2024:12:25 14:30:00'  # DateTimeOriginal
        mock_exif.get_ifd.return_value = None
        mock_img.getexif.return_value = mock_exif
        mock_pil.return_value = mock_img
        
        count = scan_directory('/test', db_session)
        
        assert count == 1
        
        image = db_session.query(Image).first()
        assert image.capture_date is not None
        assert image.capture_date.year == 2024
        assert image.capture_date.month == 12
        assert image.capture_date.day == 25

    @patch('app.services.scanner.get_location_parts')
    @patch('app.services.scanner.os.walk')
    def test_scan_filters_supported_formats(self, mock_walk, mock_location, db_session):
        """Test that scan only processes supported image formats"""
        mock_walk.return_value = [
            ('/test', [], [
                'photo.jpg',
                'photo.JPEG',
                'photo.png',
                'photo.heic',
                'photo.HEIF',
                'video.mp4',
                'document.pdf',
                'data.txt'
            ])
        ]
        mock_location.return_value = None
        
        with patch('app.services.scanner.ensure_thumbnail', return_value='thumb_abc.jpg'):
            with patch('app.services.scanner.PILImage.open') as mock_pil:
                with patch('app.services.scanner.os.path.getsize', return_value=1024):
                    mock_img = MagicMock()
                    mock_img.size = (4000, 3000)
                    mock_exif = MagicMock()
                    mock_exif.get.return_value = None
                    mock_exif.get_ifd.return_value = None
                    mock_img.getexif.return_value = mock_exif
                    mock_pil.return_value = mock_img
                    
                    count = scan_directory('/test', db_session)
        
        # Should only process 5 image files
        assert count == 5


class TestEnsureThumbnail:
    """Test suite for thumbnail generation"""

    @patch('app.services.scanner.ensure_thumbnail_dir')
    @patch('app.services.scanner.os.path.exists')
    @patch('app.services.scanner.PILImage.open')
    def test_thumbnail_already_exists(self, mock_pil, mock_exists, mock_ensure_dir):
        """Test that existing thumbnails are not regenerated"""
        from app.services.scanner import ensure_thumbnail
        
        # Simulate existing thumbnail
        mock_exists.return_value = True
        
        result = ensure_thumbnail('/test/photo.jpg', 'photo.jpg')
        
        # Should return hash-based filename
        assert result.startswith('thumb_')
        assert result.endswith('.jpg')
        # Should not try to open the image
        mock_pil.assert_not_called()

    @patch('app.services.scanner.ensure_thumbnail_dir')
    @patch('app.services.scanner.os.path.exists')
    @patch('app.services.scanner.ImageOps.exif_transpose')
    @patch('app.services.scanner.PILImage.open')
    def test_thumbnail_creation_success(self, mock_pil, mock_transpose, mock_exists, mock_ensure_dir):
        """Test successful thumbnail creation"""
        from app.services.scanner import ensure_thumbnail
        
        mock_exists.return_value = False
        
        # Mock PIL image operations - chain the transforms
        mock_img = MagicMock()
        mock_img_transposed = MagicMock()
        mock_img_rgb = MagicMock()
        
        mock_pil.return_value.__enter__.return_value = mock_img
        mock_pil.return_value.__exit__.return_value = None
        mock_transpose.return_value = mock_img_transposed
        mock_img_transposed.convert.return_value = mock_img_rgb
        
        result = ensure_thumbnail('/test/photo.jpg', 'photo.jpg')
        
        # Should return hash-based filename
        assert result.startswith('thumb_')
        assert result.endswith('.jpg')
        mock_img_rgb.thumbnail.assert_called_once_with((300, 300))
        mock_img_rgb.save.assert_called_once()

    @patch('app.services.scanner.ensure_thumbnail_dir')
    @patch('app.services.scanner.os.path.exists')
    @patch('app.services.scanner.ImageOps.exif_transpose')
    @patch('app.services.scanner.PILImage.open')
    def test_thumbnail_creation_handles_heic(self, mock_pil, mock_transpose, mock_exists, mock_ensure_dir):
        """Test thumbnail creation for HEIC images"""
        from app.services.scanner import ensure_thumbnail
        
        mock_exists.return_value = False
        
        # Mock PIL image - chain the transforms
        mock_img = MagicMock()
        mock_img_transposed = MagicMock()
        mock_img_rgb = MagicMock()
        
        mock_pil.return_value.__enter__.return_value = mock_img
        mock_pil.return_value.__exit__.return_value = None
        mock_transpose.return_value = mock_img_transposed
        mock_img_transposed.convert.return_value = mock_img_rgb
        
        result = ensure_thumbnail('/test/photo.heic', 'photo.heic')
        
        # Should return hash-based filename saved as .jpg
        assert result.startswith('thumb_')
        assert result.endswith('.jpg')
        mock_img_rgb.save.assert_called_once()
        # Verify it's saved as JPEG
        save_args = mock_img_rgb.save.call_args
        assert save_args[0][0].endswith('.jpg')
        assert save_args[0][1] == 'JPEG'  # Second positional arg
        assert save_args[1]['quality'] == 70

    @patch('app.services.scanner.ensure_thumbnail_dir')
    @patch('app.services.scanner.os.path.exists')
    @patch('app.services.scanner.PILImage.open')
    def test_thumbnail_creation_error_handling(self, mock_pil, mock_exists, mock_ensure_dir):
        """Test error handling during thumbnail creation"""
        from app.services.scanner import ensure_thumbnail
        
        mock_exists.return_value = False
        mock_pil.side_effect = Exception("Corrupted image")
        
        result = ensure_thumbnail('/test/corrupted.jpg', 'corrupted.jpg')
        
        assert result is None

    @patch('app.services.scanner.ensure_thumbnail_dir')
    @patch('app.services.scanner.os.path.exists')
    @patch('app.services.scanner.ImageOps.exif_transpose')
    @patch('app.services.scanner.PILImage.open')
    def test_thumbnail_exif_transpose(self, mock_pil, mock_transpose, mock_exists, mock_ensure_dir):
        """Test that EXIF orientation is respected"""
        from app.services.scanner import ensure_thumbnail
        
        mock_exists.return_value = False
        
        # Mock PIL image - chain the transforms
        mock_img = MagicMock()
        mock_img_transposed = MagicMock()
        mock_img_rgb = MagicMock()
        
        mock_pil.return_value.__enter__.return_value = mock_img
        mock_pil.return_value.__exit__.return_value = None
        mock_transpose.return_value = mock_img_transposed
        mock_img_transposed.convert.return_value = mock_img_rgb
        
        ensure_thumbnail('/test/rotated.jpg', 'rotated.jpg')
        
        # Verify exif_transpose was called
        mock_transpose.assert_called_once_with(mock_img)

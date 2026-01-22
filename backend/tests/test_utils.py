"""
Tests for utility functions in app.core.utils
"""
import pytest
from unittest.mock import patch, MagicMock
from PIL.TiffImagePlugin import IFDRational
import os
import tempfile
import shutil

from app.core.utils import (
    get_coordinates,
    get_location_parts,
    get_float,
    get_decimal_from_dms,
    ensure_dirs,
    format_shutter_speed,
    parse_iso6709,
    get_duration_cv2
)


class TestGeocoding:
    """Tests for geocoding functions"""

    @patch('app.core.utils.Nominatim')
    def test_get_coordinates_success(self, mock_nominatim):
        """Test successful coordinate lookup"""
        mock_geolocator = MagicMock()
        mock_location = MagicMock()
        mock_location.latitude = 37.7749
        mock_location.longitude = -122.4194
        mock_geolocator.geocode.return_value = mock_location
        mock_nominatim.return_value = mock_geolocator
        
        result = get_coordinates(city="San Francisco", state="California", country="United States")
        
        assert result == (37.7749, -122.4194)
        mock_geolocator.geocode.assert_called_once()

    @patch('app.core.utils.Nominatim')
    def test_get_coordinates_not_found(self, mock_nominatim):
        """Test coordinate lookup when location not found"""
        mock_geolocator = MagicMock()
        mock_geolocator.geocode.return_value = None
        mock_nominatim.return_value = mock_geolocator
        
        result = get_coordinates(city="NonexistentCity")
        
        assert result is None

    def test_get_coordinates_empty_query(self):
        """Test coordinate lookup with empty query"""
        result = get_coordinates()
        assert result is None

    @patch('app.core.utils.Nominatim')
    def test_get_coordinates_exception(self, mock_nominatim):
        """Test coordinate lookup with exception"""
        mock_geolocator = MagicMock()
        mock_geolocator.geocode.side_effect = Exception("Network error")
        mock_nominatim.return_value = mock_geolocator
        
        result = get_coordinates(city="San Francisco")
        assert result is None

    @patch('app.core.utils.Nominatim')
    def test_get_location_parts_success(self, mock_nominatim):
        """Test successful reverse geocoding"""
        mock_geolocator = MagicMock()
        mock_location = MagicMock()
        mock_location.raw = {
            'address': {
                'city': 'San Francisco',
                'state': 'California',
                'country': 'United States'
            }
        }
        mock_geolocator.reverse.return_value = mock_location
        mock_nominatim.return_value = mock_geolocator
        
        result = get_location_parts(37.7749, -122.4194)
        
        assert result == {
            'city': 'San Francisco',
            'state': 'California',
            'country': 'United States'
        }

    @patch('app.core.utils.Nominatim')
    def test_get_location_parts_no_address(self, mock_nominatim):
        """Test reverse geocoding when no address found"""
        mock_geolocator = MagicMock()
        mock_location = MagicMock()
        mock_location.raw = {}
        mock_geolocator.reverse.return_value = mock_location
        mock_nominatim.return_value = mock_geolocator
        
        result = get_location_parts(37.7749, -122.4194)
        assert result is None

    @patch('app.core.utils.Nominatim')
    def test_get_location_parts_exception(self, mock_nominatim):
        """Test reverse geocoding with exception"""
        mock_geolocator = MagicMock()
        mock_geolocator.reverse.side_effect = Exception("Network error")
        mock_nominatim.return_value = mock_geolocator
        
        result = get_location_parts(37.7749, -122.4194)
        assert result is None


class TestFloatConversion:
    """Tests for float conversion utilities"""

    def test_get_float_from_ifd_rational(self):
        """Test converting IFDRational to float"""
        rational = IFDRational(1, 2)
        result = get_float(rational)
        assert result == 0.5

    def test_get_float_from_tuple(self):
        """Test converting tuple to float"""
        result = get_float((3, 4))
        assert result == 0.75

    def test_get_float_from_tuple_zero_denominator(self):
        """Test tuple with zero denominator"""
        result = get_float((1, 0))
        assert result is None

    def test_get_float_from_int(self):
        """Test converting int to float"""
        result = get_float(5)
        assert result == 5.0

    def test_get_float_from_float(self):
        """Test converting float to float"""
        result = get_float(3.14)
        assert result == 3.14

    def test_get_float_invalid(self):
        """Test invalid input"""
        result = get_float("not a number")
        assert result is None


class TestGPSConversion:
    """Tests for GPS coordinate conversion"""

    def test_get_decimal_from_dms_north_east(self):
        """Test DMS to decimal conversion for North/East"""
        dms = (37, 46, 29.64)  # San Francisco latitude
        result = get_decimal_from_dms(dms, 'N')
        assert abs(result - 37.7749) < 0.01

    def test_get_decimal_from_dms_south_west(self):
        """Test DMS to decimal conversion for South/West (negative)"""
        dms = (122, 25, 9.84)  # San Francisco longitude
        result = get_decimal_from_dms(dms, 'W')
        assert abs(result - (-122.4194)) < 0.01

    def test_get_decimal_from_dms_south(self):
        """Test DMS to decimal conversion for South"""
        dms = (37, 46, 29.64)
        result = get_decimal_from_dms(dms, 'S')
        assert result < 0


class TestDirectoryManagement:
    """Tests for directory management utilities"""

    def test_ensure_dirs_creates_directory(self):
        """Test creating directories"""
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = os.path.join(tmpdir, "test_subdir")
            ensure_dirs([test_dir])
            assert os.path.exists(test_dir)
            assert os.path.isdir(test_dir)

    def test_ensure_dirs_multiple(self):
        """Test creating multiple directories"""
        with tempfile.TemporaryDirectory() as tmpdir:
            dirs = [
                os.path.join(tmpdir, "dir1"),
                os.path.join(tmpdir, "dir2"),
                os.path.join(tmpdir, "dir3")
            ]
            ensure_dirs(dirs)
            for d in dirs:
                assert os.path.exists(d)

    def test_ensure_dirs_existing(self):
        """Test ensure_dirs with existing directory"""
        with tempfile.TemporaryDirectory() as tmpdir:
            ensure_dirs([tmpdir])  # Should not raise error
            assert os.path.exists(tmpdir)


class TestShutterSpeedFormatting:
    """Tests for shutter speed formatting"""

    def test_format_shutter_speed_fraction(self):
        """Test formatting decimal to fraction"""
        result = format_shutter_speed(0.00125)
        assert result == "1/800"

    def test_format_shutter_speed_one_second(self):
        """Test formatting 1 second"""
        result = format_shutter_speed(1.0)
        assert result == "1"

    def test_format_shutter_speed_long_exposure(self):
        """Test formatting long exposure"""
        result = format_shutter_speed(2.5)
        assert result == "2.5"

    def test_format_shutter_speed_none(self):
        """Test formatting None"""
        result = format_shutter_speed(None)
        assert result is None

    def test_format_shutter_speed_zero(self):
        """Test formatting zero"""
        result = format_shutter_speed(0)
        # Zero is falsy, so function returns None (early return on "if not val")
        # This is the actual behavior of the function
        assert result is None

    def test_format_shutter_speed_negative(self):
        """Test formatting negative value"""
        result = format_shutter_speed(-1)
        assert result == "-1"

    def test_format_shutter_speed_invalid(self):
        """Test formatting invalid input"""
        result = format_shutter_speed("invalid")
        assert result == "invalid"


class TestISO6709Parsing:
    """Tests for ISO6709 string parsing"""

    def test_parse_iso6709_valid(self):
        """Test parsing valid ISO6709 string"""
        result = parse_iso6709("+37.7749-122.4194/")
        assert result == (37.7749, -122.4194)

    def test_parse_iso6709_no_slash(self):
        """Test parsing ISO6709 without trailing slash"""
        result = parse_iso6709("+37.7749-122.4194")
        assert result == (37.7749, -122.4194)

    def test_parse_iso6709_invalid(self):
        """Test parsing invalid ISO6709 string"""
        result = parse_iso6709("invalid")
        assert result == (None, None)

    def test_parse_iso6709_empty(self):
        """Test parsing empty string"""
        result = parse_iso6709("")
        assert result == (None, None)


class TestVideoDuration:
    """Tests for video duration extraction"""

    @patch('app.core.utils.cv2.VideoCapture')
    def test_get_duration_cv2_success(self, mock_videocapture):
        """Test successful video duration extraction"""
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.get.side_effect = lambda prop: {
            5: 30.0,  # CAP_PROP_FPS
            7: 900.0  # CAP_PROP_FRAME_COUNT
        }.get(prop, 0)
        mock_videocapture.return_value = mock_cap
        
        result = get_duration_cv2("/path/to/video.mp4")
        
        assert result == 30.0  # 900 frames / 30 fps = 30 seconds
        mock_cap.release.assert_called_once()

    @patch('app.core.utils.cv2.VideoCapture')
    def test_get_duration_cv2_not_opened(self, mock_videocapture):
        """Test when video cannot be opened"""
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = False
        mock_videocapture.return_value = mock_cap
        
        result = get_duration_cv2("/path/to/video.mp4")
        
        assert result is None

    @patch('app.core.utils.cv2.VideoCapture')
    def test_get_duration_cv2_zero_fps(self, mock_videocapture):
        """Test when FPS is zero"""
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.get.side_effect = lambda prop: {
            5: 0.0,   # CAP_PROP_FPS
            7: 900.0  # CAP_PROP_FRAME_COUNT
        }.get(prop, 0)
        mock_videocapture.return_value = mock_cap
        
        result = get_duration_cv2("/path/to/video.mp4")
        
        assert result == 0

    @patch('app.core.utils.cv2.VideoCapture')
    def test_get_duration_cv2_exception(self, mock_videocapture):
        """Test exception handling"""
        mock_videocapture.side_effect = Exception("OpenCV error")
        
        result = get_duration_cv2("/path/to/video.mp4")
        
        assert result is None

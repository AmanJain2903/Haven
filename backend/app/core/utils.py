from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from PIL.TiffImagePlugin import IFDRational
import cv2
import re
import os

def get_coordinates(city: str = None, state: str = None, country: str = None) -> tuple:
    """
    Forward Geocoding: City, State, Country -> (Latitude, Longitude)
    Returns: (latitude, longitude) as floats, or None if not found.
    """
    try:
        geolocator = Nominatim(user_agent="haven_photo_manager")
        
        # Build a structured query dict (more accurate than a raw string)
        query = {}
        if city: query['city'] = city
        if state: query['state'] = state
        if country: query['country'] = country
        
        if not query:
            return None

        # Perform the lookup
        location = geolocator.geocode(query, timeout=10, language='en')
        
        if location:
            return (location.latitude, location.longitude)
        else:
            print(f"❌ Location not found: {query}")
            return None

    except Exception as e:
        print(f"❌ Error getting coordinates: {e}")
        return None

def get_location_parts(latitude: float, longitude: float) -> dict:
    """
    Reverse geocode coordinates to get a human-readable location label.
    """
    try:
        geolocator = Nominatim(user_agent="haven_photo_manager")
        location = geolocator.reverse(f"{latitude}, {longitude}", timeout=10, language='en')
        
        if not location or not location.raw.get('address'):
            return None
        
        address = location.raw['address']
        parts = {
            'city': None,
            'state': None,
            'country': None
        }
        
        city = address.get('city') or address.get('town') or address.get('village') or address.get('municipality')
        if city: parts['city'] = city
        
        state = address.get('state') or address.get('region')
        if state: parts['state'] = state
        
        country = address.get('country')
        if country: parts['country'] = country
        
        return parts
        
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"Geocoding service error: {e}")
        return None
    except Exception as e:
        print(f"Error reverse geocoding ({latitude}, {longitude}): {e}")
        return None

def get_float(val):
    if isinstance(val, IFDRational):
        return float(val)
    if isinstance(val, tuple) and len(val) == 2 and val[1] != 0:
        return val[0] / val[1]
    if isinstance(val, (int, float)):
        return float(val)
    return None

def get_decimal_from_dms(dms, ref):
    """Helper to convert degrees/minutes/seconds format to decimal format."""
    degrees = dms[0]
    minutes = dms[1]
    seconds = dms[2]
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal

def ensure_dirs(dirs: list[str]):
    """Create thumbnail directory if it doesn't exist"""
    for dir in dirs:
        try:
            os.makedirs(dir, exist_ok=True)
        except Exception as e:
            print(f"Error creating directory {dir}: {e}")

def format_shutter_speed(val):
    """
    Converts decimal exposure (0.00125) to fraction string (1/800).
    """
    if not val:
        return None
    try:
        f_val = float(val)
        if f_val >= 1:
            return str(round(f_val, 1)).replace(".0", "") # e.g. "2" or "0.5" if long exposure
        if f_val <= 0:
            return str(val)
        
        # Calculate denominator
        denom = round(1 / f_val)
        return f"1/{denom}"
    except:
        return str(val)

def parse_iso6709(geo_string):
    """
    Parses ISO6709 string from metadata (e.g., "+37.7749-122.4194/")
    """
    try:
        match = re.match(r'([+-][0-9.]+)([+-][0-9.]+)', geo_string)
        if match:
            return float(match.group(1)), float(match.group(2))
    except:
        pass
    return None, None

def get_duration_cv2(file_path):
    try:
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            return None
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        
        if fps > 0:
            duration = frame_count / fps
        else:
            duration = 0
            
        cap.release()
        return duration
    except Exception as e:
        print(f"Error reading video duration: {e}")
        return None
"""
Tests for maps endpoints.
"""
from unittest.mock import patch, MagicMock
from fastapi import status


class TestMapsEndpoints:
    """Test suite for /api/v1/maps endpoints"""

    def test_get_map_data_images(self, client, db_session, sample_images, sample_system_config):
        """Test getting map data for images"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/maps/images")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All items should have GPS coordinates
        for item in data:
            assert "latitude" in item
            assert "longitude" in item
            assert item["type"] == "image"
            assert item["latitude"] is not None
            assert item["longitude"] is not None

    def test_get_map_data_videos(self, client, db_session, sample_videos, sample_system_config):
        """Test getting map data for videos"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/maps/videos")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All items should have GPS coordinates
        for item in data:
            assert "latitude" in item
            assert "longitude" in item
            assert item["type"] == "video"

    def test_get_map_data_raw_images(self, client, db_session, sample_raw_images, sample_system_config):
        """Test getting map data for raw images"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/maps/raw_images")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All items should have GPS coordinates
        for item in data:
            assert "latitude" in item
            assert "longitude" in item
            assert item["type"] == "raw"

    def test_get_map_data_all_media(
        self, client, db_session, sample_images, sample_videos,
        sample_raw_images, sample_system_config
    ):
        """Test getting map data for all media"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/maps/all_media")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All items should have GPS coordinates and type
        for item in data:
            assert "latitude" in item
            assert "longitude" in item
            assert "type" in item
            assert item["type"] in ["image", "video", "raw"]

    def test_get_location_data_image(self, client, db_session, sample_images):
        """Test getting location data for an image"""
        image_id = sample_images[0].id
        
        response = client.get(f"/api/v1/maps/location/image/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "city" in data
        assert "state" in data
        assert "country" in data

    def test_get_location_data_video(self, client, db_session, sample_videos):
        """Test getting location data for a video"""
        video_id = sample_videos[0].id
        
        response = client.get(f"/api/v1/maps/location/video/{video_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "city" in data
        assert "state" in data
        assert "country" in data

    def test_get_location_data_raw(self, client, db_session, sample_raw_images):
        """Test getting location data for a raw image"""
        raw_id = sample_raw_images[0].id
        
        response = client.get(f"/api/v1/maps/location/raw/{raw_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "city" in data
        assert "state" in data
        assert "country" in data

    def test_get_location_data_invalid_type(self, client):
        """Test getting location data with invalid file type"""
        response = client.get("/api/v1/maps/location/invalid/1")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid file type" in response.json()["detail"]

    @patch('app.api.v1.endpoints.maps.get_coordinates')
    @patch('app.api.v1.endpoints.maps.get_location_parts')
    def test_update_location_data(
        self, mock_location_parts, mock_coordinates, client, db_session, sample_images
    ):
        """Test updating location data"""
        mock_coordinates.return_value = (37.775, -122.419)
        mock_location_parts.return_value = {
            "city": "San Francisco",
            "state": "California",
            "country": "United States"
        }
        
        image_id = sample_images[0].id
        
        response = client.post(
            f"/api/v1/maps/location/image/{image_id}",
            params={"city": "San Francisco", "state": "California", "country": "United States"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["city"] == "San Francisco"
        assert data["state"] == "California"
        assert data["country"] == "United States"
        
        # Check that coordinates were updated
        db_session.refresh(sample_images[0])
        assert sample_images[0].latitude == 37.775
        assert sample_images[0].longitude == -122.419

    @patch('app.api.v1.endpoints.maps.get_coordinates')
    def test_update_location_data_no_coordinates(
        self, mock_coordinates, client, db_session, sample_images
    ):
        """Test updating location data when coordinates not found"""
        mock_coordinates.return_value = None
        
        image_id = sample_images[0].id
        
        response = client.post(
            f"/api/v1/maps/location/image/{image_id}",
            params={"city": "Test City", "state": "Test State", "country": "Test Country"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["city"] == "Test City"
        
        # Check that coordinates were cleared
        db_session.refresh(sample_images[0])
        assert sample_images[0].latitude is None
        assert sample_images[0].longitude is None

    def test_update_location_data_invalid_type(self, client):
        """Test updating location data with invalid file type"""
        response = client.post("/api/v1/maps/location/invalid/1")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid file type" in response.json()["detail"]

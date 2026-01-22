"""
Tests for favorites endpoints.
"""
from unittest.mock import patch
from fastapi import status


class TestFavoritesEndpoints:
    """Test suite for /api/v1/favorites endpoints"""

    def test_get_favorites_timeline_all(
        self, client, db_session, sample_images, sample_videos,
        sample_raw_images, sample_system_config
    ):
        """Test getting favorites timeline with all media types"""
        # Mark some items as favorites
        sample_images[0].is_favorite = True
        sample_videos[0].is_favorite = True
        sample_raw_images[0].is_favorite = True
        db_session.commit()
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/favorites/timeline?mediaFilter=all")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert "X-Total-Count" in response.headers
        
        # All items should be favorites
        for item in data:
            assert item["is_favorite"] is True

    def test_get_favorites_timeline_photos_only(
        self, client, db_session, sample_images, sample_system_config
    ):
        """Test getting favorites timeline with photos only"""
        sample_images[0].is_favorite = True
        db_session.commit()
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/favorites/timeline?mediaFilter=photos")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All items should be images
        for item in data:
            assert item["type"] == "image"

    def test_get_favorites_timeline_videos_only(
        self, client, db_session, sample_videos, sample_system_config
    ):
        """Test getting favorites timeline with videos only"""
        sample_videos[0].is_favorite = True
        db_session.commit()
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/favorites/timeline?mediaFilter=videos")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All items should be videos
        for item in data:
            assert item["type"] == "video"

    def test_get_favorites_timeline_raw_only(
        self, client, db_session, sample_raw_images, sample_system_config
    ):
        """Test getting favorites timeline with raw images only"""
        sample_raw_images[0].is_favorite = True
        db_session.commit()
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/favorites/timeline?mediaFilter=raw")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All items should be raw
        for item in data:
            assert item["type"] == "raw"

    def test_toggle_favorite_image(self, client, db_session, sample_images):
        """Test toggling favorite for an image"""
        image_id = sample_images[0].id
        initial_favorite = sample_images[0].is_favorite
        
        response = client.post(f"/api/v1/favorites/toggle/image/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == image_id
        
        # Check that favorite status changed
        db_session.refresh(sample_images[0])
        assert sample_images[0].is_favorite != initial_favorite

    def test_toggle_favorite_video(self, client, db_session, sample_videos):
        """Test toggling favorite for a video"""
        video_id = sample_videos[0].id
        initial_favorite = sample_videos[0].is_favorite
        
        response = client.post(f"/api/v1/favorites/toggle/video/{video_id}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == video_id
        
        # Check that favorite status changed
        db_session.refresh(sample_videos[0])
        assert sample_videos[0].is_favorite != initial_favorite

    def test_toggle_favorite_raw(self, client, db_session, sample_raw_images):
        """Test toggling favorite for a raw image"""
        raw_id = sample_raw_images[0].id
        initial_favorite = sample_raw_images[0].is_favorite
        
        response = client.post(f"/api/v1/favorites/toggle/raw/{raw_id}")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == raw_id
        
        # Check that favorite status changed
        db_session.refresh(sample_raw_images[0])
        assert sample_raw_images[0].is_favorite != initial_favorite

    def test_toggle_favorite_invalid_type(self, client, db_session, sample_images):
        """Test toggling favorite with invalid file type"""
        image_id = sample_images[0].id
        
        response = client.post(f"/api/v1/favorites/toggle/invalid/{image_id}")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid file type" in response.json()["detail"]

    def test_toggle_favorite_not_found(self, client, db_session):
        """Test toggling favorite for non-existent media"""
        response = client.post("/api/v1/favorites/toggle/image/99999")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Media not found" in response.json()["detail"]

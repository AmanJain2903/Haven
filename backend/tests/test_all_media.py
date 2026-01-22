"""
Tests for all_media endpoints.
"""
from unittest.mock import patch
from fastapi import status


class TestAllMediaEndpoints:
    """Test suite for /api/v1/all_media endpoints"""

    def test_get_all_media_timeline(
        self, client, db_session, sample_images, sample_videos, 
        sample_raw_images, sample_system_config
    ):
        """Test getting all media timeline"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/all_media/timeline?skip=0&limit=10")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert "X-Total-Count" in response.headers
        
        # Check that items have type field
        if len(data) > 0:
            assert "type" in data[0]
            assert data[0]["type"] in ["image", "video", "raw"]

    def test_get_all_media_timeline_pagination(
        self, client, db_session, sample_images, sample_videos,
        sample_raw_images, sample_system_config
    ):
        """Test all media timeline pagination"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/all_media/timeline?skip=0&limit=2")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) <= 2

    def test_get_all_media_timeline_storage_not_configured(
        self, client, db_session, sample_images, sample_videos, sample_raw_images
    ):
        """Test all media timeline when storage not configured"""
        # Remove storage_path config
        from app import models
        db_session.query(models.SystemConfig).filter_by(key="storage_path").delete()
        db_session.commit()
        
        response = client.get("/api/v1/all_media/timeline")
        
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert "Storage not configured" in response.json()["detail"]

    def test_get_all_media_timeline_empty(
        self, client, db_session, sample_system_config
    ):
        """Test all media timeline when no media exists"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        response = client.get("/api/v1/all_media/timeline")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

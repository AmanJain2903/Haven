"""
Tests for intelligence/search endpoints.
"""
from unittest.mock import patch, MagicMock
from fastapi import status
import pytest


class TestIntelligenceEndpoints:
    """Test suite for /api/v1/intelligence endpoints"""

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_images(
        self, mock_embedding, client, db_session, sample_images, sample_system_config, mock_embedding_vector
    ):
        """Test searching images"""
        # Skip if using SQLite (doesn't support vector operations)
        pytest.skip("Requires PostgreSQL with pgvector for vector search")
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_embedding.return_value = mock_embedding_vector
        
        response = client.get("/api/v1/intelligence/search/images?query=beach")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert "X-Total-Count" in response.headers

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_images_no_embedding(
        self, mock_embedding, client, db_session, sample_system_config
    ):
        """Test searching images when embedding generation fails"""
        mock_embedding.return_value = None
        
        response = client.get("/api/v1/intelligence/search/images?query=beach")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "error" in data
        assert "Could not generate embedding" in data["error"]

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_videos(
        self, mock_embedding, client, db_session, sample_videos, sample_system_config, mock_embedding_vector
    ):
        """Test searching videos"""
        pytest.skip("Requires PostgreSQL with pgvector for vector search")
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_embedding.return_value = mock_embedding_vector
        
        response = client.get("/api/v1/intelligence/search/videos?query=beach")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_raw_images(
        self, mock_embedding, client, db_session, sample_raw_images, sample_system_config, mock_embedding_vector
    ):
        """Test searching raw images"""
        pytest.skip("Requires PostgreSQL with pgvector for vector search")
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_embedding.return_value = mock_embedding_vector
        
        response = client.get("/api/v1/intelligence/search/raw_images?query=portrait")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_all_media(
        self, mock_embedding, client, db_session, sample_images, sample_videos,
        sample_raw_images, sample_system_config, mock_embedding_vector
    ):
        """Test searching all media"""
        pytest.skip("Requires PostgreSQL with pgvector for vector search")
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_embedding.return_value = mock_embedding_vector
        
        response = client.get("/api/v1/intelligence/search/all_media?query=beach")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_favorites(
        self, mock_embedding, client, db_session, sample_images, sample_videos,
        sample_raw_images, sample_system_config, mock_embedding_vector
    ):
        """Test searching favorites"""
        pytest.skip("Requires PostgreSQL with pgvector for vector search")
        
        # Mark some items as favorites
        sample_images[0].is_favorite = True
        sample_videos[0].is_favorite = True
        db_session.commit()
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_embedding.return_value = mock_embedding_vector
        
        response = client.get("/api/v1/intelligence/search/favorites?query=beach")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_map_points_images(
        self, mock_embedding, client, db_session, sample_images, sample_system_config, mock_embedding_vector
    ):
        """Test searching map points for images"""
        pytest.skip("Requires PostgreSQL with pgvector for vector search")
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_embedding.return_value = mock_embedding_vector
        
        response = client.get("/api/v1/intelligence/search/map/images?query=beach")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        
        # All items should have GPS coordinates
        for item in data:
            assert "latitude" in item
            assert "longitude" in item

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_map_points_all_media(
        self, mock_embedding, client, db_session, sample_images, sample_videos,
        sample_raw_images, sample_system_config, mock_embedding_vector
    ):
        """Test searching map points for all media"""
        pytest.skip("Requires PostgreSQL with pgvector for vector search")
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        mock_embedding.return_value = mock_embedding_vector
        
        response = client.get("/api/v1/intelligence/search/map/all_media?query=beach")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

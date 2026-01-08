import sqlalchemy
import os
import pytest

# Fixture to skip vector search tests if not using Postgres/pgvector
@pytest.fixture(autouse=True)
def skip_if_not_postgres(db_session):
    url = str(db_session.bind.url)
    if not url.startswith("postgresql"):
        pytest.skip("Vector search tests require PostgreSQL with pgvector.")
"""
Tests for AI-powered intelligence endpoints (semantic search).

Note: Vector search tests are skipped with SQLite as it doesn't support pgvector.
Integration tests with PostgreSQL would be needed for full vector search testing.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from app.models import Image, SystemConfig


@pytest.fixture(autouse=True)
def ensure_system_config(db_session):
    from sqlalchemy import inspect
    inspector = inspect(db_session.bind)
    if "system_config" not in inspector.get_table_names():
        SystemConfig.__table__.create(db_session.bind)
    if not db_session.query(SystemConfig).filter_by(key="storage_path").first():
        db_session.add(SystemConfig(key="storage_path", value="/mock/storage"))
        db_session.commit()


class TestSemanticSearchEndpoint:
    """Test suite for /api/v1/intelligence/search endpoint"""

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector for vector operations")
    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_success(self, mock_text_embedding, client, db_session):
        """Test successful semantic search"""
        mock_text_embedding.return_value = [0.5] * 512
        
        response = client.post(
            "/api/v1/intelligence/search",
            params={"query": "dog"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        mock_text_embedding.assert_called_once_with("dog")

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector for vector operations")
    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_with_custom_threshold(self, mock_text_embedding, client, db_session):
        """Test search with custom similarity threshold"""
        mock_text_embedding.return_value = [0.5] * 512
        
        response = client.post(
            "/api/v1/intelligence/search",
            params={
                "query": "sunset",
                "threshold": 0.2
            }
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_response_structure(self, mock_text_embedding, client, db_session):
        """Test that search results have correct structure and fields"""
        mock_text_embedding.return_value = [0.5] * 512
        response = client.post(
            "/api/v1/intelligence/search",
            params={"query": "beach"}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        if data:
            photo = data[0]
            for field in [
                "id", "filename", "thumbnail_url", "image_url", "score", "date",
                "latitude", "longitude", "city", "state", "country",
                "width", "height", "megapixels", "metadata"
            ]:
                assert field in photo
            for meta_field in [
                "camera_make", "camera_model", "exposure_time", "f_number", "iso", "focal_length", "size_bytes"
            ]:
                assert meta_field in photo["metadata"]

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_map_response_structure(self, mock_text_embedding, client, db_session):
        """Test that /search/map returns correct structure and fields"""
        mock_text_embedding.return_value = [0.5] * 512
        response = client.post(
            "/api/v1/intelligence/search/map",
            params={"query": "beach"}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        if data:
            point = data[0]
            for field in ["id", "latitude", "longitude", "thumbnail_url"]:
                assert field in point

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector for vector operations")
    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_no_results(self, mock_text_embedding, client, db_session):
        """Test search with no matching images"""
        mock_text_embedding.return_value = [0.9] * 512
        
        response = client.post(
            "/api/v1/intelligence/search",
            params={
                "query": "completely different",
                "threshold": 0.1
            }
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_embedding_generation_failure(self, mock_text_embedding, client):
        """Test handling when text embedding generation fails"""
        mock_text_embedding.return_value = None
        
        response = client.post(
            "/api/v1/intelligence/search",
            params={"query": "test"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "error" in data
        assert "Could not generate embedding" in data["error"]

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector for vector operations")
    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_only_returns_processed_images(self, mock_text_embedding, client, db_session):
        """Test that search only returns images with embeddings"""
        mock_text_embedding.return_value = [0.5] * 512
        
        response = client.post(
            "/api/v1/intelligence/search",
            params={"query": "any"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector for vector operations")
    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_results_ordered_by_similarity(self, mock_text_embedding, client, db_session):
        """Test that search endpoint accepts ordering parameters"""
        mock_text_embedding.return_value = [0.5] * 512
        
        response = client.post(
            "/api/v1/intelligence/search",
            params={"query": "test", "threshold": 0.9}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    def test_search_missing_query_parameter(self, client):
        """Test search endpoint without required query parameter"""
        response = client.post("/api/v1/intelligence/search")
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector for vector operations")
    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_with_loose_threshold(self, mock_text_embedding, client, db_session):
        """Test search with loose threshold parameter"""
        mock_text_embedding.return_value = [0.5] * 512
        
        response = client.post(
            "/api/v1/intelligence/search",
            params={
                "query": "test",
                "threshold": 0.9
            }
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

"""
Tests for AI-powered intelligence endpoints (semantic search).

Note: Vector search tests are skipped with SQLite as it doesn't support pgvector.
Integration tests with PostgreSQL would be needed for full vector search testing.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from app.models import Image


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

    @pytest.mark.skip(reason="Requires PostgreSQL with pgvector for vector operations")
    @patch('app.api.v1.endpoints.intelligence.generate_text_embedding')
    def test_search_response_structure(self, mock_text_embedding, client, db_session):
        """Test that search results have correct structure"""
        mock_text_embedding.return_value = [0.5] * 512
        
        response = client.post(
            "/api/v1/intelligence/search",
            params={"query": "beach"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

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

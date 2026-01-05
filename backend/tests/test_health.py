"""
Tests for health check endpoints.
"""
import pytest
from fastapi import status


class TestHealthEndpoints:
    """Test suite for /api/v1/health endpoints"""

    def test_read_root(self, client):
        """Test the root welcome endpoint"""
        response = client.get("/api/v1/health/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert data["message"] == "Welcome to Haven API"

    def test_status_check_healthy(self, client):
        """Test status endpoint with healthy database"""
        response = client.get("/api/v1/health/status")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"

    def test_status_check_structure(self, client):
        """Test that status response has correct structure"""
        response = client.get("/api/v1/health/status")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
        assert "database" in data
        assert isinstance(data["status"], str)
        assert isinstance(data["database"], str)

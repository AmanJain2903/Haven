"""
Tests for system configuration endpoints.
"""
import pytest
import os
from unittest.mock import patch, MagicMock
from fastapi import status
from app.models import SystemConfig


class TestGetConfigEndpoint:
    """Test suite for GET /api/v1/system/config/{key} endpoint"""

    def test_get_config_existing(self, client, db_session):
        """Test getting existing configuration"""
        # Create a config entry first
        config = SystemConfig(key="storage_path", value="/mock/storage")
        db_session.add(config)
        db_session.commit()
        
        response = client.get("/api/v1/system/config/storage_path")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "storage_path"
        assert data["value"] == "/mock/storage"

    def test_get_config_non_existing(self, client, db_session):
        """Test getting non-existent configuration returns null"""
        response = client.get("/api/v1/system/config/non_existent_key")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "non_existent_key"
        assert data["value"] is None


class TestSetConfigEndpoint:
    """Test suite for POST /api/v1/system/config endpoint"""

    @patch('app.api.v1.endpoints.system.os.path.exists')
    @patch('app.api.v1.endpoints.system.os.makedirs')
    def test_set_storage_path_success(self, mock_makedirs, mock_exists, client, db_session):
        """Test successfully setting storage path"""
        mock_exists.return_value = True
        mock_makedirs.return_value = None
        
        response = client.post(
            "/api/v1/system/config",
            json={"key": "storage_path", "value": "/test/path"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "storage_path"
        assert data["value"] == "/test/path"
        
        # Verify folders were created
        assert mock_makedirs.call_count == 3  # images, videos, raw

    @patch('app.api.v1.endpoints.system.os.path.exists')
    def test_set_storage_path_nonexistent(self, mock_exists, client, db_session):
        """Test setting storage path that doesn't exist"""
        mock_exists.return_value = False
        
        response = client.post(
            "/api/v1/system/config",
            json={"key": "storage_path", "value": "/nonexistent/path"}
        )
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "does not exist" in response.json()["detail"]

    @patch('app.api.v1.endpoints.system.os.path.exists')
    @patch('app.api.v1.endpoints.system.os.makedirs')
    def test_set_storage_path_permission_error(self, mock_makedirs, mock_exists, client, db_session):
        """Test handling permission error when creating folders"""
        mock_exists.return_value = True
        mock_makedirs.side_effect = PermissionError("Permission denied")
        
        response = client.post(
            "/api/v1/system/config",
            json={"key": "storage_path", "value": "/restricted/path"}
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Permission denied" in response.json()["detail"]

    @patch('app.api.v1.endpoints.system.os.path.exists')
    @patch('app.api.v1.endpoints.system.os.makedirs')
    def test_update_existing_config(self, mock_makedirs, mock_exists, client, db_session):
        """Test updating existing configuration"""
        mock_exists.return_value = True
        mock_makedirs.return_value = None
        
        # First set
        client.post(
            "/api/v1/system/config",
            json={"key": "storage_path", "value": "/test/path1"}
        )
        
        # Update
        response = client.post(
            "/api/v1/system/config",
            json={"key": "storage_path", "value": "/test/path2"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["value"] == "/test/path2"

    def test_set_non_storage_config(self, client, db_session):
        """Test setting non-storage configuration (no folder creation)"""
        response = client.post(
            "/api/v1/system/config",
            json={"key": "other_setting", "value": "test_value"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "other_setting"
        assert data["value"] == "test_value"


class TestSystemStatusEndpoint:
    """Test suite for GET /api/v1/system/status endpoint"""

    @patch('app.api.v1.endpoints.system.os.path.exists')
    @patch('app.api.v1.endpoints.system.os.path.isdir')
    def test_status_connected(self, mock_isdir, mock_exists, client, db_session):
        """Test status when storage is connected"""
        # Create a config entry first
        config = SystemConfig(key="storage_path", value="/mock/storage")
        db_session.add(config)
        db_session.commit()
        
        mock_exists.return_value = True
        mock_isdir.return_value = True
        
        response = client.get("/api/v1/system/status")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_connected"] is True
        assert data["storage_path"] == "/mock/storage"
        assert "active and connected" in data["message"]

    @patch('app.api.v1.endpoints.system.os.path.exists')
    def test_status_disconnected(self, mock_exists, client, db_session):
        """Test status when storage is disconnected"""
        # Create a config entry first
        config = SystemConfig(key="storage_path", value="/mock/storage")
        db_session.add(config)
        db_session.commit()
        
        mock_exists.return_value = False
        
        response = client.get("/api/v1/system/status")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_connected"] is False
        assert data["storage_path"] == "/mock/storage"
        assert "disconnected" in data["message"]

    def test_status_not_configured(self, client, db_session):
        """Test status when storage path not configured"""
        # Remove storage config
        config = db_session.query(SystemConfig).filter_by(key="storage_path").first()
        if config:
            db_session.delete(config)
            db_session.commit()
        
        response = client.get("/api/v1/system/status")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_connected"] is False
        assert data["storage_path"] is None
        assert "not configured" in data["message"]


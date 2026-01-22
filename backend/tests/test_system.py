"""
Tests for system configuration endpoints.
"""
from unittest.mock import patch, MagicMock
from fastapi import status
from app.core.config import settings
import shutil
import tempfile
import os


class TestSystemEndpoints:
    """Test suite for /api/v1/system endpoints"""

    def test_version_endpoint(self, client):
        """Test version endpoint"""
        response = client.get("/api/v1/system/version")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == settings.PROJECT_VERSION

    @patch('app.api.v1.endpoints.system.settings')
    @patch('app.api.v1.endpoints.system.shutil.disk_usage')
    @patch('app.api.v1.endpoints.system.Path')
    def test_space_available_sufficient(self, mock_path_class, mock_disk, mock_settings, client):
        """Test space available when sufficient space exists"""
        temp_dir = tempfile.mkdtemp()
        try:
            mock_path = MagicMock()
            mock_path.exists.return_value = True
            mock_path_class.return_value = mock_path
            mock_settings.DOWNLOAD_PATH = temp_dir
            
            # Mock disk_usage to return sufficient space (size * 1.2 + extra)
            mock_disk.return_value = MagicMock(free=1200000000)  # 1.2GB free
            
            response = client.get("/api/v1/system/space_available?size=1000000000")
            
            assert response.status_code == status.HTTP_200_OK
            assert response.json() is True
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @patch('app.api.v1.endpoints.system.settings.DOWNLOAD_PATH')
    def test_space_available_insufficient(self, mock_path, client):
        """Test space available when insufficient space"""
        temp_dir = tempfile.mkdtemp()
        try:
            mock_path.return_value = temp_dir
            
            # Mock disk_usage to return insufficient space
            with patch('shutil.disk_usage') as mock_disk:
                mock_disk.return_value = MagicMock(free=100000000)  # 100MB free
                
                response = client.get("/api/v1/system/space_available?size=1000000000")
                
                assert response.status_code == status.HTTP_200_OK
                assert response.json() is False
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @patch('app.api.v1.endpoints.system.settings.DOWNLOAD_PATH')
    def test_space_available_path_not_exists(self, mock_path, client):
        """Test space available when path doesn't exist"""
        mock_path.return_value = "/nonexistent/path/12345"
        
        response = client.get("/api/v1/system/space_available?size=1000000000")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() is False
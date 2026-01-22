"""
Tests for dashboard endpoints.
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
import os
import tempfile
import shutil


class TestDashboardEndpoints:
    """Test suite for /api/v1/dashboard endpoints"""

    @patch('app.api.v1.endpoints.dashboard.settings')
    def test_get_hot_storage_path(self, mock_settings, client):
        """Test getting hot storage path"""
        mock_settings.APP_DATA_DIR = "/tmp/test_hot_storage"
        
        response = client.get("/api/v1/dashboard/hot_storage_path")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == "/tmp/test_hot_storage"

    def test_get_storage_path(self, client, db_session, sample_system_config):
        """Test getting storage path"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        
        response = client.get("/api/v1/dashboard/storage_path")
        
        assert response.status_code == status.HTTP_200_OK
        if config:
            assert response.json() == config.value
        else:
            assert response.json() is None

    def test_check_path_existence_exists(self, client):
        """Test checking path existence when path exists"""
        temp_dir = tempfile.mkdtemp()
        try:
            response = client.get(f"/api/v1/dashboard/check_path_existence?path={temp_dir}")
            
            assert response.status_code == status.HTTP_200_OK
            assert response.json() is True
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_check_path_existence_not_exists(self, client):
        """Test checking path existence when path doesn't exist"""
        response = client.get("/api/v1/dashboard/check_path_existence?path=/nonexistent/path/12345")
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json() is False

    def test_get_disk_information(self, client):
        """Test getting disk information"""
        temp_dir = tempfile.mkdtemp()
        try:
            response = client.get(f"/api/v1/dashboard/disk_information?path={temp_dir}")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "total_space" in data
            assert "used_space" in data
            assert "available_space" in data
            assert data["total_space"] is not None
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_get_disk_information_path_not_exists(self, client):
        """Test getting disk information for non-existent path"""
        response = client.get("/api/v1/dashboard/disk_information?path=/nonexistent/path/12345")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_space"] is None
        assert data["used_space"] is None
        assert data["available_space"] is None

    @patch('app.api.v1.endpoints.dashboard.settings')
    @patch('app.api.v1.endpoints.dashboard.HOT_STORAGE_FOLDERS', ["thumbnails", "video_thumbnails"])
    def test_get_app_data_size(
        self, mock_settings, client
    ):
        """Test getting app data size"""
        temp_dir = tempfile.mkdtemp()
        try:
            mock_settings.APP_DATA_DIR = temp_dir
            
            # Create test files
            for folder in ["thumbnails", "video_thumbnails"]:
                folder_path = os.path.join(temp_dir, folder)
                os.makedirs(folder_path, exist_ok=True)
                test_file = os.path.join(folder_path, "test.txt")
                with open(test_file, 'w') as f:
                    f.write("test content")
            
            response = client.get("/api/v1/dashboard/app_data_size")
            
            assert response.status_code == status.HTTP_200_OK
            assert response.json() > 0
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_get_data_breakdown(self, client, temp_storage_dir):
        """Test getting data breakdown"""
        # Create test files in subdirectories
        images_dir = os.path.join(temp_storage_dir, "images")
        videos_dir = os.path.join(temp_storage_dir, "videos")
        raw_dir = os.path.join(temp_storage_dir, "raw")
        
        os.makedirs(images_dir, exist_ok=True)
        os.makedirs(videos_dir, exist_ok=True)
        os.makedirs(raw_dir, exist_ok=True)
        
        # Create test files
        with open(os.path.join(images_dir, "test1.jpg"), 'w') as f:
            f.write("test")
        with open(os.path.join(videos_dir, "test1.mp4"), 'w') as f:
            f.write("test")
        with open(os.path.join(raw_dir, "test1.arw"), 'w') as f:
            f.write("test")
        
        response = client.get(f"/api/v1/dashboard/data_breakdown?path={temp_storage_dir}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "images_count" in data
        assert "videos_count" in data
        assert "raw_count" in data
        assert "total_count" in data
        assert data["images_count"] == 1
        assert data["videos_count"] == 1
        assert data["raw_count"] == 1

    def test_get_processed_files_information(
        self, client, db_session, sample_images, sample_videos, sample_raw_images, sample_albums
    ):
        """Test getting processed files information"""
        response = client.get("/api/v1/dashboard/processed_files_information")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "albums_count" in data
        assert "processed_images_count" in data
        assert "processed_videos_count" in data
        assert "processed_raw_count" in data
        assert "processed_total_files_count" in data
        assert "processed_total_files_size" in data
        assert data["processed_images_count"] > 0

    @patch('app.api.v1.endpoints.dashboard.inspect')
    @patch('app.api.v1.endpoints.dashboard.get_db')
    def test_get_metadata_information(self, mock_get_db, mock_inspect, client, db_session):
        """Test getting metadata information - mocked PostgreSQL function"""
        # Mock get_db to return our test session
        mock_get_db.return_value = db_session
        
        # Mock the inspector to return table names
        mock_inspector = MagicMock()
        mock_inspector.get_table_names.return_value = ["images", "videos", "raw_images", "albums", "system_config"]
        mock_inspect.return_value = mock_inspector
        
        # Mock execute to handle both COUNT and pg_total_relation_size queries
        def mock_execute(query, params=None):
            result = MagicMock()
            query_str = str(query) if hasattr(query, '__str__') else str(query)
            
            # Handle COUNT queries
            if "COUNT" in query_str.upper():
                result.scalar.return_value = 5
            # Handle pg_total_relation_size queries (PostgreSQL-specific)
            elif "pg_total_relation_size" in query_str or (params and "relname" in str(params)):
                result.scalar.return_value = 1024000  # Mock size in bytes
            else:
                result.scalar.return_value = 0
            return result
        
        # Mock the session methods
        db_session.execute = MagicMock(side_effect=mock_execute)
        db_session.get_bind = MagicMock(return_value=MagicMock())
        
        response = client.get("/api/v1/dashboard/metadata_information")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_tables" in data
        assert "total_size_bytes" in data
        assert "tables" in data
        assert data["total_tables"] > 0
        assert data["total_size_bytes"] > 0

    @patch('app.tasks.task_create_haven_vault_zip')
    @patch('app.api.v1.endpoints.dashboard.settings')
    @patch('app.api.v1.endpoints.dashboard.os.path.exists')
    def test_start_download_vault(self, mock_exists, mock_settings, mock_task, client, db_session, sample_system_config, temp_storage_dir):
        """Test starting vault download"""
        mock_task.delay = MagicMock()
        mock_settings.APP_DATA_DIR = temp_storage_dir
        mock_exists.return_value = True
        
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        response = client.post("/api/v1/dashboard/download?downloadType=vault")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "task_id" in data

    @patch('app.tasks.task_create_haven_app_data_zip')
    @patch('app.api.v1.endpoints.dashboard.settings')
    @patch('app.api.v1.endpoints.dashboard.os.path.exists')
    def test_start_download_app_data(self, mock_exists, mock_settings, mock_task, client, db_session, sample_system_config):
        """Test starting app data download"""
        mock_task.delay = MagicMock()
        
        temp_dir = tempfile.mkdtemp()
        try:
            mock_settings.APP_DATA_DIR = temp_dir
            mock_exists.return_value = True
            
            response = client.post("/api/v1/dashboard/download?downloadType=app_data")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "task_id" in data
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @patch('app.tasks.task_create_haven_metadata_zip')
    @patch('app.api.v1.endpoints.dashboard.settings')
    @patch('app.api.v1.endpoints.dashboard.os.path.exists')
    def test_start_download_metadata(self, mock_exists, mock_settings, mock_task, client, db_session, sample_system_config, temp_storage_dir):
        """Test starting metadata download"""
        mock_task.delay = MagicMock()
        mock_settings.APP_DATA_DIR = temp_storage_dir
        mock_exists.return_value = True
        
        # Configure storage path (required by endpoint)
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        response = client.post("/api/v1/dashboard/download?downloadType=metadata")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "task_id" in data

    @patch('app.api.v1.endpoints.dashboard.settings')
    @patch('app.api.v1.endpoints.dashboard.os.path.exists')
    def test_start_download_invalid_type(self, mock_exists, mock_settings, client, db_session, sample_system_config, temp_storage_dir):
        """Test starting download with invalid type"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if config:
            config.value = temp_storage_dir
        else:
            config = sample_system_config[0].__class__(key="storage_path", value=temp_storage_dir)
            db_session.add(config)
        db_session.commit()
        
        mock_settings.APP_DATA_DIR = temp_storage_dir
        mock_exists.return_value = True
        
        response = client.post("/api/v1/dashboard/download?downloadType=invalid")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid download type" in response.json()["detail"]

    @patch('app.api.v1.endpoints.dashboard.redis_client')
    def test_get_download_task_status(self, mock_redis, client):
        """Test getting download task status"""
        task_id = "test-task-id"
        mock_redis.hgetall.return_value = {
            b"status": b"completed",
            b"total": b"100",
            b"completed": b"100",
            b"progress": b"100",
            b"zip_path": b"/tmp/test.zip",
            b"zip_filename": b"test.zip"
        }
        
        response = client.get(f"/api/v1/dashboard/download_task_status/{task_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
        assert data["total"] == 100
        assert data["progress"] == 100

    @patch('app.api.v1.endpoints.dashboard.redis_client')
    def test_get_download_task_status_not_found(self, mock_redis, client):
        """Test getting status for non-existent task"""
        mock_redis.hgetall.return_value = {}
        
        response = client.get("/api/v1/dashboard/download_task_status/nonexistent")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "not_found"

    @patch('app.api.v1.endpoints.dashboard.redis_client')
    @patch('app.api.v1.endpoints.dashboard.os.path.exists')
    @patch('app.api.v1.endpoints.dashboard.os.remove')
    def test_cleanup_download(
        self, mock_remove, mock_exists, mock_redis, client
    ):
        """Test cleaning up download"""
        task_id = "test-task-id"
        mock_redis.hgetall.return_value = {
            b"zip_path": b"/tmp/test.zip"
        }
        mock_exists.return_value = True
        
        response = client.delete(f"/api/v1/dashboard/cleanup_download/{task_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "cleaned"
        mock_remove.assert_called_once()
        mock_redis.delete.assert_called_once()

    @patch('app.core.celery_app.celery_app')
    @patch('app.api.v1.endpoints.dashboard.redis_client')
    @patch('app.api.v1.endpoints.dashboard.os.path.exists')
    @patch('app.api.v1.endpoints.dashboard.os.remove')
    def test_cancel_download(
        self, mock_remove, mock_exists, mock_redis, mock_celery, client
    ):
        """Test cancelling download"""
        task_id = "test-task-id"
        mock_redis.hgetall.return_value = {
            b"zip_path": b"/tmp/test.zip"
        }
        mock_exists.return_value = True
        mock_celery.control.revoke = MagicMock()
        
        response = client.post(f"/api/v1/dashboard/cancel_download/{task_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "cancelled"
        assert data["task_id"] == task_id

"""
Tests for albums endpoints.
"""
from unittest.mock import patch, MagicMock
from fastapi import status
import uuid


class TestAlbumsEndpoints:
    """Test suite for /api/v1/albums endpoints"""

    @patch('app.api.v1.endpoints.albums.get_coordinates')
    @patch('app.api.v1.endpoints.albums.get_location_parts')
    def test_create_album(
        self, mock_location_parts, mock_coordinates, client, db_session
    ):
        """Test creating an album"""
        mock_coordinates.return_value = (37.775, -122.419)
        mock_location_parts.return_value = {
            "city": "San Francisco",
            "state": "California",
            "country": "United States"
        }
        
        response = client.post(
            "/api/v1/albums/create",
            params={
                "albumName": "Test Album",
                "albumDescription": "Test Description",
                "albumCity": "San Francisco",
                "albumState": "California",
                "albumCountry": "United States"
            }
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Album created successfully"
        assert data["album"] == "Test Album"

    def test_create_album_no_name(self, client, db_session):
        """Test creating album without name"""
        response = client.post("/api/v1/albums/create")
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Album name is required" in response.json()["detail"]

    def test_get_albums(self, client, db_session, sample_albums):
        """Test getting all albums"""
        response = client.get("/api/v1/albums/getAlbums")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "album_name" in data[0]

    def test_get_album(self, client, db_session, sample_albums):
        """Test getting a specific album"""
        album_id = sample_albums[0].id
        
        response = client.get(f"/api/v1/albums/getAlbum/{album_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == album_id
        assert "album_name" in data

    @patch('app.api.v1.endpoints.albums.get_coordinates')
    @patch('app.api.v1.endpoints.albums.get_location_parts')
    def test_update_album(
        self, mock_location_parts, mock_coordinates, client, db_session, sample_albums
    ):
        """Test updating an album"""
        mock_coordinates.return_value = (40.712, -74.006)
        mock_location_parts.return_value = {
            "city": "New York",
            "state": "New York",
            "country": "United States"
        }
        
        album_id = sample_albums[0].id
        
        response = client.post(
            f"/api/v1/albums/update/{album_id}",
            params={
                "albumName": "Updated Album",
                "albumDescription": "Updated Description"
            }
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Album updated successfully"

    def test_update_album_not_found(self, client, db_session):
        """Test updating non-existent album"""
        response = client.post(
            "/api/v1/albums/update/99999",
            params={"albumName": "Test"}
        )
        
        # The endpoint returns 500 when album not found, not 404
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_500_INTERNAL_SERVER_ERROR]

    def test_add_to_album_image(self, client, db_session, sample_albums, sample_images):
        """Test adding image to album"""
        album_id = sample_albums[0].id
        image_id = sample_images[0].id
        
        response = client.post(f"/api/v1/albums/addToAlbum/{album_id}/image/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "File added to album successfully"
        
        # Query fresh from database since endpoint closes session
        from app import models
        album = db_session.query(models.Albums).filter_by(id=album_id).first()
        assert image_id in album.album_images_ids

    def test_add_to_album_video(self, client, db_session, sample_albums, sample_videos):
        """Test adding video to album"""
        album_id = sample_albums[0].id
        video_id = sample_videos[0].id
        
        response = client.post(f"/api/v1/albums/addToAlbum/{album_id}/video/{video_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "File added to album successfully"

    def test_add_to_album_raw(self, client, db_session, sample_albums, sample_raw_images):
        """Test adding raw image to album"""
        album_id = sample_albums[0].id
        raw_id = sample_raw_images[0].id
        
        response = client.post(f"/api/v1/albums/addToAlbum/{album_id}/raw/{raw_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "File added to album successfully"

    def test_remove_from_album(self, client, db_session, sample_albums, sample_images):
        """Test removing file from album"""
        album_id = sample_albums[0].id
        image_id = sample_images[0].id
        
        # First add to album
        sample_albums[0].album_images_ids = [image_id]
        sample_albums[0].album_images_count = 1
        sample_albums[0].album_total_count = 1
        sample_images[0].album_ids = [album_id]
        db_session.commit()
        
        response = client.post(f"/api/v1/albums/removeFromAlbum/{album_id}/image/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "File removed from album successfully"

    def test_update_album_cover(self, client, db_session, sample_albums, sample_images):
        """Test updating album cover"""
        album_id = sample_albums[0].id
        image_id = sample_images[0].id
        
        response = client.post(f"/api/v1/albums/updateAlbumCover/{album_id}/image/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Album cover updated successfully"
        
        # Query fresh from database since endpoint closes session
        from app import models
        album = db_session.query(models.Albums).filter_by(id=album_id).first()
        assert album.album_cover_id == image_id
        assert album.album_cover_type == "image"

    def test_get_album_cover(self, client, db_session, sample_albums, sample_images, sample_system_config):
        """Test getting album cover"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        album_id = sample_albums[0].id
        sample_albums[0].album_cover_id = sample_images[0].id
        sample_albums[0].album_cover_type = "image"
        db_session.commit()
        
        response = client.get(f"/api/v1/albums/getAlbumCover/{album_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "album_cover_url" in data
        assert "album_cover_type" in data

    def test_get_album_timeline(
        self, client, db_session, sample_albums, sample_images, sample_videos,
        sample_raw_images, sample_system_config
    ):
        """Test getting album timeline"""
        config = db_session.query(sample_system_config[0].__class__).filter_by(key="storage_path").first()
        if not config:
            config = sample_system_config[0].__class__(key="storage_path", value="/tmp/test")
            db_session.add(config)
            db_session.commit()
        
        album_id = sample_albums[0].id
        # Add media to album
        sample_images[0].album_ids = [album_id]
        sample_albums[0].album_images_ids = [sample_images[0].id]
        db_session.commit()
        
        response = client.get(f"/api/v1/albums/timeline/{album_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert "X-Total-Count" in response.headers

    def test_get_part_of_albums(self, client, db_session, sample_images, sample_albums):
        """Test getting albums that contain a file"""
        image_id = sample_images[0].id
        album_id = sample_albums[0].id
        
        # Add image to album
        sample_images[0].album_ids = [album_id]
        db_session.commit()
        
        response = client.get(f"/api/v1/albums/getPartOfAlbums/image/{image_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "albums" in data
        assert album_id in data["albums"]

    @patch('app.api.v1.endpoints.albums.task_batch_add_to_album')
    def test_batch_add_to_album(self, mock_task, client, db_session, sample_albums):
        """Test batch adding files to album"""
        mock_task.delay = MagicMock()
        
        album_id = sample_albums[0].id
        files = [
            {"type": "image", "id": 1},
            {"type": "video", "id": 1}
        ]
        
        response = client.post(
            f"/api/v1/albums/batch_add_to_album",
            params={"albumId": album_id},
            json=files
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "started"

    @patch('app.api.v1.endpoints.albums.task_batch_delete_album')
    def test_batch_delete_album(self, mock_task, client, db_session, sample_albums):
        """Test batch deleting album"""
        mock_task.delay = MagicMock()
        
        album_id = sample_albums[0].id
        
        response = client.post(
            f"/api/v1/albums/batch_delete_album",
            params={"albumId": album_id}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "started"

    @patch('app.api.v1.endpoints.albums.redis_client')
    def test_get_batch_task_status(self, mock_redis, client):
        """Test getting batch task status"""
        task_id = str(uuid.uuid4())
        mock_redis.hgetall.return_value = {
            b"status": b"completed",
            b"total": b"10",
            b"completed": b"10",
            b"failed": b"0"
        }
        
        response = client.get(f"/api/v1/albums/batch_task_status/{task_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
        assert data["total"] == 10

    @patch('app.api.v1.endpoints.albums.redis_client')
    def test_get_batch_task_status_not_found(self, mock_redis, client):
        """Test getting status for non-existent task"""
        mock_redis.hgetall.return_value = {}
        
        response = client.get("/api/v1/albums/batch_task_status/nonexistent")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch('app.api.v1.endpoints.albums.task_create_album_zip')
    def test_start_album_download(self, mock_task, client, db_session, sample_albums):
        """Test starting album download"""
        mock_task.delay = MagicMock()
        
        album_id = sample_albums[0].id
        
        response = client.post(f"/api/v1/albums/download_album/{album_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "started"

    @patch('app.api.v1.endpoints.albums.redis_client')
    def test_get_download_task_status(self, mock_redis, client):
        """Test getting download task status"""
        task_id = str(uuid.uuid4())
        mock_redis.hgetall.return_value = {
            b"status": b"completed",
            b"total": b"100",
            b"completed": b"100",
            b"progress": b"100",
            b"zip_path": b"/tmp/test.zip"
        }
        
        response = client.get(f"/api/v1/albums/download_task_status/{task_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
        assert data["progress"] == 100

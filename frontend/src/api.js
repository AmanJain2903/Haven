import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // System API ENDPOINTS
  // ------------------------------------------------------------
  // Get project version
  getProjectVersion: async () => {
    const response = await axios.get(`${API_URL}/system/version`);
    return response.data;
  },
  // Check if space is available
  checkSpaceAvailable: async (size) => {
    const response = await axios.get(`${API_URL}/system/space_available`, { params: { size: size } });
    return response.data;
  },
  // ------------------------------------------------------------

  // IMAGES API ENDPOINTS
  // ------------------------------------------------------------
  // Fetch all photos for timeline view
  getThumbnails: async (skip=0, limit=500) => {
    const response = await axios.get(`${API_URL}/images/timeline`, {
      params: { skip: skip, limit: limit } 
    });
    return {
        photos: response.data,
        total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Fetch detailed info for a specific image
  getImageDetails: async (id) => {
    const response = await axios.get(`${API_URL}/images/details/${id}`);
    return response.data;
  },

  deleteImage: async (id) => {
    const response = await axios.delete(`${API_URL}/images/delete/${id}`);
    return response.data;
  },
  // ------------------------------------------------------------


  // VIDEOS API ENDPOINTS
  // ------------------------------------------------------------
  // Fetch all videos for timeline view
  getVideoThumbnails: async (skip=0, limit=500) => {
    const response = await axios.get(`${API_URL}/videos/timeline`, {
      params: { skip: skip, limit: limit }
    });
    return {
      videos: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  getVideoDetails: async (id) => {
    const response = await axios.get(`${API_URL}/videos/details/${id}`);
    return response.data;
  },

  deleteVideo: async (id) => {
    const response = await axios.delete(`${API_URL}/videos/delete/${id}`);
    return response.data;
  },

  // ------------------------------------------------------------

  // Raw Images API ENDPOINTS
  // ------------------------------------------------------------
  // Fetch all raw images for timeline view
  getRawThumbnails: async (skip=0, limit=500) => {
    const response = await axios.get(`${API_URL}/raw_images/timeline`, {
      params: { skip: skip, limit: limit }
    });
    return {
      rawImages: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  getRawDetails: async (id) => {
    const response = await axios.get(`${API_URL}/raw_images/details/${id}`);
    return response.data;
  },

  deleteRawImage: async (id) => {
    const response = await axios.delete(`${API_URL}/raw_images/delete/${id}`);
    return response.data;
  },
  // ------------------------------------------------------------

  // All Media API ENDPOINTS
  // ------------------------------------------------------------
  // Fetch all media for timeline view
  getAllMediaThumbnails: async (skip=0, limit=500) => {
    const response = await axios.get(`${API_URL}/all_media/timeline`, {
      params: { skip: skip, limit: limit }
    });
    return {
      allMedia: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },
  // ------------------------------------------------------------

  // Favorites API ENDPOINTS
  // ------------------------------------------------------------
  // Fetch all favorites for timeline view
  getAllFavoritesThumbnails: async (skip=0, limit=500, mediaFilter="all") => {
    const response = await axios.get(`${API_URL}/favorites/timeline`, {
      params: { skip: skip, limit: limit, mediaFilter: mediaFilter }
    });
    return {
      favorites: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  toggleFavorite: async (id, fileType) => {
    const response = await axios.post(`${API_URL}/favorites/toggle/${fileType}/${id}`);
    return response.data;
  },
  // ------------------------------------------------------------

  // Intelligence API ENDPOINTS
  // ------------------------------------------------------------
  // Search photos
  searchPhotos: async (query, skip=0, limit=500) => {
    const response = await axios.get(`${API_URL}/intelligence/search/images`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
        photos: response.data,
        total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Search videos
  searchVideos: async (query, skip=0, limit=500) => {
    const response = await axios.get(`${API_URL}/intelligence/search/videos`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
      videos: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Search raw images
  searchRawImages: async (query, skip=0, limit=500) => {
    const response = await axios.get(`${API_URL}/intelligence/search/raw_images`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
      rawImages: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    } 
  },

  // Search all media
  searchAllMedia: async (query, skip=0, limit=500) => {
    const response = await axios.get(`${API_URL}/intelligence/search/all_media`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
      allMedia: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Search favorites
  // Note: backend may ignore mediaFilter if not implemented server-side; frontend can still filter results.
  searchFavorites: async (query, skip=0, limit=500, mediaFilter="all") => {
    const response = await axios.get(`${API_URL}/intelligence/search/favorites`, null, {
      params: { query: query, skip: skip, limit: limit, mediaFilter: mediaFilter }
    });
    return {
      favorites: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Search map points for images
  searchMapPointsImages: async (query) => {
    const response = await axios.get(`${API_URL}/intelligence/search/map/images`, null, {
      params: { query: query }
    });
    return response.data;
  },

  // Search map points for videos
  searchMapPointsVideos: async (query) => {
    const response = await axios.get(`${API_URL}/intelligence/search/map/videos`, null, {
      params: { query: query }
    });
    return response.data;
  },

  // Search map points for raw images
  searchMapPointsRawImages: async (query) => {
    const response = await axios.get(`${API_URL}/intelligence/search/map/raw_images`, null, {
      params: { query: query }
    });
    return response.data;
  },

  // Search map points for all media
  searchMapPointsAllMedia: async (query) => {
    const response = await axios.get(`${API_URL}/intelligence/search/map/all_media`, null, {
      params: { query: query }
    });
    return response.data;
  },

  // Search albums
  searchAlbums: async (albumId, query, skip=0, limit=500, mediaFilter="all") => {
    const response = await axios.get(`${API_URL}/intelligence/search/albums/${albumId}`, null, {
      params: { query: query, skip: skip, limit: limit, mediaFilter: mediaFilter }
    });
    return {
      albums: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },
  // ------------------------------------------------------------


  // Map Search Endpoints
  // ------------------------------------------------------------
  // Search specifically for map points (lightweight, high limit)
  // Get all map points for images (lightweight)
  getAllMapPointsImages: async () => {
    const response = await axios.get(`${API_URL}/maps/images`);
    return response.data;
  },

  // Get all map points for videos (lightweight)
  getAllMapPointsVideos: async () => {
    const response = await axios.get(`${API_URL}/maps/videos`);
    return response.data;
  },

  // Get all map points for raw images (lightweight)
  getAllMapPointsRawImages: async () => {
    const response = await axios.get(`${API_URL}/maps/raw_images`);
    return response.data;
  },

  // Get all map points for all media (lightweight)
  getAllMapPointsAllMedia: async () => {
    const response = await axios.get(`${API_URL}/maps/all_media`);
    return response.data;
  },

  getFileLocation: async (fileType, id) => {
    const response = await axios.get(`${API_URL}/maps/location/${fileType}/${id}`);
    return response.data;
  },

  updateFileLocation: async (fileType, id, city, state, country) => {
    const response = await axios.post(`${API_URL}/maps/location/${fileType}/${id}`, null, {
      params: { city: city, state: state, country: country }
    });
    return response.data;
  },
  // ------------------------------------------------------------

  // Albums API ENDPOINTS
  // ------------------------------------------------------------
  // Get all albums
  createAlbum: async (albumName, albumDescription, albumLocation, albumCity, albumState, albumCountry) => {
    const response = await axios.post(`${API_URL}/albums/create`, null, {
      params: { albumName: albumName, albumDescription: albumDescription, albumLocation: albumLocation, albumCity: albumCity, albumState: albumState, albumCountry: albumCountry }
    });
    return response.data;
  },

  getAlbums: async () => {
    const response = await axios.get(`${API_URL}/albums/getAlbums`);
    return response.data;
  },

  getAlbum: async (albumId) => {
    const response = await axios.get(`${API_URL}/albums/getAlbum/${albumId}`);
    return response.data;
  },

  updateAlbum: async (albumId, albumName, albumDescription, albumLocation, albumCity, albumState, albumCountry) => {
    const response = await axios.post(`${API_URL}/albums/update/${albumId}`, null, {
      params: { albumName: albumName, albumDescription: albumDescription, albumLocation: albumLocation, albumCity: albumCity, albumState: albumState, albumCountry: albumCountry }
    });
    return response.data;
  },

  addToAlbum: async (albumId, fileType, id) => {
    const response = await axios.post(`${API_URL}/albums/addToAlbum/${albumId}/${fileType}/${id}`);
    return response.data;
  },

  removeFromAlbum: async (albumId, fileType, id) => {
    const response = await axios.post(`${API_URL}/albums/removeFromAlbum/${albumId}/${fileType}/${id}`);
    return response.data;
  },

  updateAlbumCover: async (albumId, fileType, id) => {
    const response = await axios.post(`${API_URL}/albums/updateAlbumCover/${albumId}/${fileType}/${id}`);
    return response.data;
  },

  getAlbumCover: async (albumId) => {
    const response = await axios.get(`${API_URL}/albums/getAlbumCover/${albumId}`);
    return response.data;
  },

  getAlbumTimeline: async (albumId, skip=0, limit=500, mediaFilter="all") => {
    const response = await axios.get(`${API_URL}/albums/timeline/${albumId}`, {
      params: { skip: skip, limit: limit, mediaFilter: mediaFilter }
    });
    return {
      timeline: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  getPartOfAlbums: async (fileType, id) => {
    const response = await axios.get(`${API_URL}/albums/getPartOfAlbums/${fileType}/${id}`);
    return response.data;
  },

  // Batch operations
  batchAddToAlbum: async (albumId, files) => {
  const response = await fetch(`${API_URL}/albums/batch_add_to_album?albumId=${albumId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(files)
  });
  if (!response.ok) throw new Error('Failed to start batch add');
  return response.json();
},

  batchDeleteAlbum: async (albumId) => {
  const response = await fetch(`${API_URL}/albums/batch_delete_album?albumId=${albumId}`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to start batch delete');
  return response.json();
},

  getBatchTaskStatus: async (taskId) => {
  const response = await fetch(`${API_URL}/albums/batch_task_status/${taskId}`);
  if (!response.ok) throw new Error('Failed to get task status');
  return response.json();
},

  // Album Download API ENDPOINTS
  // ------------------------------------------------------------
  startAlbumDownload: async (albumId) => {
    const response = await axios.post(`${API_URL}/albums/download_album/${albumId}`);
    return response.data;
  },

  getDownloadTaskStatus: async (taskId) => {
    const response = await axios.get(`${API_URL}/albums/download_task_status/${taskId}`);
    return response.data;
  },

  cleanupDownload: async (taskId) => {
    const response = await axios.delete(`${API_URL}/albums/cleanup_download/${taskId}`);
    return response.data;
  },

  cancelDownload: async (taskId) => {
    const response = await axios.post(`${API_URL}/albums/cancel_download/${taskId}`);
    return response.data;
  },

  // Start Haven Download Task
  startHavenDownloadTask: async (downloadType="default") => {
    const response = await axios.post(`${API_URL}/dashboard/download`, null,
      { params: { downloadType: downloadType } 
    });
    return response.data;
  },

  // Get the status of a download task
  getHavenDownloadTaskStatus: async (taskId) => {
    const response = await axios.get(`${API_URL}/dashboard/download_task_status/${taskId}`);
    return response.data;
  },

  // Cleanup a download task
  cleanupHavenDownload: async (taskId) => {
    const response = await axios.delete(`${API_URL}/dashboard/cleanup_download/${taskId}`);
    return response.data;
  },

  // Cancel a download task
  cancelHavenDownloadTask: async (taskId) => {
    const response = await axios.post(`${API_URL}/dashboard/cancel_download/${taskId}`);
    return response.data;
  },

  // ------------------------------------------------------------

  // Dashboard API ENDPOINTS
  // ------------------------------------------------------------
  getHotStoragePath: async () => {
    const response = await axios.get(`${API_URL}/dashboard/hot_storage_path`);
    return response.data;
  },

  getStoragePath: async () => {
    const response = await axios.get(`${API_URL}/dashboard/storage_path`);
    return response.data;
  },

  checkPathExistence: async (path) => {
    const response = await axios.get(`${API_URL}/dashboard/check_path_existence`, {
      params: { path: path }
    });
    return response.data;
  },

  getHavenVaultDiskInformation: async (path) => {
    const response = await axios.get(`${API_URL}/dashboard/disk_information`, {
      params: { path: path }
    });
    return response.data;
  },

  getHavenAppDataSize: async () => {
    const response = await axios.get(`${API_URL}/dashboard/app_data_size`);
    return response.data;
  },

  getHavenVaultDataBreakdown: async (path) => {
    const response = await axios.get(`${API_URL}/dashboard/data_breakdown`, {
      params: { path: path }
    });
    return response.data;
  },

  getProcessedFilesInformation: async () => {
    const response = await axios.get(`${API_URL}/dashboard/processed_files_information`);
    return response.data;
  },

  getMetadataInformation: async () => {
    const response = await axios.get(`${API_URL}/dashboard/metadata_information`);
    return response.data;
  },
  // ------------------------------------------------------------


  // Helper Functions
  // ------------------------------------------------------------
  getImageUrl: (id) => `${API_URL}/images/file/${id}`,
  getThumbnailUrl: (id) => `${API_URL}/images/thumbnail/${id}`,
  getVideoUrl: (id) => `${API_URL}/videos/file/${id}`,
  getVideoThumbnailUrl: (id) => `${API_URL}/videos/thumbnail/${id}`,
  getVideoPreviewUrl: (id) => `${API_URL}/videos/preview/${id}`,
  getRawUrl: (id) => `${API_URL}/raw_images/file/${id}`,
  getRawThumbnailUrl: (id) => `${API_URL}/raw_images/thumbnail/${id}`,
  getRawPreviewUrl: (id) => `${API_URL}/raw_images/preview/${id}`
  // ------------------------------------------------------------
};
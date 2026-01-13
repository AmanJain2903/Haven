import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // System API ENDPOINTS
  // ------------------------------------------------------------
  // Get backend status
  getBackendStatus: async () => {
    const response = await axios.get(`${API_URL}/health/status`);
    return response.data;
  },
  // Get system status
  getSystemStatus: async () => {
    const response = await axios.get(`${API_URL}/system/status`);
    return response.data;
  },
  // Get system config
  getSystemConfig: async (key) => {
    const response = await axios.get(`${API_URL}/system/config`, {
      params: { key: key }
    });
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

  getImageThumbnailFile: async (id) => {
    const response = await axios.get(`${API_URL}/images/thumbnail/${id}`);
    return response.data;
  },

  getImageFile: async (id) => {
    const response = await axios.get(`${API_URL}/images/file/${id}`);
    return response.data;
  },

  // Fetch detailed info for a specific image
  getImageDetails: async (id) => {
    const response = await axios.get(`${API_URL}/images/details/${id}`);
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

  getVideoThumbnailFile: async (id) => {
    const response = await axios.get(`${API_URL}/videos/thumbnail/${id}`);
    return response.data;
  },

  getVideoPreviewFile: async (id) => {
    const response = await axios.get(`${API_URL}/videos/preview/${id}`);
    return response.data;
  },

  getVideoFile: async (id) => {
    const response = await axios.get(`${API_URL}/videos/file/${id}`);
    return response.data;
  },

  getVideoDetails: async (id) => {
    const response = await axios.get(`${API_URL}/videos/details/${id}`);
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

  getRawThumbnailFile: async (id) => {
    const response = await axios.get(`${API_URL}/raw_images/thumbnail/${id}`);
    return response.data;
  },

  getRawPreviewFile: async (id) => {
    const response = await axios.get(`${API_URL}/raw_images/preview/${id}`);
    return response.data;
  },

  getRawFile: async (id) => {
    const response = await axios.get(`${API_URL}/raw_images/file/${id}`);
    return response.data;
  },

  getRawDetails: async (id) => {
    const response = await axios.get(`${API_URL}/raw_images/details/${id}`);
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

  // Intelligence API ENDPOINTS
  // ------------------------------------------------------------
  // Search photos
  searchPhotos: async (query, skip=0, limit=500) => {
    const response = await axios.post(`${API_URL}/intelligence/search/images`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
        photos: response.data,
        total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Search videos
  searchVideos: async (query, skip=0, limit=500) => {
    const response = await axios.post(`${API_URL}/intelligence/search/videos`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
      videos: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Search raw images
  searchRawImages: async (query, skip=0, limit=500) => {
    const response = await axios.post(`${API_URL}/intelligence/search/raw_images`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
      rawImages: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    } 
  },

  // Search all media
  searchAllMedia: async (query, skip=0, limit=500) => {
    const response = await axios.post(`${API_URL}/intelligence/search/all_media`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
      allMedia: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Search map points for images
  searchMapPointsImages: async (query) => {
    const response = await axios.post(`${API_URL}/intelligence/search/map/images`, null, {
      params: { query: query }
    });
    return response.data;
  },

  // Search map points for videos
  searchMapPointsVideos: async (query) => {
    const response = await axios.post(`${API_URL}/intelligence/search/map/videos`, null, {
      params: { query: query }
    });
    return response.data;
  },

  // Search map points for raw images
  searchMapPointsRawImages: async (query) => {
    const response = await axios.post(`${API_URL}/intelligence/search/map/raw_images`, null, {
      params: { query: query }
    });
    return response.data;
  },

  // Search map points for all media
  searchMapPointsAllMedia: async (query) => {
    const response = await axios.post(`${API_URL}/intelligence/search/map/all_media`, null, {
      params: { query: query }
    });
    return response.data;
  },
  // ------------------------------------------------------------


  // Map Search Endpoints
  // ------------------------------------------------------------
  // Search specifically for map points (lightweight, high limit)
  // Get all map points for images (lightweight)
  getAllMapPointsImages: async () => {
    const response = await axios.get(`${API_URL}/map/images`);
    return response.data;
  },

  // Get all map points for videos (lightweight)
  getAllMapPointsVideos: async () => {
    const response = await axios.get(`${API_URL}/map/videos`);
    return response.data;
  },

  // Get all map points for raw images (lightweight)
  getAllMapPointsRawImages: async () => {
    const response = await axios.get(`${API_URL}/map/raw_images`);
    return response.data;
  },

  // Get all map points for all media (lightweight)
  getAllMapPointsAllMedia: async () => {
    const response = await axios.get(`${API_URL}/map/all_media`);
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
  getRawPreviewUrl: (id) => `${API_URL}/raw_images/preview/${id}`,
  // ------------------------------------------------------------
};
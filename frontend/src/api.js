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
    const response = await axios.get(`${API_URL}/raw-images/timeline`, {
      params: { skip: skip, limit: limit }
    });
    return response.data;
  },

  getRawThumbnailFile: async (id) => {
    const response = await axios.get(`${API_URL}/raw-images/thumbnail/${id}`);
    return response.data;
  },

  getRawPreviewFile: async (id) => {
    const response = await axios.get(`${API_URL}/raw-images/preview/${id}`);
    return response.data;
  },

  getRawFile: async (id) => {
    const response = await axios.get(`${API_URL}/raw-images/file/${id}`);
    return response.data;
  },

  getRawDetails: async (id) => {
    const response = await axios.get(`${API_URL}/raw-images/details/${id}`);
    return response.data;
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
    const response = await axios.post(`${API_URL}/intelligence/search/raw-images`, null, {
      params: { query: query, skip: skip, limit: limit }
    });
    return {
      rawImages: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    } 
  },

  // Search map points
  searchMapPoints: async (query) => {
    const response = await axios.post(`${API_URL}/intelligence/search/map`, null, {
      params: { query: query }
    });
    return response.data;
  },
  // ------------------------------------------------------------


  // Map Search Endpoints
  // ------------------------------------------------------------
  // Search specifically for map points (lightweight, high limit)
  // Get all map points (lightweight)
  getAllMapPoints: async () => {
    const response = await axios.get(`${API_URL}/images/map-data`);
    return response.data;
  },

  // Get all map points (lightweight)
  getAllVideoMapPoints: async () => {
    const response = await axios.get(`${API_URL}/videos/map-data`);
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
  getRawUrl: (id) => `${API_URL}/raw-images/file/${id}`,
  getRawThumbnailUrl: (id) => `${API_URL}/raw-images/thumbnail/${id}`,
  getRawPreviewUrl: (id) => `${API_URL}/raw-images/preview/${id}`,
  // ------------------------------------------------------------
};
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

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

  getVideoPreviewFile: async (id) => {
    const response = await axios.get(`${API_URL}/videos/preview/${id}`);
    return response.data;
  },

  getVideoDetails: async (id) => {
    const response = await axios.get(`${API_URL}/videos/details/${id}`);
    return response.data;
  },

  // ------------------------------------------------------------


  // Intelligence API ENDPOINTS
  // ------------------------------------------------------------
  // Search photos
  searchPhotos: async (query, skip=0, limit=500) => {
    const response = await axios.post(`${API_URL}/intelligence/search`, null, {
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
  // ------------------------------------------------------------


  // Map Search Endpoints
  // ------------------------------------------------------------
  // Search specifically for map points (lightweight, high limit)
  // Get all map points (lightweight)
  getAllMapPoints: async () => {
    const response = await axios.get(`${API_URL}/images/map-data`);
    return response.data;
  },

  searchMapPoints: async (query) => {
    const response = await axios.post(`${API_URL}/intelligence/search/map`, null, {
      params: { query: query }
    });
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
  // ------------------------------------------------------------
};
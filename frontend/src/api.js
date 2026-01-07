import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {
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

  // Get all map points (lightweight)
  getAllMapPoints: async () => {
    const response = await axios.get(`${API_URL}/images/map-data`);
    return response.data;
  },

  // Search specifically for map points (lightweight, high limit)
  searchMapPoints: async (query) => {
    const response = await axios.post(`${API_URL}/intelligence/search/map`, null, {
      params: { query: query }
    });
    return response.data;
  },
  
  // Helper to get full image URL
  getImageUrl: (id) => `${API_URL}/images/file/${id}`,

  getThumbnailUrl: (id) => `${API_URL}/images/thumbnail/${id}`
};
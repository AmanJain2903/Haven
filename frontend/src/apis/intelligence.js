import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

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
};
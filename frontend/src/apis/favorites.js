import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

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

  // Toggle favorite for a specific media item
  toggleFavorite: async (id, fileType) => {
    const response = await axios.post(`${API_URL}/favorites/toggle/${fileType}/${id}`);
    return response.data;
  },
  
  // ------------------------------------------------------------
};
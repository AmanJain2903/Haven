import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

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
};
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // Images API ENDPOINTS
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

  // Delete a specific image
  deleteImage: async (id) => {
    const response = await axios.delete(`${API_URL}/images/delete/${id}`);
    return response.data;
  },
  // ------------------------------------------------------------
};
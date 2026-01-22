import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

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

  // Fetch detailed info for a specific raw image
  getRawDetails: async (id) => {
    const response = await axios.get(`${API_URL}/raw_images/details/${id}`);
    return response.data;
  },

  // Delete a specific raw image
  deleteRawImage: async (id) => {
    const response = await axios.delete(`${API_URL}/raw_images/delete/${id}`);
    return response.data;
  },
  
  // ------------------------------------------------------------
};
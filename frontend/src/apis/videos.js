import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // Videos API ENDPOINTS
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

  // Fetch detailed info for a specific video
  getVideoDetails: async (id) => {
    const response = await axios.get(`${API_URL}/videos/details/${id}`);
    return response.data;
  },

  // Delete a specific video
  deleteVideo: async (id) => {
    const response = await axios.delete(`${API_URL}/videos/delete/${id}`);
    return response.data;
  },
  // ------------------------------------------------------------
};
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {
  // Fetch all photos
  getThumbnails: async () => {
    const response = await axios.get(`${API_URL}/images/`);
    for (let photo of response.data) {
      photo.thumbnail_url = api.getThumbnailUrl(photo.id);
    }
    return response.data;
  },

  // Search photos
  searchPhotos: async (query) => {
    const response = await axios.post(`${API_URL}/intelligence/search`, null, {
      params: { query: query }
    });
    // Add URL to each photo
    for (let photo of response.data) {
      photo.thumbnail_url = api.getThumbnailUrl(photo.id);
    }
    return response.data;
  },
  
  // Helper to get full image URL
  getImageUrl: (id) => `${API_URL}/images/file/${id}`,

  getThumbnailUrl: (id) => `${API_URL}/images/thumbnail/${id}`
};
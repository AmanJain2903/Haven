import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // MAPS API ENDPOINTS
  // ------------------------------------------------------------

  // Get all map points for images (lightweight)
  getAllMapPointsImages: async () => {
    const response = await axios.get(`${API_URL}/maps/images`);
    return response.data;
  },

  // Get all map points for videos (lightweight)
  getAllMapPointsVideos: async () => {
    const response = await axios.get(`${API_URL}/maps/videos`);
    return response.data;
  },

  // Get all map points for raw images (lightweight)
  getAllMapPointsRawImages: async () => {
    const response = await axios.get(`${API_URL}/maps/raw_images`);
    return response.data;
  },

  // Get all map points for all media (lightweight)
  getAllMapPointsAllMedia: async () => {
    const response = await axios.get(`${API_URL}/maps/all_media`);
    return response.data;
  },

  // Get the location data for a specific media item
  getFileLocation: async (fileType, id) => {
    const response = await axios.get(`${API_URL}/maps/location/${fileType}/${id}`);
    return response.data;
  },

  // Update the location data for a specific media item
  updateFileLocation: async (fileType, id, city, state, country) => {
    const response = await axios.post(`${API_URL}/maps/location/${fileType}/${id}`, null, {
      params: { city: city, state: state, country: country }
    });
    return response.data;
  },
  
  // ------------------------------------------------------------
};
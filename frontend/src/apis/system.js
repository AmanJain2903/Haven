import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // System API ENDPOINTS
  // ------------------------------------------------------------

  // Get project version
  getProjectVersion: async () => {
    const response = await axios.get(`${API_URL}/system/version`);
    return response.data;
  },
  // Check if space is available
  checkSpaceAvailable: async (size) => {
    const response = await axios.get(`${API_URL}/system/space_available`, { params: { size: size } });
    return response.data;
  },

  // ------------------------------------------------------------
};
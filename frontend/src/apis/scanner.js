import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // Scanner API ENDPOINTS
  // ------------------------------------------------------------

  // Trigger scan
  triggerScan: async () => {
    const response = await axios.post(`${API_URL}/scanner/`);
    return response.data;
  },

  // ------------------------------------------------------------
};
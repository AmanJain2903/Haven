import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // Health API ENDPOINTS
  // ------------------------------------------------------------

  // Get Backend Status
  getBackendStatus: async () => {
    const response = await axios.get(`${API_URL}/health/`);
    return response.data;
  },
  // Get Database Status
  getDatabaseStatus: async () => {
    const response = await axios.get(`${API_URL}/health/status/db`);
    return response.data;
  },
  // Get Haven Vault Status
  getHavenVaultStatus: async () => {
    const response = await axios.get(`${API_URL}/health/status/haven_vault`);
    return response.data;
  },
  // Get App Data Directory Status
  getAppDataDirectoryStatus: async () => {
    const response = await axios.get(`${API_URL}/health/status/app_data_dir`);
    return response.data;
  },
  // Get Redis Status
  getRedisStatus: async () => {
    const response = await axios.get(`${API_URL}/health/status/redis`);
    return response.data;
  },
  // Get Celery Status
  getCeleryStatus: async () => {
    const response = await axios.get(`${API_URL}/health/status/celery`);
    return response.data;
  },
  // ------------------------------------------------------------
};
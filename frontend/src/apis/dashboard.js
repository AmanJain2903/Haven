import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // Dashboard API ENDPOINTS
  // ------------------------------------------------------------

  // Get the hot storage path
  getHotStoragePath: async () => {
    const response = await axios.get(`${API_URL}/dashboard/hot_storage_path`);
    return response.data;
  },

  // Get the storage path
  getStoragePath: async () => {
    const response = await axios.get(`${API_URL}/dashboard/storage_path`);
    return response.data;
  },

  // Check if a path exists
  checkPathExistence: async (path) => {
    const response = await axios.get(`${API_URL}/dashboard/check_path_existence`, {
      params: { path: path }
    });
    return response.data;
  },

  // Get the disk information for a path
  getHavenVaultDiskInformation: async (path) => {
    const response = await axios.get(`${API_URL}/dashboard/disk_information`, {
      params: { path: path }
    });
    return response.data;
  },

  // Get the app data size
  getHavenAppDataSize: async () => {
    const response = await axios.get(`${API_URL}/dashboard/app_data_size`);
    return response.data;
  },

  // Get the data breakdown for a path
  getHavenVaultDataBreakdown: async (path) => {
    const response = await axios.get(`${API_URL}/dashboard/data_breakdown`, {
      params: { path: path }
    });
    return response.data;
  },

  // Get the processed files information
  getProcessedFilesInformation: async () => {
    const response = await axios.get(`${API_URL}/dashboard/processed_files_information`);
    return response.data;
  },

  // Get the metadata information
  getMetadataInformation: async () => {
    const response = await axios.get(`${API_URL}/dashboard/metadata_information`);
    return response.data;
  },

  // Start Haven Download Task
  startHavenDownloadTask: async (downloadType="default") => {
    const response = await axios.post(`${API_URL}/dashboard/download`, null,
      { params: { downloadType: downloadType } 
    });
    return response.data;
  },

  // Get the status of a download task
  getHavenDownloadTaskStatus: async (taskId) => {
    const response = await axios.get(`${API_URL}/dashboard/download_task_status/${taskId}`);
    return response.data;
  },

  // Cleanup a download task
  cleanupHavenDownload: async (taskId) => {
    const response = await axios.delete(`${API_URL}/dashboard/cleanup_download/${taskId}`);
    return response.data;
  },

  // Cancel a download task
  cancelHavenDownloadTask: async (taskId) => {
    const response = await axios.post(`${API_URL}/dashboard/cancel_download/${taskId}`);
    return response.data;
  },

  // ------------------------------------------------------------
};
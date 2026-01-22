import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // All Media API ENDPOINTS
  // ------------------------------------------------------------

  // Create a new album
  createAlbum: async (albumName, albumDescription, albumLocation, albumCity, albumState, albumCountry) => {
    const response = await axios.post(`${API_URL}/albums/create`, null, {
      params: { albumName: albumName, albumDescription: albumDescription, albumLocation: albumLocation, albumCity: albumCity, albumState: albumState, albumCountry: albumCountry }
    });
    return response.data;
  },

  // Get all albums
  getAlbums: async () => {
    const response = await axios.get(`${API_URL}/albums/getAlbums`);
    return response.data;
  },

  // Get a specific album
  getAlbum: async (albumId) => {
    const response = await axios.get(`${API_URL}/albums/getAlbum/${albumId}`);
    return response.data;
  },

  // Update an album
  updateAlbum: async (albumId, albumName, albumDescription, albumLocation, albumCity, albumState, albumCountry) => {
    const response = await axios.post(`${API_URL}/albums/update/${albumId}`, null, {
      params: { albumName: albumName, albumDescription: albumDescription, albumLocation: albumLocation, albumCity: albumCity, albumState: albumState, albumCountry: albumCountry }
    });
    return response.data;
  },

  // Add a file to an album
  addToAlbum: async (albumId, fileType, id) => {
    const response = await axios.post(`${API_URL}/albums/addToAlbum/${albumId}/${fileType}/${id}`);
    return response.data;
  },

  // Remove a file from an album
  removeFromAlbum: async (albumId, fileType, id) => {
    const response = await axios.post(`${API_URL}/albums/removeFromAlbum/${albumId}/${fileType}/${id}`);
    return response.data;
  },

  // Update the album cover
  updateAlbumCover: async (albumId, fileType, id) => {
    const response = await axios.post(`${API_URL}/albums/updateAlbumCover/${albumId}/${fileType}/${id}`);
    return response.data;
  },

  // Get the album cover
  getAlbumCover: async (albumId) => {
    const response = await axios.get(`${API_URL}/albums/getAlbumCover/${albumId}`);
    return response.data;
  },

  // Get the album timeline
  getAlbumTimeline: async (albumId, skip=0, limit=500, mediaFilter="all") => {
    const response = await axios.get(`${API_URL}/albums/timeline/${albumId}`, {
      params: { skip: skip, limit: limit, mediaFilter: mediaFilter }
    });
    return {
      timeline: response.data,
      total: parseInt(response.headers['x-total-count'] || 0, 10)
    }
  },

  // Get the part of albums
  getPartOfAlbums: async (fileType, id) => {
    const response = await axios.get(`${API_URL}/albums/getPartOfAlbums/${fileType}/${id}`);
    return response.data;
  },

  // Batch operations

  // Start a batch add to album
  batchAddToAlbum: async (albumId, files) => {
    const response = await fetch(`${API_URL}/albums/batch_add_to_album?albumId=${albumId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(files)
    });
    if (!response.ok) throw new Error('Failed to start batch add');
    return response.json();
  },

  // Start a batch delete album
  batchDeleteAlbum: async (albumId) => {
    const response = await fetch(`${API_URL}/albums/batch_delete_album?albumId=${albumId}`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to start batch delete');
    return response.json();
  },

  // Get the status of a batch task
  getBatchTaskStatus: async (taskId) => {
    const response = await fetch(`${API_URL}/albums/batch_task_status/${taskId}`);
    if (!response.ok) throw new Error('Failed to get task status');
    return response.json();
  },

  // Album Download API ENDPOINTS

  // Start a album download
  startAlbumDownload: async (albumId) => {
    const response = await axios.post(`${API_URL}/albums/download_album/${albumId}`);
    return response.data;
  },

  // Get the status of a download task
  getDownloadTaskStatus: async (taskId) => {
    const response = await axios.get(`${API_URL}/albums/download_task_status/${taskId}`);
    return response.data;
  },

  // Cleanup a download task
  cleanupDownload: async (taskId) => {
    const response = await axios.delete(`${API_URL}/albums/cleanup_download/${taskId}`);
    return response.data;
  },

  // Cancel a download task
  cancelDownload: async (taskId) => {
    const response = await axios.post(`${API_URL}/albums/cancel_download/${taskId}`);
    return response.data;
  },
  // ------------------------------------------------------------
};
import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

export const api = {

  // Helper Functions
  // ------------------------------------------------------------

  getImageUrl: (id) => `${API_URL}/images/file/${id}`,
  getThumbnailUrl: (id) => `${API_URL}/images/thumbnail/${id}`,
  getVideoUrl: (id) => `${API_URL}/videos/file/${id}`,
  getVideoThumbnailUrl: (id) => `${API_URL}/videos/thumbnail/${id}`,
  getVideoPreviewUrl: (id) => `${API_URL}/videos/preview/${id}`,
  getRawUrl: (id) => `${API_URL}/raw_images/file/${id}`,
  getRawThumbnailUrl: (id) => `${API_URL}/raw_images/thumbnail/${id}`,
  getRawPreviewUrl: (id) => `${API_URL}/raw_images/preview/${id}`,
  
  // ------------------------------------------------------------
};
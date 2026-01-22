// Import all API modules
import * as imagesApi from './apis/images';
import * as videosApi from './apis/videos';
import * as rawImagesApi from './apis/raw_images';
import * as allMediaApi from './apis/all_media';
import * as favoritesApi from './apis/favorites';
import * as intelligenceApi from './apis/intelligence';
import * as mapsApi from './apis/maps';
import * as albumsApi from './apis/albums';
import * as dashboardApi from './apis/dashboard';
import * as systemApi from './apis/system';
import * as healthApi from './apis/health';
import * as scannerApi from './apis/scanner';
import * as helperApi from './apis/helper';

// Combine all API modules into a single api object
export const api = {
  // Spread all methods from each API module
  ...imagesApi.api,
  ...videosApi.api,
  ...rawImagesApi.api,
  ...allMediaApi.api,
  ...favoritesApi.api,
  ...intelligenceApi.api,
  ...mapsApi.api,
  ...albumsApi.api,
  ...dashboardApi.api,
  ...systemApi.api,
  ...healthApi.api,
  ...scannerApi.api,
  ...helperApi.api,
};
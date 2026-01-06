import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { divIcon } from 'leaflet';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';
import ImageViewer from './ImageViewer';

// Fix for default Leaflet markers not showing in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapView = ({ photos }) => {
  const { isDark } = useTheme();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [clusterPhotos, setClusterPhotos] = useState([]);
  
  // Filter out photos that don't have GPS data
  const geotaggedPhotos = photos.filter(p => p.latitude && p.longitude);

  // Calculate center as average of all geotagged photos
  const center = geotaggedPhotos.length > 0 
    ? [
        geotaggedPhotos.reduce((sum, p) => sum + p.latitude, 0) / geotaggedPhotos.length,
        geotaggedPhotos.reduce((sum, p) => sum + p.longitude, 0) / geotaggedPhotos.length
      ]
    : [20.5937, 78.9629]; // Default to India

  // Calculate appropriate zoom level based on photo spread
  const getZoomLevel = () => {
    if (geotaggedPhotos.length === 0) return 4;
    if (geotaggedPhotos.length === 1) return 12;
    
    const lats = geotaggedPhotos.map(p => p.latitude);
    const lngs = geotaggedPhotos.map(p => p.longitude);
    const latDiff = Math.max(...lats) - Math.min(...lats);
    const lngDiff = Math.max(...lngs) - Math.min(...lngs);
    const maxDiff = Math.max(latDiff, lngDiff);
    
    // Adjust zoom based on spread
    if (maxDiff > 50) return 3;
    if (maxDiff > 20) return 4;
    if (maxDiff > 10) return 5;
    if (maxDiff > 5) return 6;
    if (maxDiff > 2) return 7;
    if (maxDiff > 1) return 8;
    return 10;
  };

  // Handle photo click from marker
  const handlePhotoClick = (photo) => {
    const index = geotaggedPhotos.findIndex(p => p.id === photo.id);
    setSelectedPhoto(photo);
    setSelectedIndex(index);
    setClusterPhotos(geotaggedPhotos);
  };

  const handleClose = () => {
    setSelectedPhoto(null);
    setSelectedIndex(null);
    setClusterPhotos([]);
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < clusterPhotos.length - 1) {
      const nextIndex = selectedIndex + 1;
      setSelectedIndex(nextIndex);
      setSelectedPhoto(clusterPhotos[nextIndex]);
    }
  };

  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      setSelectedIndex(prevIndex);
      setSelectedPhoto(clusterPhotos[prevIndex]);
    }
  };

  return (
    <div className="relative">
      {/* Header Stats */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r 
                       from-purple-600 via-indigo-600 to-violet-600
                       dark:from-white dark:via-cyan-100 dark:to-teal-100 
                       bg-clip-text text-transparent mb-2 flex items-center gap-3">
            Map View
          </h1>
          <p className="text-slate-600 dark:text-white/50 text-lg">
            <span className="font-semibold text-purple-600 dark:text-cyan-400">{geotaggedPhotos.length}</span> geotagged photos
          </p>
        </div>
      </div>

      {/* Map Container with Glassmorphism */}
      <div 
        style={{ height: 'calc(100vh - 20rem)' }} 
        className="relative rounded-3xl overflow-hidden glass-panel shadow-2xl border border-purple-400/20 dark:border-cyan-400/20"
      >

        <div className="relative z-10 h-full w-full rounded-3xl overflow-hidden">
          <MapContainer 
            attributionControl={false}
            center={center} 
            zoom={getZoomLevel()} 
            scrollWheelZoom={true} 
            style={{ 
              height: '100%', 
              width: '100%', 
              background: isDark ? '#0f172a' : '#f1f5f9',
              borderRadius: '1.5rem'
            }}
          >
            {/* Map Tiles - Switch based on theme */}
            <TileLayer
              url={isDark 
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              }
            />

            {/* Marker Cluster Group */}
            <MarkerClusterGroup
              chunkedLoading
              zoomToBoundsOnClick={false}
              showCoverageOnHover={false}
              maxClusterRadius={80}
              iconCreateFunction={(cluster) => {
                const count = cluster.getChildCount();
                
                // Add click handler to cluster icon
                setTimeout(() => {
                  const clusterElement = cluster.getElement();
                  if (clusterElement && !clusterElement.dataset.clickHandlerAdded) {
                    clusterElement.dataset.clickHandlerAdded = 'true';
                    clusterElement.style.cursor = 'pointer';
                    // Add click handler to entire cluster element
                    clusterElement.addEventListener('click', (e) => {
                      e.stopPropagation();
                      // Show all geotagged photos when clicking any cluster
                      setClusterPhotos(geotaggedPhotos);
                      setSelectedPhoto(geotaggedPhotos[0]);
                      setSelectedIndex(0);
                    });
                  }
                }, 0);
                
                return L.divIcon({
                  html: `<div class="flex items-center justify-center w-12 h-12 rounded-full glass-panel border-2 border-purple-400 dark:border-cyan-400 shadow-glow-cyan hover:scale-110 transition-transform" style="pointer-events: auto;">
                          <span class="text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">${count}</span>
                        </div>`,
                  className: 'custom-cluster-icon',
                  iconSize: L.point(48, 48, true),
                });
              }}
            >
              {/* Render Markers */}
              {geotaggedPhotos.map((photo) => (
                <Marker 
                  key={photo.id} 
                  position={[photo.latitude, photo.longitude]}
                  photoId={photo.id}
                  eventHandlers={{
                    click: () => handlePhotoClick(photo),
                  }}
                  icon={L.divIcon({
                    className: 'bg-transparent',
                    html: `<div class="w-12 h-12 rounded-xl overflow-hidden border-2 border-purple-400 dark:border-cyan-400 shadow-lg hover:scale-110 transition-transform duration-200 cursor-pointer glass-panel">
                            <img src="${photo.thumbnail_url}" class="w-full h-full object-cover" />
                          </div>`,
                    iconSize: [48, 48],
                    iconAnchor: [24, 24]
                  })}
                />
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      {/* Image Viewer */}
      {selectedPhoto && (
        <ImageViewer
          photo={selectedPhoto}
          onClose={handleClose}
          onNext={handleNext}
          onPrev={handlePrev}
          currentIndex={selectedIndex}
          totalPhotos={clusterPhotos.length}
        />
      )}
    </div>
  );
};

export default MapView;
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { divIcon } from 'leaflet';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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

  return (
    <div className="relative">
      {/* Header Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mb-8 flex items-center justify-between"
      >
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
      </motion.div>

      {/* Map Container with Glassmorphism */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{ height: 'calc(100vh - 20rem)' }} 
        className="relative rounded-3xl overflow-hidden glass-panel shadow-2xl border border-purple-400/20 dark:border-cyan-400/20"
      >
        {/* Animated Morphing Blob Background */}
        <motion.div
          animate={{
            borderRadius: [
              '60% 40% 30% 70% / 60% 30% 70% 40%',
              '30% 60% 70% 40% / 50% 60% 30% 60%',
              '60% 40% 30% 70% / 60% 30% 70% 40%',
            ],
            scale: [1, 1.08, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -inset-20 bg-gradient-to-r from-purple-600/60 via-indigo-600/50 to-violet-600/60 
                     dark:from-cyan-600/60 dark:via-teal-600/50 dark:to-blue-600/60 blur-3xl pointer-events-none z-0"
        />

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
              spiderfyOnMaxZoom={true}
              iconCreateFunction={(cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                  html: `<div class="flex items-center justify-center w-12 h-12 rounded-full glass-panel border-2 border-purple-400 dark:border-cyan-400 shadow-glow-cyan">
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
                  icon={L.divIcon({
                    className: 'bg-transparent',
                    html: `<div class="w-12 h-12 rounded-xl overflow-hidden border-2 border-purple-400 dark:border-cyan-400 shadow-lg hover:scale-110 transition-transform duration-200 cursor-pointer glass-panel">
                            <img src="${photo.thumbnail_url}" class="w-full h-full object-cover" />
                          </div>`,
                    iconSize: [48, 48],
                    iconAnchor: [24, 24]
                  })}
                >
                  <Popup 
                    className="custom-popup"
                    maxWidth={250}
                  >
                    <div className="glass-panel rounded-xl p-3 border border-purple-400/30 dark:border-cyan-400/30">
                      <img src={photo.thumbnail_url} className="w-full h-40 object-cover rounded-lg mb-3 shadow-lg" alt={photo.filename} />
                      <p className="text-sm font-medium text-slate-800 dark:text-white mb-1">{photo.filename || 'Untitled'}</p>
                      <p className="text-xs text-slate-500 dark:text-white/50">
                        {new Date(photo.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </motion.div>
    </div>
  );
};

export default MapView;
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { divIcon } from 'leaflet';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useState, useEffect, useMemo } from 'react';
import ImageViewer from './ImageViewer';
import  { api }  from '../api';

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

const MapView = ({searchQuery}) => {
  const { isDark } = useTheme();
  const [mapPhotos, setMapPhotos] = useState([]); // Store all map points
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [viewerPhotos, setViewerPhotos] = useState([]);

  // 1. Fetch Data
  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      try {
        let data = [];
        if (searchQuery && searchQuery.trim().length > 0) {
          data = await api.searchMapPoints(searchQuery);
        } else {
          data = await api.getAllMapPoints();
        }
        setMapPhotos(data || []);
      } catch (error) {
        console.error("Failed to load map data", error);
        setMapPhotos([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
  }, [searchQuery]);

  // 2. Compute Valid Photos (Memoized)
  const validPhotos = useMemo(() => {
    if (!mapPhotos) return [];
    return mapPhotos.filter(p => 
      p.latitude != null && 
      p.longitude != null && 
      !isNaN(Number(p.latitude)) && 
      !isNaN(Number(p.longitude))
    );
  }, [mapPhotos]);

  // 3. Compute Center (Memoized)
  const center = useMemo(() => {
    if (validPhotos.length === 0) return [20.5937, 78.9629]; 
    try {
        const latSum = validPhotos.reduce((sum, p) => sum + Number(p.latitude), 0);
        const lngSum = validPhotos.reduce((sum, p) => sum + Number(p.longitude), 0);
        return [latSum / validPhotos.length, lngSum / validPhotos.length];
    } catch (e) {
        return [20.5937, 78.9629]; 
    }
  }, [validPhotos]);

  // 4. Compute Zoom (Memoized)
  const zoomLevel = useMemo(() => {
    if (validPhotos.length === 0) return 4;
    if (validPhotos.length === 1) return 12;
    
    const lats = validPhotos.map(p => Number(p.latitude));
    const lngs = validPhotos.map(p => Number(p.longitude));
    const maxDiff = Math.max(
        Math.max(...lats) - Math.min(...lats),
        Math.max(...lngs) - Math.min(...lngs)
    );
    
    if (maxDiff > 50) return 3;
    if (maxDiff > 20) return 4;
    if (maxDiff > 10) return 5;
    if (maxDiff > 5) return 6;
    return 8;
  }, [validPhotos]);

  // 5. GENERATE MARKERS ONCE (The "Render Only Once" Fix)
  // This prevents re-rendering thousands of markers on every interaction
  const markerComponents = useMemo(() => {
    return validPhotos.map((photo) => (
        <Marker 
          key={photo.id} 
          position={[Number(photo.latitude), Number(photo.longitude)]}
          photoId={photo.id} 
          eventHandlers={{
            click: () => handleMarkerClick(photo),
          }}
          // LIGHTWEIGHT ICON (No Image/Thumbnail)
          icon={L.divIcon({
            className: 'bg-transparent',
            // Simple CSS Dot
            html: `<div class="w-4 h-4 rounded-full bg-purple-600 border-2 border-white dark:border-slate-900 shadow-md hover:scale-150 transition-transform cursor-pointer"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8] // Center of the dot
          })}
        />
    ));
  }, [validPhotos]); // Only re-run if the DATA changes

    // --- HANDLERS ---

  // A. Handle Single Marker Click
  const handleMarkerClick = (photo) => {
    setViewerPhotos([photo]); // Only show this one photo (or you could show all)
    setSelectedPhoto(photo);
    setSelectedIndex(0);
  };

  // B. Handle Cluster Click (The Logic Fix)
  const handleClusterClick = (cluster) => {
    // 1. Get all Leaflet markers inside this cluster
    const leafMarkers = cluster.getAllChildMarkers();

    // 2. Extract the 'id' we stored in the marker options
    const clusterPhotoIds = leafMarkers.map(marker => marker.options.photoId);

    // 3. Find the actual photo objects from our state
    const photosInCluster = mapPhotos.filter(p => clusterPhotoIds.includes(p.id));

    // 4. Open Viewer with ONLY these photos
    if (photosInCluster.length > 0) {
      setViewerPhotos(photosInCluster);
      setSelectedPhoto(photosInCluster[0]);
      setSelectedIndex(0);
    }
  };

  const handleClose = () => {
    setSelectedPhoto(null);
    setSelectedIndex(null);
    setViewerPhotos([]);
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < viewerPhotos.length - 1) {
      const nextIndex = selectedIndex + 1;
      setSelectedIndex(nextIndex);
      setSelectedPhoto(viewerPhotos[nextIndex]);
    }
  };

  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      setSelectedIndex(prevIndex);
      setSelectedPhoto(viewerPhotos[prevIndex]);
    }
  };


  return (
    <div className="relative">
      {/* Header Stats */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 dark:from-white dark:via-cyan-100 dark:to-teal-100 bg-clip-text text-transparent mb-2 flex items-center gap-3">
            {searchQuery ? `Searching: "${searchQuery}"` : "Map View"}
          </h1>
          <p className="text-slate-600 dark:text-white/50 text-lg">
            <span className="font-semibold text-purple-600 dark:text-cyan-400">
              {validPhotos.length}
            </span> geotagged photos
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div 
        style={{ height: 'calc(100vh - 20rem)' }} 
        className="relative rounded-3xl overflow-hidden glass-panel shadow-2xl border border-purple-400/20 dark:border-cyan-400/20"
      >
        <div className="relative z-10 h-full w-full rounded-3xl overflow-hidden">
            
          {/* Loading Overlay */}
          {loading && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent"></div>
             </div>
          )}

          <MapContainer 
            key={validPhotos.length} // Force re-center only when data size changes drastically
            attributionControl={false}
            center={center} 
            zoom={zoomLevel} 
            scrollWheelZoom={true} 
            preferCanvas={true} // IMPORTANT for performance with many markers
            style={{ 
              height: '100%', 
              width: '100%', 
              background: isDark ? '#0f172a' : '#f1f5f9',
              borderRadius: '1.5rem'
            }}
          >
            <TileLayer
              url={isDark 
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              }
            />

            <MarkerClusterGroup
              chunkedLoading // Process clusters in chunks to avoid UI freeze
              onClick={(e) => {
                if (e.layer && typeof e.layer.getAllChildMarkers === 'function') {
                    handleClusterClick(e.layer);
                }
              }}
              maxClusterRadius={80}
              iconCreateFunction={(cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                  html: `<div class="flex items-center justify-center w-12 h-12 rounded-full glass-panel border-2 border-purple-400 dark:border-cyan-400 shadow-glow-cyan hover:scale-110 transition-transform">
                          <span class="text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">${count}</span>
                        </div>`,
                  className: 'custom-cluster-icon',
                  iconSize: L.point(48, 48, true),
                });
              }}
            >
              {/* Render the MEMOIZED markers */}
              {markerComponents}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      {selectedPhoto && (
        <ImageViewer
          photo={selectedPhoto}
          onClose={handleClose}
          onNext={handleNext}
          onPrev={handlePrev}
          currentIndex={selectedIndex}
          totalPhotos={viewerPhotos.length}
        />
      )}
    </div>
  );
};

export default MapView;
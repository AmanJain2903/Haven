import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import PhotoGrid from './components/ImageGrid';
import VideoGrid from './components/VideoGrid';
import RawImageGrid from './components/RawImageGrid';
import MapView from './components/MapView';
import { useTheme } from './contexts/ThemeContext';

import { api } from './api';

function App() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isToggleVisible, setIsToggleVisible] = useState(true);
  const [scrollTimeout, setScrollTimeout] = useState(null);
  const { isDark, toggleTheme } = useTheme();

  const [totalCount, setTotalCount] = useState(0); 

  const [statusCode, setStatusCode] = useState('');

  // 1. Add state for pagination
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 500;

  // Images-specific state
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [activeView, setActiveView] = useState('photos');

  // Video-specific state
  const [videos, setVideos] = useState([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSkip, setVideoSkip] = useState(0);
  const [videoHasMore, setVideoHasMore] = useState(true);
  const [videoTotalCount, setVideoTotalCount] = useState(0);
  const [videoStatusCode, setVideoStatusCode] = useState('');

  // Raw image-specific state
  const [rawImages, setRawImages] = useState([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawSkip, setRawSkip] = useState(0);
  const [rawHasMore, setRawHasMore] = useState(true);
  const [rawTotalCount, setRawTotalCount] = useState(0);
  const [rawStatusCode, setRawStatusCode] = useState('');

  // --- UNIFIED LOAD FUNCTION ---
  // We use useCallback to prevent infinite loops when passed to useEffect
  const loadMorePhotos = useCallback(async () => {
      if (loading || !hasMore) return;

      setLoading(true);
      try {
          let response;
          console.log(`Loading... Skip: ${skip}, Limit: ${LIMIT}`);

          // BRANCH LOGIC: Check if we are searching or viewing timeline
          if (searchQuery) {
             // Load Search Results
             response = await api.searchPhotos(searchQuery, skip, LIMIT);
          } else {
             // Load Normal Timeline
             response = await api.getThumbnails(skip, LIMIT);
          }
          
          const { photos: newPhotos, total } = response;

          // UPDATE TOTAL COUNT (Only needed on first page, but safe to do always)
          if (skip === 0) {
              setTotalCount(total); 
          }

          if (newPhotos.length < LIMIT) {
              setHasMore(false); // No more photos in DB
          }
          
          // Append new photos to existing ones
          setPhotos(prev => {
              // Safety: Filter duplicates based on ID just in case
              const existingIds = new Set(prev.map(p => p.id));
              const uniqueNew = newPhotos.filter(p => !existingIds.has(p.id));
              return [...prev, ...uniqueNew];
          });

          // Increase skip for next time
          setSkip(prev => prev + LIMIT);

      } catch (error) {
          console.error("Failed to load photos:", error);
          if (error.response && error.response.status === 503) {
            setStatusCode('503');
          }
      } finally {
          setLoading(false);
      }
  }, [skip, loading, hasMore, searchQuery, totalCount]); // Dependencies

  // Load content when view changes (or on initial mount)
  // This handles:
  // 1. Initial load (activeView is 'photos' on mount)
  // 2. View switching (Photos ↔ Videos)
  // 3. Loading after search/reset when switching views
  useEffect(() => {
    // Load photos if on photos view and array is empty
    if (activeView === 'photos' && photos.length === 0 && !loading) {
      if (searchQuery) {
        // Active search exists, search photos
        setLoading(true);
        api.searchPhotos(searchQuery, 0, LIMIT)
          .then(response => {
            const { photos: results, total } = response;
            setPhotos(results);
            setTotalCount(total);
            setHasMore(results.length >= LIMIT);
            setSkip(LIMIT);
          })
          .catch(error => {
            console.error('Photo search error:', error);
            if (error.response?.status === 503) {
              setStatusCode('503');
            }
          })
          .finally(() => setLoading(false));
      } else {
        // No search, load normal timeline
        loadMorePhotos();
      }
    }
    
    // Load videos if on videos view and array is empty
    if (activeView === 'videos' && videos.length === 0 && !videoLoading) {
      if (searchQuery) {
        // Active search exists, search videos
        setVideoLoading(true);
        api.searchVideos(searchQuery, 0, LIMIT)
          .then(response => {
            const { videos: results, total } = response;
            setVideos(results);
            setVideoTotalCount(total);
            setVideoHasMore(results.length >= LIMIT);
            setVideoSkip(LIMIT);
          })
          .catch(error => {
            console.error('Video search error:', error);
            if (error.response?.status === 503) {
              setVideoStatusCode('503');
            }
          })
          .finally(() => setVideoLoading(false));
      } else {
        // No search, load normal timeline
        loadMoreVideos();
      }
    }
    
    // Load raw images if on raw view and array is empty
    if (activeView === 'raw' && rawImages.length === 0 && !rawLoading) {
      if (searchQuery) {
        // Active search exists, search raw images
        setRawLoading(true);
        api.searchRawImages(searchQuery, 0, LIMIT)
          .then(response => {
            const { rawImages: results, total } = response;
            setRawImages(results);
            setRawTotalCount(total);
            setRawHasMore(results.length >= LIMIT);
            setRawSkip(LIMIT);
          })
          .catch(error => {
            console.error('Raw image search error:', error);
            if (error.response?.status === 503) {
              setRawStatusCode('503');
            }
          })
          .finally(() => setRawLoading(false));
      } else {
        // No search, load normal timeline
        loadMoreRawImages();
      }
    }
  }, [activeView]); // Only runs when activeView changes (including initial mount)

  // Handle Search
  const handleSearch = async (query) => {
    if (!query || !query.trim()) {
      return handleReset();
    }

    // 1. Set search query
    setSearchQuery(query);
    setSearchInputValue(query);
    
    // 2. Clear ALL content (photos, videos, raw images) so switching views will trigger search
    setPhotos([]);
    setSkip(0);
    setHasMore(true);
    
    setVideos([]);
    setVideoSkip(0);
    setVideoHasMore(true);
    
    setRawImages([]);
    setRawSkip(0);
    setRawHasMore(true);
    
    // 3. Search only for the current active view
    if (activeView === 'raw') {
      setRawLoading(true);
      
      try {
        let response = await api.searchRawImages(query, 0, LIMIT);
        const { rawImages: results, total } = response;
        setRawImages(results);
        setRawTotalCount(total);
        
        if (results.length < LIMIT) {
          setRawHasMore(false);
        }
        setRawSkip(LIMIT);
        
      } catch (e) {
        console.error('Raw image search error:', e);
        if (e.response && e.response.status === 503) {
          setRawStatusCode('503');
        }
      } finally {
        setRawLoading(false);
        window.scrollTo(0, 0);
      }
    } else if (activeView === 'videos') {
      setVideoLoading(true);
      
      try {
        let response = await api.searchVideos(query, 0, LIMIT);
        const { videos: results, total } = response;
        setVideos(results);
        setVideoTotalCount(total);
        
        if (results.length < LIMIT) {
          setVideoHasMore(false);
        }
        setVideoSkip(LIMIT);
        
      } catch (e) {
        console.error('Video search error:', e);
        if (e.response && e.response.status === 503) {
          setVideoStatusCode('503');
        }
      } finally {
        setVideoLoading(false);
        window.scrollTo(0, 0);
      }
    } else {
      // Default to photos
      setLoading(true);
      
      try {
        let response = await api.searchPhotos(query, 0, LIMIT);
        const { photos: results, total } = response;
        setPhotos(results);
        setTotalCount(total);
        
        if (results.length < LIMIT) {
          setHasMore(false);
        }
        setSkip(LIMIT);
        
      } catch (e) {
        console.error('Photo search error:', e);
        if (e.response && e.response.status === 503) {
          setStatusCode('503');
        }
      } finally {
        setLoading(false);
        window.scrollTo(0, 0);
      }
    }
  };

  // Reset to all photos/videos
  const handleReset = async () => {
    // Clear search query
    setSearchQuery('');
    setSearchInputValue('');

    // Reset ALL state (photos, videos, and raw images)
    setPhotos([]);
    setSkip(0);
    setHasMore(true);
    setLoading(false);
    setStatusCode('');

    setVideos([]);
    setVideoSkip(0);
    setVideoHasMore(true);
    setVideoLoading(false);
    setVideoStatusCode('');

    setRawImages([]);
    setRawSkip(0);
    setRawHasMore(true);
    setRawLoading(false);
    setRawStatusCode('');

    // Load content ONLY for the active view
    if (activeView === 'raw') {
      setRawLoading(true);
      try {
        const response = await api.getRawThumbnails(0, LIMIT);
        const { rawImages: results, total } = response;
        setRawImages(results);
        setRawTotalCount(total);
        setRawSkip(LIMIT);
      } catch (error) {
        console.error("Failed to reset raw image timeline:", error);
        if (error.response && error.response.status === 503) {
          setRawStatusCode('503');
        }
      } finally {
        setRawLoading(false);
        window.scrollTo(0, 0);
      }
    } else if (activeView === 'videos') {
      setVideoLoading(true);
      try {
        const response = await api.getVideoThumbnails(0, LIMIT);
        const { videos: results, total } = response;
        setVideos(results);
        setVideoTotalCount(total);
        setVideoSkip(LIMIT);
      } catch (error) {
        console.error("Failed to reset video timeline:", error);
        if (error.response && error.response.status === 503) {
          setVideoStatusCode('503');
        }
      } finally {
        setVideoLoading(false);
        window.scrollTo(0, 0);
      }
    } else {
      // Default to photos
      setLoading(true);
      try {
        const response = await api.getThumbnails(0, LIMIT);
        const { photos: results, total } = response;
        setPhotos(results);
        setTotalCount(total);
        setSkip(LIMIT);
      } catch (error) {
        console.error("Failed to reset photo timeline:", error);
        if (error.response && error.response.status === 503) {
          setStatusCode('503');
        }
      } finally {
        setLoading(false);
        window.scrollTo(0, 0);
      }
    }
  };

  // --- VIDEO LOAD FUNCTION ---
  const loadMoreVideos = useCallback(async () => {
    if (videoLoading || !videoHasMore) return;

    setVideoLoading(true);
    try {
      let response;
      console.log(`Loading Videos... Skip: ${videoSkip}, Limit: ${LIMIT}`);
      
      // BRANCH LOGIC: Check if we are searching or viewing timeline
      if (searchQuery) {
        // Load Search Results
        response = await api.searchVideos(searchQuery, videoSkip, LIMIT);
      } else {
        // Load Normal Timeline
        response = await api.getVideoThumbnails(videoSkip, LIMIT);
      }
      
      const { videos: newVideos, total } = response;

      // Update total count on first page
      if (videoSkip === 0) {
        setVideoTotalCount(total);
      }

      if (newVideos.length < LIMIT) {
        setVideoHasMore(false);
      }
      
      // Append new videos to existing ones
      setVideos(prev => {
        const existingIds = new Set(prev.map(v => v.id));
        const uniqueNew = newVideos.filter(v => !existingIds.has(v.id));
        return [...prev, ...uniqueNew];
      });

      // Increase skip for next time
      setVideoSkip(prev => prev + LIMIT);

    } catch (error) {
      console.error("Failed to load videos:", error);
      if (error.response && error.response.status === 503) {
        setVideoStatusCode('503');
      }
    } finally {
      setVideoLoading(false);
    }
  }, [videoSkip, videoLoading, videoHasMore, searchQuery]);

  // --- RAW IMAGES LOAD FUNCTION ---
  const loadMoreRawImages = useCallback(async () => {
    if (rawLoading || !rawHasMore) return;

    setRawLoading(true);
    try {
      let response;
      console.log(`Loading RAW Images... Skip: ${rawSkip}, Limit: ${LIMIT}`);
      
      // BRANCH LOGIC: Check if we are searching or viewing timeline
      if (searchQuery) {
        // Load Search Results
        response = await api.searchRawImages(searchQuery, rawSkip, LIMIT);
      } else {
        // Load Normal Timeline
        response = await api.getRawThumbnails(rawSkip, LIMIT);
      }
      
      const { rawImages: newRawImages, total } = response;

      // Update total count on first page
      if (rawSkip === 0) {
        setRawTotalCount(total);
      }

      if (newRawImages.length < LIMIT) {
        setRawHasMore(false);
      }
      
      // Append new raw images to existing ones
      setRawImages(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const uniqueNew = newRawImages.filter(r => !existingIds.has(r.id));
        return [...prev, ...uniqueNew];
      });

      // Increase skip for next time
      setRawSkip(prev => prev + LIMIT);

    } catch (error) {
      console.error("Failed to load raw images:", error);
      if (error.response && error.response.status === 503) {
        setRawStatusCode('503');
      }
    } finally {
      setRawLoading(false);
    }
  }, [rawSkip, rawLoading, rawHasMore, searchQuery]);


  // Scroll to top on page load
  useEffect(() => {
    // Disable scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    // Force scroll to top
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // Hide toggle on scroll
      setIsToggleVisible(false);

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Show toggle after scrolling stops (500ms delay)
      const timeout = setTimeout(() => {
        setIsToggleVisible(true);
      }, 500);

      setScrollTimeout(timeout);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [scrollTimeout]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Animated Background Orbs and Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Cursor Following Glow Effect */}
        <motion.div
          animate={{
            x: mousePosition.x - 250,
            y: mousePosition.y - 250,
          }}
          transition={{
            type: 'spring',
            stiffness: 50,
            damping: 20,
            mass: 0.5,
          }}
          className="absolute w-[500px] h-[500px] bg-gradient-to-br 
                     from-purple-400/30 via-blue-400/25 to-transparent
                     dark:from-cyan-400/30 dark:via-teal-400/20 dark:to-transparent 
                     rounded-full blur-3xl"
          style={{ willChange: 'transform' }}
        />
        
        {/* Large Gradient Orbs */}
        <motion.div
          animate={{
            x: [0, 200, 0],
            y: [0, -150, 0],
            scale: [1, 1.3, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          style={{willChange: 'transform, opacity'}}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br 
                     from-purple-300/15 to-blue-400/15
                     dark:from-cyan-400/20 dark:to-blue-500/20 
                     rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -150, 0],
            y: [0, 200, 0],
            scale: [1, 1.4, 1],
            opacity: [0.15, 0.3, 0.15],
          }}
          style={{willChange: 'transform, opacity'}}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-to-br 
                     from-indigo-300/15 to-purple-400/15
                     dark:from-teal-400/20 dark:to-cyan-500/20 
                     rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          style={{willChange: 'transform, opacity'}}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/2 left-1/2 w-[450px] h-[450px] bg-gradient-to-br 
                     from-violet-300/12 to-pink-300/12
                     dark:from-purple-400/20 dark:to-pink-500/20 
                     rounded-full blur-3xl"
        />
        
        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -100 - (i * 20), 0],
              x: [0, (i % 2 === 0 ? 50 : -50), 0],
              opacity: [0, 0.4, 0],
            }}
            transition={{
              duration: 8 + (i * 0.5),
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
            className="absolute w-1 h-1 bg-purple-400/40 dark:bg-cyan-400/60 rounded-full"
            style={{
              left: `${(i * 5) % 100}%`,
              top: `${(i * 7) % 100}%`,
              willChange: 'transform, opacity'
            }}
          />
        ))}
        
        {/* Animated Grid Lines */}
        <div className="absolute inset-0 opacity-[0.08] dark:opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.15) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />
        </div>
        <div className="hidden dark:block absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />
        </div>
      </div>

      {/* Main Layout */}
      {/* Theme Toggle - Top Right */}
      <motion.button
        initial={{ opacity: 0, y: 0 }}
        animate={{ 
          opacity: isToggleVisible ? 1 : 0,
        }}
        transition={{ 
          duration: 0.3,
          ease: "easeOut"
        }}
        onClick={toggleTheme}
        style={{ pointerEvents: isToggleVisible ? 'auto' : 'none', willChange: 'transform, opacity' }}
        className="fixed top-8 right-8 z-50 p-4 glass-panel rounded-2xl
                 hover:bg-white/85 dark:hover:bg-slate-900/90
                 transition-all duration-300 group"
      >
        <motion.div
          animate={{
            borderRadius: [
              '50% 50% 30% 70% / 50% 50% 70% 30%',
              '30% 70% 70% 30% / 50% 50% 30% 70%',
              '50% 50% 30% 70% / 50% 50% 70% 30%',
            ],
            scale: [1, 1.05, 1],
            opacity: [0.3, 0.45, 0.3],
          }}
          style={{willChange: 'transform, opacity'}}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -inset-6 bg-gradient-to-r from-purple-600/80 via-indigo-600/70 to-violet-600/80 blur-3xl"
        />
        <motion.div
          animate={{ rotate: isDark ? 0 : 180 }}
          transition={{ duration: 0.5, type: 'spring' }}
          style={{willChange: 'transform'}}
        >
          {isDark ? (
            <Moon className="w-6 h-6 text-cyan-300" />
          ) : (
            <Sun className="w-6 h-6 text-purple-600" />
          )}
        </motion.div>
      </motion.button>

      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <SearchBar onSearch={handleSearch} searchValue={searchInputValue} onClearSearch={handleReset} />
      
      {activeView === 'photos' ? (
        <PhotoGrid photos={photos} loading={loading} searchQuery={searchQuery} onLoadMore={loadMorePhotos} hasMore={hasMore} totalCount={totalCount} statusCode={statusCode} />
      ) : activeView === 'videos' ? (
        <VideoGrid videos={videos} loading={videoLoading} searchQuery={searchQuery} onLoadMore={loadMoreVideos} hasMore={videoHasMore} totalCount={videoTotalCount} statusCode={videoStatusCode} />
      ) : activeView === 'raw' ? (
        <RawImageGrid rawImages={rawImages} loading={rawLoading} searchQuery={searchQuery} onLoadMore={loadMoreRawImages} hasMore={rawHasMore} totalCount={rawTotalCount} statusCode={rawStatusCode} />
      ) : activeView === 'map' ? (
        <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
          <div style={{ height: 'calc(100vh - 16rem)' }}>
            <MapView searchQuery={searchQuery}/>
          </div>
        </div>
      ) : (
        <PhotoGrid photos={photos} loading={loading} searchQuery={searchQuery} onLoadMore={loadMorePhotos} hasMore={hasMore} totalCount={totalCount} statusCode={statusCode} />
      )}

      {/* Vignette Effect */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t 
                      from-gray-200/30 via-transparent to-gray-200/30
                      dark:from-black/20 dark:via-transparent dark:to-black/20" />
    </div>
  );
}

export default App;

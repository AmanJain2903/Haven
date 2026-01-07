import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import PhotoGrid from './components/PhotoGrid';
import MapView from './components/MapView';
import { useTheme } from './contexts/ThemeContext';

import { api } from './api';

function App() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isToggleVisible, setIsToggleVisible] = useState(true);
  const [scrollTimeout, setScrollTimeout] = useState(null);
  const { isDark, toggleTheme } = useTheme();

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [activeView, setActiveView] = useState('photos');

  // Load photos on startup
  useEffect(() => {
    loadThumbnails();
  }, []);

  const loadThumbnails = async () => {
    try {
      const data = await api.getThumbnails();
      setPhotos(data);
      console.log("Photos loaded:", data);
    } catch (error) {
      console.error("Failed to load photos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Search
  const handleSearch = async (query) => {
    if (!query || !query.trim()) {
      setSearchQuery('');
      setSearchInputValue(''); 
      return loadThumbnails();
    }
    
    setLoading(true);
    setSearchQuery(query);
    setSearchInputValue(query);
    try {
      const results = await api.searchPhotos(query);
      setPhotos(results);
    } catch (e) {
      console.error('Search error:', e);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset to all photos
  const handleReset = () => {
    setSearchQuery('');
    setSearchInputValue('');
    loadThumbnails();
  };



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

      <Sidebar onNavigate={handleReset} activeView={activeView} setActiveView={setActiveView} />
      <SearchBar onSearch={handleSearch} searchValue={searchInputValue} onClearSearch={handleReset} />
      
      {activeView === 'photos' ? (
        <PhotoGrid photos={photos} loading={loading} searchQuery={searchQuery} />
      ) : activeView === 'map' ? (
        <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
          <div style={{ height: 'calc(100vh - 16rem)' }}>
            <MapView photos={photos} />
          </div>
        </div>
      ) : (
        <PhotoGrid photos={photos} loading={loading} searchQuery={searchQuery} />
      )}

      {/* Vignette Effect */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t 
                      from-gray-200/30 via-transparent to-gray-200/30
                      dark:from-black/20 dark:via-transparent dark:to-black/20" />
    </div>
  );
}

export default App;

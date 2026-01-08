import { X, ChevronLeft, ChevronRight, Calendar, MapPin, Info, Heart, Share2, Download, Trash2, ZoomIn, ZoomOut, HardDrive, Maximize, Camera, Aperture, Layers, Clock, MoreVertical, Play, Edit, RotateCcw, RotateCw, FolderPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../api'; // Import your API helper

const ImageViewer = ({ photo, onClose, onNext, onPrev, currentIndex, totalPhotos }) => {
  const { isDark } = useTheme();
  
  // --- NEW STATE: Active Photo Data ---
  // We initialize this with the prop 'photo' so the UI renders immediately.
  const [activePhoto, setActivePhoto] = useState(photo);

  const [direction, setDirection] = useState(0);
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // --- FETCH DETAILS LOGIC ---
  useEffect(() => {
    if (!photo) return;

    // 1. Reset to the basic prop data immediately when the index changes.
    // This ensures the transition is instant and we don't show the previous photo's details.
    setActivePhoto(photo);

    let isMounted = true;

    const fetchDetailedData = async () => {
      try {
        // 2. Call the API
        const details = await api.getImageDetails(photo.id);
        
        // 3. Update state only if the component is still mounted and looking at the same photo
        if (isMounted && details && details.id === photo.id) {
          setActivePhoto(details);
        }
      } catch (error) {
        console.error("Failed to fetch detailed image data, using fallback.", error);
        // We do nothing here, because activePhoto is already set to the 'photo' prop (fallback)
      }
    };

    fetchDetailedData();

    return () => { isMounted = false; };
  }, [photo]); // Run whenever the input photo object changes

  if (!activePhoto) return null;

  const hasNext = currentIndex < totalPhotos - 1;
  const hasPrev = currentIndex > 0;

  // Update direction based on index change
  useEffect(() => {
    if (currentIndex !== prevIndex) {
      setDirection(currentIndex > prevIndex ? 1 : -1);
      setPrevIndex(currentIndex);
      setImageLoaded(false); // Reset when changing photos
      setScale(1); // Reset zoom
      setPosition({ x: 0, y: 0 }); // Reset position
    }
  }, [currentIndex, prevIndex]);

  const handleNext = () => {
    if (hasNext) {
      onNext();
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      onPrev();
    }
  };

  // Zoom functions
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.5, 1);
    setScale(newScale);
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 }); // Auto-center when fully zoomed out
    }
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(1, Math.min(5, scale + delta));
      setScale(newScale);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 }); // Auto-center when fully zoomed out
      }
    }
  };

  // Dragging for panning when zoomed
  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double click to reset zoom
  const handleDoubleClick = () => {
    handleResetZoom();
  };

  // Handle Keyboard Navigation (Esc, Left, Right)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup listener when component closes
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, currentIndex, hasNext, hasPrev]);

  // Prevent scrolling the background page while viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{willChange: 'opacity'}}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      {/* Translucent Background with Blur */}
      <div className="absolute inset-0 backdrop-blur-3xl bg-white/80 dark:bg-black/80" />
      
      {/* Content Container */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8">
          
          {/* --- Close Button --- */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-3 glass-panel rounded-full 
                       border border-purple-400/30 dark:border-cyan-400/30
                       text-slate-700 dark:text-white/80 
                       hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                       hover:border-purple-400/50 dark:hover:border-cyan-400/50
                       hover:scale-110
                       shadow-lg transition-all duration-200 z-50"
          >
            <X className="w-6 h-6" />
          </button>

          {/* --- Photo Counter --- */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 
                         glass-panel border-2 border-purple-400/30 dark:border-cyan-400/30 
                         rounded-full px-6 py-2 
                         text-sm font-medium
                         text-slate-700 dark:text-white/90 
                         shadow-lg backdrop-blur-xl z-50">
            <span className="text-purple-600 dark:text-cyan-400">{currentIndex + 1}</span>
            <span className="mx-1.5 text-slate-400 dark:text-white/40">/</span>
            <span>{totalPhotos}</span>
          </div>

          {/* --- Navigation Arrows --- */}
          <button 
            onClick={handlePrev}
            disabled={!hasPrev}
            className={`absolute left-6 p-4 glass-panel rounded-full 
                       border border-purple-400/30 dark:border-cyan-400/30
                       shadow-lg transition-all duration-200 z-40 
                       hidden md:flex items-center justify-center
                       ${hasPrev 
                         ? 'text-slate-700 dark:text-white/80 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 hover:border-purple-400/50 dark:hover:border-cyan-400/50 hover:scale-110 cursor-pointer' 
                         : 'text-slate-400/30 dark:text-white/10 cursor-not-allowed opacity-50'
                       }`}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button 
            onClick={handleNext}
            disabled={!hasNext}
            className={`absolute right-6 p-4 glass-panel rounded-full 
                       border border-purple-400/30 dark:border-cyan-400/30
                       shadow-lg transition-all duration-200 z-40 
                       hidden md:flex items-center justify-center
                       ${hasNext 
                         ? 'text-slate-700 dark:text-white/80 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 hover:border-purple-400/50 dark:hover:border-cyan-400/50 hover:scale-110 cursor-pointer' 
                         : 'text-slate-400/30 dark:text-white/10 cursor-not-allowed opacity-50'
                       }`}
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          {/* --- Main Image --- */}
          <div 
            className="flex h-full w-full max-w-7xl items-center justify-center p-4 md:p-12 overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <div className="relative glass-panel rounded-3xl p-4 border-2 border-purple-400/30 dark:border-cyan-400/30 shadow-2xl overflow-hidden">
              
              <AnimatePresence mode="wait" initial={false}>
                <motion.div 
                  key={activePhoto.id} 
                  className="relative flex items-center justify-center"
                  animate={{ 
                    scale: scale,
                    x: position.x,
                    y: position.y
                  }}
                  willChange="transform"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {/* Thumbnail - shown immediately, constrained */}
                  {!imageLoaded && (
                    <motion.img 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{willChange: 'opacity'}}
                      transition={{ duration: 0.2 }}
                      src={activePhoto.thumbnail_url} 
                      alt={activePhoto.filename}
                      className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl blur-sm"
                    />
                  )}
                  
                  {/* Full image - loads in background, can be larger */}
                  <motion.img 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: imageLoaded ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    src={activePhoto.image_url} 
                    alt={activePhoto.filename}
                    onLoad={() => setImageLoaded(true)}
                    className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl select-none"
                    style={{ display: imageLoaded ? 'block' : 'none', willChange: 'opacity, transform' }}
                    draggable={false}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* --- Metadata Overlay (Bottom) --- */}
          <AnimatePresence mode="wait">
            {showMetadata && (
              <motion.div 
                style={{ willChange: "opacity" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ 
                  duration: 0.15,
                  ease: "easeOut"
                }}
                className="absolute bottom-32 left-0 right-0 flex justify-center z-50 px-4"
              >
                <div 
                  className="glass-panel border-2 border-purple-400/30 dark:border-cyan-400/30 
                             rounded-2xl px-8 py-6 
                             grid grid-cols-1 md:grid-cols-3 gap-6 
                             text-sm text-slate-700 dark:text-white/90 
                             shadow-2xl backdrop-blur-xl max-w-6xl will-change-transform"
                >
                
                {/* Column 1: File Details */}
                <div className="flex flex-col gap-3">
                  {/* Filename */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-indigo-500/10 dark:bg-blue-500/10">
                      <Info className="w-4 h-4 text-indigo-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs opacity-70">Filename</span>
                      <span className="font-medium truncate max-w-[180px]">{activePhoto.filename}</span>
                    </div>
                  </div>

                  {/* File Size */}
                  {activePhoto.metadata?.size_bytes && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-500/10 dark:bg-violet-500/10">
                        <HardDrive className="w-4 h-4 text-purple-600 dark:text-violet-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">File Size</span>
                        <span className="font-medium">
                          {activePhoto.metadata.size_bytes < 1024 * 1024 
                            ? `${(activePhoto.metadata.size_bytes / 1024).toFixed(1)} KB`
                            : `${(activePhoto.metadata.size_bytes / (1024 * 1024)).toFixed(2)} MB`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dimensions */}
                  {activePhoto.width && activePhoto.height && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-500/10 dark:bg-sky-500/10">
                        <Maximize className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Dimensions</span>
                        <span className="font-medium">{activePhoto.width}px × {activePhoto.height}px</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2: Camera Details */}
                <div className="flex flex-col gap-3">
                  {/* Camera Make & Model */}
                  {(activePhoto.metadata?.camera_make || activePhoto.metadata?.camera_model) && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-500/10 dark:bg-yellow-500/10">
                        <Camera className="w-4 h-4 text-amber-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Camera</span>
                        <span className="font-medium">
                          {[activePhoto.metadata.camera_make, activePhoto.metadata.camera_model].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Exposure Settings */}
                  {(activePhoto.metadata?.exposure_time || activePhoto.metadata?.iso || activePhoto.metadata?.f_number || activePhoto.metadata?.focal_length) && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-500/10 dark:bg-green-500/10">
                        <Aperture className="w-4 h-4 text-emerald-600 dark:text-green-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Settings</span>
                        <span className="font-medium">
                          {[
                            activePhoto.metadata.exposure_time && `${activePhoto.metadata.exposure_time}`,
                            activePhoto.metadata.f_number && `f/${activePhoto.metadata.f_number}`,
                            activePhoto.metadata.iso && `ISO ${activePhoto.metadata.iso}`,
                            activePhoto.metadata.focal_length && `${activePhoto.metadata.focal_length}mm`
                          ].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Megapixels */}
                  {activePhoto.megapixels && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-pink-500/10 dark:bg-rose-500/10">
                        <Layers className="w-4 h-4 text-pink-600 dark:text-rose-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Megapixels</span>
                        <span className="font-medium">{activePhoto.megapixels.toFixed(1)} MP</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 3: Location & Date */}
                <div className="flex flex-col gap-3">
                  {/* Location */}
                  {(activePhoto.city || activePhoto.state || activePhoto.country) && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-500/10 dark:bg-teal-500/10">
                        <MapPin className="w-4 h-4 text-green-600 dark:text-teal-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Location</span>
                        <span className="font-medium">
                          {[activePhoto.city, activePhoto.state, activePhoto.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Capture Date */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-purple-500/10 dark:bg-cyan-500/10">
                      <Calendar className="w-4 h-4 text-purple-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs opacity-70">Capture Date</span>
                      <span className="font-medium">{new Date(activePhoto.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Capture Time */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-indigo-500/10 dark:bg-purple-500/10">
                      <Clock className="w-4 h-4 text-indigo-600 dark:text-purple-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs opacity-70">Capture Time (UTC)</span>
                      <span className="font-medium">
                        {new Date(activePhoto.date).toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
              </div>
            </div>
          </div>
              </div>
            </motion.div>
            )}
          </AnimatePresence>

          {/* --- Action Buttons (Bottom) --- */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center items-end z-50">
            {/* Zoom Out Button - Left Outside */}
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className={`p-3 glass-panel rounded-full border border-purple-400/30 dark:border-cyan-400/30
                       shadow-lg transition-all duration-200 mr-4
                       ${scale <= 1 
                         ? 'opacity-50 cursor-not-allowed text-slate-400 dark:text-white/30' 
                         : 'text-slate-700 dark:text-white/80 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 hover:border-purple-400/50 dark:hover:border-cyan-400/50 hover:scale-110'
                       }`}
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            {/* Center Column */}
            <div className="flex flex-col items-center gap-3">
              {/* Reset Zoom Button - Above Toolbar */}
              {scale > 1 && (
                <button
                  onClick={handleResetZoom}
                  className="p-2 px-4 glass-panel rounded-full border border-purple-400/30 dark:border-cyan-400/30
                           text-slate-700 dark:text-white/80 
                           hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                           hover:border-purple-400/50 dark:hover:border-cyan-400/50
                           hover:scale-110
                           shadow-lg transition-all duration-200"
                >
                  <span className="text-xs font-bold">Reset Zoom</span>
                </button>
              )}

              {/* Main Toolbar */}
              <div className="glass-panel border-2 border-purple-400/30 dark:border-cyan-400/30 
                             rounded-full px-6 py-3 
                             flex items-center gap-3 
                             shadow-2xl backdrop-blur-xl">
                
                {/* Info Button */}
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className={`p-2.5 rounded-full transition-all duration-200
                           ${showMetadata 
                             ? 'bg-purple-500/30 dark:bg-cyan-500/30 border-2 border-purple-400/50 dark:border-cyan-400/50' 
                             : 'bg-white/10 dark:bg-white/5 border border-white/20 hover:bg-white/20'
                           }`}
              >
                <Info className={`w-5 h-5 ${showMetadata ? 'text-purple-600 dark:text-cyan-400' : 'text-slate-700 dark:text-white/70'}`} />
              </button>

              <div className="w-px h-6 bg-purple-400/20 dark:bg-cyan-400/20" />

              {/* Heart Button */}
              <button
                onClick={() => {/* TODO: Add favorite functionality */}}
                className="p-2.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20
                         hover:bg-pink-500/30 hover:border-pink-400/50 
                         transition-all duration-200 group"
              >
                <Heart className="w-5 h-5 text-slate-700 dark:text-white/70 group-hover:text-pink-500 dark:group-hover:text-pink-400 transition-colors" />
              </button>

              {/* Share Button */}
              <button
                onClick={() => {/* TODO: Add share functionality */}}
                className="p-2.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20
                         hover:bg-cyan-500/30 hover:border-cyan-400/50 
                         transition-all duration-200 group"
              >
                <Share2 className="w-5 h-5 text-slate-700 dark:text-white/70 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors" />
              </button>

              {/* Download Button */}
              <button
                onClick={() => {/* TODO: Add download functionality */}}
                className="p-2.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20
                         hover:bg-teal-500/30 hover:border-teal-400/50 
                         transition-all duration-200 group"
              >
                <Download className="w-5 h-5 text-slate-700 dark:text-white/70 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors" />
              </button>

              {/* Delete Button */}
              <button
                onClick={() => {/* TODO: Add delete functionality */}}
                className="p-2.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20
                         hover:bg-red-500/30 hover:border-red-400/50 
                         transition-all duration-200 group"
              >
                <Trash2 className="w-5 h-5 text-slate-700 dark:text-white/70 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
              </button>

              <div className="w-px h-6 bg-purple-400/20 dark:bg-cyan-400/20" />

              {/* More Options Button */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="p-2.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20
                           hover:bg-slate-500/30 hover:border-slate-400/50 
                           transition-all duration-200 group"
                >
                  <MoreVertical className="w-5 h-5 text-slate-700 dark:text-white/70 group-hover:text-slate-600 dark:group-hover:text-white transition-colors" />
                </button>

                {/* More Options Dropdown */}
                <AnimatePresence>
                  {showMoreOptions && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      style ={{ willChange: "opacity, transform" }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full right-0 mb-2 glass-panel border-2 border-purple-400/40 dark:border-cyan-400/40 
                                 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden z-50 min-w-[200px]"
                    >
                      <div className="py-2">
                        {/* Slideshow */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            // TODO: Add slideshow functionality
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 
                                   text-slate-700 dark:text-white/80 transition-all duration-200"
                        >
                          <Play className="w-4 h-4" />
                          <span className="text-sm font-medium">Slideshow</span>
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            // TODO: Add edit functionality
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 
                                   text-slate-700 dark:text-white/80 transition-all duration-200"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="text-sm font-medium">Edit</span>
                        </button>

                        <div className="h-px bg-purple-400/20 dark:bg-cyan-400/20 my-1 mx-2" />

                        {/* Rotate Left */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            // TODO: Add rotate left functionality
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 
                                   text-slate-700 dark:text-white/80 transition-all duration-200"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="text-sm font-medium">Rotate Left</span>
                        </button>

                        {/* Rotate Right */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            // TODO: Add rotate right functionality
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 
                                   text-slate-700 dark:text-white/80 transition-all duration-200"
                        >
                          <RotateCw className="w-4 h-4" />
                          <span className="text-sm font-medium">Rotate Right</span>
                        </button>

                        <div className="h-px bg-purple-400/20 dark:bg-cyan-400/20 my-1 mx-2" />

                        {/* Add to Album */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            // TODO: Add to album functionality
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 
                                   text-slate-700 dark:text-white/80 transition-all duration-200"
                        >
                          <FolderPlus className="w-4 h-4" />
                          <span className="text-sm font-medium">Add to Album</span>
                        </button>

                        {/* Add/Edit Location */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            // TODO: Add/edit location functionality
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 
                                   text-slate-700 dark:text-white/80 transition-all duration-200"
                        >
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm font-medium">Add/Edit Location</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              </div>
            </div>

            {/* Zoom In Button - Right Outside */}
            <button
              onClick={handleZoomIn}
              disabled={scale >= 5}
              className={`p-3 glass-panel rounded-full border border-purple-400/30 dark:border-cyan-400/30
                       shadow-lg transition-all duration-200 ml-4
                       ${scale >= 5 
                         ? 'opacity-50 cursor-not-allowed text-slate-400 dark:text-white/30' 
                         : 'text-slate-700 dark:text-white/80 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 hover:border-purple-400/50 dark:hover:border-cyan-400/50 hover:scale-110'
                       }`}
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
  );
};

export default ImageViewer;
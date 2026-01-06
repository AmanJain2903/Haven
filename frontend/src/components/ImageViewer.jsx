import { X, ChevronLeft, ChevronRight, Calendar, MapPin, Info, Heart, Share2, Download, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

const ImageViewer = ({ photo, onClose, onNext, onPrev, currentIndex, totalPhotos }) => {
  const { isDark } = useTheme();
  const [direction, setDirection] = useState(0);
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  const [showMetadata, setShowMetadata] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  if (!photo) return null;

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
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      {/* Static Background with Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br 
                     from-gray-100 via-gray-50 to-slate-100
                     dark:from-slate-950 dark:via-slate-900 dark:to-black"
      />

      {/* Glassmorphism Overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-white/10 dark:bg-black/20" />
      
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
                  key={photo.id} 
                  className="relative flex items-center justify-center"
                  animate={{ 
                    scale: scale,
                    x: position.x,
                    y: position.y
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {/* Thumbnail - shown immediately, constrained */}
                  {!imageLoaded && (
                    <motion.img 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      src={photo.thumbnail_url} 
                      alt={photo.filename}
                      className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl blur-sm"
                    />
                  )}
                  
                  {/* Full image - loads in background, can be larger */}
                  <motion.img 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: imageLoaded ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    src={photo.image_url} 
                    alt={photo.filename}
                    onLoad={() => setImageLoaded(true)}
                    className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl select-none"
                    style={{ display: imageLoaded ? 'block' : 'none' }}
                    draggable={false}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* --- Zoom Controls --- */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 z-50">
            <button
              onClick={handleZoomIn}
              disabled={scale >= 5}
              className="p-3 glass-panel rounded-full border border-purple-400/30 dark:border-cyan-400/30
                       text-slate-700 dark:text-white/80 
                       hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                       hover:border-purple-400/50 dark:hover:border-cyan-400/50
                       hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg transition-all duration-200"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-3 glass-panel rounded-full border border-purple-400/30 dark:border-cyan-400/30
                       text-slate-700 dark:text-white/80 
                       hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                       hover:border-purple-400/50 dark:hover:border-cyan-400/50
                       hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg transition-all duration-200"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            {scale > 1 && (
              <button
                onClick={handleResetZoom}
                className="p-3 glass-panel rounded-full border border-purple-400/30 dark:border-cyan-400/30
                         text-slate-700 dark:text-white/80 
                         hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                         hover:border-purple-400/50 dark:hover:border-cyan-400/50
                         hover:scale-110
                         shadow-lg transition-all duration-200"
              >
                <span className="text-xs font-bold">1:1</span>
              </button>
            )}
          </div>

          {/* --- Metadata Overlay (Bottom) --- */}
          <AnimatePresence>
            {showMetadata && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-32 left-0 right-0 flex justify-center z-50"
              >
                <div 
                  className="glass-panel border-2 border-purple-400/30 dark:border-cyan-400/30 
                             rounded-2xl px-8 py-4 
                             flex items-center gap-6 text-sm 
                             text-slate-700 dark:text-white/90 
                             shadow-2xl backdrop-blur-xl"
                  style={{ whiteSpace: 'nowrap' }}
                >
                
                {/* Date */}
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-purple-500/10 dark:bg-cyan-500/10">
                    <Calendar className="w-4 h-4 text-purple-600 dark:text-cyan-400" />
                  </div>
                  <span className="font-medium">{new Date(photo.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                
                {/* Location (Only if exists) */}
                {photo.latitude && (
                  <div className="flex items-center gap-2 border-l-2 border-purple-400/20 dark:border-cyan-400/20 pl-6">
                    <div className="p-2 rounded-full bg-green-500/10 dark:bg-teal-500/10">
                      <MapPin className="w-4 h-4 text-green-600 dark:text-teal-400" />
                    </div>
                    <span className="font-medium">{photo.latitude.toFixed(3)}, {photo.longitude.toFixed(3)}</span>
                  </div>
                )}
                
                {/* Filename */}
                <div className="hidden md:flex items-center gap-2 border-l-2 border-purple-400/20 dark:border-cyan-400/20 pl-6">
                  <div className="p-2 rounded-full bg-indigo-500/10 dark:bg-blue-500/10">
                    <Info className="w-4 h-4 text-indigo-600 dark:text-blue-400" />
                  </div>
                  <span className="truncate max-w-[200px] font-medium">{photo.filename}</span>
                </div>
              </div>
            </motion.div>
            )}
          </AnimatePresence>

          {/* --- Action Buttons (Bottom) --- */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-50">
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

              <div className="w-px h-6 bg-purple-400/20 dark:bg-cyan-400/20" />

              {/* Delete Button */}
              <button
                onClick={() => {/* TODO: Add delete functionality */}}
                className="p-2.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20
                         hover:bg-red-500/30 hover:border-red-400/50 
                         transition-all duration-200 group"
              >
                <Trash2 className="w-5 h-5 text-slate-700 dark:text-white/70 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
  );
};

export default ImageViewer;
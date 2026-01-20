import { X, ChevronLeft, ChevronRight, Calendar, MapPin, Info, Play, Pause, Volume2, VolumeX, Maximize, Camera, Timer, FileCode, HardDrive, Clock, MoreVertical, Edit, FolderPlus } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../api';
import { formatFileSize } from '../utils/fileUtils';
import FavoriteButton from './FavoriteButton';
import ShareButton from './ShareButton';
import DownloadButton from './DownloadButton';
import DeleteButton from './DeleteButton';
import EditLocationModal from './EditLocationModal';

const VideoViewer = ({ video, onClose, onNext, onPrev, currentIndex, totalVideos, onFavoriteToggle, onLocationUpdate, isAddToAlbumModalOpen, setIsAddToAlbumModalOpen, onDelete, isSlideshowActive = false, isSlideshowPaused = false, pauseSlideshow, endSlideshow }) => {
  const { isDark } = useTheme();
  
  const [activeVideo, setActiveVideo] = useState(video);
  const [direction, setDirection] = useState(0);
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [isEditLocationModalOpen, setIsEditLocationModalOpen] = useState(false);
  
  // Video-specific states
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const lastSeekTime = useRef(0);
  
  // Hover states for auto-hiding controls
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  
  // Debounced media loading
  const [shouldLoadMedia, setShouldLoadMedia] = useState(false);
  
  // Determine if bottom controls should be visible
  // Show if: paused OR (playing AND hovering video/controls)
  // Hide if: metadata overlay or more options dropdown is open
  const shouldShowControls = (!isPlaying || isHoveringVideo || isHoveringControls) && !showMetadata && !showMoreOptions;
  
  // --- DEBOUNCE MEDIA LOADING TO PREVENT QUEUE BUILDUP ---
  useEffect(() => {
    if (!video) return;

    // Cancel any in-flight video loads
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load(); // Reset the video element
    }

    // Reset media loading state immediately on navigation
    setShouldLoadMedia(false);

    // Delay media loading by 150ms - if user navigates again, this gets cancelled
    const mediaLoadTimer = setTimeout(() => {
      setShouldLoadMedia(true);
    }, 150);

    return () => {
      clearTimeout(mediaLoadTimer);
      // Final cleanup: cancel any pending video loads
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, [video]);

  // Fetch details logic
  useEffect(() => {
    if (!video) return;
    setActiveVideo(video);

    let isMounted = true;

    const fetchDetailedData = async () => {
      try {
        const details = await api.getVideoDetails(video.id);
        if (isMounted && details && String(details.id) === String(video.id)) {
          setActiveVideo(details);
        }
      } catch (error) {
        console.error("Failed to fetch detailed video data, using fallback.", error);
      }
    };

    fetchDetailedData();
    return () => { isMounted = false; };
  }, [video]);

  if (!activeVideo) return null;

  const hasNext = currentIndex < totalVideos - 1;
  const hasPrev = currentIndex > 0;

  // Update direction based on index change
  useEffect(() => {
    if (currentIndex !== prevIndex) {
      setDirection(currentIndex > prevIndex ? 1 : -1);
      setPrevIndex(currentIndex);
      setIsPlaying(false); // Pause when changing videos
      setCurrentTime(0);
      lastSeekTime.current = 0;
    }
  }, [currentIndex, prevIndex]);

  const handleNext = () => {
    if (hasNext) {
      setDuration(0);
      onNext();
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setDuration(0);
      onPrev();
    }
  };

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleTimeUpdate = () => {
    // 1. If dragging, we strictly rely on the slider input, ignore video.
    if (isDragging) return;

    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Called repeatedly while dragging
  const handleSeekChange = (e) => {
    const newTime = parseFloat(e.target.value);
    
    // 1. Update the UI instantly so it feels responsive
    setCurrentTime(newTime);
    
    // 2. Force the "ignore" buffer to stay active
    lastSeekTime.current = Date.now(); 
    
    // 3. Scrub the video engine (optional: wrap in throttle if performance is bad)
    if (videoRef.current) {
        // Check if finite to prevent crashes
        if (Number.isFinite(newTime)) {
            videoRef.current.currentTime = newTime;
        }
    }
};

const handleSeekStart = () => {
  setIsDragging(true);
  // Pause video while scrubbing for smoother experience (optional but recommended)
  // if (videoRef.current && !videoRef.current.paused) videoRef.current.pause(); 
};

const handleSeekEnd = () => {
  setIsDragging(false);
  // Refresh the buffer timestamp one last time
  lastSeekTime.current = Date.now();
  
  // If you paused on start, you could resume here:
  // if (isPlaying && videoRef.current) videoRef.current.play();
};

  // 4. Video Engine Event: "I am trying to find that frame"
  const handleVideoSeeking = () => {
    setIsSeeking(true);
  };

  // 5. Video Engine Event: "I found the frame"
  const handleVideoSeeked = () => {
    setIsSeeking(false);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, currentIndex, hasNext, hasPrev, isPlaying]);

  // Prevent scrolling the background page
  useEffect(() => {
    // Prevent scrolling on both body and html
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      // Restore overflow
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // Auto-hide "Coming Soon" message after 2 seconds
  useEffect(() => {
    if (showComingSoon) {
      const timer = setTimeout(() => {
        setShowComingSoon(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showComingSoon]);

  // Slideshow: Auto-play video when active
  useEffect(() => {
    if (isSlideshowActive && !isSlideshowPaused && videoRef.current && shouldLoadMedia) {
      videoRef.current.play().catch(err => console.log("Auto-play failed:", err));
      setIsPlaying(true);
    }
  }, [isSlideshowActive, isSlideshowPaused, shouldLoadMedia]);

  // Slideshow: Handle pause state
  useEffect(() => {
    if (isSlideshowActive && videoRef.current) {
      if (isSlideshowPaused && isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else if (!isSlideshowPaused && !isPlaying) {
        videoRef.current.play().catch(err => console.log("Resume play failed:", err));
        setIsPlaying(true);
      }
    }
  }, [isSlideshowPaused, isSlideshowActive]);

  // Slideshow: Handle video end - advance to next or end slideshow
  const handleVideoEnded = () => {
    setIsPlaying(false);
    
    if (isSlideshowActive && !isSlideshowPaused) {
      if (currentIndex < totalVideos - 1) {
        // Move to next media
        handleNext();
      } else {
        // End of slideshow
        if (endSlideshow) {
          endSlideshow();
        }
      }
    }
  };

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
          
          {/* Close Button */}
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

          {/* Video Counter */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 
                         glass-panel border-2 border-purple-400/30 dark:border-cyan-400/30 
                         rounded-full px-6 py-2 
                         text-sm font-medium
                         text-slate-700 dark:text-white/90 
                         shadow-lg backdrop-blur-xl z-50">
            <span className="text-purple-600 dark:text-cyan-400">{currentIndex + 1}</span>
            <span className="mx-1.5 text-slate-400 dark:text-white/40">/</span>
            <span>{totalVideos}</span>
          </div>

          {/* Navigation Arrows */}
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

          {/* Main Video */}
          <div className="flex h-full w-full max-w-7xl items-center justify-center p-4 md:p-12 overflow-hidden">
            <div className="relative glass-panel rounded-3xl p-4 border-2 border-purple-400/30 dark:border-cyan-400/30 shadow-2xl overflow-hidden">
              
              <AnimatePresence mode="wait" initial={false}>
                <motion.div 
                  key={String(activeVideo.id)}
                  className="relative flex items-center justify-center"
                  onMouseEnter={() => setIsHoveringVideo(true)}
                  onMouseLeave={() => setIsHoveringVideo(false)}
                >
                  <video
                    ref={videoRef}
                    src={shouldLoadMedia ? api.getVideoUrl(activeVideo.id) : undefined}
                    className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleVideoEnded}
                    onSeeking={handleVideoSeeking}
                    onSeeked={handleVideoSeeked}
                    poster={api.getVideoThumbnailUrl(activeVideo.id)}
                  />
                   
                  {/* Play/Pause Overlay (centered) - Show when paused OR hovering while playing */}
                  <AnimatePresence>
                    {shouldShowControls && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ willChange: "opacity" }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        onClick={togglePlay}
                      >
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-sm 
                                   flex items-center justify-center border-2 border-white/30
                                   shadow-2xl hover:scale-110 transition-all duration-200"
                        >
                          {isPlaying ? (
                            <Pause className="w-10 h-10 text-white" fill="white" />
                          ) : (
                            <Play className="w-10 h-10 text-white ml-1" fill="white" />
                          )}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>

              {/* Video Controls (inside video container, at bottom) */}
              <AnimatePresence>
                {shouldShowControls && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ willChange: "opacity, transform" }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-5 left-0 right-0 p-4"
                    onMouseEnter={() => setIsHoveringControls(true)}
                    onMouseLeave={() => setIsHoveringControls(false)}
                  >
                    <div className="glass-panel rounded-2xl p-4 border border-purple-400/20 dark:border-cyan-400/20">
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <input
                      type="range"
                      onMouseDown={handleSeekStart}
                      onMouseUp={handleSeekEnd}
                      onTouchStart={handleSeekStart}
                      onTouchEnd={handleSeekEnd}
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeekChange}
                      className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:accent-cyan-400"
                    />
                    <div className="flex justify-between text-xs text-slate-600 dark:text-white/60 mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                  
                  {/* Control Buttons */}
                  <div className="flex items-center gap-4">
                    {/* Play/Pause */}
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-full bg-purple-500/20 dark:bg-cyan-500/20 
                               hover:bg-purple-500/30 dark:hover:bg-cyan-500/30
                               transition-all duration-200"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 text-purple-600 dark:text-cyan-400" />
                      ) : (
                        <Play className="w-5 h-5 text-purple-600 dark:text-cyan-400" fill="currentColor" />
                      )}
                    </button>

                    {/* Volume Control */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleMute}
                        className="p-2 rounded-full hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                                 transition-all duration-200"
                      >
                        {isMuted ? (
                          <VolumeX className="w-5 h-5 text-slate-700 dark:text-white/70" />
                        ) : (
                          <Volume2 className="w-5 h-5 text-slate-700 dark:text-white/70" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:accent-cyan-400"
                      />
                    </div>

                    <div className="flex-1" />

                    {/* Fullscreen Button */}
                    <button
                      onClick={() => videoRef.current?.requestFullscreen()}
                      className="p-2 rounded-full hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                               transition-all duration-200"
                    >
                      <Maximize className="w-5 h-5 text-slate-700 dark:text-white/70" />
                    </button>
                  </div>
                </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Metadata Overlay (Bottom) */}
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
                      <span className="font-medium truncate max-w-[180px]">{activeVideo.filename}</span>
                    </div>
                  </div>

                  {/* File Size */}
                  {activeVideo.metadata?.size_bytes && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-500/10 dark:bg-violet-500/10">
                        <HardDrive className="w-4 h-4 text-purple-600 dark:text-violet-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">File Size</span>
                        <span className="font-medium">
                          {formatFileSize(activeVideo.metadata.size_bytes)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dimensions */}
                  {activeVideo.metadata?.width && activeVideo.metadata?.height && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-500/10 dark:bg-sky-500/10">
                      <Maximize className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Resolution</span>
                        <span className="font-medium">{activeVideo.metadata.width}px × {activeVideo.metadata.height}px</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2: Video Details */}
                <div className="flex flex-col gap-3">
                  {/* Camera Make & Model */}
                  {activeVideo.metadata?.camera_make || activeVideo.metadata?.camera_model && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-500/10 dark:bg-yellow-500/10">
                        <Camera className="w-4 h-4 text-amber-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Camera</span>
                        <span className="font-medium">{activeVideo.metadata.camera_make} {activeVideo.metadata.camera_model}</span>
                      </div>
                    </div>
                  )}

                  {/* FPS */}
                  {activeVideo.metadata?.fps && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-500/10 dark:bg-green-500/10">
                        <Timer className="w-4 h-4 text-emerald-600 dark:text-green-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">FPS</span>
                        <span className="font-medium">{Math.round(activeVideo.metadata.fps)} fps</span>
                      </div>
                    </div>
                  )}

                  {/* Codec */}
                  {activeVideo.metadata?.codec && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-pink-500/10 dark:bg-rose-500/10">
                        <FileCode className="w-4 h-4 text-pink-600 dark:text-rose-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Codec</span>
                        <span className="font-medium">{activeVideo.metadata.codec}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 3: Location & Date */}
                <div className="flex flex-col gap-3">
                  {/* Location */}
                  {(activeVideo.city || activeVideo.state || activeVideo.country) && (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-500/10 dark:bg-teal-500/10">
                        <MapPin className="w-4 h-4 text-green-600 dark:text-teal-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-70">Location</span>
                        <span className="font-medium">
                          {[activeVideo.city, activeVideo.state, activeVideo.country].filter(Boolean).join(', ')}
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
                      <span className="font-medium">{new Date(activeVideo.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
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
                        {new Date(activeVideo.date).toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons (Bottom) */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center items-end z-50">
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

              {/* Slideshow Controls */}
              {isSlideshowActive && (
                <>
                  <div className="w-px h-6 bg-purple-400/20 dark:bg-cyan-400/20" />
                  
                  {/* Pause/Resume Button */}
                  <button
                    onClick={pauseSlideshow}
                    className="p-2.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20 
                             hover:bg-amber-500/30 dark:hover:bg-amber-500/20
                             hover:border-amber-400/50 dark:hover:border-amber-400/40
                             transition-all duration-200"
                    title={isSlideshowPaused ? "Resume Slideshow" : "Pause Slideshow"}
                  >
                    {isSlideshowPaused ? (
                      <Play className="w-5 h-5 text-slate-700 dark:text-white/70" />
                    ) : (
                      <Pause className="w-5 h-5 text-slate-700 dark:text-white/70" />
                    )}
                  </button>

                  {/* End Slideshow Button */}
                  <button
                    onClick={endSlideshow}
                    className="p-2.5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20 
                             hover:bg-red-500/30 dark:hover:bg-red-500/20
                             hover:border-red-400/50 dark:hover:border-red-400/40
                             transition-all duration-200"
                    title="End Slideshow"
                  >
                    <X className="w-5 h-5 text-slate-700 dark:text-white/70" />
                  </button>
                </>
              )}

              <div className="w-px h-6 bg-purple-400/20 dark:bg-cyan-400/20" />

              {/* Heart Button */}
              <FavoriteButton 
                id={activeVideo.id}
                type="video"
                initialFavorite={activeVideo.is_favorite}
                size="large"
                onToggle={onFavoriteToggle}
              />

              {/* Share Button */}
              <ShareButton 
                id={activeVideo.id}
                type="video"
                size="large"
              />

              {/* Download Button */}
              <DownloadButton 
                id={activeVideo.id}
                type="video"
                size="large"
              />

              {/* Delete Button */}
              <DeleteButton 
                key={`delete-${activeVideo.id}`}
                id={activeVideo.id}
                type="video"
                size="large"
                onSuccess={(deletedId, deletedType) => {
                  // First, update global state (remove from arrays, update counts)
                  if (onDelete) {
                    onDelete(deletedId, deletedType);
                  }
                  
                  // Then navigate to next file or close viewer
                  if (currentIndex < totalVideos - 1) {
                    // Move to next file
                    onNext();
                  } else if (currentIndex > 0) {
                    // No next, move to previous
                    onPrev();
                  } else {
                    // No files left, close viewer
                    onClose();
                  }
                }}
              />

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
                        {/* Edit */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            setShowComingSoon(true);
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 
                                   text-slate-700 dark:text-white/80 transition-all duration-200"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="text-sm font-medium">Edit</span>
                        </button>

                        <div className="h-px bg-purple-400/20 dark:bg-cyan-400/20 my-1 mx-2" />

                        {/* Add to Album */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            setIsAddToAlbumModalOpen(true);
                          }}
                          className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-500/20 dark:hover:bg-cyan-500/20 
                                   text-slate-700 dark:text-white/80 transition-all duration-200"
                        >
                          <FolderPlus className="w-4 h-4" />
                          <span className="text-sm font-medium">Manage Albums</span>
                        </button>

                        {/* Add/Edit Location */}
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            setIsEditLocationModalOpen(true);
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

          {/* Coming Soon Overlay */}
          <AnimatePresence>
            {showComingSoon && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ willChange: "opacity, transform" }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, type: "spring" }}
                className="absolute inset-0 flex items-center justify-center z-[200] pointer-events-none"
              >
                <div className="glass-panel border-2 border-purple-400/50 dark:border-cyan-400/50 
                               rounded-2xl px-8 py-4 shadow-2xl backdrop-blur-xl pointer-events-auto">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 
                                dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">
                    Coming Soon !!
                  </h2>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Edit Location Modal */}
        <EditLocationModal
          isOpen={isEditLocationModalOpen}
          onClose={() => setIsEditLocationModalOpen(false)}
          fileType="video"
          fileId={activeVideo.id}
          onSuccess={() => {
            // Notify parent grid to refresh
            if (onLocationUpdate) {
              onLocationUpdate();
            }
          }}
        />

      </motion.div>
  );
};

export default VideoViewer;


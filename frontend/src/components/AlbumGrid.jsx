import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { processTimelineData } from "../utils/timelineUtils";
import ImageViewer from "./ImageViewer";
import VideoViewer from "./VideoViewer";
import RawImageViewer from "./RawImageViewer";
import { api } from "../api";
import formatTime from "../utils/timeUtils";
import { formatFileSize } from "../utils/fileUtils";
import FavoriteButton from "./FavoriteButton";
import ShareButton from "./ShareButton";
import DownloadButton from "./DownloadButton";
import DeleteButton from "./DeleteButton";
import EditAlbumModal from "./EditAlbumModal";
import DeleteAlbumModal from "./DeleteAlbumModal";
import AddFilesToAlbumModal from "./AddFilesToAlbumModal";
import { Download, Edit, Trash2, Plus, Image as ImageIcon, ArrowLeft, Folder, HardDrive, Clock, RefreshCw, MapPin, Video, FileImage, Info, ImagePlus, X, Frame } from "lucide-react";
import { format } from "date-fns";
import SearchBar from "./SearchBar";

// PhotoCard component for images
function PhotoCard({ photo, index, onClick, onFavoriteToggle, onRemove, onSetCover, isCurrentCover }) {
  const [isHovered, setIsHovered] = useState(false);

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(photo.id, "image");
    }
  };

  const handleSetCoverClick = (e) => {
    e.stopPropagation();
    if (onSetCover) {
      onSetCover(photo.id, "image");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        type: "spring",
        stiffness: 100,
        damping: 12,
      }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      className="relative group cursor-pointer h-full w-full"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl h-64 w-full
          transition-all duration-500
          ${
            isHovered
              ? "shadow-glow-cyan border-2 border-purple-400/50 dark:border-cyan-400/40"
              : "shadow-xl border-2 border-slate-200/40 dark:border-white/10"
          }
        `}
      >
        {/* Action Buttons - Top Left */}
        {isHovered && (
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <button
              onClick={handleRemoveClick}
              className="p-1.5 rounded-full bg-red-500/90 hover:bg-red-600 
                       border-2 border-white/30 shadow-lg
                       transition-all duration-200 hover:scale-110"
            >
              <X className="w-4 h-4 text-white" strokeWidth={2.5} />
            </button>
            
            {/* Set as Cover button - only show when NOT current cover */}
            {!isCurrentCover && (
              <button
                onClick={handleSetCoverClick}
                className="p-1.5 rounded-full bg-purple-500/90 dark:bg-cyan-500/90 
                         hover:bg-purple-600 dark:hover:bg-cyan-600
                         border-2 border-white/30 shadow-lg
                         transition-all duration-200 hover:scale-110"
                title="Set as album cover"
              >
                <ImagePlus className="w-4 h-4 text-white" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
        {/* Floating Favorite Button - Top Right (when favorited) */}
        {photo.is_favorite && (
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton 
              id={photo.id}
              type="image"
              initialFavorite={photo.is_favorite}
              size="small"
              onToggle={onFavoriteToggle}
            />
          </div>
        )}

        {/* Image */}
        <img
          src={photo.thumbnail_url}
          alt={photo.filename}
          className="w-full h-full object-cover"
          loading="eager"
          decoding="async"
        />

        {/* Gradient Overlay */}
        <div
          className={`
            absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
            transition-opacity duration-500
            ${isHovered ? "opacity-100" : "opacity-0"}
          `}
        />

        {/* Content Overlay */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
          style={{ willChange: "opacity, transform" }}
          transition={{ duration: 0.3 }}
          className="absolute inset-x-0 bottom-0 p-4"
        >
          <div className="space-y-1">
            {(photo.city || photo.state || photo.country) && (
              <p className="text-white font-semibold text-sm tracking-wide drop-shadow-lg">
                {[photo.city, photo.state, photo.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}

            {photo.metadata?.camera_model && (
              <p className="text-purple-300 dark:text-cyan-300 text-xs font-bold flex items-center gap-1">
                {photo.metadata.camera_model}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <FavoriteButton 
              id={photo.id}
              type="image"
              initialFavorite={photo.is_favorite}
              size="small"
              onToggle={onFavoriteToggle}
            />

            <ShareButton 
              id={photo.id}
              type="image"
              size="small"
            />

            <DownloadButton 
              id={photo.id}
              type="image"
              size="small"
            />

            <div className="flex-1" />

            <DeleteButton 
              id={photo.id}
              type="image"
              size="small"
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// VideoCard component for videos
function VideoCard({ video, index, onClick, onFavoriteToggle, onRemove, onSetCover, isCurrentCover }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewRef = useRef(null);
  const previewTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    previewTimeoutRef.current = setTimeout(() => {
      if (previewRef.current) {
        previewRef.current.play().catch(e => console.log("Preview play failed:", e));
        setIsPreviewPlaying(true);
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPreviewPlaying(false);
    
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.currentTime = 0;
    }
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(video.id, "video");
    }
  };

  const handleSetCoverClick = (e) => {
    e.stopPropagation();
    if (onSetCover) {
      onSetCover(video.id, "video");
    }
  };

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        type: "spring",
        stiffness: 100,
        damping: 12,
      }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      onHoverStart={handleMouseEnter}
      onHoverEnd={handleMouseLeave}
      onClick={onClick}
      className="relative group cursor-pointer h-full w-full"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl h-64 w-full
          transition-all duration-500
          ${
            isHovered
              ? "shadow-glow-cyan border-2 border-purple-400/50 dark:border-cyan-400/40"
              : "shadow-xl border-2 border-slate-200/40 dark:border-white/10"
          }
        `}
      >
        {/* Action Buttons - Top Left */}
        {isHovered && (
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <button
              onClick={handleRemoveClick}
              className="p-1.5 rounded-full bg-red-500/90 hover:bg-red-600 
                       border-2 border-white/30 shadow-lg
                       transition-all duration-200 hover:scale-110"
            >
              <X className="w-4 h-4 text-white" strokeWidth={2.5} />
            </button>
            
            {/* Set as Cover button - only show when NOT current cover */}
            {!isCurrentCover && (
              <button
                onClick={handleSetCoverClick}
                className="p-1.5 rounded-full bg-purple-500/90 dark:bg-cyan-500/90 
                         hover:bg-purple-600 dark:hover:bg-cyan-600
                         border-2 border-white/30 shadow-lg
                         transition-all duration-200 hover:scale-110"
                title="Set as album cover"
              >
                <ImagePlus className="w-4 h-4 text-white" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        {/* Floating Favorite Button - Top Right (when favorited) */}
        {video.is_favorite && (
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton 
              id={video.id}
              type="video"
              initialFavorite={video.is_favorite}
              size="small"
              onToggle={onFavoriteToggle}
            />
          </div>
        )}

        {/* Video Thumbnail */}
        <img
          src={api.getVideoThumbnailUrl(video.id)}
          alt={video.filename}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isPreviewPlaying ? 'opacity-0' : 'opacity-100'}`}
          loading="eager"
          decoding="async"
        />

        {/* Preview Video */}
        <video
          ref={previewRef}
          src={api.getVideoPreviewUrl(video.id)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isPreviewPlaying ? 'opacity-100' : 'opacity-0'}`}
          loop
          muted
          playsInline
          preload="none"
        />

        {/* Play Icon Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ scale: 0.8, opacity: 0.6 }}
            animate={{ 
              scale: isHovered ? (isPreviewPlaying ? 0.9 : 1.1) : 1,
              opacity: isPreviewPlaying ? 0.3 : (isHovered ? 1 : 0.8)
            }}
            transition={{ duration: 0.3 }}
            className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm 
                     flex items-center justify-center border-2 border-white/30
                     shadow-2xl"
          >
            {isPreviewPlaying ? (
              <Pause className="w-8 h-8 text-white" fill="white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" fill="white" />
            )}
          </motion.div>
        </div>

        {/* Gradient Overlay */}
        <div
          className={`
            absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
            transition-opacity duration-500
            ${isHovered ? "opacity-100" : "opacity-0"}
          `}
        />

        {/* Content Overlay */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
          style={{ willChange: "opacity, transform" }}
          transition={{ duration: 0.3 }}
          className="absolute inset-x-0 bottom-0 p-4"
        >
          <div className="space-y-1">
            {(video.city || video.state || video.country) && (
              <p className="text-white font-semibold text-sm tracking-wide drop-shadow-lg">
                {[video.city, video.state, video.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}

            {video.metadata?.camera_model && (
              <p className="text-purple-300 dark:text-cyan-300 text-xs font-bold flex items-center gap-1">
                {video.metadata.camera_model}
              </p>
            )}

            {video.duration && (
              <p className="text-purple-300 dark:text-cyan-300 text-xs font-bold flex items-center gap-2">
                <span>{formatTime(video.duration)}</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <FavoriteButton 
              id={video.id}
              type="video"
              initialFavorite={video.is_favorite}
              size="small"
              onToggle={onFavoriteToggle}
            />

            <ShareButton 
              id={video.id}
              type="video"
              size="small"
            />

            <DownloadButton 
              id={video.id}
              type="video"
              size="small"
            />

            <div className="flex-1" />

            <DeleteButton 
              id={video.id}
              type="video"
              size="small"
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// RawImageCard component for raw images
function RawImageCard({ rawImage, index, onClick, onFavoriteToggle, onRemove, onSetCover, isCurrentCover }) {
  const [isHovered, setIsHovered] = useState(false);

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(rawImage.id, "raw");
    }
  };

  const handleSetCoverClick = (e) => {
    e.stopPropagation();
    if (onSetCover) {
      onSetCover(rawImage.id, "raw");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        type: "spring",
        stiffness: 100,
        damping: 12,
      }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      className="relative group cursor-pointer h-full w-full"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl h-64 w-full
          transition-all duration-500
          ${
            isHovered
              ? "shadow-glow-cyan border-2 border-purple-400/50 dark:border-cyan-400/40"
              : "shadow-xl border-2 border-slate-200/40 dark:border-white/10"
          }
        `}
      >
        {/* Action Buttons - Top Left */}
        {isHovered && (
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <button
              onClick={handleRemoveClick}
              className="p-1.5 rounded-full bg-red-500/90 hover:bg-red-600 
                       border-2 border-white/30 shadow-lg
                       transition-all duration-200 hover:scale-110"
            >
              <X className="w-4 h-4 text-white" strokeWidth={2.5} />
            </button>
            
            {/* Set as Cover button - only show when NOT current cover */}
            {!isCurrentCover && (
              <button
                onClick={handleSetCoverClick}
                className="p-1.5 rounded-full bg-purple-500/90 dark:bg-cyan-500/90 
                         hover:bg-purple-600 dark:hover:bg-cyan-600
                         border-2 border-white/30 shadow-lg
                         transition-all duration-200 hover:scale-110"
                title="Set as album cover"
              >
                <ImagePlus className="w-4 h-4 text-white" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}

        {/* Floating Favorite Button - Top Right (when favorited) */}
        {rawImage.is_favorite && (
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton 
              id={rawImage.id}
              type="raw"
              initialFavorite={rawImage.is_favorite}
              size="small"
              onToggle={onFavoriteToggle}
            />
          </div>
        )}

        {/* Image Thumbnail */}
        <img
          src={api.getRawThumbnailUrl(rawImage.id)}
          alt={rawImage.filename}
          className="w-full h-full object-cover"
          loading="eager"
          decoding="async"
        />

        {/* Gradient Overlay */}
        <div
          className={`
            absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
            transition-opacity duration-500
            ${isHovered ? "opacity-100" : "opacity-0"}
          `}
        />

        {/* Content Overlay */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
          style={{ willChange: "opacity, transform" }}
          transition={{ duration: 0.3 }}
          className="absolute inset-x-0 bottom-0 p-4"
        >
          <div className="space-y-1">
            {(rawImage.city || rawImage.state || rawImage.country) && (
              <p className="text-white font-semibold text-sm tracking-wide drop-shadow-lg">
                {[rawImage.city, rawImage.state, rawImage.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}

            {rawImage.metadata?.camera_model && (
              <p className="text-purple-300 dark:text-cyan-300 text-xs font-bold flex items-center gap-1">
                {rawImage.metadata.camera_model}
              </p>
            )}

            {rawImage.metadata?.lens_model && (
              <p className="text-purple-200 dark:text-cyan-200 text-xs flex items-center gap-1">
                {rawImage.metadata.lens_model}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <FavoriteButton 
              id={rawImage.id}
              type="raw"
              initialFavorite={rawImage.is_favorite}
              size="small"
              onToggle={onFavoriteToggle}
            />

            <ShareButton 
              id={rawImage.id}
              type="raw"
              size="small"
            />

            <DownloadButton 
              id={rawImage.id}
              type="raw"
              size="small"
            />

            <div className="flex-1" />

            <DeleteButton 
              id={rawImage.id}
              type="raw"
              size="small"
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Choose Album Cover Modal Component
function ChooseAlbumCoverModal({ isOpen, onClose, albumId, albumName, currentCoverType, currentCoverId, onSetCover }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [setting, setSetting] = useState(false);

  useEffect(() => {
    if (isOpen && albumId) {
      loadAlbumFiles();
    }
  }, [isOpen, albumId]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const loadAlbumFiles = async () => {
    setLoading(true);
    try {
      // Load all files in the album
      const response = await api.getAlbumTimeline(albumId, 0, 1000); // Load up to 1000 files
      setTimeline(response.timeline || []);
    } catch (err) {
      console.error("Error loading album files:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (fileId, fileType) => {
    // Don't allow clicking the current cover
    if (currentCoverType === fileType && currentCoverId === fileId) {
      return;
    }

    setSetting(true);
    try {
      await onSetCover(fileId, fileType);
      onClose();
    } catch (err) {
      console.error("Error setting cover:", err);
    } finally {
      setSetting(false);
    }
  };

  const isCurrentCover = (fileId, fileType) => {
    return currentCoverType === fileType && currentCoverId === fileId;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className="relative glass-panel rounded-2xl p-6 max-w-6xl w-full max-h-[80vh] overflow-y-auto border-2 border-purple-400/30 dark:border-cyan-400/30 shadow-2xl"
          >
            {/* Close Button - Top Right */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full
                       hover:bg-slate-200 dark:hover:bg-slate-700
                       transition-colors z-10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-white/70" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                Choose Album Cover
              </h2>
              <p className="text-slate-600 dark:text-white/60 text-sm">
                Select a photo or video to be the cover for <span className="font-semibold text-purple-600 dark:text-cyan-400">{albumName}</span>
              </p>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
              </div>
            )}

            {/* Files Grid */}
            {!loading && timeline.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {timeline.map((file) => {
                  const isCurrent = isCurrentCover(file.id, file.type);
                  return (
                    <motion.div
                      key={`${file.type}-${file.id}`}
                      whileHover={!isCurrent ? { scale: 1.05 } : {}}
                      whileTap={!isCurrent ? { scale: 0.98 } : {}}
                      onClick={() => handleFileClick(file.id, file.type)}
                      className={`
                        relative aspect-square rounded-xl overflow-hidden
                        border-2 transition-all duration-200
                        ${isCurrent 
                          ? 'border-purple-500/60 dark:border-cyan-400/60 cursor-not-allowed' 
                          : 'border-slate-200/40 dark:border-white/10 cursor-pointer hover:border-purple-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg'
                        }
                      `}
                    >
                      {/* File Preview */}
                      {file.type === "image" && (
                        <img
                          src={file.thumbnail_url}
                          alt={file.filename}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {file.type === "video" && (
                        <img
                          src={api.getVideoThumbnailUrl(file.id)}
                          alt={file.filename}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {file.type === "raw" && (
                        <img
                          src={api.getRawThumbnailUrl(file.id)}
                          alt={file.filename}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Current Cover Overlay - Unclickable */}
                      {isCurrent && (
                        <>
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] z-10" />
                          <div className="absolute inset-0 flex items-center justify-center z-20">
                            <div className="bg-purple-500 dark:bg-cyan-400 text-white px-4 py-2 rounded-full text-sm font-bold shadow-2xl flex items-center gap-2 border-2 border-white/30">
                              <Frame className="w-5 h-5" strokeWidth={2.5} />
                              Current Cover
                            </div>
                          </div>
                        </>
                      )}

                      {/* Video Play Icon */}
                      {file.type === "video" && !isCurrent && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/30">
                            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!loading && timeline.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="w-16 h-16 text-slate-400 dark:text-slate-600 mb-3" />
                <p className="text-slate-600 dark:text-white/60">
                  No files in this album
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Confirmation Modal Component
function RemoveFromAlbumModal({ isOpen, onClose, onConfirm, fileName, albumName, loading }) {
  if (!isOpen) return null;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className="relative glass-panel rounded-2xl p-6 max-w-md w-full border-2 border-purple-400/30 dark:border-cyan-400/30 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                  Remove from Album?
                </h3>
                <p className="text-slate-600 dark:text-white/70">
                  Remove <span className="font-semibold text-purple-600 dark:text-cyan-400">{fileName}</span> from{" "}
                  <span className="font-semibold text-purple-600 dark:text-cyan-400">{albumName}</span>?
                </p>
              </div>

              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600
                           text-slate-700 dark:text-white/80 font-medium
                           hover:bg-slate-100 dark:hover:bg-slate-700
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl
                           bg-red-500 hover:bg-red-600
                           text-white font-medium
                           hover:shadow-lg hover:scale-105
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200"
                >
                  {loading ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AlbumGrid({ albumId, onClose, onFavoriteToggle, onAlbumUpdate, onAlbumDelete, searchQuery: externalSearchQuery = "", searchInputValue: externalSearchInputValue = "", onSearch, onClearSearch, updateProgressBar, removeProgressBar }) {
  const [album, setAlbum] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery);
  const [searchInputValue, setSearchInputValue] = useState(externalSearchInputValue);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const virtuosoRef = useRef(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [removingItem, setRemovingItem] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isChooseCoverModalOpen, setIsChooseCoverModalOpen] = useState(false);
  const [currentCover, setCurrentCover] = useState({ type: null, id: null });
  const [isAddFilesModalOpen, setIsAddFilesModalOpen] = useState(false);

  const LIMIT = 500;

  // Sync external search query - always keep in sync with parent
  useEffect(() => {
    setSearchQuery(externalSearchQuery);
    setSearchInputValue(externalSearchInputValue);
  }, [externalSearchQuery, externalSearchInputValue]);

  // Local favorite toggle to keep album timeline in sync with global favorites
  const handleLocalFavoriteToggle = (id, type, newFavoriteState) => {
    if (onFavoriteToggle) {
      onFavoriteToggle(id, type, newFavoriteState);
    }

    setTimeline(prev =>
      (prev || []).map(item => {
        const itemType = item.type || (type === "image" ? "image" : type === "video" ? "video" : "raw");
        if (item.id === id && itemType === type) {
          return { ...item, is_favorite: newFavoriteState };
        }
        return item;
      })
    );
  };

  // Load album data when albumId changes
  useEffect(() => {
    if (albumId) {
      loadAlbum();
      loadCurrentCover();
      // Preserve search query when switching albums - don't reset it
      // Only reset pagination state
      setSkip(0);
      setHasMore(true);
      setTimeline([]);
    }
  }, [albumId]);

  const loadCurrentCover = async () => {
    try {
      const coverData = await api.getAlbumCover(albumId);
      console.log("Loaded cover data:", coverData); // Debug log
      if (coverData && coverData.album_cover_type && coverData.album_cover_id) {
        setCurrentCover({
          type: coverData.album_cover_type,
          id: coverData.album_cover_id
        });
        console.log("Set current cover:", { type: coverData.album_cover_type, id: coverData.album_cover_id }); // Debug log
      } else {
        setCurrentCover({ type: null, id: null });
        console.log("No cover set for this album"); // Debug log
      }
    } catch (err) {
      console.error("Error loading current cover:", err);
      setCurrentCover({ type: null, id: null });
    }
  };

  // Reset skip when searchQuery changes (but preserve when albumId changes)
  useEffect(() => {
    if (!albumId) return;
    // Reset pagination when search query changes
    setSkip(0);
    setHasMore(true);
    setTimeline([]);
  }, [searchQuery]);

  // Load timeline when skip changes (after reset) or when albumId/searchQuery changes
  useEffect(() => {
    if (!albumId) return;
    
    // Use the current searchQuery state (which should be synced from external props)
    const currentQuery = searchQuery || externalSearchQuery;
    
    if (skip === 0) {
      // Initial load or search reset
      if (currentQuery) {
        searchTimeline(0, currentQuery);
      } else {
        loadTimeline(0);
      }
    } else {
      // Load more (pagination)
      if (currentQuery) {
        searchTimeline(skip, currentQuery);
      } else {
        loadTimeline(skip);
      }
    }
  }, [albumId, searchQuery, externalSearchQuery, skip]);

  const loadAlbum = async () => {
    setLoading(true);
    try {
      const data = await api.getAlbum(albumId);
      setAlbum(data);
    } catch (err) {
      console.error("Error loading album:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async (currentSkip = skip) => {
    setLoadingTimeline(true);
    try {
      const response = await api.getAlbumTimeline(albumId, currentSkip, LIMIT);
      if (currentSkip === 0) {
        setTimeline(response.timeline || []);
      } else {
        setTimeline(prev => [...prev, ...(response.timeline || [])]);
      }
      setTotalCount(response.total || 0);
      setHasMore(response.timeline && response.timeline.length === LIMIT);
    } catch (err) {
      console.error("Error loading timeline:", err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const searchTimeline = async (currentSkip = skip, queryToUse = null) => {
    setLoadingTimeline(true);
    try {
      // Use provided query, or fall back to current state, or external prop
      const currentQuery = queryToUse || searchQuery || externalSearchQuery;
      const response = await api.searchAlbums(albumId, currentQuery, currentSkip, LIMIT);
      if (currentSkip === 0) {
        setTimeline(response.albums || []);
      } else {
        setTimeline(prev => [...prev, ...(response.albums || [])]);
      }
      setTotalCount(response.total || 0);
      setHasMore(response.albums && response.albums.length === LIMIT);
    } catch (err) {
      console.error("Error searching timeline:", err);
      setTimeline([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingTimeline && hasMore) {
      setSkip(prev => prev + LIMIT);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setSearchInputValue(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleReset = () => {
    setSearchQuery("");
    setSearchInputValue("");
    if (onClearSearch) {
      onClearSearch();
    }
  };

  const sortedMedia = useMemo(() => {
    return [...timeline].sort((a, b) => {
      const dateA = new Date(a.date || a.capture_date || 0);
      const dateB = new Date(b.date || b.capture_date || 0);
      return dateB - dateA;
    });
  }, [timeline]);

  const timelineRows = useMemo(() => processTimelineData(sortedMedia, 5), [sortedMedia]);

  const getSortedIndex = (media) => sortedMedia.findIndex((m) => m.id === media.id && m.type === media.type);

  useEffect(() => {
    if (selectedMedia && virtuosoRef.current) {
      const rowIndex = timelineRows.findIndex(row => 
        row.type === 'photos' && row.items.some(m => m.id === selectedMedia.id && m.type === selectedMedia.type)
      );

      if (rowIndex !== -1) {
        virtuosoRef.current.scrollToIndex({
          index: rowIndex,
          align: 'center',
          behavior: 'auto'
        });
      }
    }
  }, [selectedMedia, timelineRows]);

  const handleMediaClick = (media) => {
    setSelectedMedia(media);
  };

  const handleClose = () => {
    setSelectedMedia(null);
  };

  const handleNext = () => {
    const currentIdx = getSortedIndex(selectedMedia);
    if (currentIdx !== -1 && currentIdx < sortedMedia.length - 1) {
      setSelectedMedia(sortedMedia[currentIdx + 1]);
    }
  };

  const handlePrev = () => {
    const currentIdx = getSortedIndex(selectedMedia);
    if (currentIdx > 0) {
      setSelectedMedia(sortedMedia[currentIdx - 1]);
    }
  };

  const formatSearchQuery = (query) => {
    if (!query) return "";
    const formatted = query
      .toLowerCase()
      .replace(/(^|\. )(\w)/g, (match) => match.toUpperCase());
    const words = formatted.split(" ");
    if (words.length > 4) {
      return words.slice(0, 4).join(" ") + "...";
    }
    return formatted;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return "N/A";
    }
  };

  const getLocationText = () => {
    if (!album) return "";
    let loc = "";
    let trucatedLoc = "";
    if (album.album_location) {
      loc =  album.album_location;
      trucatedLoc = loc.length > 16 ? loc.substring(0, 16) + "..." : loc;
      return trucatedLoc;
    }
    const parts = [album.album_city, album.album_state, album.album_country].filter(Boolean);
    loc = parts.length > 0 ? parts.join(", ") : "";
    trucatedLoc = loc.length > 16 ? loc.substring(0, 16) + "..." : loc;
    return trucatedLoc;
  };

  const handleEditSuccess = () => {
    loadAlbum();
    if (onAlbumUpdate) {
      onAlbumUpdate();
    }
  };

  const handleDeleteSuccess = () => {
    if (onAlbumDelete) {
      onAlbumDelete();
    }
    onClose();
  };

  const handleRemoveClick = (fileId, fileType) => {
    const item = timeline.find(m => m.id === fileId && m.type === fileType);
    if (item) {
      setRemovingItem({
        id: fileId,
        type: fileType,
        name: item.filename
      });
      setIsRemoveModalOpen(true);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removingItem) return;

    setIsRemoving(true);
    try {
      await api.removeFromAlbum(albumId, removingItem.type, removingItem.id);
      
      // Reload album metadata (for updated counts)
      await loadAlbum();
      
      // Notify parent to update album list
      if (onAlbumUpdate) {
        onAlbumUpdate();
      }
      
      // Reset pagination and reload timeline
      setSkip(0);
      setHasMore(true);
      setTimeline([]);
      
      // Explicitly reload the timeline based on current search state
      if (searchQuery) {
        await searchTimeline(0, searchQuery);
      } else {
        await loadTimeline(0);
      }
      
      // Close the modal
      setIsRemoveModalOpen(false);
      setRemovingItem(null);
    } catch (err) {
      console.error("Error removing from album:", err);
      alert("Failed to remove file from album. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRemoveModalClose = () => {
    if (!isRemoving) {
      setIsRemoveModalOpen(false);
      setRemovingItem(null);
    }
  };

  const handleSetCover = async (fileId, fileType) => {
    try {
      console.log(`Setting cover: fileId=${fileId}, fileType=${fileType}`); // Debug log
      await api.updateAlbumCover(albumId, fileType, fileId);
      
      // Reload current cover from backend to ensure consistency
      await loadCurrentCover();
      
      // Reload album to get updated cover info
      await loadAlbum();
      
      // Notify parent
      if (onAlbumUpdate) {
        onAlbumUpdate();
      }
      
      console.log("Cover updated successfully"); // Debug log
    } catch (err) {
      console.error("Error setting album cover:", err);
      alert("Failed to set album cover. Please try again.");
      throw err;
    }
  };

  const handleChooseCoverClick = () => {
    setIsChooseCoverModalOpen(true);
  };

  const isCurrentCover = (fileId, fileType) => {
    // Ensure proper type checking - return false if no cover is set
    if (!currentCover || !currentCover.type || currentCover.id === null || currentCover.id === undefined) {
      return false;
    }
    
    // Normalize type comparison (handle "image" vs other variations)
    const normalizedCoverType = String(currentCover.type).toLowerCase();
    const normalizedFileType = String(fileType).toLowerCase();
    
    // Ensure ID comparison is numeric
    const coverId = Number(currentCover.id);
    const fileIdNum = Number(fileId);
    
    const result = normalizedCoverType === normalizedFileType && coverId === fileIdNum;
    
    // Debug logging
    if (result) {
      console.log(`File ${fileId} (${fileType}) IS the current cover`);
    }
    
    return result;
  };

  const Footer = () => {
    return loadingTimeline && hasMore ? (
      <div className="py-8 flex justify-center w-full">
        <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
      </div>
    ) : null;
  };

  if (loading || !album) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600/30 dark:border-cyan-400/30 border-t-purple-600 dark:border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-white/50 text-lg">
            Loading album...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SearchBar onSearch={handleSearch} searchValue={searchInputValue} onClearSearch={handleReset} />
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
        {/* Back Button Row */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex items-center justify-between"
        >
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
              text-slate-700 dark:text-white/80
              hover:bg-purple-500/20 dark:hover:bg-purple-500/20
              hover:border-purple-400/40 dark:hover:border-purple-400/40
              transition-all duration-200 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Albums
          </motion.button>

          {/* Edit and Delete buttons - only show on no files page */}
          {totalCount === 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-4 py-2 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                  text-slate-700 dark:text-white/80
                  hover:bg-blue-500/20 dark:hover:bg-blue-500/20
                  hover:border-blue-400/40 dark:hover:border-blue-400/40
                  transition-all duration-200 font-medium flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Album
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                  text-slate-700 dark:text-white/80
                  hover:bg-red-500/20 dark:hover:bg-red-500/20
                  hover:border-red-400/40 dark:hover:border-red-400/40
                  transition-all duration-200 font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Album
              </button>
            </div>
          )}
        </motion.div>

        {/* Header */}
        {!loadingTimeline && timeline.length !== 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8"
        >
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r
                from-purple-600 via-indigo-600 to-violet-600
                dark:from-white dark:via-cyan-100 dark:to-teal-100
                bg-clip-text text-transparent">
                {searchQuery
                  ? `Searching: "${formatSearchQuery(searchQuery)}" in ${album.album_name}`
                  : album.album_name}
              </h1>
              
              {/* Action Buttons - Icon only with hover labels */}
              <div className="flex items-center gap-2">
                {/* Info Button */}
                <div
                  className="relative"
                  onMouseEnter={() => setIsInfoHovered(true)}
                  onMouseLeave={() => setIsInfoHovered(false)}
                >
                  <button
                    className="p-1.5 rounded-full hover:bg-purple-100 dark:hover:bg-cyan-900/30 transition-colors group relative"
                    aria-label="Show album info"
                  >
                    <Info className="w-5 h-5 text-purple-600 dark:text-cyan-400 group-hover:text-purple-700 dark:group-hover:text-cyan-300 transition-colors" />
                  </button>
                
                {/* Separate Info Panel - Floating */}
                {isInfoHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    style={{ willChange: "opacity, transform" }}
                    className="absolute left-0 top-full mt-2 z-50 w-[42rem] glass-panel rounded-2xl p-6 border-2 border-purple-400/20 dark:border-cyan-400/20 shadow-2xl"
                  >
                    <div className="grid grid-cols-4 gap-8 justify-center items-center text-center w-full">
                      <div className="space-y-1 flex flex-col items-center justify-center">
                        <Folder className="w-5 h-5 text-purple-600 dark:text-cyan-400 flex-shrink-0" />
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-medium">Total Items</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white">
                          {album.album_total_count || 0}
                        </p>
                      </div>
                      <div className="space-y-1 flex flex-col items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-purple-600 dark:text-cyan-400 flex-shrink-0" />
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-medium">Photos</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white">
                          {album.album_images_count || 0}
                        </p>
                      </div>
                      <div className="space-y-1 flex flex-col items-center justify-center">
                        <Video className="w-5 h-5 text-purple-600 dark:text-cyan-400 flex-shrink-0" />
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-medium">Videos</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white">
                          {album.album_videos_count || 0}
                        </p>
                      </div>
                      <div className="space-y-1 flex flex-col items-center justify-center">
                        <FileImage className="w-5 h-5 text-purple-600 dark:text-cyan-400 flex-shrink-0" />
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-medium">RAW Images</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white">
                          {album.album_raw_images_count || 0}
                        </p>
                      </div>
                      <div className="space-y-1 flex flex-col items-center justify-center">
                        <HardDrive className="w-5 h-5 text-purple-600 dark:text-cyan-400 flex-shrink-0" />
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-medium">Size</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white">
                          {formatFileSize(album.album_size || 0)}
                        </p>
                      </div>
                      <div className="space-y-1 flex flex-col items-center justify-center">
                        <Clock className="w-5 h-5 text-purple-600 dark:text-cyan-400 flex-shrink-0" />
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-medium">Created</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white">
                          {formatDate(album.album_created_at)}
                        </p>
                      </div>
                      <div className="space-y-1 flex flex-col items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-purple-600 dark:text-cyan-400 flex-shrink-0" />
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-medium">Updated</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white">
                          {formatDate(album.album_updated_at)}
                        </p>
                      </div>
                      {getLocationText() && (
                        <div className="space-y-1 flex flex-col items-center justify-center">
                          <MapPin className="w-5 h-5 text-purple-600 dark:text-cyan-400 flex-shrink-0" />
                          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-white/50 font-medium">Location</p>
                          <p className="text-base font-bold text-slate-800 dark:text-white">
                            {getLocationText()}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
              
              {/* Download Button */}
              <div className="relative group">
                <button
                  onClick={() => console.log("Download album:", albumId)}
                  className="p-1.5 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                  aria-label="Download album"
                >
                  <Download className="w-5 h-5 text-purple-600 dark:text-cyan-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Download Album
                  </span>
                </button>
              </div>

              {/* Edit Button */}
              <div className="relative group">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  aria-label="Edit album"
                >
                  <Edit className="w-5 h-5 text-purple-600 dark:text-cyan-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Edit Album
                  </span>
                </button>
              </div>

              {/* Choose Album Cover Button */}
              <div className="relative group">
                <button
                  onClick={handleChooseCoverClick}
                  className="p-1.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  aria-label="Choose album cover"
                >
                  <ImagePlus className="w-5 h-5 text-purple-600 dark:text-cyan-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors" />
                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Choose Album Cover
                  </span>
                </button>
              </div>

              {/* Add Files Button */}
              <div className="relative group">
                <button
                  onClick={() => setIsAddFilesModalOpen(true)}
                  className="p-1.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  aria-label="Add files to album"
                >
                  <Plus className="w-5 h-5 text-purple-600 dark:text-cyan-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors" />
                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Add files to {album.album_name}
                  </span>
                </button>
              </div>

              {/* Delete Button */}
              <div className="relative group">
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  aria-label="Delete album"
                >
                  <Trash2 className="w-5 h-5 text-purple-600 dark:text-cyan-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Delete Album
                  </span>
                </button>
              </div>
            </div>
            </div>
            {album.album_description && (
              <p className="text-slate-600 dark:text-white/50 text-lg mt-2">
                {album.album_description}
              </p>
            )}
            {album.album_total_count > 0 && (
              <p className="text-slate-600 dark:text-white/50 text-sm mt-2">
                <span className="font-semibold text-purple-600 dark:text-cyan-400">
              {album.album_total_count}
            </span>{" "}
                {album.album_total_count === 1 ? "item" : "items"} in {album.album_name}
              </p>
            )}
          </div>
        </motion.div>
    ) : null}

        {/* Timeline Grid or No Files Page */}
        {loadingTimeline && timeline.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : totalCount === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center justify-center min-h-[60vh]"
          >
            <div className="text-center space-y-6 max-w-md">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 dark:from-cyan-500/20 dark:to-teal-500/20 flex items-center justify-center border-2 border-purple-400/30 dark:border-cyan-400/30">
                <ImageIcon className="w-12 h-12 text-purple-600 dark:text-cyan-400" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                  {album.album_name}
                </h2>
                {album.album_total_count === 0 && (
                  <p className="text-slate-600 dark:text-white/70 text-base">
                    This is an empty album. Add files to it to get started.
                  </p>
                )}
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setIsAddFilesModalOpen(true)}
                  className="px-6 py-3 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                    text-slate-700 dark:text-white/80
                    hover:bg-purple-500/20 dark:hover:bg-purple-500/20
                    hover:border-purple-400/40 dark:hover:border-purple-400/40
                    transition-all duration-200 font-medium flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  Add files to {album.album_name}
                </button>

              </div>
            </div>
          </motion.div>
        ) : timeline.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-600 dark:text-white/50 text-lg">
              {searchQuery ? "No results found" : "No media in this album"}
            </p>
          </div>
        ) : (
          <Virtuoso
            useWindowScroll
            ref={virtuosoRef}
            data={timelineRows}
            overscan={500}
            endReached={handleLoadMore}
            components={{ Footer }}
            itemContent={(index, row) => {
              if (row.type === "year") {
                return (
                  <div className="pt-8 pb-4">
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight opacity-90 border-b border-slate-300/30 dark:border-white/10 pb-2 inline-block pr-12">
                      {row.label}
                    </h2>
                  </div>
                );
              }

              if (row.type === "month") {
                return (
                  <div className="pt-0 pb-3 sticky top-[100px] z-20 backdrop-blur-md w-full">
                    <h3 className="text-lg font-medium text-purple-600 dark:text-cyan-400 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-600 dark:bg-cyan-400 shadow-glow-cyan" />
                      {row.label}
                    </h3>
                  </div>
                );
              }

              if (row.type === "photos") {
                return (
                  <div className="flex gap-4 mb-4 mt-4">
                    {row.items.map((media, i) => (
                      <div key={`${media.type}-${media.id}`} className="flex-1 min-w-0">
                        {media.type === "image" ? (
                          <PhotoCard
                            photo={media}
                            index={i}
                            onClick={() => handleMediaClick(media)}
                            onFavoriteToggle={handleLocalFavoriteToggle}
                            onRemove={handleRemoveClick}
                            onSetCover={handleSetCover}
                            isCurrentCover={isCurrentCover(media.id, "image")}
                          />
                        ) : media.type === "video" ? (
                          <VideoCard
                            video={media}
                            index={i}
                            onClick={() => handleMediaClick(media)}
                            onFavoriteToggle={handleLocalFavoriteToggle}
                            onRemove={handleRemoveClick}
                            onSetCover={handleSetCover}
                            isCurrentCover={isCurrentCover(media.id, "video")}
                          />
                        ) : media.type === "raw" ? (
                          <RawImageCard
                            rawImage={media}
                            index={i}
                            onClick={() => handleMediaClick(media)}
                            onFavoriteToggle={handleLocalFavoriteToggle}
                            onRemove={handleRemoveClick}
                            onSetCover={handleSetCover}
                            isCurrentCover={isCurrentCover(media.id, "raw")}
                          />
                        ) : null}
                      </div>
                    ))}
                    {[...Array(5 - row.items.length)].map((_, i) => (
                      <div key={`empty-${i}`} className="flex-1" />
                    ))}
                  </div>
                );
              }

              return null;
            }}
          />
        )}
      </div>

      {/* Media Viewers */}
      {selectedMedia && selectedMedia.type === "image" && (
        <ImageViewer
          photo={selectedMedia}
          onClose={handleClose}
          onNext={handleNext}
          onPrev={handlePrev}
          currentIndex={getSortedIndex(selectedMedia)}
          totalPhotos={totalCount}
          onFavoriteToggle={handleLocalFavoriteToggle}
        />
      )}

      {selectedMedia && selectedMedia.type === "video" && (
        <VideoViewer
          video={selectedMedia}
          onClose={handleClose}
          onNext={handleNext}
          onPrev={handlePrev}
          currentIndex={getSortedIndex(selectedMedia)}
          totalVideos={totalCount}
          onFavoriteToggle={handleLocalFavoriteToggle}
        />
      )}

      {selectedMedia && selectedMedia.type === "raw" && (
        <RawImageViewer
          rawImage={selectedMedia}
          onClose={handleClose}
          onNext={handleNext}
          onPrev={handlePrev}
          currentIndex={getSortedIndex(selectedMedia)}
          totalRawImages={totalCount}
          onFavoriteToggle={handleLocalFavoriteToggle}
        />
      )}

      {/* Edit Album Modal */}
      <EditAlbumModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        albumId={albumId}
      />

      {/* Delete Album Modal */}
      <DeleteAlbumModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={handleDeleteSuccess}
        albumId={albumId}
        albumName={album.album_name}
        updateProgressBar={updateProgressBar}
        removeProgressBar={removeProgressBar}
      />

      {/* Remove From Album Modal */}
      <RemoveFromAlbumModal
        isOpen={isRemoveModalOpen}
        onClose={handleRemoveModalClose}
        onConfirm={handleConfirmRemove}
        fileName={removingItem?.name || ""}
        albumName={album?.album_name || ""}
        loading={isRemoving}
      />

      {/* Choose Album Cover Modal */}
      <ChooseAlbumCoverModal
        isOpen={isChooseCoverModalOpen}
        onClose={() => setIsChooseCoverModalOpen(false)}
        albumId={albumId}
        albumName={album?.album_name || ""}
        currentCoverType={currentCover.type}
        currentCoverId={currentCover.id}
        onSetCover={handleSetCover}
      />

      {/* Add Files to Album Modal */}
      <AddFilesToAlbumModal
        isOpen={isAddFilesModalOpen}
        onClose={() => setIsAddFilesModalOpen(false)}
        albumId={albumId}
        albumName={album?.album_name || ""}
        updateProgressBar={updateProgressBar}
        removeProgressBar={removeProgressBar}
        onFilesAdded={async () => {
          // Reload album data and timeline
          await loadAlbum();
          setSkip(0);
          setHasMore(true);
          setTimeline([]);
          if (searchQuery) {
            await searchTimeline(0, searchQuery);
          } else {
            await loadTimeline(0);
          }
          // Notify parent
          if (onAlbumUpdate) {
            onAlbumUpdate();
          }
        }}
      />
    </>
  );
}

import { motion } from "framer-motion";
import { Heart, Share2, Download, Trash2, Play, Pause } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { processTimelineData } from "../utils/timelineUtils";
import VideoViewer from "./VideoViewer";
import { api } from "../api";
import formatTime from "../utils/timeUtils";    

function VideoCard({ video, index, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewRef = useRef(null);
  const previewTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Delay preview playback slightly to avoid loading on quick hovers
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
    
    // Clear the timeout to prevent preview from starting after mouse leaves
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.currentTime = 0;
    }
  };

  // Cleanup timeout on unmount
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
        {/* Video Thumbnail */}
        <img
          src={api.getVideoThumbnailUrl(video.id)}
          alt={video.filename}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isPreviewPlaying ? 'opacity-0' : 'opacity-100'}`}
          loading="eager"
          decoding="async"
        />

        {/* Preview Video (plays on hover) */}
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
            {/* Dynamically render location only if available */}
            {(video.city || video.state || video.country) && (
              <p className="text-white font-semibold text-sm tracking-wide drop-shadow-lg">
                {[video.city, video.state, video.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}

            {/* Camera metadata if available */}

            {video.metadata?.camera_model && (
              <p className="text-purple-300 dark:text-cyan-300 text-xs font-bold flex items-center gap-1">
                {video.metadata.camera_model}
              </p>
            )}

            {/* Duration if available */}
            {(video.duration) && (
              <p className="text-purple-300 dark:text-cyan-300 text-xs font-bold flex items-center gap-2">
                {video.duration && (
                  <span>{formatTime(video.duration)}</span>
                )}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-full backdrop-blur-xl bg-white/10 border border-white/20
hover:bg-pink-500/30 hover:border-pink-400/50
transition-all duration-200 group/btn"
            >
              <Heart className="w-3 h-3 text-white/70 group-hover/btn:text-pink-400 transition-colors" />
            </motion.button>

            <motion.button
              onClick={(e) => {
                e.stopPropagation();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-full backdrop-blur-xl bg-white/10 border border-white/20
hover:bg-cyan-500/30 hover:border-cyan-400/50
transition-all duration-200 group/btn"
            >
              <Share2 className="w-3 h-3 text-white/70 group-hover/btn:text-cyan-400 transition-colors" />
            </motion.button>

            <motion.button
              onClick={(e) => {
                e.stopPropagation();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-full backdrop-blur-xl bg-white/10 border border-white/20
hover:bg-teal-500/30 hover:border-teal-400/50
transition-all duration-200 group/btn"
            >
              <Download className="w-3 h-3 text-white/70 group-hover/btn:text-teal-400 transition-colors" />
            </motion.button>

            <div className="flex-1" />

            <motion.button
              onClick={(e) => {
                e.stopPropagation();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-1.5 rounded-full backdrop-blur-xl bg-white/10 border border-white/20
hover:bg-red-500/30 hover:border-red-400/50
transition-all duration-200 group/btn"
            >
              <Trash2 className="w-3 h-3 text-white/70 group-hover/btn:text-red-400 transition-colors" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function VideoGrid({
  videos = [],
  loading = false,
  searchQuery = "",
  onLoadMore,
  hasMore = true,
  totalCount,
  statusCode
}) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const virtuosoRef = useRef(null);

  const sortedVideos = useMemo(() => {
    return [...videos].sort((a, b) => {
      const dateA = new Date(a.date || a.capture_date || 0);
      const dateB = new Date(b.date || b.capture_date || 0);
      return dateB - dateA; // Descending (Newest first)
    });
  }, [videos]);

  // Process videos into timeline rows (Year > Month > Video rows)
  const timelineRows = useMemo(() => processTimelineData(sortedVideos, 5), [sortedVideos]);

  const getSortedIndex = (video) => sortedVideos.findIndex((v) => v.id === video.id);

  useEffect(() => {
    if (selectedVideo && virtuosoRef.current) {
      const rowIndex = timelineRows.findIndex(row => 
        row.type === 'photos' && row.items.some(v => v.id === selectedVideo.id)
      );

      if (rowIndex !== -1) {
        virtuosoRef.current.scrollToIndex({
          index: rowIndex,
          align: 'center',
          behavior: 'auto'
        });
      }
    }
  }, [selectedVideo, timelineRows]);

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
  };

  const handleClose = () => {
    setSelectedVideo(null);
  };

  const handleNext = () => {
    const currentIdx = getSortedIndex(selectedVideo);
    if (currentIdx !== -1 && currentIdx < sortedVideos.length - 1) {
      setSelectedVideo(sortedVideos[currentIdx + 1]);
    }
  };

  const handlePrev = () => {
    const currentIdx = getSortedIndex(selectedVideo);
    if (currentIdx > 0) {
      setSelectedVideo(sortedVideos[currentIdx - 1]);
    }
  };

  // Format search query
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

  const Footer = () => {
    return loading && hasMore ? (
      <div className="py-8 flex justify-center w-full">
        <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
      </div>
    ) : null;
  };

  // --- Loading State ---
  if (loading && videos.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600/30 dark:border-cyan-400/30 border-t-purple-600 dark:border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-white/50 text-lg">
            Loading your videos...
          </p>
        </div>
      </div>
    );
  }

  // --- Storage Unavailable State ---
  if (statusCode === '503') {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-white/50 text-lg">
            Haven Vault is not configured
          </p>
          <p className="text-slate-400 dark:text-white/30 text-sm mt-2">
            Please configure Haven Vault to get started!
          </p>
        </div>
      </div>
    );
  }

  // --- Empty State ---
  if (!loading && (!videos || videos.length === 0)) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-white/50 text-lg">
            No {searchQuery ? `"${formatSearchQuery(searchQuery)}"` : ""} videos found in Haven Vault
          </p>
          {searchQuery ? (
            <p className="text-slate-400 dark:text-white/30 text-sm mt-2">
              Try searching for something else!
            </p>
          ) : (
            <p className="text-slate-400 dark:text-white/30 text-sm mt-2">
              Upload some videos to get started!
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Main Timeline Render ---
  return (
    <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
      {/* Header Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1
            className="text-4xl font-bold bg-gradient-to-r
from-purple-600 via-indigo-600 to-violet-600
dark:from-white dark:via-cyan-100 dark:to-teal-100
bg-clip-text text-transparent mb-2"
          >
            {searchQuery
              ? `"${formatSearchQuery(searchQuery)}"`
              : "Your Videos"}
          </h1>
          <p className="text-slate-600 dark:text-white/50 text-lg">
            <span className="font-semibold text-purple-600 dark:text-cyan-400">
              {totalCount}
            </span>{" "}
            {searchQuery ? "search results" : "videos"}
          </p>
        </div>
      </motion.div>

      {/* VIRTUALIZED TIMELINE */}
      <Virtuoso
        useWindowScroll
        ref={virtuosoRef}
        data={timelineRows}
        overscan={500}
        endReached={() => { if (hasMore && !loading) onLoadMore(); }}
        components={{ Footer }}
        itemContent={(index, row) => {
          // 1. Year Header
          if (row.type === "year") {
            return (
              <div className="pt-8 pb-4">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight opacity-90 border-b border-slate-300/30 dark:border-white/10 pb-2 inline-block pr-12">
                  {row.label}
                </h2>
              </div>
            );
          }

          // 2. Month Header
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

          // 3. Video Grid Row
          if (row.type === "photos") {
            return (
              <div className="flex gap-4 mb-4">
                {row.items.map((video, i) => (
                  <div key={video.id} className="flex-1 min-w-0">
                    <VideoCard
                      video={video}
                      index={i}
                      onClick={() => handleVideoClick(video)}
                    />
                  </div>
                ))}
                {/* Spacers for incomplete rows */}
                {[...Array(5 - row.items.length)].map((_, i) => (
                  <div key={`empty-${i}`} className="flex-1" />
                ))}
              </div>
            );
          }

          return null;
        }}
      />

      {/* Video Viewer */}
      {selectedVideo && (
        <VideoViewer
          video={selectedVideo}
          onClose={handleClose}
          onNext={handleNext}
          onPrev={handlePrev}
          currentIndex={getSortedIndex(selectedVideo)}
          totalVideos={totalCount}
        />
      )}
    </div>
  );
}


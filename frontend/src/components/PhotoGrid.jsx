import { motion } from "framer-motion";

import { Heart, Share2, Download, Trash2 } from "lucide-react";

import { useState, useMemo, useRef, useEffect } from "react";

import { Virtuoso } from "react-virtuoso";

import { processTimelineData } from "../utils/timelineUtils";

import ImageViewer from "./ImageViewer";

function PhotoCard({ photo, index, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

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
            {/* Dynamically render location only if available */}

            {(photo.city || photo.state || photo.country) && (
              <p className="text-white font-semibold text-sm tracking-wide drop-shadow-lg">
                {[photo.city, photo.state, photo.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}

            {/* Camera metadata if available */}

            {photo.metadata?.camera_model && (
              <p className="text-purple-300 dark:text-cyan-300 text-xs font-bold flex items-center gap-1">
                {photo.metadata.camera_model}
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

        {/* Glow Effect on Hover */}

        {/* <motion.div

animate={{

opacity: isHovered ? [0.3, 0.6, 0.3] : 0,

}}

transition={{

duration: glowDuration,

repeat: Infinity,

ease: 'easeInOut',

delay: glowDelay,

}}

className="absolute inset-0 bg-gradient-to-br

from-purple-400/20 via-transparent to-indigo-400/20

dark:from-cyan-500/20 dark:via-transparent dark:to-teal-500/20

pointer-events-none"

/> */}
      </div>
    </motion.div>
  );
}

export default function PhotoGrid({
  photos = [],
  loading = false,
  searchQuery = "",
  onLoadMore,
  hasMore=true,
  totalCount
}) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const virtuosoRef = useRef(null);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const dateA = new Date(a.date || a.capture_date || 0);
      const dateB = new Date(b.date || b.capture_date || 0);
      return dateB - dateA; // Descending (Newest first)
    });
  }, [photos]);

  // Process photos into timeline rows (Year > Month > Photo rows)

  const timelineRows = useMemo(() => processTimelineData(sortedPhotos, 5), [sortedPhotos]);

  const getSortedIndex = (photo) => sortedPhotos.findIndex((p) => p.id === photo.id);

  useEffect(() => {
    if (selectedPhoto && virtuosoRef.current) {
        // A. Find which "Row" contains this photo
        const rowIndex = timelineRows.findIndex(row => 
            row.type === 'photos' && row.items.some(p => p.id === selectedPhoto.id)
        );

        console.log("Syncing Scroll:", { photoId: selectedPhoto.id, rowIndex }); // <--- DEBUG LOG

        // B. Scroll the background to that row (centered)
        if (rowIndex !== -1) {
            virtuosoRef.current.scrollToIndex({
                index: rowIndex,
                align: 'center',
                behavior: 'auto' // Instant scroll, use 'smooth' if you prefer animation
            });
        }
    }
  }, [selectedPhoto, timelineRows]); // Run whenever photo changes

  const handlePhotoClick = (photo) => {
    setSelectedPhoto(photo);
  };

  const handleClose = () => {
    setSelectedPhoto(null);
  };

  const handleNext = () => {
    const currentIdx = getSortedIndex(selectedPhoto);

    if (currentIdx !== -1 && currentIdx < sortedPhotos.length - 1) {
      setSelectedPhoto(sortedPhotos[currentIdx + 1]);
    }
  };

  const handlePrev = () => {
    const currentIdx = getSortedIndex(selectedPhoto);

    if (currentIdx > 0) {
      setSelectedPhoto(sortedPhotos[currentIdx - 1]);
    }
  };

  // Format search query: capitalize first letter after periods, show first 4 words

  const formatSearchQuery = (query) => {
    if (!query) return "";

    // Capitalize first letter of sentences (after periods and at start)

    const formatted = query
      .toLowerCase()
      .replace(/(^|\. )(\w)/g, (match) => match.toUpperCase());

    // Get first 4 words

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

  if (loading && photos.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600/30 dark:border-cyan-400/30 border-t-purple-600 dark:border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />

          <p className="text-slate-600 dark:text-white/50 text-lg">
            Loading your memories...
          </p>
        </div>
      </div>
    );
  }

  // --- Empty State ---

  if (!loading && (!photos || photos.length === 0)) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-white/50 text-lg">
            No photos found
          </p>

          <p className="text-slate-400 dark:text-white/30 text-sm mt-2">
            Scan a directory to get started
          </p>
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
              : "Your Memories"}
          </h1>

          <p className="text-slate-600 dark:text-white/50 text-lg">
            <span className="font-semibold text-purple-600 dark:text-cyan-400">
              {totalCount}
            </span>{" "}
            {searchQuery ? "search results" : "photos"}
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

          // 3. Photo Grid Row

          if (row.type === "photos") {
            return (
              <div className="flex gap-4 mb-4">
                {row.items.map((photo, i) => (
                  <div key={photo.id} className="flex-1 min-w-0">
                    <PhotoCard
                      photo={photo}
                      index={i}
                      onClick={() => handlePhotoClick(photo)}
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

      {/* Image Viewer */}

      {selectedPhoto && (
        <ImageViewer
          photo={selectedPhoto}
          onClose={handleClose}
          onNext={handleNext}
          onPrev={handlePrev}
          currentIndex={getSortedIndex(selectedPhoto)}
          totalPhotos={totalCount}
        />
      )}
    </div>
  );
}

import { motion } from "framer-motion";

import { Heart, Share2, Download, Trash2 } from "lucide-react";

import { useState, useMemo, useRef, useEffect } from "react";

import { Virtuoso } from "react-virtuoso";

import { processTimelineData } from "../utils/timelineUtils";

import RawImageViewer from "./RawImageViewer";

import { api } from "../api";

function RawImageCard({ rawImage, index, onClick }) {
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
            {/* Dynamically render location only if available */}

            {(rawImage.city || rawImage.state || rawImage.country) && (
              <p className="text-white font-semibold text-sm tracking-wide drop-shadow-lg">
                {[rawImage.city, rawImage.state, rawImage.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}

            {/* Camera metadata if available */}

            {rawImage.metadata?.camera_model && (
              <p className="text-purple-300 dark:text-cyan-300 text-xs font-bold flex items-center gap-1">
                {rawImage.metadata.camera_model}
              </p>
            )}

            {/* Lens info if available */}
            {rawImage.metadata?.lens_model && (
              <p className="text-purple-200 dark:text-cyan-200 text-xs flex items-center gap-1">
                {rawImage.metadata.lens_model}
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

export default function RawImageGrid({
  rawImages = [],
  loading = false,
  searchQuery = "",
  onLoadMore,
  hasMore=true,
  totalCount,
  statusCode
}) {
  const [selectedRawImage, setSelectedRawImage] = useState(null);

  const virtuosoRef = useRef(null);

  const sortedRawImages = useMemo(() => {
    return [...rawImages].sort((a, b) => {
      const dateA = new Date(a.date || a.capture_date || 0);
      const dateB = new Date(b.date || b.capture_date || 0);
      return dateB - dateA; // Descending (Newest first)
    });
  }, [rawImages]);

  // Process raw images into timeline rows (Year > Month > Photo rows)

  const timelineRows = useMemo(() => processTimelineData(sortedRawImages, 5), [sortedRawImages]);

  const getSortedIndex = (rawImage) => sortedRawImages.findIndex((r) => r.id === rawImage.id);

  useEffect(() => {
    if (selectedRawImage && virtuosoRef.current) {
        // A. Find which "Row" contains this raw image
        const rowIndex = timelineRows.findIndex(row => 
            row.type === 'photos' && row.items.some(r => r.id === selectedRawImage.id)
        );

        // B. Scroll the background to that row (centered)
        if (rowIndex !== -1) {
            virtuosoRef.current.scrollToIndex({
                index: rowIndex,
                align: 'center',
                behavior: 'auto' // Instant scroll, use 'smooth' if you prefer animation
            });
        }
    }
  }, [selectedRawImage, timelineRows]); // Run whenever raw image changes

  const handleRawImageClick = (rawImage) => {
    setSelectedRawImage(rawImage);
  };

  const handleClose = () => {
    setSelectedRawImage(null);
  };

  const handleNext = () => {
    const currentIdx = getSortedIndex(selectedRawImage);

    if (currentIdx !== -1 && currentIdx < sortedRawImages.length - 1) {
      setSelectedRawImage(sortedRawImages[currentIdx + 1]);
    }
  };

  const handlePrev = () => {
    const currentIdx = getSortedIndex(selectedRawImage);

    if (currentIdx > 0) {
      setSelectedRawImage(sortedRawImages[currentIdx - 1]);
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

  if (loading && rawImages.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600/30 dark:border-cyan-400/30 border-t-purple-600 dark:border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />

          <p className="text-slate-600 dark:text-white/50 text-lg">
            Loading your RAW files...
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

  else if (!loading && (!rawImages || rawImages.length === 0)) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-white/50 text-lg">
            No {searchQuery ? `"${formatSearchQuery(searchQuery)}"` : ""} RAW images found in Haven Vault
          </p>
          {searchQuery ? (
            <p className="text-slate-400 dark:text-white/30 text-sm mt-2">
              Try searching for something else!
            </p>
          ) : (
            <p className="text-slate-400 dark:text-white/30 text-sm mt-2">
              Upload some RAW files to get started!
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
              ? `Searching: "${formatSearchQuery(searchQuery)}" in Your RAW Images`
              : "Your RAW Images"}
          </h1>

          <p className="text-slate-600 dark:text-white/50 text-lg">
            <span className="font-semibold text-purple-600 dark:text-cyan-400">
              {totalCount}
            </span>{" "}
            {searchQuery ? "search results" : "RAW images"} in Haven Vault
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
                {row.items.map((rawImage, i) => (
                  <div key={rawImage.id} className="flex-1 min-w-0">
                    <RawImageCard
                      rawImage={rawImage}
                      index={i}
                      onClick={() => handleRawImageClick(rawImage)}
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

      {selectedRawImage && (
        <RawImageViewer
          rawImage={selectedRawImage}
          onClose={handleClose}
          onNext={handleNext}
          onPrev={handlePrev}
          currentIndex={getSortedIndex(selectedRawImage)}
          totalRawImages={totalCount}
        />
      )}
    </div>
  );
}


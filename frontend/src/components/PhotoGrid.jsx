import { motion } from 'framer-motion';
import { Heart, Share2, Download, MoreVertical } from 'lucide-react';
import { useState } from 'react';
import Masonry from "react-masonry-css";

const breakpointColumnsObj = {
  default: 5,
  1280: 4,
  1024: 3,
  768: 2,
  640: 1,
};

function PhotoCard({ photo, index}) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Random delay and duration for async glow animation
  const glowDelay = index * 0.4; // Stagger the start
  const glowDuration = 3 + (index % 3) * 0.5; // Vary duration between 3-4.5s

  return (
    <motion.div
      initial={{ opacity: 0, y: 100, scale: 0.8 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.6,
        delay: index * 0.001,
        type: "spring",
        stiffness: 100,
        damping: 12,
      }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative group cursor-pointer mb-4 break-inside-avoid"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl
          transition-all duration-500
          ${
            isHovered
              ? 'shadow-glow-cyan border-2 border-purple-400/50 dark:border-cyan-400/40'
              : 'shadow-xl border-2 border-slate-200/40 dark:border-white/10'
          }
        `}
      >
        
        {/* Image */}
        <img
          src={photo.thumbnail_url}
          alt={photo.title}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding='async'
        />

        {/* Gradient Overlay */}
        <div
          className={`
            absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
            transition-opacity duration-500
            ${isHovered ? 'opacity-100' : 'opacity-0'}
          `}
        />

        {/* Content Overlay */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-x-0 bottom-0 p-4"
        >
          <div className="space-y-2">
            <h3 className="text-white font-semibold text-lg tracking-wide drop-shadow-lg">
              {photo.title}
            </h3>
            <p className="text-purple-300 dark:text-cyan-300 text-sm flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-purple-400 dark:bg-cyan-400" />
              {photo.location}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full backdrop-blur-xl bg-white/10 border border-white/20
                       hover:bg-pink-500/30 hover:border-pink-400/50 
                       transition-all duration-200 group/btn"
            >
              <Heart className="w-4 h-4 text-white/70 group-hover/btn:text-pink-400 transition-colors" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full backdrop-blur-xl bg-white/10 border border-white/20
                       hover:bg-cyan-500/30 hover:border-cyan-400/50 
                       transition-all duration-200 group/btn"
            >
              <Share2 className="w-4 h-4 text-white/70 group-hover/btn:text-cyan-400 transition-colors" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full backdrop-blur-xl bg-white/10 border border-white/20
                       hover:bg-teal-500/30 hover:border-teal-400/50 
                       transition-all duration-200 group/btn"
            >
              <Download className="w-4 h-4 text-white/70 group-hover/btn:text-teal-400 transition-colors" />
            </motion.button>

            <div className="flex-1" />

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full backdrop-blur-xl bg-white/10 border border-white/20
                       hover:bg-white/20 transition-all duration-200"
            >
              <MoreVertical className="w-4 h-4 text-white/70" />
            </motion.button>
          </div>
        </motion.div>


        {/* Glow Effect on Hover */}
        <motion.div
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
        />
      </div>
    </motion.div>
  );
}

export default function PhotoGrid({ photos = [], loading = false, searchQuery = '' }) {
  // Format search query: capitalize first letter after periods, show first 4 words
  const formatSearchQuery = (query) => {
    if (!query) return '';
    
    // Capitalize first letter of sentences (after periods and at start)
    const formatted = query.toLowerCase().replace(/(^|\. )(\w)/g, (match) => match.toUpperCase());
    
    // Get first 4 words
    const words = formatted.split(' ');
    if (words.length > 4) {
      return words.slice(0, 4).join(' ') + '...';
    }
    return formatted;
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600/30 dark:border-cyan-400/30 border-t-purple-600 dark:border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-white/50 text-lg">Loading your memories...</p>
        </div>
      </div>
    );
  }

  if (!photos || photos.length === 0) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-white/50 text-lg">No photos found</p>
          <p className="text-slate-400 dark:text-white/30 text-sm mt-2">Scan a directory to get started</p>
        </div>
      </div>
    );
  }
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
          <h1 className="text-4xl font-bold bg-gradient-to-r 
                       from-purple-600 via-indigo-600 to-violet-600
                       dark:from-white dark:via-cyan-100 dark:to-teal-100 
                       bg-clip-text text-transparent mb-2">
            {searchQuery ? `"${formatSearchQuery(searchQuery)}"` : 'Your Memories'}
          </h1>
          <p className="text-slate-600 dark:text-white/50 text-lg">
            <span className="font-semibold text-purple-600 dark:text-cyan-400">{photos.length}</span> {searchQuery ? 'search results' : 'photos in your collection'}
          </p>
        </div>

        {/* <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="glass-panel px-6 py-3 rounded-2xl font-medium 
                     text-slate-800 dark:text-white
                     hover:bg-white/85 dark:hover:bg-white/15 
                     transition-all duration-300 flex items-center gap-2"
          >
            <span>All Photos</span>
            <div className="w-2 h-2 rounded-full bg-purple-500 dark:bg-cyan-400 shadow-glow-cyan" />
          </motion.button>
        </div> */}
      </motion.div>

      {/* Masonry Photo Grid */}
      {/* <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
        {photos.map((photo, index) => (
          <PhotoCard key={photo.id} photo={photo} index={index} />
        ))}
      </div> */}

    

<Masonry
  breakpointCols={breakpointColumnsObj}
  className="flex gap-4"
  columnClassName="flex flex-col gap-1"
>
  {photos.map((photo, index) => (
    <PhotoCard key={photo.id} photo={photo} index={index} />
  ))}
</Masonry>

      {/* Load More */}
      {/* <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-12 flex justify-center"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="glass-panel px-8 py-4 rounded-full font-medium text-lg
                   text-slate-800 dark:text-white
                   hover:bg-white/85 dark:hover:bg-white/15 
                   hover:shadow-glow-cyan transition-all duration-300"
        >
          Load More Memories
        </motion.button>
      </motion.div> */}
    </div>
  );
}

import { Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Reusable Share Button Component
 * 
 * @param {Object} props
 * @param {number} props.id - Media ID
 * @param {string} props.type - Media type: 'image', 'video', or 'raw'
 * @param {string} props.size - Size variant: 'small' (for cards) or 'large' (for viewers)
 * @param {Function} props.onClick - Optional custom click handler
 */
export default function ShareButton({ 
  id, 
  type, 
  size = 'small',
  onClick
}) {
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    
    if (onClick) {
      onClick(id, type);
    } else {
      setShowComingSoon(true);
    }
  };

  // Auto-hide "Coming Soon" message after 2 seconds
  useEffect(() => {
    if (showComingSoon) {
      const timer = setTimeout(() => {
        setShowComingSoon(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showComingSoon]);

  const isSmall = size === 'small';
  const iconSize = isSmall ? 'w-3 h-3' : 'w-5 h-5';
  const padding = isSmall ? 'p-1.5' : 'p-2.5';

  return (
    <div className="relative inline-block">
      {/* Coming Soon Pill - appears above button */}
      <AnimatePresence>
        {showComingSoon && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-50"
          >
            <div className="px-3 py-1.5 rounded-full 
                          bg-white/95 dark:bg-slate-900/95 
                          border border-purple-300/60 dark:border-cyan-400/50 
                          shadow-lg backdrop-blur-xl whitespace-nowrap">
              <span className="text-xs font-medium bg-gradient-to-r 
                              from-purple-600 to-indigo-600 
                              dark:from-cyan-400 dark:to-teal-400 
                              bg-clip-text text-transparent">
                Coming Soon
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleClick}
        disabled={true}
        className={`${padding} rounded-full backdrop-blur-xl border transition-all duration-200 group/btn
          bg-white/10 dark:bg-white/5 border-white/20 
          hover:bg-cyan-500/30 dark:hover:bg-cyan-500/20 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Share2 
          className={`${iconSize} transition-colors ${
            isSmall 
              ? 'text-white/70 group-hover/btn:text-cyan-400'
              : 'text-slate-700 dark:text-white/70 group-hover/btn:text-cyan-500 dark:group-hover/btn:text-cyan-400'
          }`}
        />
      </button>
    </div>
  );
}

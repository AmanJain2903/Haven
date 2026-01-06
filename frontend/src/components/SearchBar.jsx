import { motion } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SearchBar({onSearch, searchValue: externalSearchValue = '', onClearSearch}) {
  const [isFocused, setIsFocused] = useState(false);
  const [searchValue, setSearchValue] = useState(externalSearchValue);
  const [isVisible, setIsVisible] = useState(true);
  const [scrollTimeout, setScrollTimeout] = useState(null);

  // Sync external searchValue with internal state
  useEffect(() => {
    setSearchValue(externalSearchValue);
  }, [externalSearchValue]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch && searchValue.trim()) {
      onSearch(searchValue);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchValue(suggestion);
    if (onSearch) {
      onSearch(suggestion);
    }
  };

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      // Hide search bar on scroll
      setIsVisible(false);

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Show search bar after scrolling stops (500ms delay)
      const timeout = setTimeout(() => {
        setIsVisible(true);
      }, 500);

      setScrollTimeout(timeout);
      lastScrollY = window.scrollY;
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
    <motion.div
      initial={{ opacity: 0 }}
      style={{ willChange: "opacity" }}
      animate={{ 
        opacity: isVisible ? 1 : 0,
      }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-8 left-[calc(240px+3rem)] right-6 z-40 flex justify-center"
    >
      <div className="w-full max-w-3xl relative">
        {/* Animated Morphing Blob Background */}
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
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -inset-6 bg-gradient-to-r from-purple-600/80 via-indigo-600/70 to-violet-600/80 blur-3xl"
        />
      <div
        className={`
          relative glass-panel rounded-full px-6 py-4 
          transition-all duration-500 ease-out
          ${
            isFocused
              ? 'shadow-glow-cyan-lg border-purple-400/50 dark:border-cyan-400/40 bg-white/85 dark:bg-white/15'
              : 'shadow-xl hover:shadow-glow-cyan'
          }
        `}
      >
        {/* Animated Background Glow */}
        <motion.div
          animate={{
            opacity: isFocused ? [0.8, 1.0, 0.8] : [0.5, 0.8, 0.5],
            scale: isFocused ? [1, 1.02, 1] : 1,
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 rounded-full bg-gradient-to-r 
                     from-purple-400/20 via-indigo-400/20 to-purple-400/20
                     dark:from-cyan-500/20 dark:via-teal-500/20 dark:to-cyan-500/20 
                     blur-xl"
        />

        <form onSubmit={handleSearch} className="relative flex items-center gap-4">
          {/* Search Icon */}
          <motion.div
            animate={{
              rotate: isFocused ? 360 : 0,
              scale: isFocused ? 1.1 : 1,
            }}
            transition={{ duration: 0.4 }}
          >
            <Search
              className={`w-5 h-5 transition-colors duration-300 ${
                isFocused ? 'text-purple-600 dark:text-cyan-300' : 'text-slate-600 dark:text-white/60'
              }`}
            />
          </motion.div>

          {/* Input Field */}
          <input
            type="text"
            placeholder="Search for 'a rainy day in Paris'..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="flex-1 bg-transparent outline-none 
                     text-slate-800 dark:text-white 
                     placeholder-slate-500 dark:placeholder-white/40 
                     font-dark text-lg tracking-wide"
          />

          {/* AI Sparkle Icon */}
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
              scale: isFocused ? [1, 1.2, 1] : 1,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="relative"
          >
            <Sparkles
              className={`w-5 h-5 transition-colors duration-300 ${
                isFocused ? 'text-indigo-600 dark:text-teal-300' : 'text-slate-500 dark:text-white/40'
              }`}
            />
            {isFocused && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.5, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                className="absolute inset-0 bg-indigo-400/30 dark:bg-teal-400/30 rounded-full blur-md"
              />
            )}
          </motion.div>

          {/* Search Button */}
          {searchValue && (
            <motion.button
              type="submit"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 rounded-full bg-gradient-to-r 
                       from-purple-500 to-indigo-600
                       dark:from-cyan-500 dark:to-teal-500 
                       text-white font-medium text-sm shadow-glow-cyan
                       hover:shadow-glow-cyan-lg transition-all duration-300"
            >
              Search
            </motion.button>
          )}
        </form>

        {/* Liquid Border Animation */}
        <motion.div
          animate={{
            background: isFocused
              ? [
                  'linear-gradient(90deg, rgba(139,92,246,0.4) 0%, rgba(99,102,241,0.4) 50%, rgba(139,92,246,0.4) 100%)',
                  'linear-gradient(90deg, rgba(99,102,241,0.4) 0%, rgba(139,92,246,0.4) 50%, rgba(99,102,241,0.4) 100%)',
                ]
              : 'linear-gradient(90deg, transparent 0%, transparent 100%)',
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute inset-0 rounded-full opacity-50 pointer-events-none dark:hidden"
          style={{ padding: '1px', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor' }}
        />
        <motion.div
          animate={{
            background: isFocused
              ? [
                  'linear-gradient(90deg, rgba(6,182,212,0.3) 0%, rgba(20,184,166,0.3) 50%, rgba(6,182,212,0.3) 100%)',
                  'linear-gradient(90deg, rgba(20,184,166,0.3) 0%, rgba(6,182,212,0.3) 50%, rgba(20,184,166,0.3) 100%)',
                ]
              : 'linear-gradient(90deg, transparent 0%, transparent 100%)',
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="hidden dark:block absolute inset-0 rounded-full opacity-50 pointer-events-none"
          style={{ padding: '1px', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor' }}
        />
      </div>

      {/* AI Suggestions (when focused) */}
      {isFocused && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-3 glass-panel rounded-2xl p-3 shadow-xl"
        >
          <div className="text-xs text-slate-600 dark:text-white/50 mb-2 px-2">AI Suggestions</div>
          <div className="flex flex-wrap gap-2">
            {['Sunset beach', 'Mountain hiking', 'City lights', 'Family photos'].map((tag, i) => (
              <motion.button
                key={tag}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  handleSuggestionClick(tag);
                }}
                style={{ willChange: "opacity" }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 py-1.5 rounded-full glass-panel text-sm 
                         text-slate-700 dark:text-white/70 
                         hover:text-purple-600 dark:hover:text-cyan-300 
                         hover:border-purple-400/40 dark:hover:border-cyan-400/30 
                         transition-all duration-200"
              >
                {tag}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
      </div>
    </motion.div>
  );
}

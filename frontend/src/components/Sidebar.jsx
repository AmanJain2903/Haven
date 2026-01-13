import { motion } from 'framer-motion';
import { Image, Album, Heart, Users, Box, Map, Settings, Video, Library, Camera, Files, Sparkles} from 'lucide-react';
import { useState } from 'react';

const navigationItems = [
  {id: 'all', icon: Files, label: 'All Media' },
  { id: 'photos', icon: Image, label: 'Photos' },
  { id: 'videos', icon: Video, label: 'Videos' },
  { id: 'raw', icon: Camera, label: 'RAW' },
  { id: 'map', icon: Map, label: 'Map' },
  { id: 'favorites', icon: Heart, label: 'Favorites' },
  { id: 'albums', icon: Album, label: 'Albums' },
  { id: 'smart-albums', icon: Sparkles, label: 'Smart Albums' },
  { id: 'faces', icon: Users, label: 'Faces' },
  { id: 'things', icon: Box, label: 'Things' },
  { id: 'dashboard', icon: Library, label: 'Dashboard' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ activeView = 'all', setActiveView }) {
  const handleItemClick = (itemId) => {
    if (setActiveView) {
      setActiveView(itemId);
    }
  };

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ 
        x: 0, 
        opacity: 1,
        y: [0, -8, 0],
      }}
      style={{willChange: 'transform, opacity'}}
      transition={{ 
        x: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        y: {
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }
      }}
      className="fixed left-6 top-6 bottom-6 w-60 z-50"
    >
      <div className="glass-panel rounded-3xl h-full flex flex-col py-8 shadow-2xl">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{willChange: 'transform'}}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-12 relative px-6 flex justify-center"
        >
          <div className="relative">
            {/* Animated Morphing Blob Background */}
            <motion.div
              animate={{
                borderRadius: [
                  '60% 40% 30% 70% / 60% 30% 70% 40%',
                  '30% 60% 70% 40% / 50% 60% 30% 60%',
                  '60% 40% 30% 70% / 60% 30% 70% 40%',
                ],
                style: {willChange: 'opacity, transform'},
                scale: [1, 1.08, 1],
                opacity: [0.35, 0.5, 0.35],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -inset-8 bg-gradient-to-br from-purple-600/70 via-indigo-600/60 to-violet-600/70 blur-3xl"
            />
            <div className="text-4xl font-bold tracking-wide bg-gradient-to-br 
                        from-purple-600 via-indigo-500 to-violet-600
                        dark:from-cyan-400 dark:via-teal-300 dark:to-cyan-500 
                        bg-clip-text text-transparent whitespace-nowrap relative z-10">
              Haven
            </div>
          </div>
        </motion.div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col gap-1 px-4">
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <motion.button
                key={item.id}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                style={{willChange: 'transform, opacity'}}
                transition={{ delay: 0.1 * index, duration: 0.4 }}
                onClick={() => handleItemClick(item.id)}
                className="relative group"
              >
                {/* Glow Indicator Bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b 
                              from-purple-500 to-indigo-600
                              dark:from-cyan-400 dark:to-teal-500 
                              rounded-full shadow-glow-cyan"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}

                {/* Icon Container */}
                <div
                  className={`
                    w-full rounded-2xl flex items-center gap-4 px-4 py-3
                    transition-all duration-300 relative overflow-hidden
                    ${
                      isActive
                        ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-400/40 dark:from-cyan-500/20 dark:to-teal-500/20 dark:border-cyan-400/30 shadow-glow-cyan'
                        : 'hover:bg-slate-200/50 dark:hover:bg-white/10 border border-transparent'
                    }
                  `}
                >
                  <Icon
                    className={`w-6 h-6 transition-all duration-300 flex-shrink-0 ${
                      isActive
                        ? 'text-purple-600 dark:text-cyan-300 scale-110'
                        : 'text-slate-600 dark:text-white/60 group-hover:text-slate-800 dark:group-hover:text-white/90 group-hover:scale-110'
                    }`}
                  />

                  {/* Label Text */}
                  <span
                    className={`text-sm font-medium whitespace-nowrap ${
                      isActive ? 'text-purple-600 dark:text-cyan-300' : 'text-slate-700 dark:text-white/70 group-hover:text-slate-900 dark:group-hover:text-white'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Hover Glow Effect */}
                  <div
                    className={`
                      absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300
                      bg-gradient-to-br from-purple-400/10 to-indigo-500/10
                      dark:from-cyan-400/10 dark:to-teal-500/10
                    `}
                  />
                </div>
              </motion.button>
            );
          })}
        </nav>
      </div>
    </motion.aside>
  );
}

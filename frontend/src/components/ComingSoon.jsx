import { motion } from "framer-motion";
import { Sparkles, Users, Box, Library, Trash2 } from "lucide-react";

const iconMap = {
  "smart-albums": Sparkles,
  "faces": Users,
  "things": Box,
  "dashboard": Library,
  "recently-deleted": Trash2,
};

const labelMap = {
  "smart-albums": "Smart Albums",
  "faces": "Faces",
  "things": "Things",
  "dashboard": "Dashboard",
  "recently-deleted": "Recently Deleted",
};

export default function ComingSoon({ feature }) {
  const Icon = iconMap[feature] || Sparkles;
  const label = labelMap[feature] || "Feature";

  return (
    <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl mx-auto overflow-visible"
      >
        {/* Animated Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mb-8 flex justify-center"
        >
          <div className="relative">
            {/* Glow Effect */}
            <motion.div
              animate={{
                borderRadius: [
                  '60% 40% 30% 70% / 60% 30% 70% 40%',
                  '30% 60% 70% 40% / 50% 60% 30% 60%',
                  '60% 40% 30% 70% / 60% 30% 70% 40%',
                ],
                scale: [1, 1.1, 1],
                opacity: [0.4, 0.6, 0.4],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -inset-12 bg-gradient-to-br from-purple-600/50 via-indigo-600/40 to-violet-600/50 dark:from-cyan-400/50 dark:via-teal-400/40 dark:to-cyan-500/50 blur-3xl"
            />
            <div className="relative z-10 w-32 h-32 rounded-3xl glass-panel border-2 border-purple-400/30 dark:border-cyan-400/30 flex items-center justify-center shadow-2xl">
              <Icon className="w-16 h-16 text-purple-600 dark:text-cyan-400" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-5xl font-bold mb-4 mt-4 py-2 bg-gradient-to-r
            from-purple-600 via-indigo-600 to-violet-600
            dark:from-white dark:via-cyan-100 dark:to-teal-100
            bg-clip-text text-transparent"
          style={{ lineHeight: '1.3', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
        >
          {label}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-2xl font-semibold text-slate-700 dark:text-white/90 mb-6"
        >
          Coming Soon
        </motion.p>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-lg text-slate-600 dark:text-white/70 mb-8 leading-relaxed"
        >
          This feature is currently under development. We're working hard to bring you an amazing experience!
        </motion.p>

        {/* Animated Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex justify-center gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
              className="w-3 h-3 rounded-full bg-purple-600 dark:bg-cyan-400"
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

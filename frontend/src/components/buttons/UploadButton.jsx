import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useState } from 'react';
import UploadModal from '../modals/UploadModal';

export default function UploadButton({ isVisible = true }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 0 }}
        animate={{ 
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ 
          duration: 0.3,
          ease: "easeOut"
        }}
        onClick={handleClick}
        style={{ pointerEvents: isVisible ? 'auto' : 'none', willChange: 'transform, opacity' }}
        className="fixed top-8 right-28 z-50 p-4 glass-panel rounded-2xl
                 hover:bg-white/85 dark:hover:bg-slate-900/90
                 transition-all duration-300 group"
      >
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
          style={{willChange: 'transform, opacity'}}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -inset-6 bg-gradient-to-r from-purple-600/80 via-indigo-600/70 to-violet-600/80 blur-3xl"
        />
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{willChange: 'transform'}}
        >
          <Upload className="w-6 h-6 text-purple-600 dark:text-cyan-300" />
        </motion.div>
      </motion.button>

      {/* Upload Modal */}
      <UploadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

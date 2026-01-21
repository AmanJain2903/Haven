import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Folder } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Upload Modal Component
 * Shows two options: Upload Files and Upload Folder as Album
 */
export default function UploadModal({ isOpen, onClose }) {
  // Prevent scrolling the background page while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUploadFiles = () => {
    // Placeholder: Upload files functionality
    console.log('Upload Files clicked - placeholder');
    // TODO: Implement file upload
    onClose();
  };

  const handleUploadFolderAsAlbum = () => {
    // Placeholder: Upload folder as album functionality
    console.log('Upload Folder as Album clicked - placeholder');
    // TODO: Implement folder upload as album
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative glass-panel rounded-2xl p-6 max-w-md w-full shadow-2xl"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          {/* Title */}
          <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">
            Upload to Haven Vault
          </h2>

          {/* Options */}
          <div className="space-y-4">
            {/* Upload Files Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleUploadFiles}
              className="w-full p-6 rounded-xl border-2 border-dashed 
                       border-purple-300 dark:border-purple-600/50
                       bg-purple-50/50 dark:bg-purple-900/20
                       hover:border-purple-400 dark:hover:border-purple-500
                       hover:bg-purple-100/50 dark:hover:bg-purple-900/30
                       transition-all duration-200 group"
            >
              <div className="flex items-center justify-center gap-4">
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/40 
                              group-hover:bg-purple-200 dark:group-hover:bg-purple-900/60
                              transition-colors">
                  <Upload className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                    Upload Files
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Select individual files to add to Haven Vault
                  </p>
                </div>
              </div>
            </motion.button>

            {/* Upload Folder as Album Option */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleUploadFolderAsAlbum}
              className="w-full p-6 rounded-xl border-2 border-dashed 
                       border-indigo-300 dark:border-indigo-600/50
                       bg-indigo-50/50 dark:bg-indigo-900/20
                       hover:border-indigo-400 dark:hover:border-indigo-500
                       hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30
                       transition-all duration-200 group"
            >
              <div className="flex items-center justify-center gap-4">
                <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/40 
                              group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60
                              transition-colors">
                  <Folder className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                    Upload Folder as Album
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Select a folder to create a new album
                  </p>
                </div>
              </div>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

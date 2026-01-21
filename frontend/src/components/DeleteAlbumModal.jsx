import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { api, batchDeleteAlbum, getBatchTaskStatus } from "../api";

export default function DeleteAlbumModal({ isOpen, onClose, onSuccess, albumId, albumName, updateProgressBar, removeProgressBar, hasActiveDownload, cancelAlbumDownload }) {
  const [error, setError] = useState(null);
  const [hasDownload, setHasDownload] = useState(false);

  // Check if album has active download
  useEffect(() => {
    if (isOpen && hasActiveDownload) {
      setHasDownload(hasActiveDownload(albumId));
    }
  }, [isOpen, albumId, hasActiveDownload]);

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

  const handleDelete = async () => {
    if (!updateProgressBar || !removeProgressBar) {
      console.error("Progress bar functions not provided");
      return;
    }

    // Generate unique ID for this progress bar
    const progressId = `delete-album-${Date.now()}`;

    // Close modal immediately
    onClose();

    // Navigate back to Albums page immediately
    if (onSuccess) {
      onSuccess();
    }

    try {
      // Cancel active download if it exists
      if (hasDownload && cancelAlbumDownload) {
        console.log('🚫 Cancelling active download before deleting album:', albumId);
        await cancelAlbumDownload(albumId);
      }

      // Start batch delete operation via Celery
      const { task_id } = await batchDeleteAlbum(albumId);
      console.log(`🗑️ Started batch delete task: ${task_id}`);

      // Add progress bar (in-progress state)
      updateProgressBar(progressId, {
        type: "deleting",
        label: `Deleting "${albumName}"...`,
        isVisible: true,
        current: 0,
        total: 1,
        taskId: task_id
      });

      // Poll for status every second
      const pollInterval = setInterval(async () => {
        try {
          const status = await getBatchTaskStatus(task_id);
          console.log(`📊 Delete task ${task_id} status:`, status);

          // Update progress bar
          updateProgressBar(progressId, {
            isVisible: true,
            current: status.completed || 0,
            total: status.total || 1
          });

          // Check if complete
          if (status.status === 'completed') {
            clearInterval(pollInterval);

            // Update to show success
            updateProgressBar(progressId, {
              label: `Album "${albumName}" deleted successfully!`,
              isVisible: true,
              current: 1,
              total: 1
            });

            // Reload albums list
            if (onSuccess) {
              onSuccess();
            }

            // Keep progress bar visible for 2 seconds
            setTimeout(() => {
              removeProgressBar(progressId);
            }, 2000);

          } else if (status.status === 'failed') {
            clearInterval(pollInterval);

            // Update to show error
            updateProgressBar(progressId, {
              label: `Failed to delete "${albumName}"`,
              isVisible: true,
              current: 1,
              total: 1
            });

            // Keep error visible longer
            setTimeout(() => {
              removeProgressBar(progressId);
            }, 4000);
          }
        } catch (pollError) {
          console.error('Error polling delete task status:', pollError);
          // Continue polling even on error
        }
      }, 1000); // Poll every 1 second

      // Safety: Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        removeProgressBar(progressId);
      }, 300000);

    } catch (error) {
      console.error('Error starting batch delete:', error);
      updateProgressBar(progressId, {
        type: "deleting",
        label: `Failed to start delete operation`,
        isVisible: true,
        current: 0,
        total: 1
      });
      setTimeout(() => {
        removeProgressBar(progressId);
      }, 4000);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ willChange: "opacity" }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        onClick={handleClose}
      >
        {/* Translucent Background with Blur */}
        <div className="absolute inset-0 backdrop-blur-3xl bg-white/80 dark:bg-black/80" />

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-md mx-4 glass-panel rounded-3xl p-8 shadow-2xl border-2 border-red-400/30 dark:border-red-500/30"
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 rounded-full 
              text-slate-700 dark:text-white/80 
              hover:bg-red-500/20 dark:hover:bg-red-500/20
              hover:scale-110
              transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Warning Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full bg-red-500/10 dark:bg-red-500/20 border-2 border-red-500/30 dark:border-red-500/40">
              <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Modal Header */}
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold bg-gradient-to-r
              from-red-600 via-red-600 to-red-700
              dark:from-red-400 dark:via-red-500 dark:to-red-600
              bg-clip-text text-transparent mb-2">
              Delete Album
            </h2>
            <p className="text-slate-600 dark:text-white/50 text-sm mt-2">
              This action cannot be undone
            </p>
          </div>

          {/* Confirmation Message */}
          <div className="mb-6 text-center">
            <p className="text-slate-700 dark:text-white/90 text-base">
              Are you sure you want to delete
            </p>
            <p className="text-slate-900 dark:text-white font-semibold text-lg mt-1">
              "{albumName}"
            </p>
            {hasDownload ? (
              <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                  ⚠️ This album is currently being downloaded
                </p>
                <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                  Deleting will cancel the download
                </p>
              </div>
            ) : (
              <p className="text-slate-600 dark:text-white/60 text-sm mt-2">
                All media in this album will remain, but the album will be permanently deleted.
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-6 py-3 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                text-slate-700 dark:text-white/80
                hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                hover:border-purple-400/40 dark:hover:border-cyan-400/40
                transition-all duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200
                bg-gradient-to-r from-red-600 to-red-700 dark:from-red-500 dark:to-red-600 
                text-white hover:shadow-lg hover:scale-105"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { X, Check, Play, Loader2 } from "lucide-react";
import { api } from "../api";

export default function AddFilesToAlbumModal({ isOpen, onClose, albumId, albumName, onFilesAdded, updateProgressBar, removeProgressBar }) {
  const [allFiles, setAllFiles] = useState([]);
  const [filesInAlbum, setFilesInAlbum] = useState(new Set());
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasChanges, setHasChanges] = useState(false); // Track if any changes were made
  const [totalFilesCount, setTotalFilesCount] = useState(0); // Total count from API
  const [isLoadingAll, setIsLoadingAll] = useState(false); // Loading all files for select all
  const scrollContainerRef = useRef(null);
  const LIMIT = 500;

  useEffect(() => {
    if (isOpen && albumId) {
      // Reset state when modal opens
      setAllFiles([]);
      setSkip(0);
      setHasMore(true);
      setSelectedFiles(new Set());
      setHasChanges(false); // Reset changes tracker
      setTotalFilesCount(0); // Reset total count
      setIsLoadingAll(false); // Reset loading all state
      
      // Load initial data
      loadFiles(0);
      loadAlbumFiles();
    }
  }, [isOpen, albumId]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const loadFiles = async (currentSkip = skip) => {
    if (loadingFiles) return;
    
    setLoadingFiles(true);
    try {
      const response = await api.getAllMediaThumbnails(currentSkip, LIMIT);
      setAllFiles(prev => currentSkip === 0 ? response.allMedia : [...prev, ...response.allMedia]);
      setHasMore(response.allMedia.length === LIMIT);
      setSkip(currentSkip + LIMIT);
      
      // Store total count from API
      if (response.total !== undefined) {
        setTotalFilesCount(response.total);
      }
    } catch (err) {
      console.error("Error loading files:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadAlbumFiles = async () => {
    try {
      const response = await api.getAlbumTimeline(albumId, 0, 10000); // Load all files in album
      const fileSet = new Set(
        response.timeline.map(file => `${file.type}-${file.id}`)
      );
      setFilesInAlbum(fileSet);
    } catch (err) {
      console.error("Error loading album files:", err);
    }
  };

  const handleFileClick = (file) => {
    const fileKey = `${file.type}-${file.id}`;
    
    // Don't allow selecting files already in album
    if (filesInAlbum.has(fileKey)) {
      return;
    }

    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileKey)) {
        newSet.delete(fileKey);
      } else {
        newSet.add(fileKey);
      }
      return newSet;
    });
  };

  const handleRemoveFromAlbum = async (file) => {
    const fileKey = `${file.type}-${file.id}`;
    try {
      await api.removeFromAlbum(albumId, file.type, file.id);
      // Update local state
      setFilesInAlbum(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileKey);
        return newSet;
      });
      
      // Mark that changes were made
      setHasChanges(true);
    } catch (err) {
      console.error("Error removing from album:", err);
      alert("Failed to remove file from album");
    }
  };

  const handleSelectAll = async () => {
    setIsLoadingAll(true);
    
    try {
      // Load all remaining files if not already loaded
      if (hasMore) {
        let currentSkip = allFiles.length;
        let allLoadedFiles = [...allFiles];
        
        while (currentSkip < totalFilesCount) {
          const response = await api.getAllMediaThumbnails(currentSkip, LIMIT);
          allLoadedFiles = [...allLoadedFiles, ...response.allMedia];
          currentSkip += LIMIT;
          
          if (response.allMedia.length < LIMIT) {
            break; // No more files to load
          }
        }
        
        // Update state with all files
        setAllFiles(allLoadedFiles);
        setHasMore(false);
        setSkip(allLoadedFiles.length);
        
        // Now select all files that are not already in the album
        const newSelection = new Set();
        allLoadedFiles.forEach(file => {
          const fileKey = `${file.type}-${file.id}`;
          if (!filesInAlbum.has(fileKey)) {
            newSelection.add(fileKey);
          }
        });
        setSelectedFiles(newSelection);
      } else {
        // All files already loaded, just select them
        const newSelection = new Set();
        allFiles.forEach(file => {
          const fileKey = `${file.type}-${file.id}`;
          if (!filesInAlbum.has(fileKey)) {
            newSelection.add(fileKey);
          }
        });
        setSelectedFiles(newSelection);
      }
    } catch (err) {
      console.error("Error loading all files:", err);
      alert("Failed to load all files. Please try again.");
    } finally {
      setIsLoadingAll(false);
    }
  };

  const handleDeselectAll = () => {
    setSelectedFiles(new Set());
  };

  const handleChooseFromDevice = () => {
    // Placeholder for future implementation
    console.log("Choose from device clicked");
  };

  const handleAddSelected = async () => {
    if (selectedFiles.size === 0) return;
    if (!updateProgressBar || !removeProgressBar) {
      console.error("Progress bar functions not provided");
      return;
    }

    const filesToAdd = Array.from(selectedFiles).map(fileKey => {
      const [type, id] = fileKey.split('-');
      return { type, id: parseInt(id) };
    });

    // Generate unique ID for this progress bar
    const progressId = `add-files-${Date.now()}`;

    // Close modal immediately without triggering reload
    onClose();

    try {
      // Start batch operation via Celery
      const { task_id, total } = await api.batchAddToAlbum(albumId, filesToAdd);
      console.log(`📦 Started batch add task: ${task_id}`);

      // Add progress bar
      updateProgressBar(progressId, {
        type: "adding",
        label: `Adding ${total} files to ${albumName}`,
        isVisible: true,
        current: 0,
        total: total,
        taskId: task_id
      });

      // Poll for status every second
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getBatchTaskStatus(task_id);
          console.log(`📊 Task ${task_id} status:`, status);

          // Update progress bar
          updateProgressBar(progressId, {
            isVisible: true,
            current: status.completed || 0,
            total: status.total || total
          });

          // Check if complete
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(pollInterval);

            // Keep progress bar visible for 2 seconds
            setTimeout(() => {
              removeProgressBar(progressId);
            }, 2000);

            // Notify parent to reload album data
            if (onFilesAdded) {
              onFilesAdded();
            }

            if (status.failed > 0) {
              console.warn(`⚠️ ${status.failed} files failed to add`);
            }
          }
        } catch (pollError) {
          console.error('Error polling task status:', pollError);
          // Continue polling even on error
        }
      }, 1000); // Poll every 1 second

      // Safety: Stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        removeProgressBar(progressId);
      }, 600000);

    } catch (error) {
      console.error('Error starting batch add:', error);
      updateProgressBar(progressId, {
        type: "adding",
        label: `Failed to start batch add`,
        isVisible: true,
        current: 0,
        total: filesToAdd.length
      });
      setTimeout(() => {
        removeProgressBar(progressId);
      }, 4000);
    }
  };

  const isInAlbum = (file) => {
    return filesInAlbum.has(`${file.type}-${file.id}`);
  };

  const isSelected = (file) => {
    return selectedFiles.has(`${file.type}-${file.id}`);
  };

  // Count how many files can be selected (total files - files already in album)
  const selectableFilesCount = totalFilesCount - filesInAlbum.size;

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Load more when user scrolls to within 200px of bottom
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (!loadingFiles && hasMore) {
        loadFiles(skip);
      }
    }
  };

  const handleClose = () => {
    // If changes were made, notify parent to reload
    if (hasChanges && onFilesAdded) {
      onFilesAdded();
    }
    // Close the modal
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            className="relative glass-panel rounded-2xl p-6 max-w-6xl w-full max-h-[85vh] flex flex-col border-2 border-purple-400/30 dark:border-cyan-400/30 shadow-2xl"
          >
            {/* Close Button - Top Right */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full
                       hover:bg-slate-200 dark:hover:bg-slate-700
                       transition-colors z-10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-white/70" />
            </button>

            {/* Header */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                Add Files to {albumName}
              </h2>
              
              <p className="text-slate-600 dark:text-white/60 text-sm mb-3">
                Select files to add to the album. Files already in the album are marked.
              </p>

              {/* Action Links Row */}
              <div className="flex items-center gap-4 text-sm">
                {/* Select All / Deselect All Link */}
                {totalFilesCount > 0 && selectableFilesCount > 0 && (
                  <button
                    onClick={selectedFiles.size > 0 ? handleDeselectAll : handleSelectAll}
                    disabled={isLoadingAll}
                    className="text-purple-600 dark:text-cyan-400 hover:text-purple-700 dark:hover:text-cyan-300 
                             font-medium decoration-2
                             transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center gap-1"
                  >
                    {isLoadingAll ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading all files...
                      </>
                    ) : selectedFiles.size > 0 ? (
                      'Deselect All'
                    ) : (
                      `Select All (${selectableFilesCount})`
                    )}
                  </button>
                )}

                {/* Choose From Device Link */}
                {!isLoadingAll && (
                  <button
                    onClick={handleChooseFromDevice}
                    className="text-purple-600 dark:text-cyan-400 hover:text-purple-700 dark:hover:text-cyan-300 
                             font-medium decoration-2
                             transition-colors duration-200"
                  >
                    Choose From Device
                  </button>
                )}

                {/* Selection Count */}
                {selectedFiles.size > 0 && !isLoadingAll && (
                  <span className="text-slate-600 dark:text-white/60">
                    <span className="font-semibold text-purple-600 dark:text-cyan-400">
                      {selectedFiles.size}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-purple-600 dark:text-cyan-400">
                      {selectableFilesCount}
                    </span>{" "}
                    {selectedFiles.size === 1 ? "item" : "items"} selected
                  </span>
                )}
              </div>
            </div>

            {/* Files Grid - Scrollable with Auto-load */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto mb-4"
            >
              {loadingFiles && allFiles.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 ml-4 mr-4">
                    {allFiles.map((file) => {
                      const inAlbum = isInAlbum(file);
                      const selected = isSelected(file);
                      
                      return (
                        <motion.div
                          key={`${file.type}-${file.id}`}
                          whileHover={!inAlbum ? { scale: 1.05 } : {}}
                          whileTap={!inAlbum ? { scale: 0.98 } : {}}
                          onClick={() => handleFileClick(file)}
                          className={`
                            relative aspect-square rounded-lg overflow-hidden
                            border-2 transition-all duration-200
                            ${inAlbum 
                              ? 'border-green-400/60 dark:border-green-400/60 opacity-75' 
                              : selected
                              ? 'border-purple-500 dark:border-cyan-400 shadow-lg'
                              : 'border-slate-200/40 dark:border-white/10 hover:border-purple-400/50 dark:hover:border-cyan-400/40'
                            }
                            ${!inAlbum ? 'cursor-pointer' : 'cursor-not-allowed'}
                          `}
                        >
                          {/* File Preview */}
                          {file.type === "image" && (
                            <img
                              src={file.thumbnail_url}
                              alt={file.filename}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {file.type === "video" && (
                            <>
                              <img
                                src={file.thumbnail_url}
                                alt={file.filename}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/30">
                                  <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                                </div>
                              </div>
                            </>
                          )}
                          {file.type === "raw" && (
                            <img
                              src={file.thumbnail_url}
                              alt={file.filename}
                              className="w-full h-full object-cover"
                            />
                          )}

                          {/* Selection Checkmark */}
                          {selected && !inAlbum && (
                            <div className="absolute top-1.5 right-1.5 z-10">
                              <div className="w-6 h-6 rounded-full bg-purple-500 dark:bg-cyan-400 flex items-center justify-center border-2 border-white shadow-lg">
                                <Check className="w-4 h-4 text-white" strokeWidth={3} />
                              </div>
                            </div>
                          )}

                          {/* In Album Badge */}
                          {inAlbum && (
                            <>
                              <div className="absolute inset-0 bg-green-500/20 dark:bg-green-500/20" />
                              <div className="absolute top-1.5 right-1.5 z-10">
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-white shadow-lg">
                                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                </div>
                              </div>
                              {/* Remove Button */}
                              <div className="absolute inset-x-0 bottom-0 p-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFromAlbum(file);
                                  }}
                                  className="w-full px-2 py-1 text-xs font-semibold rounded
                                           bg-red-500 hover:bg-red-600 text-white
                                           transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                  
                  {/* Loading indicator at bottom */}
                  {loadingFiles && hasMore && (
                    <div className="flex justify-center py-6">
                      <div className="w-8 h-8 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600
                         text-slate-700 dark:text-white/80 font-medium
                         hover:bg-slate-100 dark:hover:bg-slate-700
                         transition-all duration-200"
              >
                Close
              </button>
              <button
                onClick={handleAddSelected}
                disabled={selectedFiles.size === 0}
                className="px-6 py-2.5 rounded-xl
                         bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-cyan-500 dark:to-teal-500
                         text-white font-medium
                         hover:shadow-lg hover:scale-105
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                         transition-all duration-200"
              >
                Add {selectedFiles.size > 0 ? `${selectedFiles.size} ` : ''}Files
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

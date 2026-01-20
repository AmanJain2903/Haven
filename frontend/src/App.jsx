import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import PhotoGrid from './components/ImageGrid';
import VideoGrid from './components/VideoGrid';
import RawImageGrid from './components/RawImageGrid';
import AllMediaGrid from './components/AllMediaGrid';
import FavoritesGrid from './components/FavoritesGrid';
import MapView from './components/MapView';
import Albums from './components/Albums';
import ProgressBar from './components/ProgressBar';
import ComingSoon from './components/ComingSoon';
import Dashboard from './components/Dashboard';
import UploadButton from './components/UploadButton';
import InsufficientSpaceModal from './components/InsufficientSpaceModal';
import { useTheme } from './contexts/ThemeContext';

import { api, getBatchTaskStatus } from './api';

function App() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isToggleVisible, setIsToggleVisible] = useState(true);
  const [scrollTimeout, setScrollTimeout] = useState(null);
  const { isDark, toggleTheme } = useTheme();

  const [totalCount, setTotalCount] = useState(0); 

  const [statusCode, setStatusCode] = useState('');

  // 1. Add state for pagination
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 500;

  // Images-specific state
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [activeView, setActiveView] = useState(() => {
    // Restore the last active view from localStorage, default to 'all'
    return localStorage.getItem('havenActiveView') || 'all';
  });

  // Video-specific state
  const [videos, setVideos] = useState([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSkip, setVideoSkip] = useState(0);
  const [videoHasMore, setVideoHasMore] = useState(true);
  const [videoTotalCount, setVideoTotalCount] = useState(0);
  const [videoStatusCode, setVideoStatusCode] = useState('');

  // Raw image-specific state
  const [rawImages, setRawImages] = useState([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawSkip, setRawSkip] = useState(0);
  const [rawHasMore, setRawHasMore] = useState(true);
  const [rawTotalCount, setRawTotalCount] = useState(0);
  const [rawStatusCode, setRawStatusCode] = useState('');

  // All media-specific state
  const [allMedia, setAllMedia] = useState([]);
  const [allMediaLoading, setAllMediaLoading] = useState(false);
  const [allMediaSkip, setAllMediaSkip] = useState(0);
  const [allMediaHasMore, setAllMediaHasMore] = useState(true);
  const [allMediaTotalCount, setAllMediaTotalCount] = useState(0);
  const [allMediaStatusCode, setAllMediaStatusCode] = useState('');

  // Favorites-specific state
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesSkip, setFavoritesSkip] = useState(0);
  const [favoritesHasMore, setFavoritesHasMore] = useState(true);
  const [favoritesTotalCount, setFavoritesTotalCount] = useState(0);
  const [favoritesStatusCode, setFavoritesStatusCode] = useState('');

  // Progress bars state for background operations (supports multiple)
  const [progressBars, setProgressBars] = useState([]);
  const [expandedProgressBars, setExpandedProgressBars] = useState(new Set());
  const [albumDownloads, setAlbumDownloads] = useState({}); // Map albumId -> {taskId, progressId}
  const downloadPollIntervalsRef = useRef({}); // Map progressId -> intervalId
  const downloadStartedRef = useRef({}); // Map taskId -> boolean (prevents duplicate browser downloads)
  const [showInsufficientSpaceModal, setShowInsufficientSpaceModal] = useState(false);

  // Helper function to add or update a progress bar
  const updateProgressBar = useCallback((id, data) => {
    setProgressBars(prev => {
      const existing = prev.find(bar => bar.id === id);
      if (existing) {
        return prev.map(bar => bar.id === id ? { ...bar, ...data } : bar);
      }
      return [...prev, { id, ...data }];
    });

    // Persist active tasks to localStorage
    if (data.taskId) {
      const activeTasks = JSON.parse(localStorage.getItem('havenActiveTasks') || '{}');
      activeTasks[id] = {
        taskId: data.taskId,
        type: data.type,
        label: data.label,
        total: data.total,
        timestamp: Date.now()
      };
      localStorage.setItem('havenActiveTasks', JSON.stringify(activeTasks));
    }
  }, []);

  // Helper function to remove a progress bar
  const removeProgressBar = useCallback((id) => {
    setProgressBars(prev => prev.filter(bar => bar.id !== id));

    // Remove from localStorage
    const activeTasks = JSON.parse(localStorage.getItem('havenActiveTasks') || '{}');
    delete activeTasks[id];
    localStorage.setItem('havenActiveTasks', JSON.stringify(activeTasks));
  }, []);

  // Restore progress bars on mount from localStorage
  useEffect(() => {
    const restoreActiveTasks = async () => {
      const activeTasks = JSON.parse(localStorage.getItem('havenActiveTasks') || '{}');
      const taskIds = Object.keys(activeTasks);

      if (taskIds.length === 0) return;

      console.log('🔄 Restoring active tasks:', taskIds.length);

      for (const progressId of taskIds) {
        const taskInfo = activeTasks[progressId];
        
        // Skip tasks older than 1 hour (3600000 ms)
        if (Date.now() - taskInfo.timestamp > 3600000) {
          console.log('⏰ Skipping stale task:', progressId);
          delete activeTasks[progressId];
          continue;
        }

        try {
          // Check task status
          const status = await getBatchTaskStatus(taskInfo.taskId);
          console.log('📊 Restored task status:', status);

          // If still in progress, recreate the progress bar
          if (status.status === 'in_progress') {
            updateProgressBar(progressId, {
              type: taskInfo.type,
              label: taskInfo.label,
              isVisible: true,
              current: status.completed || 0,
              total: status.total || taskInfo.total,
              taskId: taskInfo.taskId
            });

            // Start polling for this task
            startPollingTask(progressId, taskInfo.taskId, taskInfo.type, taskInfo.label, status.total || taskInfo.total);
          } else {
            // Task completed or failed, remove from localStorage
            delete activeTasks[progressId];
          }
        } catch (error) {
          console.error('Error restoring task:', progressId, error);
          // Remove failed task from localStorage
          delete activeTasks[progressId];
        }
      }

      // Update localStorage with cleaned up tasks
      localStorage.setItem('havenActiveTasks', JSON.stringify(activeTasks));
    };

    restoreActiveTasks();
  }, []);

  // Helper function to start polling a task (used by both new tasks and restored tasks)
  const startPollingTask = useCallback((progressId, taskId, type, label, total) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await getBatchTaskStatus(taskId);
        console.log(`📊 Task ${taskId} status:`, status);

        // Update progress bar
        updateProgressBar(progressId, {
          isVisible: true,
          current: status.completed || 0,
          total: status.total || total
        });

        // Check if complete
        if (status.status === 'completed') {
          clearInterval(pollInterval);

          // Update label for success  
          const successLabel = type === 'deleting' 
            ? label.includes('...') 
              ? label.replace('Deleting', 'Album').replace('...', ' deleted successfully!')
              : `Album deleted successfully!`
            : label.includes('Adding')
              ? label.replace('Adding', 'Added').replace('to ', 'to ')
              : `Files added successfully!`;

          updateProgressBar(progressId, {
            label: successLabel,
            isVisible: true,
            current: status.total || total,
            total: status.total || total
          });

          // Keep progress bar visible for 2 seconds
          setTimeout(() => {
            removeProgressBar(progressId);
          }, 2000);

        } else if (status.status === 'failed') {
          clearInterval(pollInterval);

          // Update to show error
          const errorLabel = type === 'deleting' 
            ? 'Failed to delete album'
            : 'Failed to add files';

          updateProgressBar(progressId, {
            label: errorLabel,
            isVisible: true,
            current: 0,
            total: 1
          });

          // Keep error visible longer
          setTimeout(() => {
            removeProgressBar(progressId);
          }, 4000);
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

    return pollInterval;
  }, [updateProgressBar, removeProgressBar]);

  // Helper function to calculate total size needed for downloads
  const calculateTotalSizeNeeded = useCallback((currentItemSize) => {
    let totalSize = currentItemSize || 0;

    // Calculate remaining size for all running downloads
    progressBars.forEach(progressBar => {
      if (progressBar.type === 'downloading' && progressBar.size) {
        const progress = progressBar.progress || 0;
        
        // Calculate remaining percentage
        const remainingPercentage = Math.max(0, (100 - progress) / 100);
        
        // Add remaining size
        totalSize += progressBar.size * remainingPercentage;
      }
    });

    return totalSize;
  }, [progressBars]);

  // Helper function to check space availability
  const checkSpaceAvailability = useCallback(async (currentItemSize) => {
    try {
      const totalSizeNeeded = await calculateTotalSizeNeeded(currentItemSize);
      const hasSpace = await api.checkSpaceAvailable(totalSizeNeeded);
      return hasSpace;
    } catch (error) {
      console.error('Error checking space availability:', error);
      // If check fails, allow download to proceed (fail open)
      return true;
    }
  }, [calculateTotalSizeNeeded]);

  // Helper function to start polling a download task (albums)
  const startPollingDownloadTask = useCallback((progressId, taskId, albumName, albumId) => {
    let downloadTriggered = false; // Flag to prevent double downloads

    // Prevent duplicate polling intervals for the same progress bar (React StrictMode, restores, etc.)
    if (downloadPollIntervalsRef.current[progressId]) {
      return downloadPollIntervalsRef.current[progressId];
    }
    
    const pollInterval = setInterval(async () => {
      try {
        // Check if this interval was cancelled (removed from ref)
        if (!downloadPollIntervalsRef.current[progressId]) {
          console.log('🛑 Download cancelled, stopping polling:', progressId);
          clearInterval(pollInterval);
          return;
        }
        
        const status = await api.getDownloadTaskStatus(taskId);
        console.log(`📦 Download ${taskId} status:`, status);

        const completed = status.completed || 0;
        const total = status.total || 1;
        const progress = status.progress || 0;

        // Update progress bar with detailed label
        updateProgressBar(progressId, {
          label: `Preparing "${albumName}"...`,
          isVisible: true,
          current: completed,
          total: total,
          progress: progress
        });

        // Check if cancelled
        if (status.status === 'cancelled') {
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];
          
          // Update to show cancelled state
          updateProgressBar(progressId, {
            label: 'Download cancelled',
            isVisible: true,
            current: 0,
            total: 1
          });

          // Clean up backend
          setTimeout(async () => {
            try {
              await api.cleanupDownload(taskId);
              console.log('🗑️ Cleanup completed for:', taskId);
            } catch (cleanupError) {
              console.error('Cleanup error:', cleanupError);
            }
          }, 5000);
          
          // Remove progress bar after 2 seconds
          setTimeout(() => {
            removeProgressBar(progressId);
            // Remove album from tracking
            setAlbumDownloads(prev => {
              const newMap = { ...prev };
              delete newMap[albumId];
              return newMap;
            });
          }, 2000);
          
          return;
        }
        
        // Check if complete
        if (status.status === 'completed' && !downloadTriggered) {
          downloadTriggered = true; // Mark as triggered to prevent double updates
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];

          // Update label for success - file is ready in downloads folder
          const finalTotal = status.total || 1;
          updateProgressBar(progressId, {
            label: `"${albumName}" ready (${finalTotal} files)`,
            isVisible: true,
            current: finalTotal,
            total: finalTotal,
            progress: 100
          });

          console.log('✅ Download complete:', status.zip_filename, '- File available in downloads folder');

          // Keep progress bar visible for 3 seconds after completion
          setTimeout(() => {
            removeProgressBar(progressId);
            // Remove album from tracking
            setAlbumDownloads(prev => {
              const newMap = { ...prev };
              delete newMap[albumId];
              return newMap;
            });
          }, 3000);

        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];

          // Update to show error
          updateProgressBar(progressId, {
            label: `Failed to download "${albumName}"`,
            isVisible: true,
            current: 0,
            total: 1
          });

          // Cleanup Backend
          setTimeout(async () => {
            try {
              await api.cleanupDownload(taskId);
              console.log('🗑️ Cleanup completed for:', taskId);
            } catch (cleanupError) {
              console.error('Cleanup error:', cleanupError);
            }
          }, 5000);

          // Keep error visible longer
          setTimeout(() => {
            removeProgressBar(progressId);
            // Remove album from tracking
            setAlbumDownloads(prev => {
              const newMap = { ...prev };
              delete newMap[albumId];
              return newMap;
            });
          }, 4000);
        }
      } catch (pollError) {
        console.error('Error polling download status:', pollError);
        // Continue polling even on error
      }
    }, 1000); // Poll every 1 second

    // Store the interval so we can clear it if cancelled
    downloadPollIntervalsRef.current[progressId] = pollInterval;

    // Safety: Stop polling after 30 minutes (downloads can be large)
    setTimeout(() => {
      clearInterval(pollInterval);
      delete downloadPollIntervalsRef.current[progressId];
      removeProgressBar(progressId);
      // Remove album from tracking
      setAlbumDownloads(prev => {
        const newMap = { ...prev };
        delete newMap[albumId];
        return newMap;
      });
    }, 1800000);

    return pollInterval;
  }, [updateProgressBar, removeProgressBar]);

  // Helper function to start polling a vault download task
  const startPollingVaultDownload = useCallback((progressId, taskId) => {
    let downloadTriggered = false;

    if (downloadPollIntervalsRef.current[progressId]) {
      return downloadPollIntervalsRef.current[progressId];
    }
    const cleanupMapping = () => {
      setAlbumDownloads(prev => {
        const newMap = { ...prev };
        delete newMap['vault'];
        return newMap;
      });
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      if (activeDownloads[progressId]) {
        delete activeDownloads[progressId];
        localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));
      }
    };

    const pollInterval = setInterval(async () => {
      try {
        if (!downloadPollIntervalsRef.current[progressId]) {
          clearInterval(pollInterval);
          return;
        }

        const status = await api.getVaultDownloadTaskStatus(taskId);
        const completed = status.completed || 0;
        const total = status.total || 0;
        const progress = status.progress || 0;

        // Update progress bar with current status
        if (status.status === 'in_progress') {
          updateProgressBar(progressId, {
            label: `Preparing "Haven Vault"...`,
            isVisible: true,
            current: completed,
            total: total || 1,
            progress: progress
          });
        }

        if (status.status === 'cancelled') {
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];
          updateProgressBar(progressId, {
            label: 'Download cancelled',
            isVisible: true,
            current: 0,
            total: 1
          });
          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 2000);
          // Cleanup after a delay (give browser time to start download)
          setTimeout(async () => {
            try { 
              await api.cleanupVaultDownload(taskId); 
            } catch (e) { 
              console.error('Cleanup error:', e); 
            }
          }, 5000);
          return;
        }

        if (status.status === 'completed' && !downloadTriggered) {
          downloadTriggered = true;
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];

          const finalTotal = status.total || 1;
          updateProgressBar(progressId, {
            label: `"Haven Vault" ready (${finalTotal} files)`,
            isVisible: true,
            current: finalTotal,
            total: finalTotal,
            progress: 100
          });

          console.log('✅ Vault download complete:', status.zip_filename, '- File available in downloads folder');

          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 3000);
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];
          updateProgressBar(progressId, {
            label: `Failed to download Haven Vault`,
            isVisible: true,
            current: 0,
            total: 1
          });
          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 4000);
          // Cleanup after a delay (give browser time to start download)
          setTimeout(async () => {
            try { 
              await api.cleanupVaultDownload(taskId); 
            } catch (e) { 
              console.error('Cleanup error:', e); 
            }
          }, 5000);
        }
      } catch (pollError) {
        console.error('Error polling vault download status:', pollError);
      }
    }, 1000);

    downloadPollIntervalsRef.current[progressId] = pollInterval;
    setTimeout(() => {
      clearInterval(pollInterval);
      delete downloadPollIntervalsRef.current[progressId];
      removeProgressBar(progressId);
      cleanupMapping();
    }, 1800000); // 30 min

    return pollInterval;
  }, [updateProgressBar, removeProgressBar]);

  // Function to start album download
  const startAlbumDownload = useCallback(async (albumId, albumName) => {
    try {
      // Get album data to check size
      const albumData = await api.getAlbum(albumId);
      const albumSize = albumData.album_size || 0;

      // Check space availability
      const hasSpace = await checkSpaceAvailability(albumSize);
      if (!hasSpace) {
        setShowInsufficientSpaceModal(true);
        return;
      }

      // Start the download task
      const result = await api.startAlbumDownload(albumId);
      const taskId = result.task_id;
      const progressId = `download_${taskId}`;

      console.log('📦 Starting album download:', albumName, taskId);

      // Create progress bar
      updateProgressBar(progressId, {
        type: 'downloading',
        label: `Preparing "${albumName}"...`,
        isVisible: true,
        current: 0,
        total: 0,
        progress: 0,
        taskId: taskId,
        size: albumSize
      });

      // Track album-to-download mapping
      setAlbumDownloads(prev => ({
        ...prev,
        [albumId]: { taskId, progressId, downloadType: 'album' }
      }));

      // Persist to localStorage for downloads
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      activeDownloads[progressId] = {
        taskId: taskId,
        albumId: albumId,
        albumName: albumName,
        downloadType: 'album',
        timestamp: Date.now()
      };
      localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));

      // Start polling
      startPollingDownloadTask(progressId, taskId, albumName, albumId);

    } catch (error) {
      console.error('Error starting album download:', error);
      alert(`Failed to start download: ${error.message}`);
    }
  }, [updateProgressBar, startPollingDownloadTask, checkSpaceAvailability]);

  // Function to start Haven Vault download
  const startVaultDownload = useCallback(async () => {
    try {
      // Get storage path and vault data breakdown to calculate size
      const storagePath = await api.getStoragePath();
      if (!storagePath) {
        alert('Storage path not configured');
        return;
      }

      const vaultBreakdown = await api.getHavenVaultDataBreakdown(storagePath);
      const vaultSize = vaultBreakdown.total_size || 0;

      // Check space availability
      const hasSpace = await checkSpaceAvailability(vaultSize);
      if (!hasSpace) {
        setShowInsufficientSpaceModal(true);
        return;
      }

      const result = await api.startVaultDownload();
      const taskId = result.task_id;
      const progressId = `vault_${taskId}`;
      const albumName = 'Haven Vault';
      const albumId = 'vault';

      updateProgressBar(progressId, {
        type: 'downloading',
        label: `Preparing "${albumName}"...`,
        isVisible: true,
        current: 0,
        total: 0,
        progress: 0,
        taskId,
        size: vaultSize
      });

      // Track in mapping
      setAlbumDownloads(prev => ({
        ...prev,
        [albumId]: { taskId, progressId, downloadType: 'vault' }
      }));

      // Persist to localStorage
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      activeDownloads[progressId] = {
        taskId,
        albumId,
        albumName,
        downloadType: 'vault',
        timestamp: Date.now()
      };
      localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));

      // Start polling
      startPollingVaultDownload(progressId, taskId);
    } catch (error) {
      console.error('Error starting vault download:', error);
      alert(`Failed to start Haven Vault download: ${error.message}`);
    }
  }, [updateProgressBar, startPollingVaultDownload, checkSpaceAvailability]);

  // Helper function to start polling an app data download task
  const startPollingAppDataDownload = useCallback((progressId, taskId) => {
    let downloadTriggered = false;

    if (downloadPollIntervalsRef.current[progressId]) {
      return downloadPollIntervalsRef.current[progressId];
    }
    const cleanupMapping = () => {
      setAlbumDownloads(prev => {
        const newMap = { ...prev };
        delete newMap['appdata'];
        return newMap;
      });
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      if (activeDownloads[progressId]) {
        delete activeDownloads[progressId];
        localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));
      }
    };

    const pollInterval = setInterval(async () => {
      try {
        if (!downloadPollIntervalsRef.current[progressId]) {
          clearInterval(pollInterval);
          return;
        }

        const status = await api.getAppDataDownloadTaskStatus(taskId);
        const completed = status.completed || 0;
        const total = status.total || 0;
        const progress = status.progress || 0;

        // Update progress bar with current status
        if (status.status === 'in_progress') {
          updateProgressBar(progressId, {
            label: `Preparing "Haven App Data"...`,
            isVisible: true,
            current: completed,
            total: total || 1,
            progress: progress
          });
        }

        if (status.status === 'cancelled') {
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];
          updateProgressBar(progressId, {
            label: 'Download cancelled',
            isVisible: true,
            current: 0,
            total: 1
          });
          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 2000);
          // Cleanup after a delay
          setTimeout(async () => {
            try { 
              await api.cleanupAppDataDownload(taskId); 
            } catch (e) { 
              console.error('Cleanup error:', e); 
            }
          }, 5000);
          return;
        }

        if (status.status === 'completed' && !downloadTriggered) {
          downloadTriggered = true;
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];

          const finalTotal = status.total || 1;
          updateProgressBar(progressId, {
            label: `"Haven App Data" ready (${finalTotal} files)`,
            isVisible: true,
            current: finalTotal,
            total: finalTotal,
            progress: 100
          });

          console.log('✅ App data download complete:', status.zip_filename, '- File available in downloads folder');

          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 3000);
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];
          updateProgressBar(progressId, {
            label: `Failed to download Haven App Data`,
            isVisible: true,
            current: 0,
            total: 1
          });
          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 4000);
          // Cleanup after a delay
          setTimeout(async () => {
            try { 
              await api.cleanupAppDataDownload(taskId); 
            } catch (e) { 
              console.error('Cleanup error:', e); 
            }
          }, 5000);
        }
      } catch (pollError) {
        console.error('Error polling app data download status:', pollError);
      }
    }, 1000);

    downloadPollIntervalsRef.current[progressId] = pollInterval;
    setTimeout(() => {
      clearInterval(pollInterval);
      delete downloadPollIntervalsRef.current[progressId];
      removeProgressBar(progressId);
      cleanupMapping();
    }, 1800000); // 30 min

    return pollInterval;
  }, [updateProgressBar, removeProgressBar]);

  // Helper function to start polling a metadata download task
  const startPollingMetadataDownload = useCallback((progressId, taskId) => {
    let downloadTriggered = false;

    if (downloadPollIntervalsRef.current[progressId]) {
      return downloadPollIntervalsRef.current[progressId];
    }

    const cleanupMapping = () => {
      setAlbumDownloads(prev => {
        const newMap = { ...prev };
        delete newMap['metadata'];
        return newMap;
      });
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      if (activeDownloads[progressId]) {
        delete activeDownloads[progressId];
        localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));
      }
    };

    const pollInterval = setInterval(async () => {
      try {
        if (!downloadPollIntervalsRef.current[progressId]) {
          clearInterval(pollInterval);
          return;
        }

        const status = await api.getMetadataDownloadTaskStatus(taskId);
        const completed = status.completed || 0;
        const total = status.total || 0;
        const progress = status.progress || 0;

        // Update progress bar with current status
        if (status.status === 'in_progress') {
          updateProgressBar(progressId, {
            label: `Preparing "Metadata"...`,
            isVisible: true,
            current: completed,
            total: total || 1,
            progress: progress
          });
        }

        if (status.status === 'cancelled') {
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];
          updateProgressBar(progressId, {
            label: 'Download cancelled',
            isVisible: true,
            current: 0,
            total: 1
          });
          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 2000);
          // Cleanup after a delay
          setTimeout(async () => {
            try { 
              await api.cleanupMetadataDownload(taskId); 
            } catch (e) { 
              console.error('Cleanup error:', e); 
            }
          }, 5000);
          return;
        }

        if (status.status === 'completed' && !downloadTriggered) {
          downloadTriggered = true;
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];

          const finalTotal = status.total || 1;
          updateProgressBar(progressId, {
            label: `"Metadata" ready (${finalTotal} files)`,
            isVisible: true,
            current: finalTotal,
            total: finalTotal,
            progress: 100
          });

          console.log('✅ Metadata download complete:', status.zip_filename, '- File available in downloads folder');

          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 3000);
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          delete downloadPollIntervalsRef.current[progressId];
          updateProgressBar(progressId, {
            label: `Failed to download Metadata`,
            isVisible: true,
            current: 0,
            total: 1
          });
          cleanupMapping();
          setTimeout(() => removeProgressBar(progressId), 4000);
          // Cleanup after a delay
          setTimeout(async () => {
            try { 
              await api.cleanupMetadataDownload(taskId); 
            } catch (e) { 
              console.error('Cleanup error:', e); 
            }
          }, 5000);
        }
      } catch (pollError) {
        console.error('Error polling metadata download status:', pollError);
      }
    }, 1000);

    downloadPollIntervalsRef.current[progressId] = pollInterval;
    setTimeout(() => {
      clearInterval(pollInterval);
      delete downloadPollIntervalsRef.current[progressId];
      removeProgressBar(progressId);
      cleanupMapping();
    }, 1800000); // 30 min

    return pollInterval;
  }, [updateProgressBar, removeProgressBar]);

  // Function to start Haven App Data download
  const startAppDataDownload = useCallback(async () => {
    try {
      // Get app data size
      const appDataSize = await api.getHavenAppDataSize();

      // Check space availability
      const hasSpace = await checkSpaceAvailability(appDataSize);
      if (!hasSpace) {
        setShowInsufficientSpaceModal(true);
        return;
      }

      const result = await api.startAppDataDownload();
      const taskId = result.task_id;
      const progressId = `appdata_${taskId}`;
      const albumName = 'Haven App Data';
      const albumId = 'appdata';

      updateProgressBar(progressId, {
        type: 'downloading',
        label: `Preparing "${albumName}"...`,
        isVisible: true,
        current: 0,
        total: 0,
        progress: 0,
        taskId,
        size: appDataSize
      });

      // Track in mapping
      setAlbumDownloads(prev => ({
        ...prev,
        [albumId]: { taskId, progressId, downloadType: 'appdata' }
      }));

      // Persist to localStorage
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      activeDownloads[progressId] = {
        taskId,
        albumId,
        albumName,
        downloadType: 'appdata',
        timestamp: Date.now()
      };
      localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));

      // Start polling
      startPollingAppDataDownload(progressId, taskId);
    } catch (error) {
      console.error('Error starting app data download:', error);
      alert(`Failed to start Haven App Data download: ${error.message}`);
    }
  }, [updateProgressBar, startPollingAppDataDownload, checkSpaceAvailability]);

  // Function to start Metadata download
  const startMetadataDownload = useCallback(async () => {
    try {
      // Get metadata information to calculate size
      const metadataInfo = await api.getMetadataInformation();
      const metadataSize = metadataInfo.total_size_bytes || 0;

      // Check space availability
      const hasSpace = await checkSpaceAvailability(metadataSize);
      if (!hasSpace) {
        setShowInsufficientSpaceModal(true);
        return;
      }

      const result = await api.startMetadataDownload();
      const taskId = result.task_id;
      const progressId = `metadata_${taskId}`;
      const albumName = 'Haven Metadata';
      const albumId = 'metadata';

      updateProgressBar(progressId, {
        type: 'downloading',
        label: `Preparing "${albumName}"...`,
        isVisible: true,
        current: 0,
        total: 0,
        progress: 0,
        taskId,
        size: metadataSize
      });

      // Track in mapping
      setAlbumDownloads(prev => ({
        ...prev,
        [albumId]: { taskId, progressId, downloadType: 'metadata' }
      }));

      // Persist to localStorage
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      activeDownloads[progressId] = {
        taskId,
        albumId,
        albumName,
        downloadType: 'metadata',
        timestamp: Date.now()
      };
      localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));

      // Start polling
      startPollingMetadataDownload(progressId, taskId);
    } catch (error) {
      console.error('Error starting metadata download:', error);
      alert(`Failed to start Metadata download: ${error.message}`);
    }
  }, [updateProgressBar, startPollingMetadataDownload, checkSpaceAvailability]);

  // Restore active downloads on mount
  useEffect(() => {
    const restoreActiveDownloads = async () => {
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      const downloadIds = Object.keys(activeDownloads);

      if (downloadIds.length === 0) return;

      console.log('🔄 Restoring active downloads:', downloadIds.length);

      const restoredMapping = {};

      for (const progressId of downloadIds) {
        const downloadInfo = activeDownloads[progressId];

        // If we already started polling this progressId in this session, skip
        if (downloadPollIntervalsRef.current[progressId]) {
          continue;
        }
        
        // Skip downloads older than 2 hours (7200000 ms)
        if (Date.now() - downloadInfo.timestamp > 7200000) {
          console.log('⏰ Skipping stale download:', progressId);
          delete activeDownloads[progressId];
          continue;
        }

        const downloadType = downloadInfo.downloadType || 'album';
        const labelName =
          downloadType === 'vault'
            ? 'Haven Vault'
            : downloadType === 'appdata'
              ? 'Haven App Data'
              : downloadType === 'metadata'
                ? 'Metadata'
                : downloadInfo.albumName;

        try {
          let status;
          if (downloadType === 'vault') {
            status = await api.getVaultDownloadTaskStatus(downloadInfo.taskId);
          } else if (downloadType === 'appdata') {
            status = await api.getAppDataDownloadTaskStatus(downloadInfo.taskId);
          } else if (downloadType === 'metadata') {
            status = await api.getMetadataDownloadTaskStatus(downloadInfo.taskId);
          } else {
            status = await api.getDownloadTaskStatus(downloadInfo.taskId);
          }
          console.log('📊 Restored download status:', status);

          if (status.status === 'in_progress') {
            const completed = status.completed || 0;
            const total = status.total || 0;
            const progress = status.progress || 0;

            updateProgressBar(progressId, {
              type: 'downloading',
              label: `Preparing "${labelName}"...`,
              isVisible: true,
              current: completed,
              total: total,
              progress: progress,
              taskId: downloadInfo.taskId
            });

            restoredMapping[downloadInfo.albumId] = {
              taskId: downloadInfo.taskId,
              progressId: progressId,
              downloadType
            };

            if (downloadType === 'vault') {
              startPollingVaultDownload(progressId, downloadInfo.taskId);
            } else if (downloadType === 'appdata') {
              startPollingAppDataDownload(progressId, downloadInfo.taskId);
            } else if (downloadType === 'metadata') {
              startPollingMetadataDownload(progressId, downloadInfo.taskId);
            } else {
              startPollingDownloadTask(progressId, downloadInfo.taskId, labelName, downloadInfo.albumId);
            }
          } else if (status.status === 'completed') {
            // Completed while the app was reloading: file is already in downloads folder
            console.log('✅ Download was completed:', downloadInfo.taskId, '- File available in downloads folder');
            
            // Remove from active downloads since it's already complete
            delete activeDownloads[progressId];
          } else {
            delete activeDownloads[progressId];
          }
        } catch (error) {
          console.error('Error restoring download:', progressId, error);
          delete activeDownloads[progressId];
        }
      }

      // Update localStorage with cleaned up downloads
      localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));
      
      // Restore album download mapping
      if (Object.keys(restoredMapping).length > 0) {
        setAlbumDownloads(restoredMapping);
      }
    };

    restoreActiveDownloads();
  }, [updateProgressBar, startPollingDownloadTask]);

  // Global favorite toggle handler
  const handleGlobalFavoriteToggle = useCallback(async (id, type, newFavoriteState) => {
    // Helper function to update is_favorite in an array
    const updateItemInArray = (items) => {
      if (!items || !Array.isArray(items)) return items || [];
      return items.map(item => {
        // Match by both id and type for mixed arrays (like allMedia, favorites)
        const itemType = item.type || (type === 'image' ? 'image' : type === 'video' ? 'video' : 'raw');
        if (item.id === id && itemType === type) {
          return { ...item, is_favorite: newFavoriteState };
        }
        return item;
      });
    };

    // Store reference to find the item details
    let itemToAdd = null;

    // Update all relevant state arrays and find the item being favorited
    setPhotos(prevPhotos => {
      const updated = updateItemInArray(prevPhotos);
      if (newFavoriteState && type === 'image' && !itemToAdd) {
        itemToAdd = updated.find(item => item.id === id);
      }
      return updated;
    });
    setVideos(prevVideos => {
      const updated = updateItemInArray(prevVideos);
      if (newFavoriteState && type === 'video' && !itemToAdd) {
        itemToAdd = updated.find(item => item.id === id);
      }
      return updated;
    });
    setRawImages(prevRaw => {
      const updated = updateItemInArray(prevRaw);
      if (newFavoriteState && type === 'raw' && !itemToAdd) {
        itemToAdd = updated.find(item => item.id === id);
      }
      return updated;
    });
    setAllMedia(prevAll => {
      const updated = updateItemInArray(prevAll);
      if (newFavoriteState && !itemToAdd) {
        itemToAdd = updated.find(item => {
          const itemType = item.type || 'image';
          return item.id === id && itemType === type;
        });
      }
      return updated;
    });

    // Optimistically update favorites array
    setFavorites(prevFavs => {
      const safePrevFavs = prevFavs || [];
      if (newFavoriteState) {
        // Item was favorited - check if it already exists in favorites
        const exists = safePrevFavs.some(item => {
          const itemType = item.type || 'image';
          return item.id === id && itemType === type;
        });
        
        if (exists) {
          // Update existing item
          return updateItemInArray(safePrevFavs);
        } else if (itemToAdd) {
          // Add new item to the beginning of the array (most recent first)
          return [itemToAdd, ...safePrevFavs];
        }
        return safePrevFavs;
      } else {
        // Item was unfavorited, remove it from favorites list
        const itemType = type === 'image' ? 'image' : type === 'video' ? 'video' : 'raw';
        return safePrevFavs.filter(item => {
          const favType = item.type || itemType;
          return !(item.id === id && favType === type);
        });
      }
    });

    // Update count optimistically
    setFavoritesTotalCount(prev => newFavoriteState ? prev + 1 : Math.max(0, prev - 1));

    // If favoriting, refresh favorites data from backend to get proper thumbnails
    if (newFavoriteState) {
      setFavorites([]);
      setFavoritesLoading(true);
      setFavoritesSkip(0);
      setFavoritesHasMore(true);
      setFavoritesStatusCode('');
    
    loadMoreFavorites();
    }
  }, [LIMIT]);

  // Handle location update - reload current view while maintaining scroll position
  const handleLocationUpdate = useCallback(async () => {
    // Reload data for the current view, maintaining the current scroll position
    // by reloading all items up to the current skip value
    
    if (activeView === 'all') {
      if (allMediaSkip === 0) return; // No data loaded yet
      
      setAllMediaLoading(true);
      try {
        let response;
        if (searchQuery) {
          response = await api.searchAllMedia(searchQuery, 0, allMediaSkip);
        } else {
          response = await api.getAllMediaThumbnails(0, allMediaSkip);
        }
        
        const { allMedia: reloadedMedia, total } = response;
        setAllMedia(reloadedMedia);
        setAllMediaTotalCount(total);
        setAllMediaHasMore(reloadedMedia.length >= allMediaSkip);
      } catch (error) {
        console.error('Failed to reload all media:', error);
      } finally {
        setAllMediaLoading(false);
      }
    } else if (activeView === 'photos') {
      if (skip === 0) return;
      
      setLoading(true);
      try {
        let response;
        if (searchQuery) {
          response = await api.searchPhotos(searchQuery, 0, skip);
        } else {
          response = await api.getThumbnails(0, skip);
        }
        
        const { photos: reloadedPhotos, total } = response;
        setPhotos(reloadedPhotos);
        setTotalCount(total);
        setHasMore(reloadedPhotos.length >= skip);
      } catch (error) {
        console.error('Failed to reload photos:', error);
      } finally {
        setLoading(false);
      }
    } else if (activeView === 'videos') {
      if (videoSkip === 0) return;
      
      setVideoLoading(true);
      try {
        let response;
        if (searchQuery) {
          response = await api.searchVideos(searchQuery, 0, videoSkip);
        } else {
          response = await api.getVideoThumbnails(0, videoSkip);
        }
        
        const { videos: reloadedVideos, total } = response;
        setVideos(reloadedVideos);
        setVideoTotalCount(total);
        setVideoHasMore(reloadedVideos.length >= videoSkip);
      } catch (error) {
        console.error('Failed to reload videos:', error);
      } finally {
        setVideoLoading(false);
      }
    } else if (activeView === 'raw') {
      if (rawSkip === 0) return;
      
      setRawLoading(true);
      try {
        let response;
        if (searchQuery) {
          response = await api.searchRawImages(searchQuery, 0, rawSkip);
        } else {
          response = await api.getRawThumbnails(0, rawSkip);
        }
        
        const { rawImages: reloadedRawImages, total } = response;
        setRawImages(reloadedRawImages);
        setRawTotalCount(total);
        setRawHasMore(reloadedRawImages.length >= rawSkip);
      } catch (error) {
        console.error('Failed to reload raw images:', error);
      } finally {
        setRawLoading(false);
      }
    } else if (activeView === 'favorites') {
      if (favoritesSkip === 0) return;
      
      setFavoritesLoading(true);
      try {
        let response;
        if (searchQuery) {
          response = await api.searchFavorites(searchQuery, 0, favoritesSkip);
        } else {
          response = await api.getAllFavoritesThumbnails(0, favoritesSkip);
        }
        
        const { favorites: reloadedFavorites, total } = response;
        setFavorites(reloadedFavorites);
        setFavoritesTotalCount(total);
        setFavoritesHasMore(reloadedFavorites.length >= favoritesSkip);
      } catch (error) {
        console.error('Failed to reload favorites:', error);
      } finally {
        setFavoritesLoading(false);
      }
    }
  }, [activeView, skip, videoSkip, rawSkip, allMediaSkip, favoritesSkip, searchQuery]);

  // Handle delete - remove item from state and update count
  // Check if an album has an active download
  const hasActiveDownload = useCallback((albumId) => {
    return albumDownloads.hasOwnProperty(albumId);
  }, [albumDownloads]);

  // Cancel an active download (album or vault)
  const cancelAlbumDownload = useCallback(async (albumId) => {
    const downloadInfo = albumDownloads[albumId];
    if (!downloadInfo) {
      console.log('No active download found for album:', albumId);
      return;
    }

    const { taskId, progressId, downloadType } = downloadInfo;
    
    try {
      // Clear the polling interval first to stop updates
      const pollInterval = downloadPollIntervalsRef.current[progressId];
      if (pollInterval) {
        clearInterval(pollInterval);
        delete downloadPollIntervalsRef.current[progressId];
        console.log('🛑 Stopped polling for:', progressId);
      }
      
      // Cancel the backend task
      if (downloadType === 'vault') {
        await api.cancelVaultDownload(taskId);
      } else if (downloadType === 'appdata') {
        await api.cancelAppDataDownload(taskId);
      } else {
        await api.cancelDownload(taskId);
      }
      console.log('🚫 Cancelled download:', taskId);
      
      // Update progress bar to show cancelled state
      updateProgressBar(progressId, {
        label: 'Download cancelled',
        isVisible: true,
        current: 0,
        total: 1
      });
      
      // Cleanup backend files after a delay
      setTimeout(async () => {
        try {
          if (downloadType === 'vault') {
            await api.cleanupVaultDownload(taskId);
          } else if (downloadType === 'appdata') {
            await api.cleanupAppDataDownload(taskId);
          } else {
            await api.cleanupDownload(taskId);
          }
          console.log('🗑️ Cleanup completed for:', taskId);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }, 5000);
      
      // Remove progress bar after 2 seconds
      setTimeout(() => {
        removeProgressBar(progressId);
      }, 2000);
      
      // Remove from tracking
      setAlbumDownloads(prev => {
        const newMap = { ...prev };
        delete newMap[albumId];
        return newMap;
      });
      
      // Clean up localStorage
      const activeDownloads = JSON.parse(localStorage.getItem('havenActiveDownloads') || '{}');
      delete activeDownloads[progressId];
      localStorage.setItem('havenActiveDownloads', JSON.stringify(activeDownloads));
      
    } catch (error) {
      console.error('Error cancelling download:', error);
      alert(`Failed to cancel download: ${error.message}`);
    }
  }, [albumDownloads, updateProgressBar, removeProgressBar]);

  // Cancel vault download specifically
  const cancelVaultDownload = useCallback(async () => {
    await cancelAlbumDownload('vault');
  }, [cancelAlbumDownload]);

  // Check if vault download is active
  const hasActiveVaultDownload = useCallback(() => {
    return albumDownloads.hasOwnProperty('vault');
  }, [albumDownloads]);

  const cancelAppDataDownload = useCallback(async () => {
    await cancelAlbumDownload('appdata');
  }, [cancelAlbumDownload]);

  const hasActiveAppDataDownload = useCallback(() => {
    return albumDownloads.hasOwnProperty('appdata');
  }, [albumDownloads]);

  const cancelMetadataDownload = useCallback(async () => {
    await cancelAlbumDownload('metadata');
  }, [cancelAlbumDownload]);

  const hasActiveMetadataDownload = useCallback(() => {
    return albumDownloads.hasOwnProperty('metadata');
  }, [albumDownloads]);

  const handleDelete = useCallback((id, type) => {
    // Helper function to remove item from an array
    const removeItemFromArray = (items) => {
      if (!items || !Array.isArray(items)) return items || [];
      return items.filter(item => {
        // Match by both id and type for mixed arrays (like allMedia, favorites)
        const itemType = item.type || (type === 'image' ? 'image' : type === 'video' ? 'video' : 'raw');
        return !(item.id === id && itemType === type);
      });
    };

    // Update all relevant state arrays
    if (type === 'image') {
      setPhotos(prev => removeItemFromArray(prev));
      setTotalCount(prev => Math.max(0, prev - 1));
    } else if (type === 'video') {
      setVideos(prev => removeItemFromArray(prev));
      setVideoTotalCount(prev => Math.max(0, prev - 1));
    } else if (type === 'raw') {
      setRawImages(prev => removeItemFromArray(prev));
      setRawTotalCount(prev => Math.max(0, prev - 1));
    }

    // Always update allMedia and favorites arrays (file might be in there)
    setAllMedia(prev => removeItemFromArray(prev));
    setAllMediaTotalCount(prev => Math.max(0, prev - 1));
    setFavorites(prev => removeItemFromArray(prev));
    setFavoritesTotalCount(prev => Math.max(0, prev - 1));
  }, []);

  // --- UNIFIED LOAD FUNCTION ---
  // We use useCallback to prevent infinite loops when passed to useEffect
  const loadMorePhotos = useCallback(async () => {
      if (loading || !hasMore) return;

      setLoading(true);
      try {
          let response;
          console.log(`Loading... Skip: ${skip}, Limit: ${LIMIT}`);

          // BRANCH LOGIC: Check if we are searching or viewing timeline
          if (searchQuery) {
             // Load Search Results
             response = await api.searchPhotos(searchQuery, skip, LIMIT);
          } else {
             // Load Normal Timeline
             response = await api.getThumbnails(skip, LIMIT);
          }
          
          const { photos: newPhotos, total } = response;

          // UPDATE TOTAL COUNT (Only needed on first page, but safe to do always)
          if (skip === 0) {
              setTotalCount(total); 
          }

          if (newPhotos.length < LIMIT) {
              setHasMore(false); // No more photos in DB
          }
          
          // Append new photos to existing ones
          setPhotos(prev => {
              // Safety: Filter duplicates based on ID just in case
              const existingIds = new Set(prev.map(p => p.id));
              const uniqueNew = newPhotos.filter(p => !existingIds.has(p.id));
              return [...prev, ...uniqueNew];
          });

          // Increase skip for next time
          setSkip(prev => prev + LIMIT);

      } catch (error) {
          console.error("Failed to load photos:", error);
          if (error.response && error.response.status === 503) {
            setStatusCode('503');
          }
      } finally {
          setLoading(false);
      }
  }, [skip, loading, hasMore, searchQuery, totalCount]); // Dependencies

  // Load content when view changes (or on initial mount)
  // This handles:
  // 1. Initial load (activeView is 'photos' on mount)
  // 2. View switching (Photos ↔ Videos)
  // 3. Loading after search/reset when switching views
  useEffect(() => {
    // Load photos if on photos view and array is empty
    if (activeView === 'photos' && photos.length === 0 && !loading) {
      if (searchQuery) {
        // Active search exists, search photos
        setLoading(true);
        api.searchPhotos(searchQuery, 0, LIMIT)
          .then(response => {
            const { photos: results, total } = response;
            setPhotos(results);
            setTotalCount(total);
            setHasMore(results.length >= LIMIT);
            setSkip(LIMIT);
          })
          .catch(error => {
            console.error('Photo search error:', error);
            if (error.response?.status === 503) {
              setStatusCode('503');
            }
          })
          .finally(() => setLoading(false));
      } else {
        // No search, load normal timeline
        loadMorePhotos();
      }
    }
    
    // Load videos if on videos view and array is empty
    if (activeView === 'videos' && videos.length === 0 && !videoLoading) {
      if (searchQuery) {
        // Active search exists, search videos
        setVideoLoading(true);
        api.searchVideos(searchQuery, 0, LIMIT)
          .then(response => {
            const { videos: results, total } = response;
            setVideos(results);
            setVideoTotalCount(total);
            setVideoHasMore(results.length >= LIMIT);
            setVideoSkip(LIMIT);
          })
          .catch(error => {
            console.error('Video search error:', error);
            if (error.response?.status === 503) {
              setVideoStatusCode('503');
            }
          })
          .finally(() => setVideoLoading(false));
      } else {
        // No search, load normal timeline
        loadMoreVideos();
      }
    }
    
    // Load raw images if on raw view and array is empty
    if (activeView === 'raw' && rawImages.length === 0 && !rawLoading) {
      if (searchQuery) {
        // Active search exists, search raw images
        setRawLoading(true);
        api.searchRawImages(searchQuery, 0, LIMIT)
          .then(response => {
            const { rawImages: results, total } = response;
            setRawImages(results);
            setRawTotalCount(total);
            setRawHasMore(results.length >= LIMIT);
            setRawSkip(LIMIT);
          })
          .catch(error => {
            console.error('Raw image search error:', error);
            if (error.response?.status === 503) {
              setRawStatusCode('503');
            }
          })
          .finally(() => setRawLoading(false));
      } else {
        // No search, load normal timeline
        loadMoreRawImages();
      }
    }
    
    // Load all media if on all view and array is empty
    if (activeView === 'all' && allMedia.length === 0 && !allMediaLoading) {
      if (searchQuery) {
        // Active search exists, search all media
        setAllMediaLoading(true);
        api.searchAllMedia(searchQuery, 0, LIMIT)
          .then(response => {
            const { allMedia: results, total } = response;
            setAllMedia(results);
            setAllMediaTotalCount(total);
            setAllMediaHasMore(results.length >= LIMIT);
            setAllMediaSkip(LIMIT);
          })
          .catch(error => {
            console.error('All media search error:', error);
            if (error.response?.status === 503) {
              setAllMediaStatusCode('503');
            }
          })
          .finally(() => setAllMediaLoading(false));
      } else {
        // No search, load normal timeline
        loadMoreAllMedia();
      }
    }
    
    // Load favorites if on favorites view and array is empty
    if (activeView === 'favorites' && favorites.length === 0 && !favoritesLoading) {
      if (searchQuery) {
        // Active search exists, search favorites
        setFavoritesLoading(true);
        api.searchFavorites(searchQuery, 0, LIMIT)
          .then(response => {
            const { favorites: results, total } = response;
            setFavorites(results);
            setFavoritesTotalCount(total);
            setFavoritesHasMore(results.length >= LIMIT);
            setFavoritesSkip(LIMIT);
          })
          .catch(error => {
            console.error('Favorites search error:', error);
            if (error.response?.status === 503) {
              setFavoritesStatusCode('503');
            }
          })
          .finally(() => setFavoritesLoading(false));
      } else {
        // No search, load normal timeline
        loadMoreFavorites();
      }
    }
  }, [activeView]); // Only runs when activeView changes (including initial mount)

  // Handle Search
  const handleSearch = async (query) => {
    if (!query || !query.trim()) {
      return handleReset();
    }

    // 1. Set search query
    setSearchQuery(query);
    setSearchInputValue(query);
    
    // 2. Clear ALL content (photos, videos, raw images) so switching views will trigger search
    setPhotos([]);
    setSkip(0);
    setHasMore(true);
    
    setVideos([]);
    setVideoSkip(0);
    setVideoHasMore(true);
    
    setRawImages([]);
    setRawSkip(0);
    setRawHasMore(true);
    
    setAllMedia([]);
    setAllMediaSkip(0);
    setAllMediaHasMore(true);
    
    setFavorites([]);
    setFavoritesSkip(0);
    setFavoritesHasMore(true);
    
    // 3. Search only for the current active view
    if (activeView === 'all') {
      setAllMediaLoading(true);
      
      try {
        let response = await api.searchAllMedia(query, 0, LIMIT);
        const { allMedia: results, total } = response;
        setAllMedia(results);
        setAllMediaTotalCount(total);
        
        if (results.length < LIMIT) {
          setAllMediaHasMore(false);
        }
        setAllMediaSkip(LIMIT);
        
      } catch (e) {
        console.error('All media search error:', e);
        if (e.response && e.response.status === 503) {
          setAllMediaStatusCode('503');
        }
      } finally {
        setAllMediaLoading(false);
        window.scrollTo(0, 0);
      }
    } else if (activeView === 'favorites') {
      setFavoritesLoading(true);
      
      try {
        let response = await api.searchFavorites(query, 0, LIMIT);
        const { favorites: results, total } = response;
        setFavorites(results);
        setFavoritesTotalCount(total);
        
        if (results.length < LIMIT) {
          setFavoritesHasMore(false);
        }
        setFavoritesSkip(LIMIT);
        
      } catch (e) {
        console.error('Favorites search error:', e);
        if (e.response && e.response.status === 503) {
          setFavoritesStatusCode('503');
        }
      } finally {
        setFavoritesLoading(false);
        window.scrollTo(0, 0);
      }
    } else if (activeView === 'raw') {
      setRawLoading(true);
      
      try {
        let response = await api.searchRawImages(query, 0, LIMIT);
        const { rawImages: results, total } = response;
        setRawImages(results);
        setRawTotalCount(total);
        
        if (results.length < LIMIT) {
          setRawHasMore(false);
        }
        setRawSkip(LIMIT);
        
      } catch (e) {
        console.error('Raw image search error:', e);
        if (e.response && e.response.status === 503) {
          setRawStatusCode('503');
        }
      } finally {
        setRawLoading(false);
        window.scrollTo(0, 0);
      }
    } else if (activeView === 'videos') {
      setVideoLoading(true);
      
      try {
        let response = await api.searchVideos(query, 0, LIMIT);
        const { videos: results, total } = response;
        setVideos(results);
        setVideoTotalCount(total);
        
        if (results.length < LIMIT) {
          setVideoHasMore(false);
        }
        setVideoSkip(LIMIT);
        
      } catch (e) {
        console.error('Video search error:', e);
        if (e.response && e.response.status === 503) {
          setVideoStatusCode('503');
        }
      } finally {
        setVideoLoading(false);
        window.scrollTo(0, 0);
      }
    } else {
      // Default to photos
      setLoading(true);
      
      try {
        let response = await api.searchPhotos(query, 0, LIMIT);
        const { photos: results, total } = response;
        setPhotos(results);
        setTotalCount(total);
        
        if (results.length < LIMIT) {
          setHasMore(false);
        }
        setSkip(LIMIT);
        
      } catch (e) {
        console.error('Photo search error:', e);
        if (e.response && e.response.status === 503) {
          setStatusCode('503');
        }
      } finally {
        setLoading(false);
        window.scrollTo(0, 0);
      }
    }
  };

  // Reset to all photos/videos
  const handleReset = async () => {
    // Clear search query
    setSearchQuery('');
    setSearchInputValue('');

    // Reset ALL state (photos, videos, and raw images)
    setPhotos([]);
    setSkip(0);
    setHasMore(true);
    setLoading(false);
    setStatusCode('');

    setVideos([]);
    setVideoSkip(0);
    setVideoHasMore(true);
    setVideoLoading(false);
    setVideoStatusCode('');

    setRawImages([]);
    setRawSkip(0);
    setRawHasMore(true);
    setRawLoading(false);
    setRawStatusCode('');

    setAllMedia([]);
    setAllMediaSkip(0);
    setAllMediaHasMore(true);
    setAllMediaLoading(false);
    setAllMediaStatusCode('');

    setFavorites([]);
    setFavoritesSkip(0);
    setFavoritesHasMore(true);
    setFavoritesLoading(false);
    setFavoritesStatusCode('');

    // Load content ONLY for the active view
    if (activeView === 'all') {
      setAllMediaLoading(true);
      try {
        const response = await api.getAllMediaThumbnails(0, LIMIT);
        const { allMedia: results, total } = response;
        setAllMedia(results);
        setAllMediaTotalCount(total);
        setAllMediaSkip(LIMIT);
      } catch (error) {
        console.error("Failed to reset all media timeline:", error);
        if (error.response && error.response.status === 503) {
          setAllMediaStatusCode('503');
        }
      } finally {
        setAllMediaLoading(false);
        window.scrollTo(0, 0);
      }
    } else if (activeView === 'favorites') {
      setFavoritesLoading(true);
      try {
        const response = await api.getAllFavoritesThumbnails(0, LIMIT);
        const { favorites: results, total } = response;
        setFavorites(results);
        setFavoritesTotalCount(total);
        setFavoritesSkip(LIMIT);
      } catch (error) {
        console.error("Failed to reset favorites timeline:", error);
        if (error.response && error.response.status === 503) {
          setFavoritesStatusCode('503');
        }
      } finally {
        setFavoritesLoading(false);
        window.scrollTo(0, 0);
      }
    } else if (activeView === 'raw') {
      setRawLoading(true);
      try {
        const response = await api.getRawThumbnails(0, LIMIT);
        const { rawImages: results, total } = response;
        setRawImages(results);
        setRawTotalCount(total);
        setRawSkip(LIMIT);
      } catch (error) {
        console.error("Failed to reset raw image timeline:", error);
        if (error.response && error.response.status === 503) {
          setRawStatusCode('503');
        }
      } finally {
        setRawLoading(false);
        window.scrollTo(0, 0);
      }
    } else if (activeView === 'videos') {
      setVideoLoading(true);
      try {
        const response = await api.getVideoThumbnails(0, LIMIT);
        const { videos: results, total } = response;
        setVideos(results);
        setVideoTotalCount(total);
        setVideoSkip(LIMIT);
      } catch (error) {
        console.error("Failed to reset video timeline:", error);
        if (error.response && error.response.status === 503) {
          setVideoStatusCode('503');
        }
      } finally {
        setVideoLoading(false);
        window.scrollTo(0, 0);
      }
    } else {
      // Default to photos
      setLoading(true);
      try {
        const response = await api.getThumbnails(0, LIMIT);
        const { photos: results, total } = response;
        setPhotos(results);
        setTotalCount(total);
        setSkip(LIMIT);
      } catch (error) {
        console.error("Failed to reset photo timeline:", error);
        if (error.response && error.response.status === 503) {
          setStatusCode('503');
        }
      } finally {
        setLoading(false);
        window.scrollTo(0, 0);
      }
    }
  };

  // --- VIDEO LOAD FUNCTION ---
  const loadMoreVideos = useCallback(async () => {
    if (videoLoading || !videoHasMore) return;

    setVideoLoading(true);
    try {
      let response;
      console.log(`Loading Videos... Skip: ${videoSkip}, Limit: ${LIMIT}`);
      
      // BRANCH LOGIC: Check if we are searching or viewing timeline
      if (searchQuery) {
        // Load Search Results
        response = await api.searchVideos(searchQuery, videoSkip, LIMIT);
      } else {
        // Load Normal Timeline
        response = await api.getVideoThumbnails(videoSkip, LIMIT);
      }
      
      const { videos: newVideos, total } = response;

      // Update total count on first page
      if (videoSkip === 0) {
        setVideoTotalCount(total);
      }

      if (newVideos.length < LIMIT) {
        setVideoHasMore(false);
      }
      
      // Append new videos to existing ones
      setVideos(prev => {
        const existingIds = new Set(prev.map(v => v.id));
        const uniqueNew = newVideos.filter(v => !existingIds.has(v.id));
        return [...prev, ...uniqueNew];
      });

      // Increase skip for next time
      setVideoSkip(prev => prev + LIMIT);

    } catch (error) {
      console.error("Failed to load videos:", error);
      if (error.response && error.response.status === 503) {
        setVideoStatusCode('503');
      }
    } finally {
      setVideoLoading(false);
    }
  }, [videoSkip, videoLoading, videoHasMore, searchQuery]);

  // --- RAW IMAGES LOAD FUNCTION ---
  const loadMoreRawImages = useCallback(async () => {
    if (rawLoading || !rawHasMore) return;

    setRawLoading(true);
    try {
      let response;
      console.log(`Loading RAW Images... Skip: ${rawSkip}, Limit: ${LIMIT}`);
      
      // BRANCH LOGIC: Check if we are searching or viewing timeline
      if (searchQuery) {
        // Load Search Results
        response = await api.searchRawImages(searchQuery, rawSkip, LIMIT);
      } else {
        // Load Normal Timeline
        response = await api.getRawThumbnails(rawSkip, LIMIT);
      }
      
      const { rawImages: newRawImages, total } = response;

      // Update total count on first page
      if (rawSkip === 0) {
        setRawTotalCount(total);
      }

      if (newRawImages.length < LIMIT) {
        setRawHasMore(false);
      }
      
      // Append new raw images to existing ones
      setRawImages(prev => {
        const existingIds = new Set(prev.map(r => r.id));
        const uniqueNew = newRawImages.filter(r => !existingIds.has(r.id));
        return [...prev, ...uniqueNew];
      });

      // Increase skip for next time
      setRawSkip(prev => prev + LIMIT);

    } catch (error) {
      console.error("Failed to load raw images:", error);
      if (error.response && error.response.status === 503) {
        setRawStatusCode('503');
      }
    } finally {
      setRawLoading(false);
    }
  }, [rawSkip, rawLoading, rawHasMore, searchQuery]);

  // --- ALL MEDIA LOAD FUNCTION ---
  const loadMoreAllMedia = useCallback(async () => {
    if (allMediaLoading || !allMediaHasMore) return;

    setAllMediaLoading(true);
    try {
      let response;
      console.log(`Loading All Media... Skip: ${allMediaSkip}, Limit: ${LIMIT}`);
      
      // BRANCH LOGIC: Check if we are searching or viewing timeline
      if (searchQuery) {
        // Load Search Results
        response = await api.searchAllMedia(searchQuery, allMediaSkip, LIMIT);
      } else {
        // Load Normal Timeline
        response = await api.getAllMediaThumbnails(allMediaSkip, LIMIT);
      }
      
      const { allMedia: newAllMedia, total } = response;

      // Update total count on first page
      if (allMediaSkip === 0) {
        setAllMediaTotalCount(total);
      }

      if (newAllMedia.length < LIMIT) {
        setAllMediaHasMore(false);
      }
      
      // Append new media to existing ones
      setAllMedia(prev => {
        const existingIds = new Set(prev.map(m => `${m.type}-${m.id}`));
        const uniqueNew = newAllMedia.filter(m => !existingIds.has(`${m.type}-${m.id}`));
        return [...prev, ...uniqueNew];
      });

      // Increase skip for next time
      setAllMediaSkip(prev => prev + LIMIT);

    } catch (error) {
      console.error("Failed to load all media:", error);
      if (error.response && error.response.status === 503) {
        setAllMediaStatusCode('503');
      }
    } finally {
      setAllMediaLoading(false);
    }
  }, [allMediaSkip, allMediaLoading, allMediaHasMore, searchQuery]);

  // --- FAVORITES LOAD FUNCTION ---
  const loadMoreFavorites = useCallback(async () => {
    if (favoritesLoading || !favoritesHasMore) return;

    setFavoritesLoading(true);
    try {
      let response;
      console.log(`Loading Favorites... Skip: ${favoritesSkip}, Limit: ${LIMIT}`);
      
      // BRANCH LOGIC: Check if we are searching or viewing timeline
      if (searchQuery) {
        // Load Search Results
        response = await api.searchFavorites(searchQuery, favoritesSkip, LIMIT);
      } else {
        // Load Normal Timeline
        response = await api.getAllFavoritesThumbnails(favoritesSkip, LIMIT);
      }
      
      const { favorites: newFavorites, total } = response;

      // Update total count on first page
      if (favoritesSkip === 0) {
        setFavoritesTotalCount(total);
      }

      if (newFavorites.length < LIMIT) {
        setFavoritesHasMore(false);
      }
      
      // Append new favorites to existing ones
      setFavorites(prev => {
        const existingIds = new Set(prev.map(f => `${f.type}-${f.id}`));
        const uniqueNew = newFavorites.filter(f => !existingIds.has(`${f.type}-${f.id}`));
        return [...prev, ...uniqueNew];
      });

      // Increase skip for next time
      setFavoritesSkip(prev => prev + LIMIT);

    } catch (error) {
      console.error("Failed to load favorites:", error);
      if (error.response && error.response.status === 503) {
        setFavoritesStatusCode('503');
      }
    } finally {
      setFavoritesLoading(false);
    }
  }, [favoritesSkip, favoritesLoading, favoritesHasMore, searchQuery]);


  // Save active view to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('havenActiveView', activeView);
    
    // Clear selected album when navigating away from albums
    if (activeView !== 'albums') {
      localStorage.removeItem('havenSelectedAlbumId');
    }
  }, [activeView]);

  // Scroll to top on page load (but preserve the active view)
  useEffect(() => {
    // Disable scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    // Force scroll to top
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      // Hide toggle on scroll
      setIsToggleVisible(false);

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Show toggle after scrolling stops (500ms delay)
      const timeout = setTimeout(() => {
        setIsToggleVisible(true);
      }, 500);

      setScrollTimeout(timeout);
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
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Animated Background Orbs and Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Cursor Following Glow Effect */}
        <motion.div
          animate={{
            x: mousePosition.x - 250,
            y: mousePosition.y - 250,
          }}
          transition={{
            type: 'spring',
            stiffness: 50,
            damping: 20,
            mass: 0.5,
          }}
          className="absolute w-[500px] h-[500px] bg-gradient-to-br 
                     from-purple-400/30 via-blue-400/25 to-transparent
                     dark:from-cyan-400/30 dark:via-teal-400/20 dark:to-transparent 
                     rounded-full blur-3xl"
          style={{ willChange: 'transform' }}
        />
        
        {/* Large Gradient Orbs */}
        <motion.div
          animate={{
            x: [0, 200, 0],
            y: [0, -150, 0],
            scale: [1, 1.3, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          style={{willChange: 'transform, opacity'}}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br 
                     from-purple-300/15 to-blue-400/15
                     dark:from-cyan-400/20 dark:to-blue-500/20 
                     rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -150, 0],
            y: [0, 200, 0],
            scale: [1, 1.4, 1],
            opacity: [0.15, 0.3, 0.15],
          }}
          style={{willChange: 'transform, opacity'}}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-to-br 
                     from-indigo-300/15 to-purple-400/15
                     dark:from-teal-400/20 dark:to-cyan-500/20 
                     rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          style={{willChange: 'transform, opacity'}}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/2 left-1/2 w-[450px] h-[450px] bg-gradient-to-br 
                     from-violet-300/12 to-pink-300/12
                     dark:from-purple-400/20 dark:to-pink-500/20 
                     rounded-full blur-3xl"
        />
        
        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -100 - (i * 20), 0],
              x: [0, (i % 2 === 0 ? 50 : -50), 0],
              opacity: [0, 0.4, 0],
            }}
            transition={{
              duration: 8 + (i * 0.5),
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
            className="absolute w-1 h-1 bg-purple-400/40 dark:bg-cyan-400/60 rounded-full"
            style={{
              left: `${(i * 5) % 100}%`,
              top: `${(i * 7) % 100}%`,
              willChange: 'transform, opacity'
            }}
          />
        ))}
        
        {/* Animated Grid Lines */}
        <div className="absolute inset-0 opacity-[0.08] dark:opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.15) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />
        </div>
        <div className="hidden dark:block absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />
        </div>
      </div>

      {/* Main Layout */}
      {/* Upload Button - Top Right (left of theme toggle) */}
      <UploadButton isVisible={isToggleVisible} />

      {/* Theme Toggle - Top Right */}
      <motion.button
        initial={{ opacity: 0, y: 0 }}
        animate={{ 
          opacity: isToggleVisible ? 1 : 0,
        }}
        transition={{ 
          duration: 0.3,
          ease: "easeOut"
        }}
        onClick={toggleTheme}
        style={{ pointerEvents: isToggleVisible ? 'auto' : 'none', willChange: 'transform, opacity' }}
        className="fixed top-8 right-8 z-50 p-4 glass-panel rounded-2xl
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
          animate={{ rotate: isDark ? 0 : 180 }}
          transition={{ duration: 0.5, type: 'spring' }}
          style={{willChange: 'transform'}}
        >
          {isDark ? (
            <Moon className="w-6 h-6 text-cyan-300" />
          ) : (
            <Sun className="w-6 h-6 text-purple-600" />
          )}
        </motion.div>
      </motion.button>

      {/* Background Progress Bars */}
      {progressBars.map((bar, index) => {
        // Calculate how many bars below this one are expanded
        const expandedBelowCount = progressBars
          .slice(0, index)
          .filter(b => expandedProgressBars.has(b.id))
          .length;
        
        return (
          <ProgressBar
            key={bar.id}
            id={bar.id}
            type={bar.type}
            label={bar.label}
            isVisible={bar.isVisible}
            current={bar.current}
            total={bar.total}
            index={index}
            expandedBelowCount={expandedBelowCount}
            onExpandChange={(isExpanded) => {
              setExpandedProgressBars(prev => {
                const newSet = new Set(prev);
                if (isExpanded) {
                  newSet.add(bar.id);
                } else {
                  newSet.delete(bar.id);
                }
                return newSet;
              });
            }}
            onDismiss={() => {
              setProgressBars(prev => prev.filter(b => b.id !== bar.id));
              setExpandedProgressBars(prev => {
                const newSet = new Set(prev);
                newSet.delete(bar.id);
                return newSet;
              });
            }}
          />
        );
      })}

      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      {activeView !== 'albums' && activeView !== 'smart-albums' && activeView !== 'faces' && activeView !== 'things' && activeView !== 'dashboard' && activeView !== 'recently-deleted' && (
      <SearchBar onSearch={handleSearch} searchValue={searchInputValue} onClearSearch={handleReset} />
      )}
      
      {activeView === 'all' ? (
        <AllMediaGrid allMedia={allMedia} loading={allMediaLoading} searchQuery={searchQuery} onLoadMore={loadMoreAllMedia} hasMore={allMediaHasMore} totalCount={allMediaTotalCount} statusCode={allMediaStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} onLocationUpdate={handleLocationUpdate} onDelete={handleDelete} />
      ) : activeView === 'photos' ? (
        <PhotoGrid photos={photos} loading={loading} searchQuery={searchQuery} onLoadMore={loadMorePhotos} hasMore={hasMore} totalCount={totalCount} statusCode={statusCode} onFavoriteToggle={handleGlobalFavoriteToggle} onLocationUpdate={handleLocationUpdate} onDelete={handleDelete} />
      ) : activeView === 'videos' ? (
        <VideoGrid videos={videos} loading={videoLoading} searchQuery={searchQuery} onLoadMore={loadMoreVideos} hasMore={videoHasMore} totalCount={videoTotalCount} statusCode={videoStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} onLocationUpdate={handleLocationUpdate} onDelete={handleDelete} />
      ) : activeView === 'raw' ? (
        <RawImageGrid rawImages={rawImages} loading={rawLoading} searchQuery={searchQuery} onLoadMore={loadMoreRawImages} hasMore={rawHasMore} totalCount={rawTotalCount} statusCode={rawStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} onLocationUpdate={handleLocationUpdate} onDelete={handleDelete} />
      ) : activeView === 'favorites' ? (
        <FavoritesGrid favorites={favorites} loading={favoritesLoading} searchQuery={searchQuery} onLoadMore={loadMoreFavorites} hasMore={favoritesHasMore} totalCount={favoritesTotalCount} statusCode={favoritesStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} onLocationUpdate={handleLocationUpdate} onDelete={handleDelete} />
      ) : activeView === 'map' ? (
        <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
          <div style={{ height: 'calc(100vh - 16rem)' }}>
            <MapView searchQuery={searchQuery} onFavoriteToggle={handleGlobalFavoriteToggle} onDelete={handleDelete} />
          </div>
        </div>
      ) : activeView === 'albums' ? (
        <Albums 
          onFavoriteToggle={handleGlobalFavoriteToggle}
          searchQuery={searchQuery}
          searchInputValue={searchInputValue}
          onSearch={handleSearch}
          onClearSearch={handleReset}
          updateProgressBar={updateProgressBar}
          removeProgressBar={removeProgressBar}
          onDelete={handleDelete}
          startAlbumDownload={startAlbumDownload}
          hasActiveDownload={hasActiveDownload}
          cancelAlbumDownload={cancelAlbumDownload}
        />
      ) : activeView === 'dashboard' ? (
        <Dashboard 
          startVaultDownload={startVaultDownload}
          cancelVaultDownload={cancelVaultDownload}
          hasActiveVaultDownload={hasActiveVaultDownload()}
          startAppDataDownload={startAppDataDownload}
          cancelAppDataDownload={cancelAppDataDownload}
          hasActiveAppDataDownload={hasActiveAppDataDownload()}
          startMetadataDownload={startMetadataDownload}
          cancelMetadataDownload={cancelMetadataDownload}
          hasActiveMetadataDownload={hasActiveMetadataDownload()}
        />
      ) : activeView === 'smart-albums' || activeView === 'faces' || activeView === 'things' || activeView === 'recently-deleted' ? (
        <ComingSoon feature={activeView} />
      ) : (
        <AllMediaGrid allMedia={allMedia} loading={allMediaLoading} searchQuery={searchQuery} onLoadMore={loadMoreAllMedia} hasMore={allMediaHasMore} totalCount={allMediaTotalCount} statusCode={allMediaStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} onLocationUpdate={handleLocationUpdate} onDelete={handleDelete} />
      )}

      {/* Insufficient Space Modal */}
      <InsufficientSpaceModal 
        isOpen={showInsufficientSpaceModal} 
        onClose={() => setShowInsufficientSpaceModal(false)} 
      />

      {/* Vignette Effect */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t 
                      from-gray-200/30 via-transparent to-gray-200/30
                      dark:from-black/20 dark:via-transparent dark:to-black/20" />
    </div>
  );
}

export default App;

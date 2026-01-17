import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
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
      {progressBars.map((bar, index) => (
        <ProgressBar
          key={bar.id}
          id={bar.id}
          type={bar.type}
          label={bar.label}
          isVisible={bar.isVisible}
          current={bar.current}
          total={bar.total}
          index={index}
          onDismiss={() => {
            setProgressBars(prev => prev.filter(b => b.id !== bar.id));
          }}
        />
      ))}

      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      {activeView !== 'albums' && (
        <SearchBar onSearch={handleSearch} searchValue={searchInputValue} onClearSearch={handleReset} />
      )}
      
      {activeView === 'all' ? (
        <AllMediaGrid allMedia={allMedia} loading={allMediaLoading} searchQuery={searchQuery} onLoadMore={loadMoreAllMedia} hasMore={allMediaHasMore} totalCount={allMediaTotalCount} statusCode={allMediaStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} />
      ) : activeView === 'photos' ? (
        <PhotoGrid photos={photos} loading={loading} searchQuery={searchQuery} onLoadMore={loadMorePhotos} hasMore={hasMore} totalCount={totalCount} statusCode={statusCode} onFavoriteToggle={handleGlobalFavoriteToggle} />
      ) : activeView === 'videos' ? (
        <VideoGrid videos={videos} loading={videoLoading} searchQuery={searchQuery} onLoadMore={loadMoreVideos} hasMore={videoHasMore} totalCount={videoTotalCount} statusCode={videoStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} />
      ) : activeView === 'raw' ? (
        <RawImageGrid rawImages={rawImages} loading={rawLoading} searchQuery={searchQuery} onLoadMore={loadMoreRawImages} hasMore={rawHasMore} totalCount={rawTotalCount} statusCode={rawStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} />
      ) : activeView === 'favorites' ? (
        <FavoritesGrid favorites={favorites} loading={favoritesLoading} searchQuery={searchQuery} onLoadMore={loadMoreFavorites} hasMore={favoritesHasMore} totalCount={favoritesTotalCount} statusCode={favoritesStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} />
      ) : activeView === 'map' ? (
        <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
          <div style={{ height: 'calc(100vh - 16rem)' }}>
            <MapView searchQuery={searchQuery} onFavoriteToggle={handleGlobalFavoriteToggle} />
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
        />
      ) : (
        <AllMediaGrid allMedia={allMedia} loading={allMediaLoading} searchQuery={searchQuery} onLoadMore={loadMoreAllMedia} hasMore={allMediaHasMore} totalCount={allMediaTotalCount} statusCode={allMediaStatusCode} onFavoriteToggle={handleGlobalFavoriteToggle} />
      )}

      {/* Vignette Effect */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t 
                      from-gray-200/30 via-transparent to-gray-200/30
                      dark:from-black/20 dark:via-transparent dark:to-black/20" />
    </div>
  );
}

export default App;

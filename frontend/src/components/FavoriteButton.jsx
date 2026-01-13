import { Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../api';

/**
 * Reusable Favorite Button Component
 * 
 * @param {Object} props
 * @param {number} props.id - Media ID
 * @param {string} props.type - Media type: 'image', 'video', or 'raw'
 * @param {boolean} props.initialFavorite - Initial favorite state
 * @param {string} props.size - Size variant: 'small' (for cards) or 'large' (for viewers)
 * @param {Function} props.onToggle - Optional callback after toggle
 */
export default function FavoriteButton({ 
  id, 
  type, 
  initialFavorite = false, 
  size = 'small',
  onToggle
}) {
  const [isFavorite, setIsFavorite] = useState(Boolean(initialFavorite));
  const [isLoading, setIsLoading] = useState(false);

  // Sync internal state when the file changes (id or initialFavorite changes)
  useEffect(() => {
    setIsFavorite(Boolean(initialFavorite));
  }, [id, initialFavorite]);

  const handleClick = async (e) => {
    e.stopPropagation();
    
    if (isLoading) return;
    
    setIsLoading(true);
    const previousState = isFavorite;
    const newState = !isFavorite;
    
    // Optimistic update
    setIsFavorite(newState);
    
    try {
      await api.toggleFavorite(id, type);
      
      // Call optional callback with all necessary information
      if (onToggle) {
        onToggle(id, type, newState);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // Revert on error
      setIsFavorite(previousState);
    } finally {
      setIsLoading(false);
    }
  };

  // Size variants
  const isSmall = size === 'small';
  const iconSize = isSmall ? 'w-3 h-3' : 'w-5 h-5';
  const padding = isSmall ? 'p-1.5' : 'p-2.5';

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`${padding} rounded-full backdrop-blur-xl border transition-all duration-200 group/btn ${
        isFavorite
          ? 'bg-pink-500/30 dark:bg-pink-500/20 border-pink-400/50 dark:border-pink-400/40'
          : 'bg-white/10 dark:bg-white/5 border-white/20 hover:bg-pink-500/30 dark:hover:bg-pink-500/20 hover:border-pink-400/50 dark:hover:border-pink-400/40'
      } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
    >
      <Heart 
        className={`${iconSize} transition-colors ${
          isFavorite 
            ? 'text-pink-400 dark:text-pink-300' 
            : isSmall 
              ? 'text-white/70 group-hover/btn:text-pink-400'
              : 'text-slate-700 dark:text-white/70 group-hover/btn:text-pink-500 dark:group-hover/btn:text-pink-400'
        }`}
        fill={isFavorite ? 'currentColor' : 'none'}
      />
    </button>
  );
}

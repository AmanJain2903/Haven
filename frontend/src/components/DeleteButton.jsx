import { Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';

/**
 * Reusable Delete Button Component
 * 
 * @param {Object} props
 * @param {number} props.id - Media ID
 * @param {string} props.type - Media type: 'image', 'video', or 'raw'
 * @param {string} props.size - Size variant: 'small' (for cards) or 'large' (for viewers)
 * @param {Function} props.onClick - Optional custom click handler
 * @param {Function} props.onSuccess - Optional callback after successful deletion
 */
export default function DeleteButton({ 
  id, 
  type, 
  size = 'small',
  onClick,
  onSuccess
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    
    if (onClick) {
      onClick(id, type);
      return;
    }

    // Prevent multiple simultaneous deletions
    if (isDeleting) return;

    setIsDeleting(true);

    try {
      // Call the appropriate delete API based on file type
      if (type === 'image') {
        await api.deleteImage(id);
      } else if (type === 'video') {
        await api.deleteVideo(id);
      } else if (type === 'raw') {
        await api.deleteRawImage(id);
      } else {
        throw new Error(`Unknown file type: ${type}`);
      }

      // Trigger success callback if provided
      if (onSuccess) {
        onSuccess(id, type);
      }

    } catch (error) {
      console.error('Delete failed:', error);
      alert(`Failed to delete file: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
      setIsDeleting(false);
    }
    // Note: Don't setIsDeleting(false) on success - let parent component handle unmounting
  };

  const isSmall = size === 'small';
  const iconSize = isSmall ? 'w-3 h-3' : 'w-5 h-5';
  const padding = isSmall ? 'p-1.5' : 'p-2.5';

  return (
    <button
      onClick={handleClick}
      disabled={isDeleting}
      className={`${padding} rounded-full backdrop-blur-xl border transition-all duration-200 group/btn
        bg-white/10 dark:bg-white/5 border-white/20 
        hover:bg-red-500/30 dark:hover:bg-red-500/20 hover:border-red-400/50 dark:hover:border-red-400/40
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isDeleting ? (
        <Loader2 
          className={`${iconSize} animate-spin ${
            isSmall 
              ? 'text-red-400'
              : 'text-red-500 dark:text-red-400'
          }`}
        />
      ) : (
        <Trash2 
          className={`${iconSize} transition-colors ${
            isSmall 
              ? 'text-white/70 group-hover/btn:text-red-400'
              : 'text-slate-700 dark:text-white/70 group-hover/btn:text-red-500 dark:group-hover/btn:text-red-400'
          }`}
        />
      )}
    </button>
  );
}

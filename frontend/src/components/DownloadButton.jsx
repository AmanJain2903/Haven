import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';

/**
 * Reusable Download Button Component
 * 
 * @param {Object} props
 * @param {number} props.id - Media ID
 * @param {string} props.type - Media type: 'image', 'video', or 'raw'
 * @param {string} props.size - Size variant: 'small' (for cards) or 'large' (for viewers)
 * @param {Function} props.onClick - Optional custom click handler
 */
export default function DownloadButton({ 
  id, 
  type, 
  size = 'small',
  onClick
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    
    if (onClick) {
      onClick(id, type);
      return;
    }

    // Prevent multiple simultaneous downloads
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      // Get the file URL - backend now handles Content-Disposition headers
      let fileUrl;
      
      if (type === 'image') {
        const details = await api.getImageDetails(id);
        fileUrl = details.image_url;
      } else if (type === 'video') {
        const details = await api.getVideoDetails(id);
        fileUrl = details.video_url;
      } else if (type === 'raw') {
        const details = await api.getRawDetails(id);
        fileUrl = details.raw_url;
      }

      // Create a temporary anchor element and trigger download
      // The backend sends Content-Disposition headers, so the browser will:
      // 1. Start downloading immediately (no need to load into memory)
      // 2. Use the correct filename from the header
      const link = document.createElement('a');
      link.href = fileUrl;
      link.style.display = 'none'; // Hide the link element
      document.body.appendChild(link);
      link.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);

    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const isSmall = size === 'small';
  const iconSize = isSmall ? 'w-3 h-3' : 'w-5 h-5';
  const padding = isSmall ? 'p-1.5' : 'p-2.5';

  return (
    <button
      onClick={handleClick}
      disabled={isDownloading}
      className={`${padding} rounded-full backdrop-blur-xl border transition-all duration-200 group/btn
        bg-white/10 dark:bg-white/5 border-white/20 
        hover:bg-teal-500/30 dark:hover:bg-teal-500/20 hover:border-teal-400/50 dark:hover:border-teal-400/40
        disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isDownloading ? (
        <Loader2 
          className={`${iconSize} animate-spin ${
            isSmall 
              ? 'text-teal-400'
              : 'text-teal-500 dark:text-teal-400'
          }`}
        />
      ) : (
        <Download 
          className={`${iconSize} transition-colors ${
            isSmall 
              ? 'text-white/70 group-hover/btn:text-teal-400'
              : 'text-slate-700 dark:text-white/70 group-hover/btn:text-teal-500 dark:group-hover/btn:text-teal-400'
          }`}
        />
      )}
    </button>
  );
}

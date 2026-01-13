import { Share2 } from 'lucide-react';

/**
 * Reusable Share Button Component
 * 
 * @param {Object} props
 * @param {number} props.id - Media ID
 * @param {string} props.type - Media type: 'image', 'video', or 'raw'
 * @param {string} props.size - Size variant: 'small' (for cards) or 'large' (for viewers)
 * @param {Function} props.onClick - Optional custom click handler
 */
export default function ShareButton({ 
  id, 
  type, 
  size = 'small',
  onClick
}) {
  const handleClick = (e) => {
    e.stopPropagation();
    
    if (onClick) {
      onClick(id, type);
    } else {
      // TODO: Implement share functionality
      console.log('Share:', { id, type });
    }
  };

  const isSmall = size === 'small';
  const iconSize = isSmall ? 'w-3 h-3' : 'w-5 h-5';
  const padding = isSmall ? 'p-1.5' : 'p-2.5';

  return (
    <button
      onClick={handleClick}
      className={`${padding} rounded-full backdrop-blur-xl border transition-all duration-200 group/btn
        bg-white/10 dark:bg-white/5 border-white/20 
        hover:bg-cyan-500/30 dark:hover:bg-cyan-500/20 hover:border-cyan-400/50 dark:hover:border-cyan-400/40`}
    >
      <Share2 
        className={`${iconSize} transition-colors ${
          isSmall 
            ? 'text-white/70 group-hover/btn:text-cyan-400'
            : 'text-slate-700 dark:text-white/70 group-hover/btn:text-cyan-500 dark:group-hover/btn:text-cyan-400'
        }`}
      />
    </button>
  );
}

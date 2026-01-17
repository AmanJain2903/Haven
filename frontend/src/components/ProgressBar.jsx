import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { X, ChevronDown, ChevronUp, Check } from "lucide-react";

export default function ProgressBar({ id, type = "adding", label, isVisible, current, total, onDismiss, index = 0 }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = current === total && total > 0 && current > 0;

  // Generate appropriate labels based on type
  const getLabels = () => {
    if (type === "deleting") {
      return {
        inProgress: label || "Deleting album...",
        complete: "Album deleted successfully!"
      };
    }
    return {
      inProgress: label || "Adding files...",
      complete: "Files added successfully!"
    };
  };

  const labels = getLabels();

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          style={{ bottom: `${20 + index * 80}px` }}
          className="fixed right-6 z-[300] pointer-events-auto"
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={() => setIsExpanded(false)}
        >
          <div className="glass-panel border-2 border-purple-400/30 dark:border-cyan-400/30 shadow-2xl rounded-xl">
            {/* Collapsed View */}
            {!isExpanded && (
              <div className="px-4 py-2.5 flex items-center gap-3 min-w-[300px]">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-700 dark:text-white">
                    {isComplete ? labels.complete : labels.inProgress}
                  </div>
                  {type === "adding" && (
                    <div className="text-xs text-purple-600 dark:text-cyan-400 font-semibold mt-0.5">
                      {percentage}%
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {type === "deleting" && !isComplete && (
                    <div className="w-5 h-5 border-2 border-purple-600/30 dark:border-cyan-400/30 border-t-purple-600 dark:border-t-cyan-400 rounded-full animate-spin" />
                  )}
                  {type === "deleting" && isComplete && (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <ChevronUp className="w-4 h-4 text-slate-600 dark:text-white/70" />
                  {isComplete && (
                    <button
                      onClick={onDismiss}
                      className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      aria-label="Dismiss"
                    >
                      <X className="w-4 h-4 text-slate-600 dark:text-white/70" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Expanded View */}
            {isExpanded && (
              <div className="px-4 py-3 min-w-[350px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-700 dark:text-white">
                      {isComplete ? labels.complete : labels.inProgress}
                    </div>
                    {type === "adding" && (
                      <div className="text-xs text-slate-600 dark:text-white/60 mt-0.5">
                        {current} of {total} files
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {type === "deleting" && !isComplete && (
                      <div className="w-5 h-5 border-2 border-purple-600/30 dark:border-cyan-400/30 border-t-purple-600 dark:border-t-cyan-400 rounded-full animate-spin" />
                    )}
                    {type === "deleting" && isComplete && (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <ChevronDown className="w-4 h-4 text-slate-600 dark:text-white/70" />
                    {isComplete && (
                      <button
                        onClick={onDismiss}
                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Dismiss"
                      >
                        <X className="w-4 h-4 text-slate-600 dark:text-white/70" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {type === "adding" && (
                  <>
                    <div className="relative w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${
                          isComplete
                            ? 'bg-green-500'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-cyan-400 dark:to-teal-400'
                        }`}
                      />
                    </div>

                    {/* Percentage */}
                    <div className="mt-1 text-right">
                      <span className="text-xs font-semibold text-purple-600 dark:text-cyan-400">
                        {percentage}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

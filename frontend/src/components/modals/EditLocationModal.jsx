import { X, MapPin, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../api';

const EditLocationModal = ({ isOpen, onClose, fileType, fileId, onSuccess }) => {
  const { isDark } = useTheme();
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load existing location data when modal opens
  useEffect(() => {
    if (isOpen && fileType && fileId) {
      loadLocationData();
    }
  }, [isOpen, fileType, fileId]);

  const loadLocationData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getFileLocation(fileType, fileId);
      setCity(data.city || '');
      setState(data.state || '');
      setCountry(data.country || '');
    } catch (err) {
      console.error('Error loading location data:', err);
      setError('Failed to load location data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await api.updateFileLocation(
        fileType, 
        fileId, 
        city || null, 
        state || null, 
        country || null
      );
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Error updating location:', err);
      setError('Failed to update location');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setCity('');
      setState('');
      setCountry('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center p-4"
        style={{ willChange: 'opacity' }}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="relative glass-panel border-2 border-purple-400/30 dark:border-cyan-400/30 
                     rounded-3xl p-8 shadow-2xl backdrop-blur-xl max-w-md w-full"
          style={{ willChange: 'transform, opacity' }}
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="absolute top-4 right-4 p-2 rounded-full
                     text-slate-600 dark:text-white/60
                     hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                     transition-all duration-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-purple-500/10 dark:bg-cyan-500/10">
              <MapPin className="w-6 h-6 text-purple-600 dark:text-cyan-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                Edit Location
              </h2>
              <p className="text-sm text-slate-600 dark:text-white/60">
                Update the location information for this file
              </p>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-purple-600 dark:text-cyan-400 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* City Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., San Francisco"
                  disabled={isSaving}
                  className="w-full px-4 py-3 rounded-xl
                           bg-white/50 dark:bg-white/5
                           border-2 border-purple-400/30 dark:border-cyan-400/30
                           text-slate-800 dark:text-white
                           placeholder:text-slate-400 dark:placeholder:text-white/40
                           focus:outline-none focus:border-purple-500 dark:focus:border-cyan-400
                           transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* State Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g., California"
                  disabled={isSaving}
                  className="w-full px-4 py-3 rounded-xl
                           bg-white/50 dark:bg-white/5
                           border-2 border-purple-400/30 dark:border-cyan-400/30
                           text-slate-800 dark:text-white
                           placeholder:text-slate-400 dark:placeholder:text-white/40
                           focus:outline-none focus:border-purple-500 dark:focus:border-cyan-400
                           transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Country Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g., United States"
                  disabled={isSaving}
                  className="w-full px-4 py-3 rounded-xl
                           bg-white/50 dark:bg-white/5
                           border-2 border-purple-400/30 dark:border-cyan-400/30
                           text-slate-800 dark:text-white
                           placeholder:text-slate-400 dark:placeholder:text-white/40
                           focus:outline-none focus:border-purple-500 dark:focus:border-cyan-400
                           transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Helper Text */}
              <p className="text-xs text-slate-500 dark:text-white/50">
                All fields are optional. Leave blank to remove location data.
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 rounded-xl
                           bg-slate-200/50 dark:bg-white/5
                           border-2 border-slate-300/50 dark:border-white/10
                           text-slate-700 dark:text-white/80
                           hover:bg-slate-300/50 dark:hover:bg-white/10
                           transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 rounded-xl
                           bg-gradient-to-r from-purple-500 to-indigo-500 
                           dark:from-cyan-500 dark:to-teal-500
                           text-white font-medium
                           hover:shadow-lg hover:scale-105
                           transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Location'
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditLocationModal;

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "../../api";

export default function CreateAlbumModal({ isOpen, onClose, onSuccess }) {
  const [albumName, setAlbumName] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [locationType, setLocationType] = useState("straight"); // "straight" or "separate"
  const [albumLocation, setAlbumLocation] = useState("");
  const [albumCity, setAlbumCity] = useState("");
  const [albumState, setAlbumState] = useState("");
  const [albumCountry, setAlbumCountry] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

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

  const handleCreate = async () => {
    if (!albumName.trim()) {
      setError("Album name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await api.createAlbum(
        albumName.trim(),
        albumDescription.trim() || null,
        albumLocation.trim() || null,
        albumCity.trim() || null,
        albumState.trim() || null,
        albumCountry.trim() || null
      );
      
      // Reset form
      setAlbumName("");
      setAlbumDescription("");
      setAlbumLocation("");
      setAlbumCity("");
      setAlbumState("");
      setAlbumCountry("");
      setError(null);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error creating album:", err);
      setError(err.response?.data?.detail || "Failed to create album");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setAlbumName("");
    setAlbumDescription("");
    setAlbumLocation("");
    setAlbumCity("");
    setAlbumState("");
    setAlbumCountry("");
    setError(null);
    onClose();
  };

  const isFormValid = albumName.trim().length > 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ willChange: "opacity" }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] flex items-center justify-center"
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
          className="relative z-10 w-full max-w-md mx-4 glass-panel rounded-3xl p-8 shadow-2xl border-2 border-purple-400/30 dark:border-cyan-400/30"
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 rounded-full 
              text-slate-700 dark:text-white/80 
              hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
              hover:scale-110
              transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r
              from-purple-600 via-indigo-600 to-violet-600
              dark:from-white dark:via-cyan-100 dark:to-teal-100
              bg-clip-text text-transparent">
              Create Album
            </h2>
            <p className="text-slate-600 dark:text-white/50 text-sm mt-2">
              Organize your media into collections
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            {/* Album Name - Required */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
                Album Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={albumName}
                onChange={(e) => {
                  setAlbumName(e.target.value);
                  setError(null);
                }}
                placeholder="Enter album name"
                className="w-full px-4 py-3 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                  focus:border-purple-500 dark:focus:border-cyan-400
                  bg-white/50 dark:bg-white/5
                  text-slate-900 dark:text-white
                  placeholder:text-slate-400 dark:placeholder:text-white/30
                  transition-all duration-200 outline-none"
                autoFocus
              />
            </div>

            {/* Album Description - Optional */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
                Description
              </label>
              <textarea
                value={albumDescription}
                onChange={(e) => setAlbumDescription(e.target.value)}
                placeholder="Enter album description (optional)"
                rows={3}
                className="w-full px-4 py-3 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                  focus:border-purple-500 dark:focus:border-cyan-400
                  bg-white/50 dark:bg-white/5
                  text-slate-900 dark:text-white
                  placeholder:text-slate-400 dark:placeholder:text-white/30
                  transition-all duration-200 outline-none resize-none"
              />
            </div>

            {/* Location Toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-2">
                Location
              </label>
              
              {/* Toggle Pill */}
              <div className="flex gap-2 mb-3 p-1 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20">
                <button
                  type="button"
                  onClick={() => setLocationType("straight")}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    locationType === "straight"
                      ? "bg-purple-500/20 dark:bg-cyan-500/20 text-purple-600 dark:text-cyan-300 border-2 border-purple-400/40 dark:border-cyan-400/40"
                      : "text-slate-600 dark:text-white/60 hover:bg-white/10 dark:hover:bg-white/5"
                  }`}
                >
                  Straight Location
                </button>
                <button
                  type="button"
                  onClick={() => setLocationType("separate")}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    locationType === "separate"
                      ? "bg-purple-500/20 dark:bg-cyan-500/20 text-purple-600 dark:text-cyan-300 border-2 border-purple-400/40 dark:border-cyan-400/40"
                      : "text-slate-600 dark:text-white/60 hover:bg-white/10 dark:hover:bg-white/5"
                  }`}
                >
                  City, State, Country
                </button>
              </div>

              {/* Location Inputs */}
              {locationType === "straight" ? (
                <input
                  type="text"
                  value={albumLocation}
                  onChange={(e) => setAlbumLocation(e.target.value)}
                  placeholder="Enter location (optional)"
                  className="w-full px-4 py-3 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                    focus:border-purple-500 dark:focus:border-cyan-400
                    bg-white/50 dark:bg-white/5
                    text-slate-900 dark:text-white
                    placeholder:text-slate-400 dark:placeholder:text-white/30
                    transition-all duration-200 outline-none"
                />
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={albumCity}
                    onChange={(e) => setAlbumCity(e.target.value)}
                    placeholder="City (optional)"
                    className="w-full px-4 py-3 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                      focus:border-purple-500 dark:focus:border-cyan-400
                      bg-white/50 dark:bg-white/5
                      text-slate-900 dark:text-white
                      placeholder:text-slate-400 dark:placeholder:text-white/30
                      transition-all duration-200 outline-none"
                  />
                  <input
                    type="text"
                    value={albumState}
                    onChange={(e) => setAlbumState(e.target.value)}
                    placeholder="State (optional)"
                    className="w-full px-4 py-3 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                      focus:border-purple-500 dark:focus:border-cyan-400
                      bg-white/50 dark:bg-white/5
                      text-slate-900 dark:text-white
                      placeholder:text-slate-400 dark:placeholder:text-white/30
                      transition-all duration-200 outline-none"
                  />
                  <input
                    type="text"
                    value={albumCountry}
                    onChange={(e) => setAlbumCountry(e.target.value)}
                    placeholder="Country (optional)"
                    className="w-full px-4 py-3 rounded-xl glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                      focus:border-purple-500 dark:focus:border-cyan-400
                      bg-white/50 dark:bg-white/5
                      text-slate-900 dark:text-white
                      placeholder:text-slate-400 dark:placeholder:text-white/30
                      transition-all duration-200 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
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
              onClick={handleCreate}
              disabled={!isFormValid || isCreating}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                isFormValid && !isCreating
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-cyan-500 dark:to-teal-500 text-white hover:shadow-lg hover:scale-105"
                  : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              }`}
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { X, Plus, Image as ImageIcon, Check } from "lucide-react";
import { api } from "../api";
import CreateAlbumModal from "./CreateAlbumModal";

function SmallAlbumCard({ album, onSelect, isSelected, isAlreadyPartOf, onRemove }) {
  const [coverUrl, setCoverUrl] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    const loadCover = async () => {
      if (album.album_cover_type && album.album_cover_id) {
        try {
          const coverData = await api.getAlbumCover(album.id);
          if (coverData && coverData.album_cover_url) {
            setCoverUrl(coverData.album_cover_url);
          }
        } catch (error) {
          console.error("Error loading album cover:", error);
        }
      }
    };

    loadCover();
  }, [album.id, album.album_cover_type, album.album_cover_id]);

  const truncateText = (text, maxLength) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  const handleRemoveClick = async (e) => {
    e.stopPropagation();
    setIsRemoving(true);
    try {
      await onRemove(album.id);
    } catch (error) {
      console.error("Error removing from album:", error);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <motion.div
      whileHover={!isAlreadyPartOf ? { scale: 1.03 } : {}}
      whileTap={!isAlreadyPartOf ? { scale: 0.98 } : {}}
      onClick={!isAlreadyPartOf ? onSelect : undefined}
      className={`
        relative rounded-xl aspect-square overflow-hidden
        transition-all duration-300
        ${isAlreadyPartOf ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        ${
          isSelected
            ? "ring-4 ring-purple-500 dark:ring-cyan-400 shadow-lg"
            : isAlreadyPartOf
            ? "border-2 border-green-400/40 dark:border-green-400/40"
            : "hover:shadow-xl border-2 border-slate-200/40 dark:border-white/10"
        }
      `}
    >
      {/* Cover Image or Placeholder */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={album.album_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-200/50 to-slate-300/50 dark:from-slate-800/50 dark:to-slate-900/50 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-600" />
        </div>
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/20" />

      {/* Album Name */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-white font-bold text-sm tracking-wide drop-shadow-lg">
          {truncateText(album.album_name, 20)}
        </p>
        <p className="text-white/60 text-xs mt-0.5">
          {album.album_total_count || 0} {album.album_total_count === 1 ? "item" : "items"}
        </p>
      </div>

      {/* Selection Indicator */}
      {isSelected && !isAlreadyPartOf && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 dark:bg-cyan-400 flex items-center justify-center"
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}

      {/* Already Part Of Indicator */}
      {isAlreadyPartOf && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-green-500 dark:bg-green-400 flex items-center justify-center shadow-lg"
        >
          <Check className="w-5 h-5 text-white" strokeWidth={3} />
        </motion.div>
      )}

      {/* Remove From Album Button Overlay */}
      {isAlreadyPartOf && (
        <div className="absolute inset-0 bg-green-500/20 dark:bg-green-400/20 flex items-center justify-center">
          <button
            onClick={handleRemoveClick}
            disabled={isRemoving}
            className="bg-red-500 hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-600 
                     px-3 py-2 rounded-lg shadow-lg
                     text-white text-xs font-bold
                     transition-all duration-200
                     hover:scale-105
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isRemoving ? "Removing..." : "Remove From Album"}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function CreateAlbumCard({ onClick }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="
        relative cursor-pointer rounded-xl aspect-square overflow-hidden
        transition-all duration-300
        border-2 border-dashed border-purple-400/50 dark:border-cyan-400/50
        hover:border-purple-500 dark:hover:border-cyan-400
        bg-gradient-to-br from-purple-500/10 to-indigo-500/10 dark:from-cyan-500/10 dark:to-teal-500/10
        flex items-center justify-center
      "
    >
      <div className="flex flex-col items-center gap-2">
        <div className="p-3 rounded-full bg-purple-500/20 dark:bg-cyan-500/20">
          <Plus className="w-6 h-6 text-purple-600 dark:text-cyan-400" />
        </div>
        <p className="text-purple-600 dark:text-cyan-400 font-semibold text-sm">
          Create Album
        </p>
      </div>
    </motion.div>
  );
}

function ConfirmationModal({ isOpen, onClose, onConfirm, albumName, fileName, fileType, loading }) {
  if (!isOpen) return null;

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className="relative glass-panel rounded-2xl p-6 max-w-md w-full border-2 border-purple-400/30 dark:border-cyan-400/30 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 dark:bg-cyan-500/20 flex items-center justify-center">
                <Plus className="w-8 h-8 text-purple-600 dark:text-cyan-400" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                  Add to Album?
                </h3>
                <p className="text-slate-600 dark:text-white/70">
                  Add <span className="font-semibold text-purple-600 dark:text-cyan-400">{fileName}</span> to{" "}
                  <span className="font-semibold text-purple-600 dark:text-cyan-400">{albumName}</span>?
                </p>
              </div>

              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600
                           text-slate-700 dark:text-white/80 font-medium
                           hover:bg-slate-100 dark:hover:bg-slate-700
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl
                           bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-cyan-500 dark:to-teal-500
                           text-white font-medium
                           hover:shadow-lg hover:scale-105
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200"
                >
                  {loading ? "Adding..." : `Add to Album`}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AddToAlbumModal({ isOpen, onClose, fileId, fileType, fileName }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [addingToAlbum, setAddingToAlbum] = useState(false);
  const [partOfAlbumIds, setPartOfAlbumIds] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadAlbums();
      loadPartOfAlbums();
    }
  }, [isOpen, fileId, fileType]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  const loadAlbums = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAlbums();
      setAlbums(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading albums:", err);
      setError("Failed to load albums");
    } finally {
      setLoading(false);
    }
  };

  const loadPartOfAlbums = async () => {
    try {
      const data = await api.getPartOfAlbums(fileType, fileId);
      // API returns {"albums": [album_ids]}
      const albumIds = data?.albums || [];
      setPartOfAlbumIds(Array.isArray(albumIds) ? albumIds : []);
    } catch (err) {
      console.error("Error loading part of albums:", err);
      // Don't show error to user, just log it
      setPartOfAlbumIds([]);
    }
  };

  const handleAlbumSelect = (albumId) => {
    setSelectedAlbumId(albumId);
    setIsConfirmationOpen(true);
  };

  const handleCreateAlbumClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = async () => {
    // Reload albums after creation
    await loadAlbums();
    // The newly created album will be at the end, so select it
    // We'll wait a bit for the state to update
    setTimeout(() => {
      if (albums.length > 0) {
        const newAlbum = albums[albums.length - 1];
        setSelectedAlbumId(newAlbum.id);
        setIsConfirmationOpen(true);
      }
    }, 100);
  };

  const handleConfirmAdd = async () => {
    if (!selectedAlbumId) return;

    setAddingToAlbum(true);
    try {
      await api.addToAlbum(selectedAlbumId, fileType, fileId);
      // Success - close confirmation modal and reload state
      setIsConfirmationOpen(false);
      setSelectedAlbumId(null);
      // Reload the modal state
      await loadPartOfAlbums();
      await loadAlbums();
    } catch (err) {
      console.error("Error adding to album:", err);
      alert("Failed to add file to album. Please try again.");
    } finally {
      setAddingToAlbum(false);
    }
  };

  const handleCloseConfirmation = () => {
    setIsConfirmationOpen(false);
    setSelectedAlbumId(null);
  };

  const getSelectedAlbumName = () => {
    const album = albums.find((a) => a.id === selectedAlbumId);
    return album ? album.album_name : "";
  };

  const handleRemoveFromAlbum = async (albumId) => {
    try {
      await api.removeFromAlbum(albumId, fileType, fileId);
      // Reload the modal state
      await loadPartOfAlbums();
      await loadAlbums();
    } catch (err) {
      console.error("Error removing from album:", err);
      alert("Failed to remove file from album. Please try again.");
      throw err;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
            onClick={onClose}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="relative glass-panel rounded-2xl p-6 max-w-5xl w-full border-2 border-purple-400/30 dark:border-cyan-400/30 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                    Add to Album
                  </h2>
                  <p className="text-slate-600 dark:text-white/60 text-sm mt-1">
                    Select an album or create a new one
                  </p>
                  <p className="text-slate-600 dark:text-white/60 text-sm mt-1">
                    {`${fileName}`}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600 dark:text-white/60" />
                </button>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-slate-600 dark:text-white/60">Loading albums...</div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-red-600 dark:text-red-400">{error}</div>
                </div>
              )}

              {/* Albums Row - Horizontal Scroll */}
              {!loading && !error && (
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-4 min-w-max">
                    {/* Create Album Card */}
                    <div className="w-48 flex-shrink-0">
                      <CreateAlbumCard onClick={handleCreateAlbumClick} />
                    </div>

                    {/* Album Cards */}
                    {albums.map((album) => {
                      const isPartOf = partOfAlbumIds.includes(album.id);
                      return (
                        <div key={album.id} className="w-48 flex-shrink-0">
                          <SmallAlbumCard
                            album={album}
                            onSelect={() => handleAlbumSelect(album.id)}
                            isSelected={selectedAlbumId === album.id}
                            isAlreadyPartOf={isPartOf}
                            onRemove={handleRemoveFromAlbum}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No Albums Message */}
              {!loading && !error && albums.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-600 dark:text-white/60 mb-4">
                    No albums yet. Create your first album to get started!
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Album Modal */}
      <CreateAlbumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={handleCloseConfirmation}
        onConfirm={handleConfirmAdd}
        albumName={getSelectedAlbumName()}
        fileName={fileName}
        fileType={fileType}
        loading={addingToAlbum}
      />
    </>
  );
}

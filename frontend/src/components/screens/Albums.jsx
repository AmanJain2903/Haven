import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Plus, Image as ImageIcon, Download, Trash2, Edit, ArrowLeft, XCircle } from "lucide-react";
import { api } from "../../api";
import CreateAlbumModal from "../modals/CreateAlbumModal";
import EditAlbumModal from "../modals/EditAlbumModal";
import DeleteAlbumModal from "../modals/DeleteAlbumModal";
import AlbumGrid from "./AlbumGrid";
import SearchBar from "../common/SearchBar";

function AlbumCard({ album, index, onEdit, onDelete, onClick, onDownload, onCancelDownload, isDownloading }) {
  const [isHovered, setIsHovered] = useState(false);
  const [coverUrl, setCoverUrl] = useState(null);
  const [loadingCover, setLoadingCover] = useState(false);

  useEffect(() => {
    const loadCover = async () => {
      if (album.album_cover_type && album.album_cover_id) {
        setLoadingCover(true);
        try {
          const coverData = await api.getAlbumCover(album.id);
          if (coverData && coverData.album_cover_url) {
            setCoverUrl(coverData.album_cover_url);
          }
        } catch (error) {
          console.error("Error loading album cover:", error);
        } finally {
          setLoadingCover(false);
        }
      }
    };

    loadCover();
  }, [album.id, album.album_cover_type, album.album_cover_id]);

  const truncateAlbumName = (text) => {
    if (!text) return "";
    return text.length > 48 ? text.substring(0, 48) + "..." : text;
  };

  const getLocationText = () => {
    if (album.album_location) {
      return album.album_location;
    }
    const parts = [album.album_city, album.album_state, album.album_country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        type: "spring",
        stiffness: 100,
        damping: 12,
      }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      className="relative group cursor-pointer h-full w-full"
    >
      <div
        className={`
          relative overflow-hidden rounded-2xl aspect-square w-full
          transition-all duration-500
          ${
            isHovered
              ? "shadow-glow-cyan border-2 border-purple-400/50 dark:border-cyan-400/40"
              : "shadow-xl border-2 border-slate-200/40 dark:border-white/10"
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
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-200/50 to-slate-300/50 dark:from-slate-800/50 dark:to-slate-900/50 flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-slate-400 dark:text-slate-600" />
          </div>
        )}

        {/* Gradient Overlay - Strong gradient for text visibility in both light and dark modes */}
        <div
          className={`
            absolute inset-0 bg-gradient-to-t 
            from-black/90 via-black/70 to-black/20
            dark:from-black/95 dark:via-black/80 dark:to-black/30
            transition-opacity duration-500
            ${isHovered ? "opacity-100" : "opacity-100"}
          `}
        />

        {/* Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col">
          {/* Text Content - Always visible, moves up when buttons appear */}
          <motion.div
            animate={{ y: isHovered ? -12 : 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-1.5"
          >
            {/* Album Name */}
            <p className="text-white font-bold text-xl tracking-wide drop-shadow-lg">
              {truncateAlbumName(album.album_name)}
            </p>

            {/* Location */}
            {getLocationText() && (
              <p className="text-purple-300 dark:text-cyan-300 text-sm font-bold flex items-center gap-1">
                {getLocationText()}
              </p>
            )}

            {/* Album Count */}
            {album.album_total_count !== undefined && album.album_total_count !== null && (
              <p className="text-white/80 dark:text-white/70 text-xs font-medium">
                {album.album_total_count} {album.album_total_count === 1 ? "item" : "items"}
              </p>
            )}
          </motion.div>

          {/* Action Buttons - Only visible on hover, appears below text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
            style={{ willChange: "opacity, transform" }}
            transition={{ duration: 0.3 }}
            className="mt-3"
          >
            <div className="flex items-center gap-2.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDownloading) {
                    onCancelDownload && onCancelDownload(album.id);
                  } else {
                    onDownload && onDownload(album.id, album.album_name);
                  }
                }}
                className="p-2 rounded-full backdrop-blur-xl border transition-all duration-200 group/btn
                  bg-white/10 dark:bg-white/5 border-white/20 
                  hover:bg-teal-500/30 dark:hover:bg-teal-500/20 hover:border-teal-400/50 dark:hover:border-teal-400/40"
              >
                {isDownloading ? (
                  <XCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <Download className="w-4 h-4 text-white/70 group-hover/btn:text-teal-400" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(album.id);
                }}
                className="p-2 rounded-full backdrop-blur-xl border transition-all duration-200 group/btn
                  bg-white/10 dark:bg-white/5 border-white/20 
                  hover:bg-blue-500/30 dark:hover:bg-blue-500/20 hover:border-blue-400/50 dark:hover:border-blue-400/40"
              >
                <Edit className="w-4 h-4 text-white/70 group-hover/btn:text-blue-400" />
              </button>

              <div className="flex-1" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(album.id, album.album_name);
                }}
                className="p-2 rounded-full backdrop-blur-xl border transition-all duration-200 group/btn
                  bg-white/10 dark:bg-white/5 border-white/20 
                  hover:bg-red-500/30 dark:hover:bg-red-500/20 hover:border-red-400/50 dark:hover:border-red-400/40"
              >
                <Trash2 className="w-4 h-4 text-white/70 group-hover/btn:text-red-400" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function CreateAlbumCard({ index, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        type: "spring",
        stiffness: 100,
        damping: 12,
      }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      onClick={onClick}
      className="relative group cursor-pointer h-full w-full"
    >
      <div
        className="
          relative overflow-hidden rounded-2xl aspect-square w-full
          transition-all duration-500
          shadow-xl border-2 border-slate-200/40 dark:border-white/10
          hover:shadow-glow-cyan hover:border-2 hover:border-purple-400/50 dark:hover:border-cyan-400/40
          bg-gradient-to-br from-purple-500/20 to-indigo-500/20 dark:from-cyan-500/20 dark:to-teal-500/20
          flex items-center justify-center
        "
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="p-5 rounded-full bg-white/10 dark:bg-white/5 border border-white/20">
            <Plus className="w-10 h-10 text-purple-600 dark:text-cyan-300" />
          </div>
          <p className="text-purple-600 dark:text-cyan-300 font-semibold text-lg">
            Create Album
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function Albums({ onFavoriteToggle, searchQuery: externalSearchQuery = "", searchInputValue: externalSearchInputValue = "", onSearch, onClearSearch, updateProgressBar, removeProgressBar, onDelete, startAlbumDownload, hasActiveDownload, cancelAlbumDownload }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAlbumId, setDeletingAlbumId] = useState(null);
  const [deletingAlbumName, setDeletingAlbumName] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState(() => {
    // Restore selected album from localStorage on mount
    const saved = localStorage.getItem('havenSelectedAlbumId');
    return saved ? Number(saved) : null;
  });
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery);
  const [searchInputValue, setSearchInputValue] = useState(externalSearchInputValue);

  // Sync with external search state
  useEffect(() => {
    setSearchQuery(externalSearchQuery);
    setSearchInputValue(externalSearchInputValue);
  }, [externalSearchQuery, externalSearchInputValue]);

  // Save selected album to localStorage when it changes
  useEffect(() => {
    if (selectedAlbumId) {
      localStorage.setItem('havenSelectedAlbumId', String(selectedAlbumId));
    } else {
      localStorage.removeItem('havenSelectedAlbumId');
    }
  }, [selectedAlbumId]);

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

  useEffect(() => {
    loadAlbums();
  }, []);

  const handleCreateSuccess = () => {
    loadAlbums(); // Reload albums after creation
  };

  const handleEdit = (albumId) => {
    setEditingAlbumId(albumId);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    loadAlbums(); // Reload albums after update
  };

  const handleEditClose = () => {
    setIsEditModalOpen(false);
    setEditingAlbumId(null);
  };

  const handleDelete = (albumId, albumName) => {
    setDeletingAlbumId(albumId);
    setDeletingAlbumName(albumName);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    loadAlbums(); // Reload albums after deletion
  };

  const handleDeleteClose = () => {
    setIsDeleteModalOpen(false);
    setDeletingAlbumId(null);
    setDeletingAlbumName("");
  };

  const handleAlbumClick = (albumId) => {
    setSelectedAlbumId(albumId);
  };

  const handleAlbumGridClose = () => {
    setSelectedAlbumId(null);
    localStorage.removeItem('havenSelectedAlbumId');
    // Don't reset search query here - let it persist from global state
    // Only reset if user explicitly clears search
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setSearchInputValue(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleReset = () => {
    setSearchQuery("");
    setSearchInputValue("");
    if (onClearSearch) {
      onClearSearch();
    }
  };

  const handleAlbumUpdate = () => {
    loadAlbums();
  };

  const handleAlbumDelete = () => {
    // Navigate back to albums list when album is deleted
    setSelectedAlbumId(null);
    localStorage.removeItem('havenSelectedAlbumId');
    loadAlbums();
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600 dark:text-slate-400">Loading albums...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  // Show AlbumGrid if an album is selected
  if (selectedAlbumId) {
    return (
      <AlbumGrid
        key={selectedAlbumId} // Force remount when album changes to ensure proper initialization
        albumId={selectedAlbumId}
        onClose={handleAlbumGridClose}
        onFavoriteToggle={onFavoriteToggle}
        onAlbumUpdate={handleAlbumUpdate}
        onAlbumDelete={handleAlbumDelete}
        searchQuery={searchQuery}
        searchInputValue={searchInputValue}
        onSearch={handleSearch}
        onClearSearch={handleReset}
        updateProgressBar={updateProgressBar}
        removeProgressBar={removeProgressBar}
        onDelete={onDelete}
        startAlbumDownload={startAlbumDownload}
        hasActiveDownload={hasActiveDownload}
        cancelAlbumDownload={cancelAlbumDownload}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
        {/* Header Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1
              className="text-4xl font-bold bg-gradient-to-r
                from-purple-600 via-indigo-600 to-violet-600
                dark:from-white dark:via-cyan-100 dark:to-teal-100
                bg-clip-text text-transparent mb-2"
            >
              Your Albums
            </h1>
            <p className="text-slate-600 dark:text-white/50 text-lg">
              <span className="font-semibold text-purple-600 dark:text-cyan-400">
                {albums.length}
              </span>{" "}
              {albums.length === 1 ? "album" : "albums"} in Haven Vault
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {/* Create Album Card - First */}
          <CreateAlbumCard index={0} onClick={() => setIsCreateModalOpen(true)} />

          {/* Album Cards */}
          {albums.map((album, index) => (
            <AlbumCard 
              key={album.id} 
              album={album} 
              index={index + 1} 
              onEdit={handleEdit}
              onDelete={handleDelete}
              onClick={() => handleAlbumClick(album.id)}
              isDownloading={hasActiveDownload ? hasActiveDownload(album.id) : false}
              onDownload={(albumId, albumName) => startAlbumDownload && startAlbumDownload(albumId, albumName)}
              onCancelDownload={(albumId) => cancelAlbumDownload && cancelAlbumDownload(albumId)}
            />
          ))}
        </div>

      </div>

      {/* Create Album Modal */}
      <CreateAlbumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Album Modal */}
      <EditAlbumModal
        isOpen={isEditModalOpen}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
        albumId={editingAlbumId}
      />

      {/* Delete Album Modal */}
      <DeleteAlbumModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteClose}
        onSuccess={handleDeleteSuccess}
        albumId={deletingAlbumId}
        albumName={deletingAlbumName}
        updateProgressBar={updateProgressBar}
        removeProgressBar={removeProgressBar}
        hasActiveDownload={hasActiveDownload}
        cancelAlbumDownload={cancelAlbumDownload}
      />
    </>
  );
}

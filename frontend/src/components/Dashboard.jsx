import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  HardDrive,
  Database,
  Server,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Folder,
  Image as ImageIcon,
  Video,
  Album,
  ChevronDown,
  ChevronUp,
  FileText,
  Scan,
  Pencil,
  Files,
  Camera,
  Archive,
  DownloadCloud,
  Layers,
} from 'lucide-react';
import { api } from '../api';
import {formatFileSize, getEstimatedPreparationTime} from '../utils/fileUtils';


// Collapsible Section Component (moved outside to prevent re-creation)
const CollapsibleSection = ({ title, icon: Icon, isOpen, onToggle, children, isDanger = false }) => (
  <motion.div
    // Skip mount animations to avoid delayed rendering when off-screen
    initial={false}
    animate={{ opacity: 1, y: 0 }}
    className={`mb-6 glass-panel rounded-2xl border-2 ${
      isDanger 
        ? 'border-red-400/30 dark:border-red-500/30' 
        : 'border-purple-400/20 dark:border-cyan-400/20'
    } overflow-hidden`}
  >
    <button
      onClick={onToggle}
      className={`w-full px-6 py-4 flex items-center justify-between transition-colors ${
        isDanger
          ? 'hover:bg-red-500/10 dark:hover:bg-red-500/20'
          : 'hover:bg-purple-500/10 dark:hover:bg-cyan-500/20'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${
          isDanger 
            ? 'text-red-600 dark:text-red-400' 
            : 'text-purple-600 dark:text-cyan-400'
        }`} />
        <h2 className={`text-xl font-bold ${
          isDanger
            ? 'text-red-600 dark:text-red-400'
            : 'text-slate-800 dark:text-white'
        }`}>
          {title}
        </h2>
      </div>
      {isOpen ? (
        <ChevronUp className="w-5 h-5 text-slate-600 dark:text-white/70" />
      ) : (
        <ChevronDown className="w-5 h-5 text-slate-600 dark:text-white/70" />
      )}
    </button>
    
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          style={{ willChange: 'height, opacity' }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="px-6 py-4 border-t border-slate-200/20 dark:border-white/10">
            {children}
          </div>
        </motion.div>
      )}
  </motion.div>
);

// Storage Card Component
const StorageCard = ({ 
  title, 
  isConfigured,
  isConnected, 
  path, 
  lastCheckedTime, 
  onEdit,
  used, 
  total, 
  available, 
  percentage, 
  breakdown 
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-panel rounded-2xl p-6 border-2 border-purple-400/20 dark:border-cyan-400/20"
  >
    {/* Header with Title, Edit Button, and Status */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h3>
        {onEdit && (
          <button
            onClick={onEdit}
            aria-label={`Edit ${title}`}
          >
            <Pencil className="w-4 h-4 text-purple-600 dark:text-cyan-400 hover:scale-110 transition-all duration-200" />
          </button>
        )}
      </div>
      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
        isConnected
          ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30'
          : 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30'
      }`}>
        {isConfigured && isConnected ? (
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {'Connected'}
          </span>
        ) : isConfigured ? (
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {'Disconnected'}
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {'Not configured'}
          </span>
        )}
      </div>
    </div>
    
    {/* Path and Last Checked */}
      <div className="space-y-2 mb-4">
        {isConfigured && (
          <div className="text-sm text-slate-600 dark:text-white/70">
          <span className="font-medium">Path:</span>{' '}
          <span className="font-mono text-xs">{path || 'Not configured'}</span>
        </div>
        )}
        <div className="text-xs text-slate-500 dark:text-white/50">
          Last checked: {lastCheckedTime || 'Not checked'}
        </div>
      </div>
    
    {/* Storage Details (only show if connected) */}
    {isConfigured && isConnected && (
      <>
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-600 dark:text-white/70">Used</span>
            <span className="font-semibold text-slate-800 dark:text-white">{percentage}%</span>
          </div>
          <div className="relative w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full rounded-full ${
                percentage > 90
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : percentage > 70
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 dark:from-cyan-400 dark:to-teal-400'
              }`}
            />
          </div>
        </div>
        
        {/* Storage Info */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-left">
            <div className="text-xs text-slate-500 dark:text-white/50 mb-1">Used</div>
            <div className="font-semibold text-slate-800 dark:text-white">{used}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 dark:text-white/50 mb-1">Available</div>
            <div className="font-semibold text-slate-800 dark:text-white">{available}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-white/50 mb-1">Total</div>
            <div className="font-semibold text-slate-800 dark:text-white">{total}</div>
          </div>
        </div>
        
        {/* Breakdown */}
        {breakdown && breakdown.length > 0 && (
          <div className="pt-4 border-t border-slate-200/20 dark:border-white/10">
            <div className="grid grid-cols-4 gap-4">
              {breakdown.map((item, idx) => {
                // Parse the value to extract count and size
                // Format: "1,234 files (200 GB)" or "null files (null)" or similar
                let count = '-';
                let size = '-';
                
                if (item.value && item.value !== 'null files (null)') {
                  const match = item.value.match(/([\d,]+)\s+files\s+\(([^)]+)\)/);
                  if (match) {
                    count = match[1];
                    size = match[2];
                  }
                }
                
                return (
                  <div key={idx} className="text-center">
                    <div className="text-xs text-slate-500 dark:text-white/50 mb-1">{item.label}</div>
                    <div className="font-semibold text-slate-800 dark:text-white mb-0.5">{count === '-' ? '-' : `${count} files`}</div>
                    <div className="text-xs font-medium text-slate-600 dark:text-white/70">{size}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    )}
  </motion.div>
);

// Stat Card Component (moved outside to prevent re-creation)
const StatCard = ({ icon: Icon, label, value }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="glass-panel rounded-xl p-4 border-2 border-purple-400/20 dark:border-cyan-400/20 text-center"
  >
    <Icon className="w-8 h-8 text-purple-600 dark:text-cyan-400 mx-auto mb-2" />
    <div className="text-xs font-medium text-slate-500 dark:text-white/50 mb-1">{label}</div>
    <div className="text-xl font-bold text-slate-800 dark:text-white">{value}</div>
  </motion.div>
);

export default function Dashboard({ startVaultDownload, cancelVaultDownload, hasActiveVaultDownload, startAppDataDownload, cancelAppDataDownload, hasActiveAppDataDownload, startMetadataDownload, cancelMetadataDownload, hasActiveMetadataDownload }) {
  // Collapsible sections state
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isSystemInfoOpen, setIsSystemInfoOpen] = useState(false);

  // System information state
  const [projectVersion, setProjectVersion] = useState(null);
  
  // Dashboard data state (static once loaded)
  const [lastChecked, setLastChecked] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const hasLoadedRef = useRef(false);
  
  // Haven Vault state
  const [havenVaultPath, setHavenVaultPath] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Haven App Data state
  const [havenAppDataPath, setHavenAppDataPath] = useState(null);
  const [isAppDataConfigured, setIsAppDataConfigured] = useState(false);
  const [isAppDataConnected, setIsAppDataConnected] = useState(false);
  const [appDataSize, setAppDataSize] = useState(0);

  // Haven Metadata state
  const [metadataInformation, setMetadataInformation] = useState({});
  
  // Storage information
  const [totalSize, setTotalSize] = useState(0);
  const [usedSize, setUsedSize] = useState(0);
  const [availableSize, setAvailableSize] = useState(0);
  const [percentage, setPercentage] = useState(0);
  
  // File counts and sizes on haven vault
  const [imagesCount, setImagesCount] = useState(0);
  const [videosCount, setVideosCount] = useState(0);
  const [rawCount, setRawCount] = useState(0);
  const [totalFilesCount, setTotalFilesCount] = useState(0);
  const [imagesSize, setImagesSize] = useState(0);
  const [videosSize, setVideosSize] = useState(0);
  const [rawSize, setRawSize] = useState(0);
  const [totalFilesSize, setTotalFilesSize] = useState(0);
  
  // Stats on Haven - Processed files
  const [albumsCount, setAlbumsCount] = useState(0);
  const [processedImagesCount, setProcessedImagesCount] = useState(0);
  const [processedVideosCount, setProcessedVideosCount] = useState(0);
  const [processedRawCount, setProcessedRawCount] = useState(0);
  const [processedTotalFilesCount, setProcessedTotalFilesCount] = useState(0);
  const [processedTotalFilesSize, setProcessedTotalFilesSize] = useState(0);
  
  // Fetch data function
  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const projectVersion = await api.getProjectVersion();
      if (projectVersion) {
        setProjectVersion(projectVersion);
      }
      const storagePath = await api.getStoragePath();
      
      if (storagePath) {
        setHavenVaultPath(storagePath);
        setIsConfigured(true);
        const connectionCheck = await api.checkPathExistence(storagePath);
        if (connectionCheck) {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      } else {
        setIsConfigured(false);
        setIsConnected(false);
        setIsAppDataConfigured(false);
        setIsAppDataConnected(false);
        setHavenAppDataPath(null);
        setTotalSize(0);
        setUsedSize(0);
        setAvailableSize(0);
        setPercentage(0);
        setImagesCount(0);
        setVideosCount(0);
        setRawCount(0);
        setTotalFilesCount(0);
        setImagesSize(0);
        setVideosSize(0);
        setRawSize(0);
        setTotalFilesSize(0);
        setLastChecked(new Date().toLocaleTimeString());
        setIsRefreshing(false);
        return;
      }

      const appDataPath = await api.getHotStoragePath();
      if (appDataPath) {
        setHavenAppDataPath(appDataPath);
        setIsAppDataConfigured(true);
        const connectionCheck = await api.checkPathExistence(appDataPath);
        if (connectionCheck) {
          setIsAppDataConnected(true);
          const sizeAppData = await api.getHavenAppDataSize();
          setAppDataSize(sizeAppData);
        } else {
          setIsAppDataConnected(false);
        }
      } else {
        setIsAppDataConfigured(false);
        setIsAppDataConnected(false);
        setHavenAppDataPath(null);
      }

      const metaInformation = await api.getMetadataInformation();
      if (metaInformation) {
        setMetadataInformation(metaInformation);
      } else {
        setMetadataInformation({});
      }
      
      const diskInformation = await api.getHavenVaultDiskInformation(storagePath);
      if (diskInformation) {
        setTotalSize(diskInformation.total_space);
        setUsedSize(diskInformation.used_space);
        setAvailableSize(diskInformation.available_space);
        const calculatedPercentage = Math.round((diskInformation.used_space / diskInformation.total_space) * 100);
        setPercentage(calculatedPercentage);
      } else {
        setTotalSize(0);
        setUsedSize(0);
        setAvailableSize(0);
        setPercentage(0);
      }
      
      const dataBreakdown = await api.getHavenVaultDataBreakdown(storagePath);
      if (dataBreakdown) {
        setImagesCount(dataBreakdown.images_count);
        setVideosCount(dataBreakdown.videos_count);
        setRawCount(dataBreakdown.raw_count);
        setTotalFilesCount(dataBreakdown.total_count);
        setImagesSize(dataBreakdown.images_size);
        setVideosSize(dataBreakdown.videos_size);
        setRawSize(dataBreakdown.raw_size);
        setTotalFilesSize(dataBreakdown.total_size);
      } else {
        setImagesCount(0);
        setVideosCount(0);
        setRawCount(0);
        setTotalFilesCount(0);
        setImagesSize(0);
        setVideosSize(0);
        setRawSize(0);
        setTotalFilesSize(0);
      }
      const processedFilesInformation = await api.getProcessedFilesInformation(storagePath);
      if (processedFilesInformation) {
        setAlbumsCount(processedFilesInformation.albums_count);
        setProcessedImagesCount(processedFilesInformation.processed_images_count);
        setProcessedVideosCount(processedFilesInformation.processed_videos_count);
        setProcessedRawCount(processedFilesInformation.processed_raw_count);
        setProcessedTotalFilesCount(processedFilesInformation.processed_total_files_count);
        setProcessedTotalFilesSize(processedFilesInformation.processed_total_files_size);
      } else {
        setAlbumsCount(0);
        setProcessedImagesCount(0);
        setProcessedVideosCount(0);
        setProcessedRawCount(0);
        setProcessedTotalFilesCount(0);
        setProcessedTotalFilesSize(0);
      }
    } catch (error) {
      setIsRefreshing(false);
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setIsRefreshing(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  };
  
  // Mark as animated after first render
  useEffect(() => {
    if (!hasAnimated) {
      setHasAnimated(true);
    }
  }, [hasAnimated]);
  
  // Load data only once on mount
  useEffect(() => {
    if (!hasLoadedRef.current) {
      fetchData();
      hasLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Handle refresh button click
  const handleRefresh = async () => {
    await fetchData();
  };

  return (
    <div className="min-h-screen pt-32 pb-16 px-8 pl-[calc(240px+6rem)]">
      {/* Header */}
      <motion.div
        initial={hasAnimated ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r
            from-purple-600 via-indigo-600 to-violet-600
            dark:from-white dark:via-cyan-100 dark:to-teal-100
            bg-clip-text text-transparent">
            Dashboard
          </h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh Dashboard"
          >
            <RefreshCw 
              className={`w-5 h-5 text-purple-600 dark:text-cyan-400 hover:scale-110 transition-all duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
        <p className="text-slate-600 dark:text-white/50 text-lg">
          Welcome to your Haven's Dashboard
        </p>
      </motion.div>

      {/* Section 1: Storage Status */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <StorageCard
          title="Haven Vault"
          isConfigured={isConfigured}
          isConnected={isConnected}
          path={havenVaultPath}
          lastCheckedTime={lastChecked}
          onEdit={() => {}}
          used={formatFileSize(usedSize)}
          total={formatFileSize(totalSize)}
          available={formatFileSize(availableSize)}
          percentage={percentage}
          breakdown={[
            { label: 'Images', value: `${imagesCount} files (${formatFileSize(imagesSize)})` },
            { label: 'Videos', value: `${videosCount} files (${formatFileSize(videosSize)})` },
            { label: 'RAW', value: `${rawCount} files (${formatFileSize(rawSize)})` },
            { label: 'Total', value: `${totalFilesCount} files (${formatFileSize(totalFilesSize)})` }
          ]}
        />
      </div>

      {/* Section 2: Media Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon={ImageIcon} label="Photos" value={processedImagesCount} />
        <StatCard icon={Video} label="Videos" value={processedVideosCount} />
        <StatCard icon={Camera} label="RAW" value={processedRawCount} />
        <StatCard icon={Files} label="Total" value={processedTotalFilesCount} />
        <StatCard icon={Album} label="Albums" value={albumsCount} />
      </div>

      {/* Section 3: Download Options */}
      <CollapsibleSection
        title="Download Options"
        icon={Download}
        isOpen={isDownloadOpen}
        onToggle={() => setIsDownloadOpen(!isDownloadOpen)}
      >
        <div className="space-y-4">
          {/* Download Haven Vault */}
          <div className="glass-panel rounded-xl p-4 border border-purple-400/10 dark:border-cyan-400/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                {hasActiveVaultDownload? 
                (
                    <h4 className="font-semibold text-slate-800 dark:text-white mb-1">Downloading Entire Haven Vault</h4>
                )
                :(
                <h4 className="font-semibold text-slate-800 dark:text-white mb-1">Download Entire Haven Vault</h4>
)}
                <p className="text-sm text-slate-600 dark:text-white/70">
                   {hasActiveVaultDownload ? 'Do not disconnect the Haven Vault during the download' : 'Download all media files as a zip archive'}
                </p>
              </div>
              {hasActiveVaultDownload ? (
                <button
                  onClick={() => cancelVaultDownload && cancelVaultDownload()}
                  className="px-4 py-2 rounded-lg glass-panel border-2 border-red-400/20 dark:border-red-400/20
                    text-red-700 dark:text-red-400
                    hover:bg-red-500/20 dark:hover:bg-red-500/20
                    transition-all duration-200 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!isConfigured || !isConnected}
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Download
                </button>
              ) : (
                <button
                  onClick={() => startVaultDownload && startVaultDownload()}
                  className="px-4 py-2 rounded-lg glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                    text-slate-700 dark:text-white/80
                    hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                    transition-all duration-200 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isConfigured || !isConnected}
                >
                  <DownloadCloud className="w-4 h-4" />
                  Download
                </button>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-2">
              { !isConfigured || !isConnected ? 'Not connected to Haven Vault' : 'Total size: ' + formatFileSize(totalFilesSize) + ' | Estimated preparation time: ' + getEstimatedPreparationTime(totalFilesSize).human}
            </div>
          </div>

          {/* Download Haven App Data */}
          <div className="glass-panel rounded-xl p-4 border border-purple-400/10 dark:border-cyan-400/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                {hasActiveAppDataDownload? 
                (
                    <h4 className="font-semibold text-slate-800 dark:text-white mb-1">Downloading Haven App Data</h4>
                )
                :(
                <h4 className="font-semibold text-slate-800 dark:text-white mb-1">Download Haven App Data</h4>
)}
                <p className="text-sm text-slate-600 dark:text-white/70">
                  {hasActiveAppDataDownload ? 'Do not disconnect the Haven App Data Directory during the download' : 'Download all app data as a zip archive'}
                </p>
              </div>
              {hasActiveAppDataDownload ? (
                <button
                  onClick={() => cancelAppDataDownload && cancelAppDataDownload()}
                  className="px-4 py-2 rounded-lg glass-panel border-2 border-red-400/20 dark:border-red-400/20
                    text-red-700 dark:text-red-400
                    hover:bg-red-500/20 dark:hover:bg-red-500/20
                    transition-all duration-200 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isAppDataConfigured || !isAppDataConnected}
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Download
                </button>
              ) : (
                <button
                  onClick={() => startAppDataDownload && startAppDataDownload()}
                  className="px-4 py-2 rounded-lg glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                    text-slate-700 dark:text-white/80
                    hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                    transition-all duration-200 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isAppDataConfigured || !isAppDataConnected}
                >
                  <Database className="w-4 h-4" />
                  Download
                </button>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-2">
              { !isAppDataConfigured || !isAppDataConnected ? 'Not connected to Haven App Data' : 'Total size: ' + formatFileSize(appDataSize) + ' | Estimated preparation time: ' + getEstimatedPreparationTime(appDataSize).human}
            </div>
          </div>

          {/* Download Metadata */}
          <div className="glass-panel rounded-xl p-4 border border-purple-400/10 dark:border-cyan-400/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                {hasActiveMetadataDownload? 
                (
                    <h4 className="font-semibold text-slate-800 dark:text-white mb-1">Downloading Metadata</h4>
                )
                :(
                <h4 className="font-semibold text-slate-800 dark:text-white mb-1">Download Metadata</h4>
)}
                <p className="text-sm text-slate-600 dark:text-white/70">
                  Download database metadata (albums, favorites, locations, etc.)
                </p>
              </div>
              {hasActiveMetadataDownload ? (
                <button
                  onClick={() => cancelMetadataDownload && cancelMetadataDownload()}
                  className="px-4 py-2 rounded-lg glass-panel border-2 border-red-400/20 dark:border-red-400/20
                    text-red-700 dark:text-red-400
                    hover:bg-red-500/20 dark:hover:bg-red-500/20
                    transition-all duration-200 font-medium flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Download
                </button>
              ) : (
                <button
                  onClick={() => startMetadataDownload && startMetadataDownload()}
                  className="px-4 py-2 rounded-lg glass-panel border-2 border-purple-400/20 dark:border-cyan-400/20
                    text-slate-700 dark:text-white/80
                    hover:bg-purple-500/20 dark:hover:bg-cyan-500/20
                    transition-all duration-200 font-medium flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Download
                </button>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-2">
            Total size: {formatFileSize(metadataInformation.total_size_bytes)} | Estimated preparation time: {getEstimatedPreparationTime(metadataInformation.total_size_bytes).human}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 4: Danger Zone */}
      <CollapsibleSection
        title="Danger Zone"
        icon={AlertCircle}
        isOpen={isDangerZoneOpen}
        onToggle={() => setIsDangerZoneOpen(!isDangerZoneOpen)}
        isDanger={true}
      >
        <div className="space-y-4">
          {/* Format Haven Vault */}
          <div className="glass-panel rounded-xl p-4 border-2 border-red-400/30 dark:border-red-500/30 bg-red-500/5 dark:bg-red-500/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">Format Haven Vault</h4>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  This will clear everything - all media files will be deleted
                </p>
              </div>
              <button
                onClick={() => console.log('Format Haven Vault')}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white
                  transition-all duration-200 font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Format
              </button>
            </div>
            <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-2">
              This action cannot be undone
            </div>
          </div>

          {/* Reset Haven Vault */}
          <div className="glass-panel rounded-xl p-4 border-2 border-red-400/30 dark:border-red-500/30 bg-red-500/5 dark:bg-red-500/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">Reset Haven Vault</h4>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  Clear database and hot storage, keep media files, retrigger processing
                </p>
              </div>
              <button
                onClick={() => console.log('Reset Haven Vault')}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white
                  transition-all duration-200 font-medium flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
            <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-2">
              This will delete all metadata, thumbnails, and previews. Media files will remain.
            </div>
          </div>

          {/* Change App Data Location */}
          <div className="glass-panel rounded-xl p-4 border-2 border-red-400/30 dark:border-red-500/30 bg-red-500/5 dark:bg-red-500/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">Change App Data Location</h4>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  Change the location where Haven stores thumbnails, previews, and other app data
                </p>
              </div>
              <button
                onClick={() => console.log('Change App Data Location')}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white
                  transition-all duration-200 font-medium flex items-center gap-2"
              >
                <Folder className="w-4 h-4" />
                Change Location
              </button>
            </div>
            <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-2">
              This will move all app data to the new location. Ensure sufficient space is available.
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 5: System Info */}
      <CollapsibleSection
        title="System Information"
        icon={Server}
        isOpen={isSystemInfoOpen}
        onToggle={() => setIsSystemInfoOpen(!isSystemInfoOpen)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="glass-panel rounded-xl p-4 border border-purple-400/10 dark:border-cyan-400/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-white/70">Haven Version</span>
                <span className="px-2 py-1 rounded-lg bg-purple-500/20 dark:bg-cyan-500/20 text-xs font-medium text-purple-700 dark:text-cyan-400">
                  {projectVersion}
                </span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4 border border-purple-400/10 dark:border-cyan-400/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-white/70">Haven Status</span>
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/20 text-xs font-medium text-green-700 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  Running
                </span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

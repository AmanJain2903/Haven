const formatFileSize = (size) => {
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  } else if (size < 1024 * 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (size < 1024 * 1024 * 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
  }
  return `${size} B`;
};

const THROUGHPUT_PROFILES = {
  hdd: 25 * 1024 * 1024,   // 25 MB/s
  ssd: 60 * 1024 * 1024,   // 60 MB/s
  nvme: 120 * 1024 * 1024, // 120 MB/s
  auto: 100 * 1024 * 1024  // safe default
};

const getEstimatedPreparationTime = (size, profile = "auto") => {
  if (!size || size <= 0) {
    return {
      seconds: 0,
      human: "0s",
      profile
    };
  }

  const throughput =
    THROUGHPUT_PROFILES[profile] ?? THROUGHPUT_PROFILES.auto;

  const seconds = Math.max(1, Math.floor(size / throughput));

  let human;
  if (seconds < 60) {
    human = `${seconds}s`;
  } else if (seconds < 3600) {
    human = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  } else {
    human = `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  return {
    seconds,
    minutes: +(seconds / 60).toFixed(2),
    human,
    profile
  };
};

export { formatFileSize, getEstimatedPreparationTime };
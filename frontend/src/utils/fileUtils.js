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

export { formatFileSize };
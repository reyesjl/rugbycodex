
export const sanitizeFileName = (name: string) => {
  const trimmed = name.trim();
  const withoutPath = trimmed.split(/[/\\]/).pop() ?? trimmed;
  return withoutPath
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
};

/**
 * Formats a file name for display:
 * - Removes file extension
 * - Replaces dashes and underscores with spaces
 * - Trims whitespace
 * 
 * Returns the formatted string (to be used with Tailwind's capitalize class)
 */
export const formatMediaAssetNameForDisplay = (fileName: string): string => {
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  const withSpaces = withoutExtension.replace(/[-_]+/g, ' ');
  return withSpaces.trim() || 'Untitled';
};

export const getMediaDurationSeconds = async (file: globalThis.File) => {
  const mime = file.type ?? '';
  if (!mime.startsWith('video/') && !mime.startsWith('audio/')) return 0;
  if (typeof document === 'undefined') return 0;

  const url = URL.createObjectURL(file);
  try {
    const element = document.createElement(mime.startsWith('video/') ? 'video' : 'audio');
    element.preload = 'metadata';
    element.src = url;
    const duration = await new Promise<number>((resolve) => {
      const onLoaded = () => resolve(Number.isFinite(element.duration) ? element.duration : 0);
      const onError = () => resolve(0);
      element.addEventListener('loadedmetadata', onLoaded, { once: true });
      element.addEventListener('error', onError, { once: true });
    });
    return Math.max(0, duration);
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const SUPPORTED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'application/mp4',
  'video/quicktime',      // MOV
  'video/x-msvideo',      // AVI
  'video/x-matroska',     // MKV
  'video/webm',           // WebM
  'video/x-flv',          // FLV
]);

export const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.flv',
]);

export const isSupportedVideoFile = (file: globalThis.File) => {
  const lowerName = file.name.toLowerCase();
  const hasValidExtension = Array.from(SUPPORTED_VIDEO_EXTENSIONS).some(ext => lowerName.endsWith(ext));
  
  if (!hasValidExtension) return false;
  
  // Some browsers/OSes provide an empty type; allow it if extension is valid.
  if (!file.type) return true;
  
  return SUPPORTED_VIDEO_MIME_TYPES.has(file.type);
};

// Legacy function - kept for backward compatibility
export const MP4_MIME_TYPES = new Set(['video/mp4', 'application/mp4']);
export const isMp4File = isSupportedVideoFile;

export async function calculateFileChecksum(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
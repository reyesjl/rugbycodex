
export const sanitizeFileName = (name: string) => {
  const trimmed = name.trim();
  const withoutPath = trimmed.split(/[/\\]/).pop() ?? trimmed;
  return withoutPath
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
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

export const MP4_MIME_TYPES = new Set(['video/mp4', 'application/mp4']);
export const isMp4File = (file: globalThis.File) => {
  const nameOk = file.name.toLowerCase().endsWith('.mp4');
  if (!nameOk) return false;
  // Some browsers/OSes provide an empty type; allow it if extension is .mp4.
  if (!file.type) return true;
  return MP4_MIME_TYPES.has(file.type);
};

export async function calculateFileChecksum(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
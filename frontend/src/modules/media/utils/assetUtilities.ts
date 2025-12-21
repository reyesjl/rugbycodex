
export const sanitizeFileName = (name: string) => {
  const trimmed = name.trim();
  const withoutPath = trimmed.split(/[/\\]/).pop() ?? trimmed;
  return withoutPath
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
};

export const createStoragePath = (orgId: string, fileName: string) => {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeName = sanitizeFileName(fileName);
  const uuid =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  // Bucket layout: matches/orgs/{orgId}/media/{yyyy}/{mm}/{uuid}_{file}
  return `orgs/${orgId}/media/${yyyy}/${mm}/${uuid}_${safeName}`;
};

export const createTempUploadId = () => {
  // We generate a client-side id so the table can render a stable row (and progress bar)
  // while the storage upload is in-flight. Once the DB insert succeeds, we remove the
  // temporary row and show the persisted `media_assets` row (with DB-generated UUID).
  const uuid =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `upload-${uuid}`;
};

export const resolveSupabaseStorageBaseUrl = (supabaseUrl: string) => {
  // For large uploads, Supabase recommends using the direct storage hostname:
  // `https://<project-ref>.storage.supabase.co` instead of `https://<project-ref>.supabase.co`.
  // This avoids gateway limits and improves reliability/performance.
  try {
    const url = new URL(supabaseUrl);
    const host = url.hostname;
    if (host.endsWith('.storage.supabase.co')) {
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    }
    if (host.endsWith('.supabase.co') && !host.includes('.storage.')) {
      const projectRef = host.split('.')[0];
      url.hostname = `${projectRef}.storage.supabase.co`;
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    }
    return supabaseUrl.replace(/\/$/, '');
  } catch {
    return supabaseUrl.replace(/\/$/, '');
  }
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
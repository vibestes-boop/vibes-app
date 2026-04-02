import { supabase } from './supabase';
import { useAuthStore } from './authStore';

type UploadResult = {
  url: string;
  path: string;
};

type ThumbnailResult = {
  url: string;
} | null;

// ── Limits ──────────────────────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 50  * 1024 * 1024;  //  50 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;  // 200 MB

// ── Helpers ──────────────────────────────────────────────────────────────────
function mimeToExt(mimeType: string): string {
  if (mimeType.includes('png'))       return 'png';
  if (mimeType.includes('webp'))      return 'webp';
  if (mimeType.includes('gif'))       return 'gif';
  if (mimeType.includes('mp4'))       return 'mp4';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('mov'))       return 'mov';
  if (mimeType.includes('video'))     return 'mp4';
  return 'jpg';
}

function isVideo(mimeType: string): boolean {
  return (
    mimeType.includes('video')     ||
    mimeType.includes('mp4')       ||
    mimeType.includes('mov')       ||
    mimeType.includes('quicktime')
  );
}

/**
 * Normalize a MIME type coming from expo-image-picker.
 * Uses || (not ??) to also catch empty strings that iOS sometimes returns.
 * Trims whitespace to prevent canonical header mismatches with the signed value.
 */
function normalizeMime(raw: string | null | undefined): string {
  return (raw || 'image/jpeg').trim();
}

// ── Retry with exponential backoff ───────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  onRetry?: (attempt: number, error: Error) => void,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        onRetry?.(attempt, lastError);
        // Exponential backoff: 500ms → 1000ms → 2000ms
        await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Universeller Upload zu Cloudflare R2 (0€ Egress-Kosten)
 *
 * Wird für Videos, Bilder und Avatare verwendet.
 * Flow:
 * 1. Supabase Edge Function `r2-sign` gibt Presigned PUT URL zurück
 * 2. App lädt Datei direkt zu R2 hoch (kein Secret im Client)
 * 3. Öffentliche R2-URL wird gespeichert (direkt Cloudflare CDN)
 *
 * Features:
 * - File-size validation (50MB Images / 200MB Videos)
 * - Retry mit Exponential Backoff (3 Versuche)
 * - AbortController support (Cancel-Button)
 * - Content-Type Contract: normalizeMime() einmalig → gleicher Wert für Sign + PUT
 */
async function uploadToR2(
  key: string,
  localUri: string,
  rawMimeType: string | null | undefined,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  onProgress?.(5);

  if (!useAuthStore.getState().session?.access_token) {
    throw new Error('Nicht eingeloggt.');
  }

  // Normalize once — used for both signing AND the PUT Content-Type header.
  const mimeType = normalizeMime(rawMimeType);

  // ── 1) Fetch local file & validate size ─────────────────────────────────
  const fileRes = await fetch(localUri, { signal });
  if (!fileRes.ok) {
    throw new Error(`Lokale Datei nicht lesbar (${fileRes.status})`);
  }
  const fileBuffer = await fileRes.arrayBuffer();

  const maxBytes = isVideo(mimeType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (fileBuffer.byteLength > maxBytes) {
    const limitMB = Math.round(maxBytes / 1024 / 1024);
    const fileMB  = (fileBuffer.byteLength / 1024 / 1024).toFixed(1);
    throw new Error(
      `Datei zu groß: ${fileMB} MB (Maximum: ${limitMB} MB für ${isVideo(mimeType) ? 'Videos' : 'Bilder'})`,
    );
  }
  onProgress?.(15);

  // ── 2) Get presigned URL from Edge Function (with retry) ────────────────
  const { uploadUrl, publicUrl } = await withRetry(
    async () => {
      if (signal?.aborted) throw new Error('Upload abgebrochen.');
      const { data, error } = await supabase.functions.invoke('r2-sign', {
        body: { key, contentType: mimeType },
      });
      if (error || !data?.uploadUrl) {
        throw new Error(`Sign-Fehler: ${error?.message ?? 'Keine uploadUrl'}`);
      }
      return data as { uploadUrl: string; publicUrl: string };
    },
    3,
    (attempt, err) => {
      onProgress?.(-attempt); // Negative value signals retry to the UI
__DEV__ && console.warn(`[r2-sign] Versuch ${attempt} fehlgeschlagen: ${err.message}`);
    },
  );
  onProgress?.(20);

  // ── 3) PUT to R2 (with retry + simulated progress) ───────────────────────
  let simPct = 20;
  const simInterval = setInterval(() => {
    simPct = Math.min(simPct + 8, 90);
    onProgress?.(simPct);
  }, 600);

  try {
    await withRetry(
      async () => {
        if (signal?.aborted) throw new Error('Upload abgebrochen.');
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
          body: fileBuffer,
          signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '(kein Body)');
          throw new Error(`R2 Upload fehlgeschlagen (${res.status}): ${text.substring(0, 500)}`);
        }
      },
      3,
      (attempt, err) => {
        simPct = 20; // Reset simulated progress on retry
        onProgress?.(-attempt);
__DEV__ && console.warn(`[r2-upload] Versuch ${attempt} fehlgeschlagen: ${err.message}`);
      },
    );
  } finally {
    clearInterval(simInterval);
  }

  onProgress?.(100);
  return { url: publicUrl, path: key };
}

/**
 * Post-Medien: Videos UND Bilder → Cloudflare R2
 * (0€ Egress — kein Supabase Storage mehr für neue Uploads)
 */
export async function uploadPostMedia(
  userId: string,
  localUri: string,
  mimeType?: string | null,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const resolvedMime = normalizeMime(mimeType);
  const ext    = mimeToExt(resolvedMime);
  const folder = isVideo(resolvedMime) ? 'videos' : 'images';
  const key    = `posts/${folder}/${userId}/${Date.now()}.${ext}`;
  return uploadToR2(key, localUri, resolvedMime, onProgress, signal);
}

/**
 * Video-Thumbnail direkt hochladen (bereits generiertes Bild-URI)
 * Internes Hilfsmittel — wird von generateAndUploadThumbnail genutzt.
 */
async function uploadThumbnail(
  userId: string,
  localUri: string,
  signal?: AbortSignal,
): Promise<string> {
  const key = `thumbnails/${userId}/${Date.now()}.jpg`;
  const { url } = await uploadToR2(key, localUri, 'image/jpeg', undefined, signal);
  return url;
}

/**
 * Aus einem Video automatisch einen Thumbnail extrahieren und zu R2 hochladen.
 *
 * • Nutzt expo-video-thumbnails (bereits installiert)
 * • Extrahiert Frame bei t=0ms, Quality=0.75
 * • Gibt null zurück falls Thumbnail nicht generiert werden kann
 *   (Thumbnails sind IMMER optional — kein harter Fehler)
 *
 * Verwendung:
 *   const thumbUrl = await generateAndUploadThumbnail(userId, videoUri);
 *   // thumbUrl ist string | null
 */
export async function generateAndUploadThumbnail(
  userId: string,
  videoUri: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    // Dynamischer Import → kein Bundle-Problem falls Library fehlt
    const VideoThumbnails = await import('expo-video-thumbnails');
    const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time:    0,     // Erster Frame
      quality: 0.75,  // JPEG-Qualität — gut genug für Thumbnails
    });

    if (!thumbUri) return null;

    const url = await uploadThumbnail(userId, thumbUri, signal);
    return url;
  } catch (err) {
    // Thumbnail ist optional — kein harter Fehler, nur warnen
    __DEV__ && console.warn('[generateAndUploadThumbnail]', err);
    return null;
  }
}

/**
 * Profilbild → Cloudflare R2
 * (Avatare werden bei jedem Feed-Item, Profil und DM geladen — hoher Egress)
 */
export async function uploadAvatar(
  userId: string,
  localUri: string,
  signal?: AbortSignal,
): Promise<UploadResult> {
  // Timestamp im Key → verhindert CDN-Cache-Probleme bei Avatar-Wechsel
  const key = `avatars/${userId}/${Date.now()}.jpg`;
  return uploadToR2(key, localUri, 'image/jpeg', undefined, signal);
}

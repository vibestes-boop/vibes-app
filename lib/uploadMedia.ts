import { useAuthStore } from './authStore';
import { supabase } from './supabase';
import {
  extensionForMediaMime,
  inspectMp4FastStart,
  isVideoMime,
  isWebmMime,
  normalizeMediaMime,
} from '../shared/media/videoFastStart';

type UploadResult = {
  url: string;
  path: string;
};

type R2SignResult = {
  uploadUrl: string;
  publicUrl: string;
  uploadHeaders?: Record<string, string>;
};

// ── Limits ──────────────────────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;  //  50 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;  // 200 MB
const IMMUTABLE_MEDIA_CACHE = 'public, max-age=31536000, immutable';

// ── Helpers ──────────────────────────────────────────────────────────────────
function mimeToExt(mimeType: string): string {
  return extensionForMediaMime(mimeType);
}

function isVideo(mimeType: string): boolean {
  return isVideoMime(mimeType);
}

/**
 * Normalize a MIME type coming from expo-image-picker.
 * Uses || (not ??) to also catch empty strings that iOS sometimes returns.
 * Trims whitespace to prevent canonical header mismatches with the signed value.
 */
function normalizeMime(raw: string | null | undefined, uriOrName?: string | null): string {
  return normalizeMediaMime(raw, uriOrName);
}

function getHeaderValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1]?.trim();
}

function normalizeUploadHeaders(
  headers: Record<string, string> | undefined,
  fallbackContentType: string,
): Record<string, string> {
  const contentType = getHeaderValue(headers, 'content-type') || fallbackContentType;
  const cacheControl = getHeaderValue(headers, 'cache-control');
  return cacheControl
    ? { 'Content-Type': contentType, 'Cache-Control': cacheControl }
    : { 'Content-Type': contentType };
}

async function assertUploadMediaHealthy(
  localUri: string,
  mimeType: string,
  fileBuffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<void> {
  if (!isVideo(mimeType)) return;

  if (isWebmMime(mimeType)) {
    throw new Error('Bitte lade ein MP4- oder MOV-Video hoch. WebM startet auf iOS nicht zuverlaessig im Feed.');
  }

  // Fast-Start-Inspektion bleibt (Telemetrie), aber slow-start wird NICHT mehr
  // hart geblockt: iOS-Kamera-Aufnahmen sind systembedingt slow-start
  // (AVFoundation schreibt das moov-Atom ans Datei-Ende), und es gibt keine
  // On-Device-Remux-Lib → der Block machte Video-Posten auf iOS unmöglich.
  // Das Video spielt im Feed trotzdem (AVPlayer holt moov per HTTP-Range);
  // nur der Instant-Feed-Start ist nicht optimiert. Echte Fast-Start-
  // Optimierung gehört server-seitig beim Ingest, nicht als Client-Block.
  const inspection = inspectMp4FastStart(fileBuffer, mimeType);
  if (inspection.status === 'slow-start') {
    __DEV__ && console.warn('[media-upload] slow-start Video erlaubt (kein Client-Remux möglich):', inspection.reason);
  }

  if (signal?.aborted) throw new Error('Upload abgebrochen.');

  try {
    const VideoThumbnails = await import('expo-video-thumbnails');
    const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
      time: 0,
      quality: 0.25,
    });
    if (!uri) throw new Error('missing thumbnail uri');
  } catch (err) {
    __DEV__ && console.warn('[media-upload-health]', err);
    throw new Error('Video konnte nicht gelesen werden. Bitte waehle oder exportiere die Datei neu.');
  }
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
  const mimeType = normalizeMime(rawMimeType, localUri);

  // ── 1) Fetch local file & validate size ─────────────────────────────────
  const fileRes = await fetch(localUri, { signal });
  if (!fileRes.ok) {
    throw new Error(`Lokale Datei nicht lesbar (${fileRes.status})`);
  }
  const fileBuffer = await fileRes.arrayBuffer();

  const maxBytes = isVideo(mimeType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (fileBuffer.byteLength > maxBytes) {
    const limitMB = Math.round(maxBytes / 1024 / 1024);
    const fileMB = (fileBuffer.byteLength / 1024 / 1024).toFixed(1);
    throw new Error(
      `Datei zu groß: ${fileMB} MB (Maximum: ${limitMB} MB für ${isVideo(mimeType) ? 'Videos' : 'Bilder'})`,
    );
  }
  await assertUploadMediaHealthy(localUri, mimeType, fileBuffer, signal);
  onProgress?.(15);

  // ── 2) Get presigned URL from Edge Function (with retry) ────────────────
  const { uploadUrl, publicUrl, uploadHeaders } = await withRetry(
    async () => {
      if (signal?.aborted) throw new Error('Upload abgebrochen.');
      const { data, error } = await supabase.functions.invoke('r2-sign', {
        // contentLength: serverseitige Größen-Guardrail (Edge-Function prüft
        // gegen Kategorie-Limit). fileBuffer hat fixe Länge → exakt + verlässlich.
        body: { key, contentType: mimeType, cacheControl: IMMUTABLE_MEDIA_CACHE, contentLength: fileBuffer.byteLength },
      });
      if (error || !data?.uploadUrl) {
        throw new Error(`Sign-Fehler: ${error?.message ?? 'Keine uploadUrl'}`);
      }
      return data as R2SignResult;
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
          headers: normalizeUploadHeaders(uploadHeaders, mimeType),
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
 * Video on-device komprimieren, BEVOR es zu R2 geht.
 *
 * Ein rohes Handy-Video (1080p, hohe Bitrate) wiegt schnell 14–60 MB. Das
 * bremst den Feed-Start (vor allem im Mobilfunknetz), kostet die User
 * Upload-Daten und füllt R2. `react-native-compressor` re-encodet das Video
 * nativ (AVAssetExportSession auf iOS, MediaCodec auf Android) → typischerweise
 * 3–5× kleiner, bei für einen Phone-Feed nicht sichtbarem Qualitätsverlust.
 *
 * Best-effort: schlägt die Komprimierung fehl (exotischer Codec, OOM, Cancel),
 * laden wir das Original hoch statt den Post zu blockieren. Gibt das (ggf.
 * neue) lokale URI zurück.
 */
async function compressVideoForUpload(
  localUri: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new Error('Upload abgebrochen.');
  try {
    const { Video } = await import('react-native-compressor');
    const compressedUri = await Video.compress(
      localUri,
      {
        // 'auto' wählt Bitrate/Resolution adaptiv.
        compressionMethod: 'auto',
        // Längste Kante auf ~720p deckeln (Portrait 720×1280) — scharf genug
        // für den Feed, aber deutlich leichter als 1080p.
        maxSize: 1280,
        // 0 = IMMER komprimieren. Sonst überspringt die Lib Dateien unter ihrer
        // Default-Schwelle (16 MB) — und genau unsere ~14-MB-Clips blieben roh.
        minimumFileSizeForCompress: 0,
      },
      (progress) => onProgress?.(Math.round(progress * 100)),
    );
    return compressedUri || localUri;
  } catch (err) {
    __DEV__ && console.warn('[compressVideoForUpload] Fallback auf Original:', err);
    return localUri;
  }
}

/**
 * Post-Medien: Videos UND Bilder → Cloudflare R2
 * (0€ Egress — kein Supabase Storage mehr für neue Uploads)
 *
 * Videos werden vorher on-device komprimiert (s. compressVideoForUpload).
 */
export async function uploadPostMedia(
  userId: string,
  localUri: string,
  mimeType?: string | null,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const resolvedMime = normalizeMime(mimeType, localUri);

  if (isVideo(resolvedMime)) {
    // Progress gesplittet: Komprimieren 0–40 %, Upload 40–100 %.
    // Negative Werte (Retry-Signal an die UI) werden unverändert durchgereicht.
    const compressedUri = await compressVideoForUpload(
      localUri,
      (p) => onProgress?.(p < 0 ? p : Math.round(p * 0.4)),
      signal,
    );
    // react-native-compressor schreibt immer ein H.264-MP4 → Mime/Extension auf
    // mp4 normalisieren, wenn tatsächlich komprimiert wurde. (mov→mp4 ist ein
    // Bonus: mp4 startet im Feed zuverlässiger als mov.)
    const didCompress = compressedUri !== localUri;
    const videoMime = didCompress ? 'video/mp4' : resolvedMime;
    const videoExt = didCompress ? 'mp4' : mimeToExt(resolvedMime);
    const key = `posts/videos/${userId}/${Date.now()}.${videoExt}`;
    return uploadToR2(
      key,
      compressedUri,
      videoMime,
      (p) => onProgress?.(p < 0 ? p : 40 + Math.round(p * 0.6)),
      signal,
    );
  }

  const ext = mimeToExt(resolvedMime);
  const key = `posts/images/${userId}/${Date.now()}.${ext}`;
  return uploadToR2(key, localUri, resolvedMime, onProgress, signal);
}

/**
 * Shop-Produktbilder getrennt von Feed-Posts ablegen. Dadurch bleiben sie
 * leichter auditierbar und werden vom R2-Orphan-Scanner als Produkt-Medien
 * geschützt.
 */
export async function uploadProductImage(
  userId: string,
  localUri: string,
  mimeType?: string | null,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const resolvedMime = normalizeMime(mimeType, localUri);
  const ext = mimeToExt(resolvedMime);
  const key = `products/images/${userId}/${Date.now()}.${ext}`;
  return uploadToR2(key, localUri, resolvedMime, onProgress, signal);
}

/**
 * Digitale Produktdatei (PDF/ZIP/…) in den PRIVATEN Supabase-Storage-Bucket
 * `digital-products` hochladen — NICHT R2, weil der Download-Vertrag
 * (`generate_download_url` + `createSignedUrl`) genau diesen Bucket erwartet.
 *
 * Rückgabe-`url` hat das Format `…/object/public/digital-products/<path>`,
 * damit die RPC daraus per Regex den Storage-Pfad extrahieren kann. Der Bucket
 * ist privat → der „public"-URL-String funktioniert NICHT direkt; der Käufer
 * bekommt nach Kauf eine kurzlebige Signed URL (RLS-gegated).
 */
const MAX_DIGITAL_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function uploadDigitalFile(
  userId: string,
  localUri: string,
  fileName: string,
  mimeType?: string | null,
): Promise<UploadResult> {
  const fileRes = await fetch(localUri);
  if (!fileRes.ok) throw new Error(`Datei nicht lesbar (${fileRes.status})`);
  const buf = await fileRes.arrayBuffer();
  if (buf.byteLength > MAX_DIGITAL_FILE_BYTES) {
    const mb = (buf.byteLength / 1024 / 1024).toFixed(1);
    throw new Error(`Datei zu groß: ${mb} MB (Maximum: 50 MB)`);
  }
  const safeExt = (fileName.split('.').pop() ?? 'bin')
    .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const path = `${userId}/${Date.now()}.${safeExt}`;
  const contentType = mimeType || 'application/octet-stream';

  const { error } = await supabase.storage
    .from('digital-products')
    .upload(path, buf, { contentType, upsert: false });
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);

  const url = supabase.storage.from('digital-products').getPublicUrl(path).data.publicUrl;
  return { url, path };
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
      time: 0,     // Erster Frame
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

/**
 * Creator-Stimme klonen (Chatterbox S2)
 * Lädt eine Audioaufnahme (m4a/mp4) zu R2 hoch.
 * Die URL wird als audio_prompt an generate-voice übergeben.
 */
export async function uploadVoiceSample(
  userId: string,
  localUri: string,
  mimeType: string,
): Promise<string> {
  // Chatterbox/Replicate erfordert WAV → .wav Extension wenn mimeType audio/wav
  const ext = mimeType.includes('wav') ? 'wav'
    : mimeType.includes('m4a') ? 'm4a'
    : mimeType.includes('mp4') ? 'mp4'
    : 'wav'; // Default: wav (Chatterbox-kompatibel)
  const key = `voice-samples/${userId}/${Date.now()}.${ext}`;
  const { url } = await uploadToR2(key, localUri, mimeType);
  return url;
}

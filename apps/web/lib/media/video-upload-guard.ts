import {
  inspectMp4FastStart,
  extensionForMediaMime,
  isVideoMime,
  isWebmMime,
  normalizeMediaMime,
  VIDEO_FAST_START_ERROR,
  VIDEO_FAST_START_SCAN_BYTES,
} from '@shared/media/videoFastStart';

type VideoUploadValidation =
  | { ok: true }
  | { ok: false; error: string };

const VIDEO_METADATA_TIMEOUT_MS = 8000;

export function detectUploadMediaKind(file: File): 'image' | 'video' | null {
  const rawType = file.type.trim().toLowerCase();
  if (!rawType && !hasKnownMediaExtension(file.name)) return null;
  const mimeType = normalizeMediaMime(file.type, file.name);
  if (isVideoMime(mimeType)) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

export function getUploadMediaMime(file: File): string {
  return normalizeMediaMime(file.type, file.name);
}

export function getUploadMediaExtension(file: File): string {
  return extensionForMediaMime(getUploadMediaMime(file));
}

export async function validateVideoUploadFile(file: File): Promise<VideoUploadValidation> {
  const mimeType = normalizeMediaMime(file.type, file.name);
  if (!isVideoMime(mimeType)) return { ok: true };

  if (isWebmMime(mimeType)) {
    return {
      ok: false,
      error: 'Bitte lade ein MP4- oder MOV-Video hoch. WebM startet auf iOS nicht zuverlaessig im Feed.',
    };
  }

  const slice = file.slice(0, VIDEO_FAST_START_SCAN_BYTES);
  const firstBytes = await slice.arrayBuffer();
  const inspection = inspectMp4FastStart(firstBytes, mimeType);
  if (inspection.status === 'slow-start') {
    return { ok: false, error: VIDEO_FAST_START_ERROR };
  }

  try {
    await assertBrowserCanReadVideo(file);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Video konnte nicht gelesen werden.',
    };
  }

  return { ok: true };
}

function assertBrowserCanReadVideo(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const timeout = window.setTimeout(() => {
      finish(new Error('Video konnte nicht schnell genug gelesen werden. Bitte exportiere es erneut als MP4/MOV.'));
    }, VIDEO_METADATA_TIMEOUT_MS);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onerror = () => {
      finish(new Error('Video konnte nicht gelesen werden. Bitte waehle oder exportiere die Datei neu.'));
    };
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finish(new Error('Video hat keine lesbaren Bilddaten.'));
        return;
      }
      const targetTime = Math.min(0.35, Math.max(0, (video.duration || 1) - 0.1));
      if (targetTime <= 0.05) {
        finish();
        return;
      }
      video.currentTime = targetTime;
    };
    video.onseeked = () => finish();
    video.src = objectUrl;
  });
}

function hasKnownMediaExtension(name: string): boolean {
  return /\.(gif|heic|heif|jpe?g|m4v|mov|mp4|png|webm|webp)$/i.test(name);
}

export type VideoFastStartStatus = 'fast-start' | 'slow-start' | 'unknown' | 'not-mp4';

export type VideoFastStartInspection = {
  status: VideoFastStartStatus;
  reason: string;
  scannedBytes: number;
  ftypOffset: number | null;
  moovOffset: number | null;
  mdatOffset: number | null;
};

export const VIDEO_FAST_START_SCAN_BYTES = 2 * 1024 * 1024;
export const VIDEO_FAST_START_ERROR =
  'Dieses Video ist nicht fuer schnellen Feed-Start optimiert. Bitte exportiere es erneut als MP4/MOV mit "Fast Start" oder lade eine andere Datei hoch.';

const KNOWN_MP4_BRANDS = new Set([
  'avc1',
  'dash',
  'heic',
  'heix',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'isom',
  'm4v ',
  'mp41',
  'mp42',
  'qt  ',
]);

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export function normalizeMediaMime(
  raw: string | null | undefined,
  uriOrName?: string | null,
): string {
  const trimmed = raw?.trim().toLowerCase();
  if (trimmed) return canonicalizeMime(trimmed, uriOrName);

  const ext = extensionFromUriOrName(uriOrName);
  if (ext && VIDEO_MIME_BY_EXT[ext]) return VIDEO_MIME_BY_EXT[ext];
  if (ext && IMAGE_MIME_BY_EXT[ext]) return IMAGE_MIME_BY_EXT[ext];
  return 'image/jpeg';
}

export function extensionForMediaMime(mimeType: string): string {
  const mime = normalizeMediaMime(mimeType);
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('heic')) return 'heic';
  if (mime.includes('heif')) return 'heif';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4v')) return 'mp4';
  return 'jpg';
}

export function isVideoMime(mimeType: string | null | undefined): boolean {
  const mime = (mimeType || '').toLowerCase();
  return mime.startsWith('video/') || mime.includes('quicktime') || mime.includes('mp4');
}

export function isWebmMime(mimeType: string | null | undefined): boolean {
  return (mimeType || '').toLowerCase().includes('webm');
}

export function inspectMp4FastStart(
  input: ArrayBuffer | Uint8Array,
  mimeType?: string | null,
): VideoFastStartInspection {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const scannedBytes = Math.min(bytes.byteLength, VIDEO_FAST_START_SCAN_BYTES);
  const initial: VideoFastStartInspection = {
    status: 'unknown',
    reason: 'not enough data scanned',
    scannedBytes,
    ftypOffset: null,
    moovOffset: null,
    mdatOffset: null,
  };

  if (!isMp4LikeMime(mimeType) && mimeType) {
    return { ...initial, status: 'not-mp4', reason: `mime ${mimeType} is not mp4-like` };
  }

  if (scannedBytes < 16) {
    return { ...initial, reason: 'file too small for mp4 boxes' };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let ftypOffset: number | null = null;
  let moovOffset: number | null = null;
  let mdatOffset: number | null = null;
  let sawMp4Brand = false;

  while (offset + 8 <= scannedBytes) {
    const box = readBox(view, offset, scannedBytes);
    if (!box) {
      return {
        status: mdatOffset !== null && moovOffset === null ? 'slow-start' : 'unknown',
        reason: 'could not read complete mp4 box header',
        scannedBytes,
        ftypOffset,
        moovOffset,
        mdatOffset,
      };
    }

    if (box.type === 'ftyp') {
      ftypOffset = offset;
      sawMp4Brand = hasMp4Brand(bytes, box.headerSize, box.size, offset);
    }
    if (box.type === 'moov') moovOffset = offset;
    if (box.type === 'mdat') mdatOffset = offset;

    if (moovOffset !== null && mdatOffset !== null) break;
    if (box.size <= 0) break;
    offset += box.size;
  }

  if (ftypOffset === null && !isMp4LikeMime(mimeType)) {
    return {
      status: 'not-mp4',
      reason: 'no ftyp box found',
      scannedBytes,
      ftypOffset,
      moovOffset,
      mdatOffset,
    };
  }

  if (ftypOffset !== null && !sawMp4Brand) {
    return {
      status: 'not-mp4',
      reason: 'ftyp brand is not recognized as mp4/quicktime',
      scannedBytes,
      ftypOffset,
      moovOffset,
      mdatOffset,
    };
  }

  if (moovOffset !== null && (mdatOffset === null || moovOffset < mdatOffset)) {
    return {
      status: 'fast-start',
      reason: 'moov box is before mdat',
      scannedBytes,
      ftypOffset,
      moovOffset,
      mdatOffset,
    };
  }

  if (mdatOffset !== null && (moovOffset === null || mdatOffset < moovOffset)) {
    return {
      status: 'slow-start',
      reason: moovOffset === null ? 'mdat found before moov, moov not in first scan window' : 'mdat is before moov',
      scannedBytes,
      ftypOffset,
      moovOffset,
      mdatOffset,
    };
  }

  return {
    status: 'unknown',
    reason: 'moov/mdat boxes not found in first scan window',
    scannedBytes,
    ftypOffset,
    moovOffset,
    mdatOffset,
  };
}

function canonicalizeMime(mimeType: string, uriOrName?: string | null): string {
  const mime = mimeType.split(';', 1)[0].trim().toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'video/mov' || mime === 'video/x-quicktime') return 'video/quicktime';
  if (mime === 'video/x-m4v') return 'video/mp4';
  if (mime === 'application/octet-stream') {
    const ext = extensionFromUriOrName(uriOrName);
    if (ext && VIDEO_MIME_BY_EXT[ext]) return VIDEO_MIME_BY_EXT[ext];
    if (ext && IMAGE_MIME_BY_EXT[ext]) return IMAGE_MIME_BY_EXT[ext];
  }
  return mime;
}

function extensionFromUriOrName(uriOrName?: string | null): string | null {
  if (!uriOrName) return null;
  const withoutQuery = uriOrName.split(/[?#]/, 1)[0] || '';
  const lastSlash = withoutQuery.lastIndexOf('/');
  const name = lastSlash >= 0 ? withoutQuery.slice(lastSlash + 1) : withoutQuery;
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).trim().toLowerCase();
}

function isMp4LikeMime(mimeType?: string | null): boolean {
  if (!mimeType) return true;
  const mime = mimeType.toLowerCase();
  return mime.includes('mp4') || mime.includes('quicktime') || mime.includes('m4v');
}

function readBox(
  view: DataView,
  offset: number,
  scannedBytes: number,
): { type: string; size: number; headerSize: number } | null {
  const size32 = view.getUint32(offset, false);
  const type = readAscii(view, offset + 4, 4);
  if (!type) return null;

  if (size32 === 0) {
    return { type, size: scannedBytes - offset, headerSize: 8 };
  }

  if (size32 === 1) {
    if (offset + 16 > scannedBytes) return null;
    const high = view.getUint32(offset + 8, false);
    const low = view.getUint32(offset + 12, false);
    if (high > 0) return { type, size: scannedBytes - offset, headerSize: 16 };
    if (low < 16) return null;
    return { type, size: low, headerSize: 16 };
  }

  if (size32 < 8) return null;
  return { type, size: size32, headerSize: 8 };
}

function readAscii(view: DataView, offset: number, length: number): string | null {
  if (offset + length > view.byteLength) return null;
  let out = '';
  for (let index = 0; index < length; index += 1) {
    out += String.fromCharCode(view.getUint8(offset + index));
  }
  return out;
}

function hasMp4Brand(bytes: Uint8Array, headerSize: number, boxSize: number, boxOffset: number): boolean {
  const start = boxOffset + headerSize;
  const end = Math.min(boxOffset + boxSize, bytes.byteLength);
  if (end - start < 4) return false;

  for (let offset = start; offset + 4 <= end; offset += 4) {
    let brand = '';
    for (let index = 0; index < 4; index += 1) {
      brand += String.fromCharCode(bytes[offset + index] || 0);
    }
    if (KNOWN_MP4_BRANDS.has(brand)) return true;
  }
  return false;
}

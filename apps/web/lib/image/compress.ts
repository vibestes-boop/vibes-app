/**
 * Browser-seitige Image-Compression vor R2-PUT.
 *
 * Kontext (v1.w.12.7): Bis dato wurde jedes vom User gewählte Bild unverändert
 * nach R2 geputtet. Ein 50 MB JPEG vom iPhone 15 Pro (~48 MP) landet so 1:1 im
 * Object-Store, obwohl der Feed es via `next/image` eh auf max. ~1080px
 * rendered. Der User zahlt dreimal: Upload-Zeit auf Mobile-Data, R2-Storage-Bytes,
 * Image-Optimizer-CPU beim jeden Feed-Request.
 *
 * Dieser Helper löst das Problem browser-seitig via Canvas-Resize + JPEG/WebP-
 * Re-Encode. Bewusst KEINE externe Lib (`browser-image-compression` etc.) —
 * die Canvas-API reicht für unsere Anforderungen und spart ~25 kB gz Bundle.
 *
 * Was NICHT hier gemacht wird:
 * - Video-Compression (würde `ffmpeg.wasm` brauchen, v1.w.8b-Scope)
 * - EXIF-Rotation-Fix (moderne Browser rotieren seit 2019 automatisch bei
 *   `drawImage`, aber Safari iOS <14 hat den Bug noch — Acceptable-Regression;
 *   `createImageBitmap({ imageOrientation: 'from-image' })` könnte später helfen)
 * - HEIC-Decoding (iPhone-Format): Browser decoded HEIC nicht nativ, aber
 *   `<input type="file" accept="image/*">` wandelt es auf iOS 14+ bei File-Pick
 *   automatisch in JPEG. Andere Plattformen sehen HEIC gar nicht erst.
 */

export interface CompressOptions {
  /**
   * Maximale Kantenlänge (Longest Edge) in Pixel. Bilder mit kürzerer längster
   * Kante werden nicht hochskaliert — wir verkleinern nur, wir vergrößern nie.
   * Default: 1920 (genug für 2x-Retina-Feed-Cards bis ~1080px CSS-Width).
   */
  maxEdge?: number;

  /**
   * JPEG/WebP-Quality zwischen 0 und 1. Default: 0.82 (empirisch sauberer
   * Sweet-Spot zwischen sichtbarer Qualität und Dateigröße für Social-Photos).
   */
  quality?: number;

  /**
   * Output-MIME. `'auto'` nutzt WebP wenn der Browser `canvas.toBlob` dafür
   * unterstützt (alle modernen Browser tun das), sonst JPEG. WebP spart gegenüber
   * JPEG typischerweise weitere ~25-35 % bei vergleichbarer Optik. Für
   * Maximum-Kompatibilität (alte E-Mail-Clients etc.) explizit `'image/jpeg'`.
   * Default: `'auto'`.
   */
  outputType?: 'auto' | 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface CompressResult {
  /** Komprimierter Blob (ready für `fetch(PUT, { body })`). */
  blob: Blob;
  /** Der tatsächlich gewählte MIME-Type (wichtig für `Content-Type`-Header beim PUT). */
  mimeType: string;
  /** Finale Pixel-Breite. */
  width: number;
  /** Finale Pixel-Höhe. */
  height: number;
  /** Finale Byte-Länge (= `blob.size`). */
  bytes: number;
  /**
   * Ob tatsächlich neu encoded wurde. `false` wenn das Original schon
   * kleiner/effizienter war als das Compress-Ergebnis — wir geben dann das
   * Original-File zurück (wrapped als Blob), statt unnötig Qualität zu verlieren.
   */
  compressed: boolean;
}

const DEFAULTS: Required<CompressOptions> = {
  maxEdge: 1920,
  quality: 0.82,
  outputType: 'auto',
};

/**
 * Versucht ein Bild zu komprimieren. Gibt bei Fehlern (CORS, decode-Fail,
 * unsupported-Format) das Original wrapped zurück — der Upload-Pfad soll
 * NIE an Compression scheitern, nur profitieren.
 */
export async function compressImage(
  file: File | Blob,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const opts = { ...DEFAULTS, ...options };
  const originalBytes = file.size;
  const originalMime =
    (file as File).type || (file instanceof Blob ? file.type : '') || 'image/jpeg';

  // Safety-Net: SVG niemals durch Canvas jagen (würde XSS-Pfade eröffnen und
  // Vektor-Scaling verlustfrei beibehalten — macht kein Sinn).
  if (originalMime === 'image/svg+xml') {
    return passthrough(file, originalMime);
  }

  try {
    const bitmap = await decodeToBitmap(file);
    const { width: origW, height: origH } = bitmap;

    // Ziel-Dimensionen: Longest-Edge ≤ maxEdge, Aspect-Ratio preserved.
    const longEdge = Math.max(origW, origH);
    const scale = longEdge > opts.maxEdge ? opts.maxEdge / longEdge : 1;
    const targetW = Math.round(origW * scale);
    const targetH = Math.round(origH * scale);

    const mimeType = pickOutputMime(opts.outputType);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return passthrough(file, originalMime);
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const encoded = await canvasToBlob(canvas, mimeType, opts.quality);
    if (!encoded) {
      return passthrough(file, originalMime);
    }

    // Wenn das Original kleiner war (z.B. bereits optimiertes JPEG / kleines PNG
    // von einem Screenshot-Tool), lieber das Original nehmen — Re-Encoding hätte
    // nur Qualität verloren ohne Bytes zu sparen.
    if (encoded.size >= originalBytes && scale === 1) {
      return passthrough(file, originalMime);
    }

    return {
      blob: encoded,
      mimeType,
      width: targetW,
      height: targetH,
      bytes: encoded.size,
      compressed: true,
    };
  } catch {
    return passthrough(file, originalMime);
  }
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

function passthrough(file: File | Blob, mimeType: string): CompressResult {
  return {
    blob: file instanceof Blob ? file : new Blob([file], { type: mimeType }),
    mimeType,
    // Dimensionen ohne Decode unbekannt — 0 signalisiert "unchanged".
    width: 0,
    height: 0,
    bytes: file.size,
    compressed: false,
  };
}

async function decodeToBitmap(file: File | Blob): Promise<ImageBitmap> {
  // `createImageBitmap` ist der schnellste + memory-effizienteste Weg, funktioniert
  // in allen modernen Browsern (Chrome 50+, Firefox 42+, Safari 15+).
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file);
  }
  // Fallback für sehr alte Safari/iOS-Versionen: FileReader → Image → Canvas.
  // Diese Pfad-Variante ist defensive — CI/2026-Browsers erreichen sie nie.
  const dataUrl = await blobToDataUrl(file);
  const img = await loadImage(dataUrl);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cctx = c.getContext('2d');
  if (!cctx) throw new Error('Canvas 2D-Context nicht verfügbar');
  cctx.drawImage(img, 0, 0);
  // Synthetisches ImageBitmap-Shape — reicht für unsere drawImage-Konsumenten.
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => {
      /* no-op */
    },
  } as unknown as ImageBitmap;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image-Decode fehlgeschlagen'));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}

function pickOutputMime(preference: CompressOptions['outputType']): string {
  if (preference === 'image/webp' || preference === 'image/jpeg' || preference === 'image/png') {
    return preference;
  }
  // `auto`: prefer WebP, aber nur wenn der Browser es im toBlob kann.
  if (supportsWebp()) return 'image/webp';
  return 'image/jpeg';
}

let _webpCache: boolean | null = null;
function supportsWebp(): boolean {
  if (_webpCache !== null) return _webpCache;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const url = c.toDataURL('image/webp');
    _webpCache = url.startsWith('data:image/webp');
  } catch {
    _webpCache = false;
  }
  return _webpCache;
}

/**
 * Helper für File-Namen-Anpassung nach Compression (wichtig für R2-Key-Endung).
 * Beispiel: `photo.heic` → `photo.webp` wenn mime=image/webp.
 */
export function extensionForMime(mime: string): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}

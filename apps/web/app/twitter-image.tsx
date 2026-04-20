// Twitter-Card-Image — Default-Fallback für jede Page ohne eigene
// `twitter:image`-Metadata. Wir rendern exakt das gleiche Bild wie für OG,
// um Konsistenz zwischen FB/WhatsApp/LinkedIn und Twitter/X zu garantieren.
// Next.js 15 merged die beiden Conventions NICHT automatisch — `twitter-image.tsx`
// muss existieren, sonst fällt Twitter auf kein Bild zurück.

import OgImage, {
  runtime as ogRuntime,
  alt as ogAlt,
  size as ogSize,
  contentType as ogContentType,
} from './opengraph-image';

export const runtime = ogRuntime;
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default OgImage;

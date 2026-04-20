// Twitter-Card-Image — Default-Fallback für jede Page ohne eigene
// `twitter:image`-Metadata. Wir rendern exakt das gleiche Bild wie für OG,
// um Konsistenz zwischen FB/WhatsApp/LinkedIn und Twitter/X zu garantieren.
// Next.js 15 merged die beiden Conventions NICHT automatisch — `twitter-image.tsx`
// muss existieren, sonst fällt Twitter auf kein Bild zurück.
//
// WICHTIG: Route-Config-Exports (runtime/alt/size/contentType) MÜSSEN statische
// String-Literals sein — Next.js 15 parsed sie AST-basiert ohne Code-Execution.
// Re-Exports von `./opengraph-image` funktionieren nicht (Parser sieht nur
// Variable-Identifier, kennt den Wert nicht). Deswegen hier duplizierte Literale
// — wenn sich opengraph-image ändert, hier mitziehen.

import OgImage from './opengraph-image';

export const runtime = 'edge';
export const alt = 'Serlo — Live, Feed, Shop';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default OgImage;

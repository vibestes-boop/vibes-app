// Twitter/X card image for /live/replay/[id] — re-uses the OG image function.
// Config exports MUST be static literals (Next.js 15 parses them without execution).
// v1.w.UI.132 — Replay twitter-image parity.
import Image from './opengraph-image';

export const runtime = 'edge';
export const alt = 'Serlo Live Replay';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default Image;

// Twitter/X card image for /u/[username]/shop — re-uses the OG image function.
// Config exports MUST be static literals (Next.js 15 parses them without execution).
// v1.w.UI.130 — twitter-image parity across all dynamic OG-image pages.
import Image from './opengraph-image';

export const runtime = 'edge';
export const alt = 'Serlo Shop';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default Image;

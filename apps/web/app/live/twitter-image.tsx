// Twitter/X card image for /live — re-uses the OG image function.
// Config exports MUST be static literals (Next.js 15 parses them without execution).
// v1.w.UI.131 — twitter-image parity for public hub pages.
import Image from './opengraph-image';

export const runtime = 'edge';
export const alt = 'Serlo Live';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default Image;

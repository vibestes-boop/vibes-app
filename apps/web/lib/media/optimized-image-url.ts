const DEFAULT_IMAGE_QUALITY = 75;

// Feed media is visually capped by the TikTok-style column. Keeping these
// widths close to the rendered size avoids paying for oversized LCP resources.
export const FEED_VIDEO_POSTER_WIDTH = 750;
export const FEED_ACTION_AVATAR_WIDTH = 128;
export const FEED_ACTION_AVATAR_QUALITY = 70;

export function getOptimizedImageUrl(
  src: string | null | undefined,
  width: number,
  quality = DEFAULT_IMAGE_QUALITY,
): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('/_next/image')) return src;
  if (src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) return src;

  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality),
  });

  return `/_next/image?${params.toString()}`;
}

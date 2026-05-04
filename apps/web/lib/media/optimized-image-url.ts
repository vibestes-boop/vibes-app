const DEFAULT_IMAGE_QUALITY = 75;

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

/** Keep the selected photo through refreshed/reordered lists; clamp if removed. */
export function galleryIndex(images: readonly string[], selected: { uri: string; index: number } | null): number {
  if (!selected || !images.length) return 0;
  const found = images.indexOf(selected.uri);
  return found >= 0 ? found : Math.max(0, Math.min(selected.index, images.length - 1));
}

export function galleryPage(offset: number, width: number, count: number): number {
  if (!Number.isFinite(offset) || !Number.isFinite(width) || width <= 0 || count <= 0) return 0;
  return Math.max(0, Math.min(Math.round(offset / width), count - 1));
}

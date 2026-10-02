// Media uses the screen width; text and controls keep their own reading inset.
export const DISCOVERY_MEDIA_GUTTER = 6;
export const DISCOVERY_MEDIA_GAP = 6;

export type DiscoveryRow<T> = { key: string; kind: 'posts'; posts: T[] } | { key: 'people'; kind: 'people' };
export function buildDiscoveryRows<T extends { id: string }>(posts: T[], columns: number, showPeople: boolean): DiscoveryRow<T>[] {
  const width = Math.max(1, Math.floor(columns));
  const rows: DiscoveryRow<T>[] = [];
  const insertAfter = Math.ceil(4 / width) * width;
  for (let i = 0; i < posts.length; i += width) {
    rows.push({ key: posts[i].id, kind: 'posts', posts: posts.slice(i, i + width) });
    if (showPeople && posts.length >= insertAfter && i + width >= insertAfter && i < insertAfter) rows.push({ key: 'people', kind: 'people' });
  }
  if (showPeople && posts.length < insertAfter) rows.push({ key: 'people', kind: 'people' });
  return rows;
}
export const MIN_POST_SEARCH_LENGTH = 2;

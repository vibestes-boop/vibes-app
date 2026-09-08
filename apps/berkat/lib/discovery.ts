import type { Listing } from './useListings';

export type DiscoveryPreferences = { categorySlugs: string[]; useFollowing: boolean };
export const DEFAULT_DISCOVERY: DiscoveryPreferences = { categorySlugs: [], useFollowing: true };
const MAX_INTERESTS = 24;

export function normalizePreferences(value: DiscoveryPreferences): DiscoveryPreferences {
  return {
    categorySlugs: [...new Set(value.categorySlugs.filter(
      (slug) => typeof slug === 'string' && /^[a-z][a-z0-9-]{1,30}$/.test(slug),
    ))].sort().slice(0, MAX_INTERESTS),
    useFollowing: value.useFollowing,
  };
}

export function decodePreferences(raw: string | null): DiscoveryPreferences {
  if (raw === null) return { ...DEFAULT_DISCOVERY, categorySlugs: [] };
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.categorySlugs) || typeof value.useFollowing !== 'boolean') {
    throw new Error('discovery_preferences_invalid');
  }
  return normalizePreferences(value);
}

export function expandInterests(
  selected: string[], groups: { slug: string; children: { slug: string }[] }[],
): string[] {
  const wanted = new Set(selected);
  return [...new Set(groups.filter((g) => wanted.has(g.slug))
    .flatMap((g) => [g.slug, ...g.children.map((c) => c.slug)]))].sort();
}

export type DiscoveryReason = 'following' | 'interest' | 'both';
export type DiscoverySelection = { items: Listing[]; reasons: Record<string, DiscoveryReason> };

/** Two personal slots, then a new find. Each source is fetched before mixing,
 * so relevant offers can be older than the newest general page. */
export function selectDiscovery(
  recent: Listing[], interests: Listing[], following: Listing[], userId: string | null, limit = 8,
): DiscoverySelection {
  const byDate = (a: Listing, b: Listing) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
  const personal = (rows: Listing[]) => rows.filter((l) => l.seller_id !== userId).slice().sort(byDate);
  const interestPool = personal(interests);
  const followPool = personal(following);
  const recentPool = recent.slice().sort(byDate);
  const interestIds = new Set(interestPool.map((l) => l.id));
  const followIds = new Set(followPool.map((l) => l.id));
  const exploration = recentPool.filter((l) => !interestIds.has(l.id) && !followIds.has(l.id));
  const items: Listing[] = [];
  const seen = new Set<string>();
  const reasons: Record<string, DiscoveryReason> = {};
  const take = (pools: Listing[][]) => {
    // Prefer another seller where possible, without leaving slots empty.
    for (const pool of pools) {
      for (const diverse of [true, false]) {
        const next = pool.find((l) => !seen.has(l.id) &&
          (!diverse || l.seller_id !== items[items.length - 1]?.seller_id));
        if (!next) continue;
        seen.add(next.id);
        items.push(next);
        const interest = interestIds.has(next.id), followed = followIds.has(next.id);
        if (interest || followed) reasons[next.id] = interest && followed ? 'both' : interest ? 'interest' : 'following';
        return true;
      }
    }
    return false;
  };
  // With no personal matches, keep the familiar chronological general feed.
  if (interestPool.length === 0 && followPool.length === 0) {
    for (const item of recentPool) {
      if (!seen.has(item.id) && items.length < limit) { seen.add(item.id); items.push(item); }
    }
    return { items, reasons };
  }
  while (items.length < limit) {
    const slot = items.length % 3;
    const pools = slot === 0 ? [followPool, interestPool, recentPool]
      : slot === 1 ? [interestPool, followPool, recentPool]
        : [exploration, recentPool, followPool, interestPool];
    if (!take(pools)) break;
  }
  return { items, reasons };
}

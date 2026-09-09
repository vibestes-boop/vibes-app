import type { DiscoveryReason } from './discovery';
import type { LiveShow } from './useLiveShows';
import { nextPerSeries, type PlannedShow, type Series } from './useSchedule';

export type ShowSources<T> = { general: T[]; interest: T[]; following: T[]; partial: boolean };
export type ShowReasons = Record<string, DiscoveryReason>;
export function showReasonText(reason: DiscoveryReason): string {
  return reason === 'both' ? 'Gefolgt · Dein Interesse' : reason === 'following' ? 'Du folgst dem Gastgeber' : 'Aus deinen Interessen';
}
const score = (reason: DiscoveryReason | undefined) => reason === 'both' ? 3 : reason === 'following' ? 2 : reason === 'interest' ? 1 : 0;

function merge<T extends { id: string; host_id: string }>(sources: ShowSources<T>, userId: string | null) {
  const unique = new Map<string, T>();
  for (const show of [...sources.general, ...sources.interest, ...sources.following]) {
    if (!unique.has(show.id)) unique.set(show.id, show);
  }
  const interest = new Set(sources.interest.filter((s) => s.host_id !== userId).map((s) => s.id));
  const following = new Set(sources.following.filter((s) => s.host_id !== userId).map((s) => s.id));
  const reasons: ShowReasons = {};
  for (const id of unique.keys()) {
    if (interest.has(id) && following.has(id)) reasons[id] = 'both';
    else if (following.has(id)) reasons[id] = 'following';
    else if (interest.has(id)) reasons[id] = 'interest';
  }
  return { shows: [...unique.values()], reasons };
}

export function selectLiveShows(sources: ShowSources<LiveShow>, userId: string | null) {
  const { shows, reasons } = merge(sources, userId);
  shows.sort((a, b) => score(reasons[b.id]) - score(reasons[a.id]) ||
    (b.viewer_count ?? 0) - (a.viewer_count ?? 0) || a.id.localeCompare(b.id));
  const items = shows.slice(0, 60);
  return { items, reasons: Object.fromEntries(items.filter((s) => reasons[s.id]).map((s) => [s.id, reasons[s.id]])) };
}

export function selectUpcomingShows(sources: ShowSources<PlannedShow>, userId: string | null, now: number) {
  const { shows, reasons } = merge(sources, userId);
  const valid = shows.filter((s) => ['scheduled', 'reminded'].includes(s.status) &&
    Date.parse(s.scheduled_at) > now - 10 * 60_000);
  // The next occurrence is authoritative: a later matching occurrence must
  // neither hide an earlier date nor give that earlier date a false reason.
  const series: Series[] = nextPerSeries(valid);
  const soon = (s: Series) => Date.parse(s.next.scheduled_at) <= now + 6 * 60 * 60_000 ? 1 : 0;
  series.sort((a, b) => soon(b) - soon(a) ||
    (soon(a) ? 0 : score(reasons[b.next.id]) - score(reasons[a.next.id])) ||
    Date.parse(a.next.scheduled_at) - Date.parse(b.next.scheduled_at) || a.next.id.localeCompare(b.next.id));
  const items = series.slice(0, 12);
  return { items, reasons: Object.fromEntries(items.filter((s) => reasons[s.next.id]).map((s) => [s.next.id, reasons[s.next.id]])) };
}

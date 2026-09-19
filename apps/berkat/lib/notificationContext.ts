import { supabase } from './supabase';
import type { NotificationFeed, NotificationRecord } from './useNotifications';

type Profile = { id: string; username: string | null; avatar_url: string | null };
type Show = { id: string; title: string | null; thumbnail_url: string | null; status: string };
type Win = { id: string; seller_id: string; session_id: string | null; title: string;
  image_url: string | null; settled_at: string | null };

/** Old notifications have no auction ID. The trigger and settlement both use
 * transaction now(): require the exact timestamp, seller, session AND title.
 * A title-only or nearest-time guess can attach another purchase. */
export function matchingNotificationWin(row: NotificationRecord, wins: Win[]): Win | undefined {
  if (row.type !== 'auction_won' || !row.sender_id || !row.product_name) return;
  const matches = wins.filter(win => win.seller_id === row.sender_id &&
    win.session_id === row.session_id && win.title === row.product_name &&
    win.settled_at === row.created_at);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Batch enrichment under the signed-in user's existing RLS, never one request per row. */
export async function loadNotificationContext(rows: NotificationRecord[], userId: string, signal: AbortSignal): Promise<NotificationFeed> {
  if (!rows.length) return { items: [], partial: false };
  const senderIds = [...new Set(rows.flatMap(row => row.sender_id ? [row.sender_id] : []))];
  const sessionIds = [...new Set(rows.flatMap(row =>
    ['live', 'auction_up'].includes(row.type) && row.session_id ? [row.session_id] : []))];
  const wonRows = rows.filter(row => row.type === 'auction_won' && row.product_name && row.sender_id);
  const transactionTimes = [...new Set(wonRows.map(row => row.created_at))];
  const empty = { data: [], error: null };
  const result = await Promise.allSettled([
    senderIds.length ? supabase.from('profiles').select('id, username, avatar_url')
      .in('id', senderIds).abortSignal(signal) : Promise.resolve(empty),
    sessionIds.length ? supabase.from('live_sessions').select('id, title, thumbnail_url, status')
      .eq('app', 'berkat').in('id', sessionIds).abortSignal(signal) : Promise.resolve(empty),
    wonRows.length ? supabase.from('live_auctions').select('id, seller_id, session_id, title, image_url, settled_at')
      .eq('winner_id', userId).eq('status', 'sold').in('settled_at', transactionTimes)
      .order('settled_at', { ascending: false }).limit(200).abortSignal(signal) : Promise.resolve(empty),
  ]);
  if (signal.aborted) throw new Error('notification_request_cancelled');
  const get = <T,>(index: number): T[] => {
    const item = result[index];
    return item.status === 'fulfilled' && !item.value.error ? (item.value.data ?? []) as T[] : [];
  };
  const profiles = new Map(get<Profile>(0).map(profile => [profile.id, profile]));
  const shows = new Map(get<Show>(1).map(show => [show.id, show]));
  const wins = get<Win>(2);
  // A capped batch cannot establish uniqueness for all its timestamps.
  const completeWins = wins.length < 200 ? wins : [];
  return {
    partial: wins.length === 200 || result.some(item => item.status === 'rejected' || Boolean(item.value.error)),
    items: rows.map(row => {
      const profile = row.sender_id ? profiles.get(row.sender_id) : undefined;
      const show = row.session_id ? shows.get(row.session_id) : undefined;
      const win = matchingNotificationWin(row, completeWins);
      return { ...row,
        sender_name: profile?.username ?? null,
        sender_avatar: profile?.avatar_url ?? null,
        image_url: win?.image_url ?? (['live', 'auction_up'].includes(row.type) ? show?.thumbnail_url : null) ?? null,
        subject_title: win?.title ?? (row.type === 'live' ? show?.title : null) ?? null,
        auction_id: win?.id ?? null,
        live_status: show?.status ?? null,
      };
    }),
  };
}

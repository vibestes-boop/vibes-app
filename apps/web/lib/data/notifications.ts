import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Notifications Daten-Layer — v1.w.UI.38
//
// Zapft dieselbe `notifications`-Tabelle an, die auch die Native-App nutzt.
// Alle Push-Trigger (Like, Comment, Follow, DM, Gift, Live, Mention) laufen
// server-seitig via DB-Trigger → kein Web-seitiger Write nötig.
//
// Typen-Übersicht (notifications.type CHECK):
//   like          → jemand hat deinen Post geliked
//   comment       → jemand hat deinen Post kommentiert
//   follow        → jemand folgt dir
//   mention       → jemand hat dich in einem Kommentar erwähnt
//   dm            → neue DM (wird heute von der DM-Badge-Query abgedeckt)
//   gift          → jemand hat dir ein Geschenk gesendet (Live)
//   live          → jemand den du folgst geht live
//   live_invite   → du wurdest zum Duett/CoHost eingeladen
// -----------------------------------------------------------------------------

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'dm'
  | 'gift'
  | 'live'
  | 'live_invite';

export interface NotificationSender {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Notification {
  id: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  sender: NotificationSender | null;
  post_id: string | null;
  comment_id: string | null;
  session_id: string | null;
  comment_text: string | null;
  gift_name: string | null;
  gift_emoji: string | null;
  product_name: string | null;
}

const NOTIF_COLUMNS = `
  id,
  type,
  read,
  created_at,
  post_id,
  comment_id,
  session_id,
  comment_text,
  gift_name,
  gift_emoji,
  product_name,
  sender:profiles!notifications_sender_id_fkey (
    id,
    username,
    display_name,
    avatar_url
  )
`.trim();

// -----------------------------------------------------------------------------
// getNotifications — neueste 40 Notifications des eingeloggten Users.
// Gecacht per Request (React cache) — mehrfache Aufrufe in einem RSC-Tree
// landen auf dieselbe DB-Query.
// -----------------------------------------------------------------------------
export const getNotifications = cache(async (): Promise<Notification[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIF_COLUMNS)
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    type: row.type as NotificationType,
    read: row.read ?? false,
    created_at: row.created_at,
    sender: row.sender
      ? {
          id: (row.sender as NotificationSender).id,
          username: (row.sender as NotificationSender).username,
          display_name: (row.sender as NotificationSender).display_name,
          avatar_url: (row.sender as NotificationSender).avatar_url,
        }
      : null,
    post_id: row.post_id ?? null,
    comment_id: row.comment_id ?? null,
    session_id: row.session_id ?? null,
    comment_text: row.comment_text ?? null,
    gift_name: row.gift_name ?? null,
    gift_emoji: row.gift_emoji ?? null,
    product_name: row.product_name ?? null,
  }));
});

// -----------------------------------------------------------------------------
// getUnreadNotificationCount — Zahl für den Sidebar-Badge.
// Eigene Query statt getNotifications() nutzen damit der Badge-Fetch günstig
// bleibt (kein JOIN, kein 40-Row-Load).
// -----------------------------------------------------------------------------
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .eq('read', false);

  if (error) return 0;
  return count ?? 0;
});

import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './authStore';
import { supabase } from './supabase';

export type AppNotification = {
  id: string;
  // `auction_won` stammt aus Berkat (gemeinsame notifications-Tabelle) — Serlo
  // zeigt es an, springt aber nicht, siehe app/(tabs)/notifications.tsx.
  // ⚠️ Diese Union ist die FÜNFTE Stelle, die einen Meldungstyp kennen muss —
  // neben CHECK, Push-CASE, In-App-Liste und Web-Liste (Übergabe 9). Sie ist
  // die einzige, die sich von selbst meldet: `tsc` bricht ab, wenn ein `case`
  // einen Typ nennt, der hier fehlt. Genau so ist `comment_reply` am
  // 23.08.2026 aufgefallen.
  type: 'like' | 'comment' | 'comment_reply' | 'follow' | 'live' | 'live_invite' | 'dm' | 'mention' | 'follow_request' | 'follow_request_accepted' | 'gift' | 'auction_won' | 'new_order' | 'preorder_interest' | 'preorder_round_open' | 'product_saved' | 'order_payment_requested' | 'order_payment_reminder' | 'order_paid' | 'order_shipped' | 'order_cancelled' | 'order_address_updated' | 'order_review' | 'order_dispute' | 'support_reply' | 'support_new';
  read: boolean;
  created_at: string;
  comment_text: string | null;
  post_id: string | null;
  session_id: string | null;       // für Live-Benachrichtigungen
  conversation_id: string | null;  // für DM-Benachrichtigungen
  product_id: string | null;       // für Shop-/Vorbestell-Benachrichtigungen
  gift_name: string | null;        // für Gift-Benachrichtigungen
  gift_emoji: string | null;       // für Gift-Benachrichtigungen
  sender: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
  post_thumb: string | null;
};

export function useNotifications() {
  const userId = useAuthStore((s) => s.profile?.id);

  // Realtime läuft zentral in useNotificationsRealtime (Tab-Bar) — eine
  // Subscription invalidiert alle notifications-Queries. Kein eigener Kanal hier.

  return useQuery<AppNotification[]>({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id, type, read, created_at, comment_text, post_id, session_id, conversation_id,
          product_id, gift_name, gift_emoji,
          sender:sender_id ( id, username, avatar_url ),
          post:post_id ( media_url )
        `)
        .eq('recipient_id', userId)
        // ⚠️ Serlos Glocke zeigt nur Serlo-Meldungen. Ohne diesen Filter stand
        // hier alles, was Berkat korrekt als `app = 'berkat'` gestempelt hat —
        // Zuschlag, Zahlungsfrist, Streitfall, Suchtreffer — in einer App, in
        // der es weder einen Zielbildschirm noch einen Sinn hat.
        // Gefunden im Sicherheits-Audit vom 22.08.2026.
        .eq('app', 'serlo')
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;

      return (data ?? []).map((n: any) => ({
        id: n.id,
        type: n.type,
        read: n.read,
        created_at: n.created_at,
        comment_text: n.comment_text ?? null,
        post_id: n.post_id ?? null,
        session_id: n.session_id ?? null,
        conversation_id: n.conversation_id ?? null,
        product_id:      n.product_id      ?? null,
        gift_name:       n.gift_name       ?? null,
        gift_emoji:      n.gift_emoji      ?? null,
        sender: n.sender ?? null,
        post_thumb: n.post?.media_url ?? null,
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 min — Realtime übernimmt Aktualität
  });
}


export function useUnreadCount() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<number>({
    queryKey: ['notifications-unread', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        // Siehe oben: Serlos Zaehler zaehlt nur Serlo-Meldungen.
        .eq('app', 'serlo')
        .eq('read', false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: Infinity,         // Realtime-Kanal in useNotifications() invalidiert bei Änderungen
    refetchInterval: false,
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', userId)
        // Siehe oben: Serlos Zaehler zaehlt nur Serlo-Meldungen.
        .eq('app', 'serlo')
        .eq('read', false);
    },
    onSuccess: () => {
      // userId-scoped: verhindert Cross-User Cache-Invalidierung
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', userId] });
    },
  });
}

export function useMarkOneRead() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (notifId: string) => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notifId);
    },
    onSuccess: () => {
      // userId-scoped: verhindert Cross-User Cache-Invalidierung
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', userId] });
    },
  });
}

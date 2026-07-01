/**
 * useNotificationsRealtime — EINE zentrale Realtime-Subscription auf die
 * `notifications`-Tabelle pro User. Genau EINMAL aufrufen (Tab-Bar-Layout,
 * post-Login immer gemountet).
 *
 * Warum: Früher hörten DREI Hooks parallel auf dieselbe Tabelle —
 * useNotifications (Glocke), useConversations (DM-Liste) und useUnreadDMCount
 * (DM-Badge), jeder mit eigenem postgres_changes-Kanal. Mehrere
 * postgres_changes-Subscriptions auf einer Tabelle können sich auf demselben
 * Client blockieren → Live-Updates fielen aus (Badge erst nach App-Neuladen).
 * Plus: 3 Kanäle = 3× Concurrent-Verbindungen + 3× zugestellte Messages.
 *
 * Jetzt: eine Subscription invalidiert alle betroffenen Queries. Die Hooks
 * lesen nur noch ihre Query (kein eigener Realtime-Kanal mehr).
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from './authStore';
import { supabase } from './supabase';

export function useNotificationsRealtime() {
  const userId = useAuthStore((s) => s.profile?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-rt-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload: { new?: { type?: string } }) => {
          // Glocke / Notifications-Liste (jede Notification)
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
          queryClient.invalidateQueries({ queryKey: ['notifications-unread', userId] });
          // DM-spezifisch: Conversations-Liste + DM-Badge
          if (payload?.new?.type === 'dm') {
            queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
            queryClient.invalidateQueries({ queryKey: ['unread-dm-count', userId] });
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);
}

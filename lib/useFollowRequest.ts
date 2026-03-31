/**
 * useFollowRequest.ts
 *
 * Follow-Request-System für private Profile.
 * - sendFollowRequest: sendet Anfrage oder folgt direkt (wenn Profil öffentlich)
 * - usePendingRequests: eingehende Anfragen laden
 * - useRespondRequest: annehmen / ablehnen
 * - useHasPendingRequest: prüft ob ich eine Anfrage an User X gesendet habe
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ── Typen ──────────────────────────────────────────────────────────────────
export type FollowRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  sender: {
    username: string;
    avatar_url: string | null;
  } | null;
};

// ── Hook: Eigene eingehende Requests ───────────────────────────────────────
export function usePendingFollowRequests() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<FollowRequest[]>({
    queryKey: ['follow-requests-inbox', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('follow_requests')
        .select('id, sender_id, receiver_id, created_at, sender:profiles!follow_requests_sender_id_fkey(username, avatar_url)')
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FollowRequest[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ── Hook: Prüfen ob ich bereits eine Anfrage gesendet habe ────────────────
export function useHasPendingRequest(targetUserId: string | null) {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<boolean>({
    queryKey: ['follow-request-sent', userId, targetUserId],
    queryFn: async () => {
      if (!userId || !targetUserId) return false;
      const { data } = await supabase
        .from('follow_requests')
        .select('id')
        .eq('sender_id', userId)
        .eq('receiver_id', targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId && !!targetUserId && userId !== targetUserId,
    staleTime: 30_000,
  });
}

// ── Hook: Anfrage senden ──────────────────────────────────────────────────
export function useSendFollowRequest() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const { error } = await supabase
        .from('follow_requests')
        .insert({ sender_id: userId, receiver_id: targetUserId });
      if (error) throw error;

      // Notification an Empfänger
      await supabase.from('notifications').insert({
        user_id:   targetUserId,
        sender_id: userId,
        type:      'follow_request',
      });
    },
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ['follow-request-sent', userId, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['follow-requests-inbox'] });
    },
  });
}

// ── Hook: Anfrage zurückziehen ────────────────────────────────────────────
export function useWithdrawFollowRequest() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const { error } = await supabase
        .from('follow_requests')
        .delete()
        .eq('sender_id', userId)
        .eq('receiver_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: ['follow-request-sent', userId, targetUserId] });
    },
  });
}

// ── Hook: Anfrage annehmen / ablehnen ─────────────────────────────────────
export function useRespondFollowRequest() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async ({ requestId, senderId, accept }: {
      requestId?: string; // optional: wenn aus Notifications bekannt nur senderId nötig
      senderId: string;
      accept: boolean;
    }) => {
      if (!userId) throw new Error('Nicht eingeloggt');

      // Request löschen: per ID (wenn vorhanden) oder per sender+receiver
      const deleteQuery = requestId
        ? supabase.from('follow_requests').delete().eq('id', requestId)
        : supabase.from('follow_requests').delete()
            .eq('sender_id', senderId)
            .eq('receiver_id', userId);

      const { error: delErr } = await deleteQuery;
      if (delErr) throw delErr;

      if (accept) {
        // Follow eintragen
        const { error: followErr } = await supabase
          .from('follows')
          .insert({ follower_id: senderId, following_id: userId });
        if (followErr) throw followErr;

        // Notification: Anfrage akzeptiert
        await supabase.from('notifications').insert({
          user_id:   senderId,
          sender_id: userId,
          type:      'follow_request_accepted',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-requests-inbox', userId] });
      queryClient.invalidateQueries({ queryKey: ['follow-counts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}


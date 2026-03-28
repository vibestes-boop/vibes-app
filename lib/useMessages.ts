import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ── Types ──────────────────────────────────────────────────────────────────

export type Conversation = {
  id: string;
  other_user: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
};

// ── Hilfsfunktion: sortierte Teilnehmer-IDs ───────────────────────────────
function sortedParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ── Conversation öffnen / erstellen ───────────────────────────────────────
export function useOrCreateConversation() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (otherUserId: string): Promise<string> => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const [p1, p2] = sortedParticipants(userId, otherUserId);

      // Bestehende Konversation suchen
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_1', p1)
        .eq('participant_2', p2)
        .maybeSingle();

      if (existing?.id) return existing.id;

      // Neu erstellen
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ participant_1: p1, participant_2: p2 })
        .select('id')
        .single();

      if (error) throw error;
      return created.id;
    },
  });
}

// ── Alle Konversationen des Users (1 RPC statt N+2 Queries) ──────────────
export function useConversations() {
  const userId = useAuthStore((s) => s.profile?.id);
  const queryClient = useQueryClient();

  const query = useQuery<Conversation[]>({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase.rpc('get_conversations');
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id:              row.id,
        other_user: {
          id:         row.other_user_id,
          username:   row.other_username  ?? null,
          avatar_url: row.other_avatar_url ?? null,
        },
        last_message:    row.last_message    ?? null,
        last_message_at: row.last_message_at,
        unread_count:    Number(row.unread_count ?? 0),
      } as Conversation));
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });

  // Realtime: neue Nachrichten → Conversations-Liste updaten
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  return query;
}

// ── Nachrichten einer Konversation ────────────────────────────────────────
export function useMessages(conversationId: string | null) {
  const userId = useAuthStore((s) => s.profile?.id);
  const queryClient = useQueryClient();

  const query = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
    enabled: !!conversationId,
    staleTime: 0,
  });

  // Realtime: neue Nachrichten live empfangen (Duplikat-Check wegen Race mit Refetch)
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          if (!newMsg?.id) return;
          queryClient.setQueryData<Message[]>(['messages', conversationId], (old = []) => {
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
          queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, userId, queryClient]);

  return query;
}

// ── Nachricht senden ──────────────────────────────────────────────────────
export function useSendMessage() {
  const userId = useAuthStore((s) => s.profile?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });
}

// ── Nachrichten als gelesen markieren ─────────────────────────────────────
export function useMarkMessagesRead(conversationId: string | null) {
  const userId = useAuthStore((s) => s.profile?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Bei jedem Konversationswechsel (conversationId ändert sich) neu markieren
    if (!conversationId || !userId) return;

    supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('read', false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
        queryClient.invalidateQueries({ queryKey: ['unread-dms', userId] });
      });
  }, [conversationId, userId, queryClient]);
}

// ── Ungelesene DM-Gesamtzahl ──────────────────────────────────────────────
export function useUnreadDMCount() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<number>({
    queryKey: ['unread-dms', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

      if (!convs?.length) return 0;
      const ids = convs.map((c: any) => c.id);

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', ids)
        .eq('read', false)
        .neq('sender_id', userId);

      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });
}

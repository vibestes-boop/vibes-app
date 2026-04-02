import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
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

export type PostPreview = {
  id: string;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  author_username: string | null;
};

export type MessageReaction = {
  emoji: string;
  count: number;
  byMe: boolean;
};

export type ReplyPreview = {
  id: string;
  content: string;
  sender_id: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  post_id: string | null;
  post: PostPreview | null;
  read: boolean;
  created_at: string;
  reply_to_id: string | null;
  reply_to: ReplyPreview | null;   // inline join
  reactions: MessageReaction[];    // batch-geladen
  image_url: string | null;        // Bild-DM
  story_media_url: string | null;  // Story-Antwort Thumbnail (TikTok-Style)
  story_author: string | null;     // @username des Story-Erstellers
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
        id: row.id,
        other_user: {
          id: row.other_user_id,
          username: row.other_username ?? null,
          avatar_url: row.other_avatar_url ?? null,
        },
        last_message: row.last_message ?? null,
        last_message_at: row.last_message_at,
        unread_count: Number(row.unread_count ?? 0),
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
        .select(`
          *,
          post:post_id (
            id,
            media_url,
            media_type,
            caption,
            profiles!posts_author_id_fkey ( username )
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // Normalize nested post shape
      return (data ?? []).map((row: any) => ({
        ...row,
        story_media_url: row.story_media_url ?? null,
        story_author: null,   // Spalte nicht in DB — aus story_media_url/profil ableiten falls benötigt
        post: row.post
          ? {
            id: row.post.id,
            media_url: row.post.media_url ?? null,
            media_type: row.post.media_type ?? null,
            caption: row.post.caption ?? null,
            author_username: row.post.profiles?.username ?? null,
          }
          : null,
      } as Message));
    },
    enabled: !!conversationId,
    staleTime: 1000 * 30,  // Realtime hält Daten aktuell — kein sofortiger Refetch bei App-Fokus
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
    mutationFn: async ({
      conversationId,
      content,
      postId,
      replyToId,
      imageUrl,
      storyMediaUrl,
      storyAuthor,
    }: {
      conversationId: string;
      content: string;
      postId?: string | null;
      replyToId?: string | null;
      imageUrl?: string | null;
      storyMediaUrl?: string | null;   // Story-Thumbnail URL
      storyAuthor?: string | null;     // @username des Story-Erstellers
    }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const payload: Record<string, any> = {
        conversation_id: conversationId,
        sender_id: userId,
        content: content.trim(),
      };
      if (postId) payload.post_id = postId;
      if (replyToId) payload.reply_to_id = replyToId;
      if (imageUrl) payload.image_url = imageUrl;
      if (storyMediaUrl) payload.story_media_url = storyMediaUrl;
      // story_author: Spalte existiert nicht in DB — nicht senden
      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select('id, conversation_id, sender_id, content, post_id, reply_to_id, image_url, story_media_url, read, created_at')
        .single();
      if (error) throw error;
      return data as unknown as Message;
    },

    // ── Optimistisches Update: Nachricht sofort anzeigen ─────────────────
    onMutate: async ({ conversationId, content, postId, imageUrl, storyMediaUrl, storyAuthor }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previous = queryClient.getQueryData<Message[]>(['messages', conversationId]);
      const tempMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: userId ?? '',
        content: content.trim(),
        post_id: postId ?? null,
        post: null,
        read: false,
        created_at: new Date().toISOString(),
        reply_to_id: null,
        reply_to: null,
        reactions: [],
        image_url: imageUrl ?? null,
        story_media_url: storyMediaUrl ?? null,
        story_author: storyAuthor ?? null,
      };

      queryClient.setQueryData<Message[]>(['messages', conversationId], (old = []) => [
        ...old,
        tempMsg,
      ]);

      return { previous, tempId: tempMsg.id, conversationId };
    },

    // ── Erfolgreich: Temp-Msg durch echte ersetzen ────────────────────────
    onSuccess: (realMsg, { conversationId }, context) => {
      queryClient.setQueryData<Message[]>(['messages', conversationId], (old = []) =>
        old.map((m) => (m.id === context?.tempId ? realMsg : m))
      );
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    },

    // ── Fehler: Rollback zur vorherigen Zustand ───────────────────────────
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<Message[]>(
          ['messages', context.conversationId],
          context.previous
        );
      }
    },
  });
}


// ── Nachrichten als gelesen markieren ─────────────────────────────────────
export function useMarkMessagesRead(conversationId: string | null) {
  const userId = useAuthStore((s) => s.profile?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId || !userId) return;

    // Sofort im Cache updaten → ✓✓ erscheint ohne Wartezeit (B9)
    queryClient.setQueryData<Message[]>(['messages', conversationId], (old = []) =>
      old.map((m) =>
        m.sender_id !== userId && !m.read ? { ...m, read: true } : m
      )
    );

    supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('read', false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      });
  }, [conversationId, userId, queryClient]);
}

// ── Ungelesene DM-Gesamtzahl ──────────────────────────────────────────────
// Senior-Dev-Trick: Leite aus dem bereits gecachten useConversations ab.
// → 0 extra DB-Queries, 0 Polling, auto-update via Realtime-Subscription.
export function useUnreadDMCount() {
  const { data: conversations = [] } = useConversations();
  const total = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
  return { data: total };
}

// ── Typing-Indikator via Supabase Realtime Presence ───────────────────────
// Kein DB-Query — reines WebSocket Presence-Protokoll.
// Gibt zurück:
//   - onTypingStart/Stop: call wenn User anfängt / aufhört zu tippen
//   - otherIsTyping: true wenn der andere User gerade tippt
export function useTypingPresence(conversationId: string | null) {
  const userId = useAuthStore((s) => s.profile?.id);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`typing-${conversationId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ typing: boolean }>();
        const others = Object.entries(state)
          .filter(([key]) => key !== userId)
          .flatMap(([, presences]) => presences);
        setOtherIsTyping(others.some((p) => p.typing === true));
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      // Bug 10 Fix: Timer abbrechen bevor Channel entfernt wird
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  const onTypingStart = useCallback(() => {
    channelRef.current?.track({ typing: true });
    // Auto-stop nach 3s Inaktivität
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      channelRef.current?.track({ typing: false });
    }, 3000);
  }, []);

  const onTypingStop = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    channelRef.current?.track({ typing: false });
  }, []);

  return { otherIsTyping, onTypingStart, onTypingStop };
}

// ─── Nachricht löschen ────────────────────────────────────────────────────────
export function useDeleteMessage(conversationId: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId ?? '');
      if (error) throw error;
    },
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previous = queryClient.getQueryData<Message[]>(['messages', conversationId]);
      queryClient.setQueryData<Message[]>(['messages', conversationId], (old = []) =>
        old.filter((m) => m.id !== messageId)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['messages', conversationId], context.previous);
      }
      Alert.alert('Fehler', 'Nachricht konnte nicht gelöscht werden.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] }); // userId-Scope: nur eigene Liste
    },
  });
}

// ─── Emoji-Reaction auf Nachricht toggeln ─────────────────────────────────────
export function useToggleReaction(conversationId: string | null) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!userId) return;

      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from('message_reactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', conversationId] });
    },
  });
}

// ─── Alle Reactions einer Konversation (Batch-Fetch + Realtime) ───────────────
export function useMessageReactions(conversationId: string | null) {
  const userId = useAuthStore((s) => s.profile?.id);
  const queryClient = useQueryClient();

  // Realtime-Subscription: sofort aktualisieren wenn jemand eine Reaction setzt/entfernt
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`message-reactions-rt-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',   // INSERT + DELETE
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          // Kompletten Batch neu laden — einfacher als manuelles Mergen
          queryClient.invalidateQueries({ queryKey: ['message-reactions', conversationId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  return useQuery<Record<string, MessageReaction[]>>({
    queryKey: ['message-reactions', conversationId],
    queryFn: async () => {
      if (!conversationId) return {};

      // Nutze gecachte Message-IDs statt extra DB-Query (Messages sind bereits im Cache)
      const cachedMessages = queryClient.getQueryData<{ id: string }[]>(['messages', conversationId]) ?? [];
      const msgIds = cachedMessages.map((m) => m.id);
      if (msgIds.length === 0) return {};

      const { data } = await supabase
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', msgIds);

      const out: Record<string, MessageReaction[]> = {};
      for (const row of data ?? []) {
        if (!out[row.message_id]) out[row.message_id] = [];
        const existing = out[row.message_id].find((r) => r.emoji === row.emoji);
        if (existing) {
          existing.count += 1;
          if (row.user_id === userId) existing.byMe = true;
        } else {
          out[row.message_id].push({ emoji: row.emoji, count: 1, byMe: row.user_id === userId });
        }
      }
      return out;
    },
    enabled: !!conversationId,
    staleTime: 1000 * 30,
  });
}

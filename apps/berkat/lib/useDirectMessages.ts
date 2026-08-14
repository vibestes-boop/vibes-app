// Direktnachrichten.
//
// Berkat hatte keine. Gebaut wird trotzdem nichts Neues: `conversations` und
// `messages` gehören Serlo, liegen in derselben Datenbank und sind schlicht
// genug, dass beide Apps sie teilen können — dieselbe Entscheidung wie beim
// Live-Chat und beim Folgen (Übergabe, Abschnitt 4).
//
// Folge davon, bewusst in Kauf genommen: Eine Nachricht, die hier geschrieben
// wird, taucht in Serlos Posteingang auf und umgekehrt. Das ist richtig — es
// ist dieselbe Person, die schreibt. Eine getrennte Nachrichtenwelt je App
// hätte zwei Posteingänge für einen Menschen bedeutet.
//
// Das Paar (participant_1, participant_2) ist sortiert abgelegt, sonst gäbe es
// dieselbe Unterhaltung zweimal — je nachdem, wer zuerst geschrieben hat.

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { subscribeToTable } from './realtime';

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  read: boolean;
};

export type Conversation = {
  id: string;
  otherId: string;
  lastMessageAt: string | null;
};

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Die Unterhaltung mit genau dieser Person — vorhandene oder neue.
 * Wird beim Öffnen des Bildschirms gerufen, nicht beim Tippen auf „Senden":
 * Ein leerer Verlauf mit sichtbarer Anrede ist ehrlicher als ein Feld, das
 * erst beim Absenden entscheidet, wohin es schreibt.
 */
export function useConversationWith(myUserId: string | null, otherId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'conversation', myUserId, otherId],
    enabled: Boolean(myUserId && otherId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const [p1, p2] = sortedPair(myUserId!, otherId!);

      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_1', p1)
        .eq('participant_2', p2)
        .maybeSingle();
      if (existing?.id) return (existing as { id: string }).id;

      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ participant_1: p1, participant_2: p2 })
        .select('id')
        .single();
      if (error) throw error;
      return (created as { id: string }).id;
    },
  });
}

/** Der Verlauf. Neueste unten, wie in jedem Messenger. */
export function useMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['berkat', 'messages', conversationId],
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<DirectMessage[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, image_url, created_at, read')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as DirectMessage[];
    },
  });

  // Ein Abo je Unterhaltung, gefiltert auf genau sie — nie tabellenweit.
  // Ohne den Filter zahlte jedes offene Gerät für jede Nachricht der ganzen
  // Plattform (Übergabe: Realtime-Kostenhygiene).
  useEffect(() => {
    if (!conversationId) return;
    return subscribeToTable(
      `messages-${conversationId}`,
      { event: 'INSERT', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      () => {
        void queryClient.invalidateQueries({
          queryKey: ['berkat', 'messages', conversationId],
        });
      },
    );
  }, [conversationId, queryClient]);

  return query;
}

export type SendResult = { ok: true } | { ok: false; message: string };

export function useSendMessage(conversationId: string | null | undefined, myUserId: string | null) {
  const queryClient = useQueryClient();

  return useCallback(
    async (text: string): Promise<SendResult> => {
      const content = text.trim();
      if (!content) return { ok: false, message: 'Da steht noch nichts.' };
      if (!conversationId || !myUserId) {
        return { ok: false, message: 'Die Unterhaltung ist noch nicht bereit.' };
      }

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: myUserId,
        content,
      });
      if (error) return { ok: false, message: 'Die Nachricht ging nicht raus. Nochmal?' };

      // `last_message_at` pflegt in Serlo ein Trigger. Falls der je verschwindet,
      // sortiert der Posteingang falsch — er fällt dann auf created_at zurück.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'conversations', myUserId] });
      return { ok: true };
    },
    [conversationId, myUserId, queryClient],
  );
}

/** Der Posteingang. Ohne ihn wäre jede eingehende Nachricht unauffindbar. */
export function useConversations(myUserId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['berkat', 'conversations', myUserId],
    enabled: Boolean(myUserId),
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, participant_1, participant_2, last_message_at')
        .or(`participant_1.eq.${myUserId},participant_2.eq.${myUserId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;

      return ((data ?? []) as {
        id: string;
        participant_1: string;
        participant_2: string;
        last_message_at: string | null;
      }[]).map((row) => ({
        id: row.id,
        otherId: row.participant_1 === myUserId ? row.participant_2 : row.participant_1,
        lastMessageAt: row.last_message_at,
      }));
    },
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'conversations', myUserId] });
  }, [queryClient, myUserId]);

  return { ...query, refresh };
}

/** Ungelesenes für das Abzeichen im Konto. */
export function useUnreadMessageCount(myUserId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'unread-messages', myUserId],
    enabled: Boolean(myUserId),
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('read', false)
        .neq('sender_id', myUserId!);
      // Scheitert die Zählung, ist eine 0 besser als ein kaputtes Konto —
      // dieselbe Regel wie beim Glocken-Abzeichen auf der Startseite.
      if (error) return 0;
      return count ?? 0;
    },
  });
}

/**
 * Gelesen setzen, sobald der Verlauf offen ist.
 *
 * Zwingend über die RPC `mark_messages_read`: Die Policy `msg_update` erlaubt
 * ausschließlich dem **Absender**, seine Zeile zu ändern. Ein direktes
 * `update({ read: true })` durch den Empfänger träfe also null Zeilen — ohne
 * Fehler, einfach wirkungslos. Serlo geht denselben Weg.
 *
 * Das `.then()` ist Pflicht, kein Stil: `supabase.rpc()` liefert einen faulen
 * Erzeuger, der die Anfrage erst beim Abwarten losschickt. Ein blankes
 * `void supabase.rpc(…)` baut ihn nur und wirft ihn weg — lautlos (Übergabe,
 * Abschnitt 3).
 */
export function useMarkMessagesRead(
  conversationId: string | null | undefined,
  myUserId: string | null,
) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!conversationId || !myUserId) return;
    void supabase
      .rpc('mark_messages_read', { p_conversation_id: conversationId })
      .then(({ error }) => {
        if (error && __DEV__) console.warn('[Berkat] gelesen setzen:', error.message);
        void queryClient.invalidateQueries({ queryKey: ['berkat', 'unread-messages', myUserId] });
        void queryClient.invalidateQueries({ queryKey: ['berkat', 'messages', conversationId] });
      });
  }, [conversationId, myUserId, queryClient]);
}

// Live-Chat, gelesen aus live_comments.
//
// Bewusst über postgres_changes statt über den Broadcast-Kanal, den die
// Serlo-App nutzt: die Tabelle ist die gemeinsame Wahrheit von App und Web.
// Wer nur den Broadcast hört, verpasst alles, was von der jeweils anderen
// Plattform kommt — genau der Fehler, der im Juli 2026 zwischen Serlo-Web
// und Serlo-App auftrat.

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { subscribeToTable } from './realtime';

export type LiveComment = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
};

const MAX_VISIBLE = 40;

export function useLiveChat(sessionId: string | undefined) {
  const [comments, setComments] = useState<LiveComment[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    supabase
      .from('live_comments')
      .select('id, user_id, text, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(MAX_VISIBLE)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setComments((data as LiveComment[]).slice().reverse());
      });

    const unsubscribe = subscribeToTable(
      `berkat-chat-${sessionId}`,
      { event: 'INSERT', table: 'live_comments', filter: `session_id=eq.${sessionId}` },
      (payload) => {
        if (cancelled) return;
        const row = payload.new as unknown as LiveComment;
        setComments((prev) => {
          if (prev.some((c) => c.id === row.id)) return prev;
          return [...prev, row].slice(-MAX_VISIBLE);
        });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId]);

  return comments;
}

/**
 * `user_id` ist in live_comments NOT NULL und muss mitgeschickt werden — es
 * gibt keinen Default und keinen Trigger, der ihn setzt. Fehlt er, lehnt
 * Postgres jede Nachricht ab.
 */
export async function sendLiveComment(
  sessionId: string,
  userId: string,
  text: string,
): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const { error } = await supabase.from('live_comments').insert({
    session_id: sessionId,
    user_id: userId,
    text: trimmed.slice(0, 300),
  });
  if (error && __DEV__) console.warn('[Berkat] Kommentar abgelehnt:', error.message);
  return !error;
}

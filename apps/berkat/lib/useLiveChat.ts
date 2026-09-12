// Live-Chat, gelesen aus live_comments.
//
// Bewusst über postgres_changes statt über den Broadcast-Kanal, den die
// Serlo-App nutzt: die Tabelle ist die gemeinsame Wahrheit von App und Web.
// Wer nur den Broadcast hört, verpasst alles, was von der jeweils anderen
// Plattform kommt — genau der Fehler, der im Juli 2026 zwischen Serlo-Web
// und Serlo-App auftrat.

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { subscribeToTable } from './realtime';

export type LiveComment = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
};

const MAX_VISIBLE = 40;

/** Merge a delayed history response with comments already received through realtime. */
export function mergeLiveComments(...groups: LiveComment[][]): LiveComment[] {
  const rows = new Map<string, LiveComment>();
  for (const group of groups) for (const row of group) rows.set(row.id, row);
  return [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).slice(-MAX_VISIBLE);
}

export function useLiveChat(sessionId: string | undefined, userId: string | null, enabled = true) {
  const client = useQueryClient();
  const key = useMemo(() => ['berkat', 'live-chat', sessionId, userId], [sessionId, userId]);
  const query = useQuery({
    queryKey: key,
    enabled: enabled && Boolean(sessionId),
    retry: 1,
    queryFn: async ({ signal }): Promise<LiveComment[]> => {
      const { data, error } = await supabase.from('live_comments')
        .select('id, user_id, text, created_at').eq('session_id', sessionId!)
        .order('created_at', { ascending: false }).limit(MAX_VISIBLE).abortSignal(signal).retry(false);
      if (error) throw error;
      return mergeLiveComments((data ?? []) as LiveComment[], client.getQueryData<LiveComment[]>(key) ?? []);
    },
  });
  useEffect(() => {
    if (!enabled || !sessionId) return;
    return subscribeToTable(
      `berkat-chat-${sessionId}`,
      { event: 'INSERT', table: 'live_comments', filter: `session_id=eq.${sessionId}` },
      payload => client.setQueryData<LiveComment[]>(key, old => mergeLiveComments(old ?? [], [payload.new as unknown as LiveComment])),
    );
  }, [enabled, sessionId, client, key]);
  return query;
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

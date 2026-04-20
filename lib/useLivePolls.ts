/**
 * lib/useLivePolls.ts
 *
 * v1.18.0 — Live-Polls (Umfragen im Stream).
 *
 * Host startet eine Poll mit 2-4 Optionen. Alle Viewer können
 * einmal abstimmen. Ergebnisse werden live via Supabase Realtime
 * auf `live_poll_votes` gepusht.
 *
 * Hooks:
 *   useActiveLivePoll(sessionId) → { poll, myVote, vote, isVoting }
 *   useCreateLivePoll()          → { createPoll, isCreating }
 *   useCloseLivePoll()           → { closePoll }
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LivePoll {
  id:          string;
  question:    string;
  options:     string[];
  createdAt:   string;
  tallies:     Record<number, number>; // option_index → count
  totalVotes:  number;
}

interface RawPoll {
  id:         string;
  question:   string;
  options:    string[];
  created_at: string;
  tallies:    Array<{ option_index: number; vote_count: number }>;
}

// ─── Active-Poll Query ──────────────────────────────────────────────────────

/**
 * Lädt die aktuell aktive Poll einer Live-Session und liefert
 * deren Tally-Counts. Reagiert auf neue Polls und neue Votes
 * via Realtime und invalidiert den Cache entsprechend.
 *
 * `myVote` ist der optionIndex den der aktuelle User abgegeben hat
 * (oder null wenn noch nicht abgestimmt).
 */
export function useActiveLivePoll(sessionId: string | null | undefined) {
  const userId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();

  const pollQuery = useQuery<LivePoll | null>({
    queryKey:  ['live-poll-active', sessionId],
    enabled:   !!sessionId,
    staleTime: 5_000,
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase.rpc('get_active_poll', {
        p_session_id: sessionId,
      });
      if (error) {
        __DEV__ && console.warn('[useActiveLivePoll] rpc error:', error.message);
        return null;
      }
      if (!data) return null;
      const raw = data as RawPoll;
      const tallies: Record<number, number> = {};
      let total = 0;
      for (const t of raw.tallies ?? []) {
        tallies[t.option_index] = t.vote_count;
        total += t.vote_count;
      }
      return {
        id:         raw.id,
        question:   raw.question,
        options:    raw.options,
        createdAt:  raw.created_at,
        tallies,
        totalVotes: total,
      };
    },
  });

  const pollId = pollQuery.data?.id ?? null;

  // Eigener Vote nachladen
  const myVoteQuery = useQuery<number | null>({
    queryKey:  ['live-poll-my-vote', pollId, userId],
    enabled:   !!pollId && !!userId,
    staleTime: 5_000,
    queryFn: async () => {
      if (!pollId || !userId) return null;
      const { data, error } = await supabase
        .from('live_poll_votes')
        .select('option_index')
        .eq('poll_id', pollId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        __DEV__ && console.warn('[useActiveLivePoll] myVote error:', error.message);
        return null;
      }
      return data?.option_index ?? null;
    },
  });

  // Realtime: neue Polls + geschlossene Polls + neue Votes
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`live-polls-${sessionId}`)
      // Poll-Lifecycle: INSERT + UPDATE (closed_at)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_polls', filter: `session_id=eq.${sessionId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['live-poll-active', sessionId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, qc]);

  // Separate Subscription für Votes — gefiltert nach aktueller poll_id
  // (damit wir keine Updates für andere Session-Polls bekommen).
  useEffect(() => {
    if (!pollId) return;

    const channel = supabase
      .channel(`live-poll-votes-${pollId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_poll_votes', filter: `poll_id=eq.${pollId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['live-poll-active', sessionId] });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pollId, sessionId, qc]);

  // Vote abgeben
  const voteMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      if (!pollId) throw new Error('Keine aktive Poll');
      const { error } = await supabase
        .from('live_poll_votes')
        .insert({ poll_id: pollId, user_id: userId, option_index: optionIndex });
      // Doppelvote kommt als duplicate key Error — ignorieren
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onMutate: async (optionIndex: number) => {
      // Optimistic: myVote setzen + tally +1
      await qc.cancelQueries({ queryKey: ['live-poll-my-vote', pollId, userId] });
      const prevMyVote = qc.getQueryData<number | null>(['live-poll-my-vote', pollId, userId]);
      qc.setQueryData(['live-poll-my-vote', pollId, userId], optionIndex);

      const prevPoll = qc.getQueryData<LivePoll | null>(['live-poll-active', sessionId]);
      if (prevPoll && prevMyVote === null) {
        qc.setQueryData<LivePoll | null>(['live-poll-active', sessionId], {
          ...prevPoll,
          tallies:    { ...prevPoll.tallies, [optionIndex]: (prevPoll.tallies[optionIndex] ?? 0) + 1 },
          totalVotes: prevPoll.totalVotes + 1,
        });
      }

      return { prevMyVote, prevPoll };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevMyVote !== undefined) {
        qc.setQueryData(['live-poll-my-vote', pollId, userId], ctx.prevMyVote);
      }
      if (ctx?.prevPoll !== undefined) {
        qc.setQueryData(['live-poll-active', sessionId], ctx.prevPoll);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['live-poll-active', sessionId] });
      qc.invalidateQueries({ queryKey: ['live-poll-my-vote', pollId, userId] });
    },
  });

  const vote = useCallback(
    (optionIndex: number) => {
      if (!pollId || myVoteQuery.data !== null) return;
      voteMutation.mutate(optionIndex);
    },
    [pollId, myVoteQuery.data, voteMutation],
  );

  return {
    poll:        pollQuery.data ?? null,
    myVote:      myVoteQuery.data ?? null,
    vote,
    isVoting:    voteMutation.isPending,
    isLoading:   pollQuery.isLoading,
  };
}

// ─── Host: Poll erstellen ───────────────────────────────────────────────────

export function useCreateLivePoll() {
  const userId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      sessionId,
      question,
      options,
    }: { sessionId: string; question: string; options: string[] }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      if (options.length < 2 || options.length > 4) {
        throw new Error('Bitte 2-4 Optionen angeben');
      }
      const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
      if (cleanOptions.length !== options.length) {
        throw new Error('Leere Optionen nicht erlaubt');
      }

      // Vorher ggf. laufende Poll dieser Session schließen — es gibt immer nur eine aktive.
      // v1.27.4: Filter auf `host_id=userId` ENTFERNT. RLS auf UPDATE erlaubt ab v1.27.4
      // Session-Host + Moderatoren (inkl. aktive CoHosts) das Schließen fremder Polls
      // dieser Session. Das sichert den „one-active-poll"-Invariant auch im Dual-Authoring-
      // Fall (Host startet neue Poll während CoHost eine laufende hat und umgekehrt).
      await supabase
        .from('live_polls')
        .update({ closed_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .is('closed_at', null);

      const { data, error } = await supabase
        .from('live_polls')
        .insert({
          session_id: sessionId,
          host_id:    userId,
          question:   question.trim(),
          options:    cleanOptions,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_id, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ['live-poll-active', sessionId] });
    },
  });

  return { createPoll: mutation.mutateAsync, isCreating: mutation.isPending, error: mutation.error };
}

// ─── Host: Poll schließen ───────────────────────────────────────────────────

export function useCloseLivePoll() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ pollId, sessionId }: { pollId: string; sessionId: string }) => {
      const { error } = await supabase
        .from('live_polls')
        .update({ closed_at: new Date().toISOString() })
        .eq('id', pollId)
        .is('closed_at', null);
      if (error) throw error;
      return sessionId;
    },
    onSuccess: (sessionId) => {
      qc.invalidateQueries({ queryKey: ['live-poll-active', sessionId] });
    },
  });

  return { closePoll: mutation.mutateAsync, isClosing: mutation.isPending };
}

// ─── Helper: Prozent berechnen ──────────────────────────────────────────────

export function pollPercentage(poll: LivePoll | null, optionIndex: number): number {
  if (!poll || poll.totalVotes === 0) return 0;
  const count = poll.tallies[optionIndex] ?? 0;
  return Math.round((count / poll.totalVotes) * 100);
}

/** Index der Option mit den meisten Votes — null wenn keine Votes. */
export function pollLeadingOption(poll: LivePoll | null): number | null {
  if (!poll || poll.totalVotes === 0) return null;
  let best = -1;
  let bestCount = -1;
  for (const [idxStr, cnt] of Object.entries(poll.tallies)) {
    if (cnt > bestCount) {
      bestCount = cnt;
      best = parseInt(idxStr, 10);
    }
  }
  return best >= 0 ? best : null;
}

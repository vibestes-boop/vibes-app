'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { BarChart3, Check } from 'lucide-react';
import { voteOnLivePoll } from '@/app/actions/live';
import type { ActiveLivePollSSR } from '@/lib/data/live';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// LivePollPanel — Umfrage-Anzeige + Voting. Realtime-Updates auf
// `live_poll_votes`-INSERTs aktualisieren die Counts live. Dedup-Schutz liegt
// in der DB-PK `(poll_id, user_id)`.
// -----------------------------------------------------------------------------

export interface LivePollPanelProps {
  sessionId: string;
  poll: ActiveLivePollSSR;
  viewerId: string | null;
  readOnly?: boolean;
  className?: string;
}

export function LivePollPanel({
  sessionId,
  poll: initialPoll,
  viewerId,
  readOnly = false,
  className,
}: LivePollPanelProps) {
  const [poll, setPoll] = useState<ActiveLivePollSSR>(initialPoll);
  const [myVote, setMyVote] = useState<number | null>(initialPoll.my_vote_index ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const channelInstanceId = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    setPoll(initialPoll);
    setMyVote(initialPoll.my_vote_index ?? null);
    setError(null);
  }, [initialPoll]);

  // -----------------------------------------------------------------------------
  // Realtime-Subs:
  // - live_polls UPDATE: Poll wurde geschlossen
  // - live_poll_votes INSERT: Vote-Counts direkt erhöhen
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(`live-poll-${poll.id}-${channelInstanceId.current}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'live_polls',
            filter: `id=eq.${poll.id}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            setPoll((prev) => ({
              ...prev,
              closed_at: (row.closed_at as string | null) ?? prev.closed_at,
            }));
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'live_poll_votes',
            filter: `poll_id=eq.${poll.id}`,
          },
          (payload) => {
            const row = payload.new as { option_index?: number | null; user_id?: string | null };
            const optionIndex = Number(row.option_index);
            if (!Number.isInteger(optionIndex)) return;
            setPoll((prev) => {
              if (optionIndex < 0 || optionIndex >= prev.options.length) return prev;
              const nextCounts = prev.options.map((_, index) => prev.vote_counts[index] ?? 0);
              nextCounts[optionIndex] += 1;
              return {
                ...prev,
                vote_counts: nextCounts,
                total_votes: nextCounts.reduce((sum, count) => sum + count, 0),
              };
            });
            if (viewerId && row.user_id === viewerId) setMyVote(optionIndex);
          },
        )
        .subscribe();
    } catch (error) {
      console.warn('[LivePollPanel] realtime subscription disabled', error);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [poll.id, sessionId, viewerId]);

  // -----------------------------------------------------------------------------
  // Vote-Handler
  // -----------------------------------------------------------------------------
  const handleVote = (optionIndex: number) => {
    if (readOnly || !viewerId || myVote !== null || poll.closed_at) return;
    setError(null);
    setMyVote(optionIndex); // optimistic
    startTransition(async () => {
      const result = await voteOnLivePoll(poll.id, optionIndex);
      if (!result.ok) {
        setMyVote(null);
        setError(result.error);
      }
    });
  };

  const totalVotes = useMemo(
    () => (poll.vote_counts ?? []).reduce((a, b) => a + b, 0),
    [poll.vote_counts],
  );

  const isClosed = Boolean(poll.closed_at);
  const canVote = Boolean(viewerId && !readOnly && myVote === null && !isClosed);

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-white/[0.12] bg-black/70 p-2.5 text-white shadow-elevation-2 backdrop-blur-xl',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
          <BarChart3 className="h-3.5 w-3.5 text-white" />
        </span>
        <h3 className="line-clamp-2 flex-1 text-xs font-semibold leading-snug text-white">
          {poll.question}
        </h3>
        {isClosed && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
            Beendet
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {poll.options.map((option, idx) => {
          const count = poll.vote_counts?.[idx] ?? 0;
          const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMyChoice = myVote === idx;
          const showResults = myVote !== null || isClosed;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleVote(idx)}
              disabled={!canVote || isPending}
              className={cn(
                'group relative min-h-9 overflow-hidden rounded-xl border px-2.5 py-2 text-left text-xs transition-colors',
                canVote
                  ? 'border-white/15 bg-white/[0.08] hover:border-white/35 hover:bg-white/[0.12]'
                  : 'cursor-default border-white/10 bg-white/[0.06]',
                isMyChoice && 'border-rose-400/70 bg-rose-500/[0.14]',
              )}
            >
              {showResults && (
                <div
                  className={cn('absolute inset-y-0 left-0', isMyChoice ? 'bg-rose-500/25' : 'bg-white/[0.12]')}
                  style={{ width: `${percent}%` }}
                />
              )}

              <div className="relative flex items-center justify-between gap-2 leading-snug">
                <span className="flex min-w-0 items-center gap-1.5 font-medium">
                  {isMyChoice && <Check className="h-3.5 w-3.5 shrink-0 text-rose-200" />}
                  <span className="truncate" title={option}>
                    {option}
                  </span>
                </span>
                {showResults && (
                  <span className="shrink-0 tabular-nums text-[11px] text-white/70">
                    {percent}% · {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {totalVotes > 0 && (
        <p className="mt-1.5 text-[10px] text-white/55">
          {totalVotes.toLocaleString('de-DE')} Stimme
          {totalVotes === 1 ? '' : 'n'}
        </p>
      )}
      {error && <p className="mt-1.5 text-[11px] text-red-300">{error}</p>}
      {!viewerId && !readOnly && (
        <p className="mt-1.5 text-[10px] text-white/55">Einloggen zum Abstimmen.</p>
      )}
    </div>
  );
}

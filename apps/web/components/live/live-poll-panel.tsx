'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { BarChart3, Check } from 'lucide-react';
import { voteOnLivePoll } from '@/app/actions/live';
import type { ActiveLivePollSSR } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// LivePollPanel — Umfrage-Anzeige + Voting. Realtime-Updates auf
// `live_polls`-Row (Vote-Counts) via `postgres_changes`-Subscription.
// Dedup-Schutz ist serverseitig (RPC `vote_on_poll` mit unique index).
// -----------------------------------------------------------------------------

export interface LivePollPanelProps {
  sessionId: string;
  poll: ActiveLivePollSSR;
  viewerId: string | null;
}

export function LivePollPanel({ sessionId, poll: initialPoll, viewerId }: LivePollPanelProps) {
  const [poll, setPoll] = useState<ActiveLivePollSSR>(initialPoll);
  const [myVote, setMyVote] = useState<number | null>(initialPoll.my_vote_index ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // -----------------------------------------------------------------------------
  // Realtime-Sub auf Poll-Update (Vote-Counts ändern sich)
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel(`live-poll-${poll.id}`)
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
            vote_counts: Array.isArray(row.vote_counts) ? (row.vote_counts as number[]) : prev.vote_counts,
            closed_at: (row.closed_at as string | null) ?? prev.closed_at,
          }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poll.id, sessionId]);

  // -----------------------------------------------------------------------------
  // Vote-Handler
  // -----------------------------------------------------------------------------
  const handleVote = (optionIndex: number) => {
    if (!viewerId || myVote !== null || poll.closed_at) return;
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
  const canVote = viewerId && myVote === null && !isClosed;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="flex-1 text-sm font-semibold">{poll.question}</h3>
        {isClosed && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Beendet
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
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
              className={`group relative overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                canVote ? 'hover:border-primary hover:bg-primary/5' : 'cursor-default'
              } ${isMyChoice ? 'border-primary bg-primary/10' : ''}`}
            >
              {showResults && (
                <div
                  className={`absolute inset-y-0 left-0 ${
                    isMyChoice ? 'bg-primary/20' : 'bg-muted/60'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              )}

              <div className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  {isMyChoice && <Check className="h-3.5 w-3.5 text-primary" />}
                  {option}
                </span>
                {showResults && (
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {percent}% · {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {totalVotes > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {totalVotes.toLocaleString('de-DE')} Stimme
          {totalVotes === 1 ? '' : 'n'}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {!viewerId && (
        <p className="mt-2 text-[11px] text-muted-foreground">Einloggen zum Abstimmen.</p>
      )}
    </div>
  );
}

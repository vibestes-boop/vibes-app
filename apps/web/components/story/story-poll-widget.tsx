'use client';

// -----------------------------------------------------------------------------
// StoryPollWidget — v1.w.UI.161
//
// Interaktive Poll-Karte unter dem Story-Media. Zwei Zustände:
//   1. Nicht abgestimmt: Optionen als klickbare Buttons (wie auf Mobile).
//   2. Abgestimmt (oder nicht eingeloggt nach Vote): Ergebnisbalken mit
//      Prozentzahlen + Stimmenanzahl — die gewählte Option ist hervorgehoben.
//
// State-Handling: optimistic update beim Klick (keine Spinner-Wartezeit),
// Server-Action bestätigt im Hintergrund. Bei Fehler wird der State zurück-
// gesetzt und eine kurze Meldung gezeigt.
// -----------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StoryPoll } from '@/lib/data/public';
import { voteOnStoryPoll } from '@/app/actions/story-poll';

interface StoryPollWidgetProps {
  storyId: string;
  poll: StoryPoll;
  /** vote count per option index (length === poll.options.length) */
  pollVotes: number[];
  /** option_idx the current user voted, null = not voted yet */
  myVote: number | null;
  /** whether the viewer is authenticated */
  isAuthenticated: boolean;
}

export function StoryPollWidget({
  storyId,
  poll,
  pollVotes: initialVotes,
  myVote: initialMyVote,
  isAuthenticated,
}: StoryPollWidgetProps) {
  const [pollVotes, setPollVotes] = useState<number[]>(initialVotes);
  const [myVote, setMyVote] = useState<number | null>(initialMyVote);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const totalVotes = pollVotes.reduce((s, v) => s + v, 0);

  function handleVote(idx: number) {
    if (myVote !== null || !isAuthenticated) return;

    // Optimistic update.
    const prev = pollVotes;
    const updated = pollVotes.map((c, i) => (i === idx ? c + 1 : c));
    setPollVotes(updated);
    setMyVote(idx);
    setErrorMsg(null);

    startTransition(async () => {
      const result = await voteOnStoryPoll(storyId, idx);
      if (!result.ok) {
        if (result.error === 'already_voted') {
          // Server says already voted — keep optimistic state (idempotent).
          return;
        }
        if (result.error === 'not_authenticated') {
          // Not logged in — roll back.
          setPollVotes(prev);
          setMyVote(null);
          setErrorMsg('Du musst eingeloggt sein um abzustimmen.');
          return;
        }
        // Generic error — roll back.
        setPollVotes(prev);
        setMyVote(null);
        setErrorMsg('Fehler beim Abstimmen. Bitte versuche es nochmal.');
      }
    });
  }

  const hasVoted = myVote !== null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      {/* Question */}
      <p className="mb-3 text-sm font-semibold leading-snug">{poll.question}</p>

      {/* Options */}
      <div className="space-y-2.5">
        {poll.options.map((option, idx) => {
          const votes = pollVotes[idx] ?? 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isChosen = myVote === idx;

          if (!hasVoted && isAuthenticated) {
            // Pre-vote: solid option buttons.
            return (
              <button
                key={idx}
                onClick={() => handleVote(idx)}
                className={cn(
                  'w-full rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-left text-sm font-medium',
                  'transition-colors hover:bg-primary/10 hover:border-primary/40 active:scale-[0.98]',
                )}
              >
                {option}
              </button>
            );
          }

          // Post-vote (or not authenticated): results bar.
          return (
            <div key={idx} className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
              {/* Progress fill */}
              <div
                className={cn(
                  'absolute inset-y-0 left-0 transition-all duration-500',
                  isChosen ? 'bg-primary/20' : 'bg-muted/60',
                )}
                style={{ width: `${pct}%` }}
                aria-hidden
              />

              {/* Text row */}
              <div className="relative flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  {isChosen && (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  )}
                  <span className={cn('truncate text-sm', isChosen ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    {option}
                  </span>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-foreground/70">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: total votes + login nudge */}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalVotes === 1 ? '1 Stimme' : `${totalVotes.toLocaleString('de-DE')} Stimmen`}
        </span>
        {!isAuthenticated && !hasVoted && (
          <span className="text-xs text-muted-foreground">Einloggen um abzustimmen</span>
        )}
      </div>

      {/* Error message */}
      {errorMsg && (
        <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}

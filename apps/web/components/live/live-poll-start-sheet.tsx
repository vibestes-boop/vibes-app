'use client';

import { useState, useTransition } from 'react';
import { X, Plus, Trash2, Loader2, BarChart3, Clock } from 'lucide-react';
import { createLivePoll, closeLivePoll } from '@/app/actions/live-host';
import type { ActiveLivePollSSR } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// LivePollStartSheet — Modal zum Erstellen einer neuen Umfrage oder Schließen
// einer laufenden. Gilt auch für CoHosts (v1.27.4 Parity).
//
// Fragen-Regel: 3-140 Zeichen (DB-CHECK). Options: 2-4, je 1-50 Zeichen.
// Duration: 60s / 180s / 300s — serverseitig validiert.
//
// Wenn bereits eine Poll läuft (`activePoll` gesetzt), zeigen wir den
// Schließen-Button + den Live-Zwischenstand statt des Formulars.
// -----------------------------------------------------------------------------

const DURATIONS = [
  { secs: 60, label: '1 Min' },
  { secs: 180, label: '3 Min' },
  { secs: 300, label: '5 Min' },
];

export interface LivePollStartSheetProps {
  sessionId: string;
  activePoll: ActiveLivePollSSR | null;
  onClose: () => void;
  onPollChange: (p: ActiveLivePollSSR | null) => void;
}

export function LivePollStartSheet({
  sessionId,
  activePoll,
  onClose,
  onPollChange,
}: LivePollStartSheetProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [duration, setDuration] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addOption = () => {
    if (options.length >= 4) return;
    setOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, value: string) => {
    setOptions(options.map((o, i) => (i === idx ? value.slice(0, 50) : o)));
  };

  const handleCreate = () => {
    setError(null);
    const q = question.trim();
    if (q.length < 3 || q.length > 140) {
      setError('Frage muss 3-140 Zeichen haben.');
      return;
    }
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (cleaned.length < 2) {
      setError('Mindestens 2 Antworten.');
      return;
    }

    startTransition(async () => {
      const result = await createLivePoll(sessionId, q, cleaned, duration);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Optimistisch: neue Poll-Shape vorbereiten — DB wird via Realtime
      // nachziehen und den Server-Zustand synchronisieren.
      onPollChange({
        id: result.data.pollId,
        question: q,
        options: cleaned,
        created_at: new Date().toISOString(),
        closed_at: null,
        total_votes: 0,
        vote_counts: cleaned.map(() => 0),
        my_vote_index: null,
      });
      onClose();
    });
  };

  const handleClose = () => {
    if (!activePoll) return;
    setError(null);
    startTransition(async () => {
      const result = await closeLivePoll(activePoll.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPollChange(null);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-card shadow-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">
              {activePoll ? 'Aktive Umfrage' : 'Umfrage starten'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {activePoll ? (
            <ActivePollView poll={activePoll} />
          ) : (
            <div className="flex flex-col gap-3">
              {/* Frage */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="poll-q" className="text-sm font-medium">
                  Frage
                </label>
                <input
                  id="poll-q"
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 140))}
                  placeholder="Was möchtest du wissen?"
                  maxLength={140}
                  className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <p className="text-[11px] text-muted-foreground">{question.length}/140</p>
              </div>

              {/* Antworten */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Antworten (2-4)</label>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      maxLength={50}
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted"
                        aria-label="Option entfernen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 4 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-1 self-start rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Weitere Option
                  </button>
                )}
              </div>

              {/* Duration */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Laufzeit</label>
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.secs}
                      type="button"
                      onClick={() => setDuration(d.secs)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        duration === d.secs
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Clock className="mr-1 inline h-3 w-3" />
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Abbrechen
          </button>
          {activePoll ? (
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Umfrage beenden
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Starten
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ActivePollView — zeigt Frage + Live-Vote-Counts mit Balken
// -----------------------------------------------------------------------------

function ActivePollView({ poll }: { poll: ActiveLivePollSSR }) {
  const total = poll.total_votes || 1; // Division-By-Zero Guard
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{poll.question}</p>
      {poll.options.map((opt, idx) => {
        const count = poll.vote_counts[idx] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{opt}</span>
              <span className="tabular-nums text-muted-foreground">
                {count} · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground">
        {poll.total_votes} Stimmen · Läuft seit {new Date(poll.created_at).toLocaleTimeString('de-DE')}
      </p>
    </div>
  );
}

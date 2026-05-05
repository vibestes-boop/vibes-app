'use client';

// -----------------------------------------------------------------------------
// /live/[id]/report — Stream melden.
// Direkt als Client Component (kein separates RSC-Wrapper nötig, kein SSR-Fetch
// für diese reine Form-Seite). Auth-Check passiert in der Server Action.
// -----------------------------------------------------------------------------

import { use, useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Flag, CheckCircle2 } from 'lucide-react';
import { reportLiveSession } from '@/app/actions/live';

interface PageProps {
  params: Promise<{ id: string }>;
}

const REASONS: Array<{ value: string; label: string; description: string }> = [
  { value: 'nudity', label: 'Nacktheit / sexueller Inhalt', description: 'Explizite oder unangemessene Inhalte' },
  { value: 'violence', label: 'Gewalt', description: 'Brutal, gefährlich oder erschreckend' },
  { value: 'hate_speech', label: 'Hassrede / Diskriminierung', description: 'Angriffe auf Gruppen oder Personen' },
  { value: 'harassment', label: 'Belästigung / Mobbing', description: 'Gezieltes Schikanieren oder Bedrohung' },
  { value: 'misinformation', label: 'Fehlinformation', description: 'Falsche oder irreführende Behauptungen' },
  { value: 'illegal', label: 'Illegale Inhalte', description: 'Verstöße gegen Gesetze' },
  { value: 'self_harm', label: 'Selbstverletzung / Suizid', description: 'Inhalte die Selbstverletzung zeigen oder fördern' },
  { value: 'other', label: 'Sonstiges', description: 'Anderer Verstoß gegen die Community-Richtlinien' },
];

export default function ReportPage({ params }: PageProps) {
  const { id } = use(params);
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;
    setError(null);

    startTransition(async () => {
      const result = await reportLiveSession(id, selectedReason, details.trim() || undefined);
      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.error ?? 'Fehler beim Senden.');
      }
    });
  };

  if (submitted) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold">Meldung eingegangen</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Danke für deinen Hinweis. Unser Moderations-Team prüft den Stream so bald wie möglich.
          </p>
          <Link
            href={'/live' as Route}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Zurück zu Live
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/live/${id}` as Route}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border hover:bg-muted"
          aria-label="Zurück"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Flag className="h-5 w-5 text-muted-foreground" />
            Stream melden
          </h1>
          <p className="text-xs text-muted-foreground">
            Hilf uns, die Community sicher zu halten.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Reason picker */}
        <div>
          <p className="mb-3 text-sm font-medium">Warum meldest du diesen Stream?</p>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                  selectedReason === r.value
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={selectedReason === r.value}
                  onChange={() => setSelectedReason(r.value)}
                  className="mt-0.5 accent-primary"
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium">{r.label}</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Optional details */}
        <div>
          <label htmlFor="details" className="mb-1.5 block text-sm font-medium">
            Zusätzliche Details{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="details"
            rows={3}
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Beschreibe kurz, was du gesehen hast…"
            className="w-full resize-none rounded-xl border bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {details.length}/500
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href={`/live/${id}` as Route}
            className="flex-1 rounded-full border py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={!selectedReason}
            className="flex-1 rounded-full bg-destructive py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Meldung senden
          </button>
        </div>
      </form>
    </main>
  );
}

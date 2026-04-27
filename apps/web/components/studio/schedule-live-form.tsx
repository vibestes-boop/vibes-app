'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Loader2, X } from 'lucide-react';

import { scheduleLive } from '@/app/actions/scheduled-lives';

// -----------------------------------------------------------------------------
// ScheduleLiveForm — v1.w.UI.155
//
// Inline-Dialog zum Planen eines neuen Live-Streams. Öffnet sich als
// einfaches Overlay-Panel (kein Radix — dependency-frei).
//
// Felder:
//   • Titel (required, 3-80 Zeichen)
//   • Beschreibung (optional)
//   • Startzeit (datetime-local, min = jetzt + 5 min)
//
// Submit → Server Action `scheduleLive` → router.refresh() → Panel schließt.
// -----------------------------------------------------------------------------

export function ScheduleLiveForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // min datetime: jetzt + 5 Minuten, auf Minuten gerundet
  function minDatetime(): string {
    const d = new Date(Date.now() + 6 * 60_000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await scheduleLive(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <CalendarPlus className="h-4 w-4" />
        Live planen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Live planen</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
              {/* Titel */}
              <div>
                <label htmlFor="sl-title" className="mb-1.5 block text-sm font-medium">
                  Titel <span className="text-rose-500">*</span>
                </label>
                <input
                  id="sl-title"
                  name="title"
                  type="text"
                  required
                  minLength={3}
                  maxLength={80}
                  placeholder="z.B. Q&A mit euch 🎤"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Beschreibung */}
              <div>
                <label htmlFor="sl-desc" className="mb-1.5 block text-sm font-medium">
                  Beschreibung{' '}
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="sl-desc"
                  name="description"
                  rows={3}
                  maxLength={300}
                  placeholder="Worum geht's in deinem Stream?"
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Startzeit */}
              <div>
                <label htmlFor="sl-datetime" className="mb-1.5 block text-sm font-medium">
                  Startzeit <span className="text-rose-500">*</span>
                </label>
                <input
                  id="sl-datetime"
                  name="scheduled_at"
                  type="datetime-local"
                  required
                  min={minDatetime()}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird gespeichert…
                  </>
                ) : (
                  <>
                    <CalendarPlus className="h-4 w-4" />
                    Live planen
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

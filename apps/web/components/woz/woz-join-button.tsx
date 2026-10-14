'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight } from 'lucide-react';
import { requestWomenOnlyZone } from '@/app/actions/women-only';

// A request requires approval. Confirm submission before refreshing server state.
export function WozJoinButton() {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestWomenOnlyZone();
        if (result.error === 'not_authenticated') {
          router.push('/login?next=%2Fwoz');
          return;
        }
        if (result.error) {
          setError('Dein Antrag konnte nicht gesendet werden. Bitte versuche es erneut.');
          return;
        }
        setSubmitted(true);
        router.refresh();
      } catch {
        setError('Dein Antrag konnte nicht gesendet werden. Bitte versuche es erneut.');
      }
    });
  }

  if (submitted) {
    return (
      <p role="status" className="rounded-xl border border-border bg-muted p-4 text-center text-sm">
        Dein Antrag wurde übermittelt. Du bekommst Zugang, sobald er freigegeben ist.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleJoin}
        disabled={pending}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Wird gesendet…
          </>
        ) : (
          <>
            Zugang beantragen
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

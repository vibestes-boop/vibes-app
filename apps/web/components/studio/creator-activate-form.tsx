'use client';

// -----------------------------------------------------------------------------
// CreatorActivateForm — v1.w.UI.163
//
// Single-button form that calls activateCreator() and navigates to /studio
// on success. Matches mobile creator/activate.tsx UX: one tap, instant access.
// -----------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { activateCreator } from '@/app/actions/creator';

export function CreatorActivateForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleActivate() {
    setError(null);
    startTransition(async () => {
      const res = await activateCreator();
      if (res.ok) {
        setSuccess(true);
        router.push('/studio');
        router.refresh();
      } else if (res.error === 'not_authenticated') {
        router.push('/login?next=/studio/activate');
      } else {
        setError(res.error ?? 'Aktivierung fehlgeschlagen. Bitte versuche es nochmal.');
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleActivate}
        disabled={success}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {success ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {success ? 'Wird aktiviert…' : 'Jetzt Creator werden — kostenlos'}
      </button>

      {error && (
        <p className="mt-2 text-center text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

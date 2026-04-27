'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { activateWomenOnlyZone } from '@/app/actions/women-only';

// -----------------------------------------------------------------------------
// WozActivateForm — Client-Button für Level-1 Selbstdeklaration.
// Kein Formular nötig — ein einziger Bestätigungs-Button ruft die
// Server-Action auf, danach Router-Refresh für Server-State-Update.
// -----------------------------------------------------------------------------

export function WozActivateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleActivate = () => {
    setError(null);
    startTransition(async () => {
      const result = await activateWomenOnlyZone();
      if (result.error === 'not_authenticated') {
        router.push('/login?next=/women-only');
        return;
      }
      if (result.error) {
        setError('Aktivierung fehlgeschlagen — bitte versuche es erneut.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleActivate}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ShieldCheck className="h-5 w-5" />
        )}
        {isPending ? 'Wird aktiviert…' : 'Women-Only Zone beitreten'}
      </button>
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        Mit dem Beitreten erklärst du dich als weiblich. Keine weiteren Nachweise nötig.
      </p>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

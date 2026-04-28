'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight } from 'lucide-react';
import { activateWomenOnlyZone } from '@/app/actions/women-only';

// -----------------------------------------------------------------------------
// WozJoinButton — Level-1-Aktivierung der Women-Only Zone.
//
// v1.w.UI.213: Parity mit app/women-only/index.tsx → activateLevel1().
// Nach Erfolg: router.refresh() damit /woz die verifizierten State zeigt.
// -----------------------------------------------------------------------------

export function WozJoinButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleJoin() {
    startTransition(async () => {
      const result = await activateWomenOnlyZone();
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleJoin}
      disabled={pending}
      className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Wird aktiviert…
        </>
      ) : (
        <>
          Jetzt beitreten
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

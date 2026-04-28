'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { activateWomenOnlyZone } from '@/app/actions/women-only';

// -----------------------------------------------------------------------------
// WozJoinButton — Level-1-Aktivierung der Women-Only Zone.
//
// v1.w.UI.213: Parity mit app/women-only/index.tsx → activateLevel1().
// Ruft die Server-Action activateWomenOnlyZone() auf, die gender=female +
// women_only_verified=true + verification_level=1 setzt.
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
      className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Wird aktiviert…
        </>
      ) : (
        <>
          <ShieldCheck className="h-4 w-4" />
          Jetzt beitreten
        </>
      )}
    </button>
  );
}

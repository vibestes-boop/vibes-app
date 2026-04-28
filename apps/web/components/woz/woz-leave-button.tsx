'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { deactivateWomenOnlyZone } from '@/app/actions/women-only';

// -----------------------------------------------------------------------------
// WozLeaveButton — deaktiviert die Women-Only Zone für den aktuellen User.
//
// Inline-Confirm-State (kein Modal): erster Klick → "Bist du sicher?" +
// [Verlassen] [Abbrechen], zweiter Klick führt die Action aus.
// router.refresh() danach → /woz zeigt den Unverified-State.
// v1.w.UI.214
// -----------------------------------------------------------------------------

export function WozLeaveButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition]  = useTransition();
  const router = useRouter();

  function handleLeave() {
    startTransition(async () => {
      await deactivateWomenOnlyZone();
      router.refresh();
    });
  }

  if (pending) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Wird beendet…
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">Verlassen?</span>
        <button
          onClick={handleLeave}
          className="font-medium text-rose-500 hover:underline"
        >
          Ja
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Abbrechen
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:underline"
    >
      Verlassen
    </button>
  );
}

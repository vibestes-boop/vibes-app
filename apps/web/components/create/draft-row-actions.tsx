'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteDraft } from '@/app/actions/posts';

// -----------------------------------------------------------------------------
// DraftRowActions — Löschen-Button pro Draft-Zeile. Soft-Confirm via zweiten
// Klick (statt Modal — UX-Konsistenz mit Native-Swipe-to-Delete).
// -----------------------------------------------------------------------------

export function DraftRowActions({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const onDelete = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      const res = await deleteDraft(draftId);
      if (res.ok) {
        router.refresh();
      } else {
        setConfirming(false);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={isPending}
      className={
        confirming
          ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-medium text-white hover:bg-red-600'
          : 'grid h-9 w-9 place-items-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground'
      }
      title={confirming ? 'Nochmal klicken zum Löschen' : 'Löschen'}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : confirming ? (
        <>
          <Trash2 className="h-3.5 w-3.5" />
          Löschen
        </>
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}

'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';

import { cancelScheduledLive } from '@/app/actions/scheduled-lives';

// -----------------------------------------------------------------------------
// CancelScheduledLiveButton — confirm → server action → router.refresh().
// -----------------------------------------------------------------------------

export function CancelScheduledLiveButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`„${title}" absagen? Diese Aktion kann nicht rückgängig gemacht werden.`))
      return;

    startTransition(async () => {
      await cancelScheduledLive(id);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Geplanten Stream absagen"
      title="Absagen"
      className="inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
    </button>
  );
}

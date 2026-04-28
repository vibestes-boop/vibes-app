'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, BellOff } from 'lucide-react';

import { unmuteHost } from '@/app/actions/live-prefs';

// -----------------------------------------------------------------------------
// UnmuteHostButton — Client-Knopf in der Muted-Live-Hosts-Liste.
// Confirm → Action → router.refresh().
// -----------------------------------------------------------------------------

interface Props {
  hostId: string;
  username: string | null;
}

export function UnmuteHostButton({ hostId, username }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const label = username ? `@${username}` : 'diesen Host';
    if (!confirm(`${label} wieder aktivieren? Du erhältst dann wieder eine Benachrichtigung wenn er/sie live geht.`))
      return;

    startTransition(async () => {
      await unmuteHost(hostId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={username ? `@${username} wieder aktivieren` : 'Host wieder aktivieren'}
      className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>…</span>
        </>
      ) : (
        <>
          <BellOff className="h-3 w-3" />
          <span>Aktivieren</span>
        </>
      )}
    </button>
  );
}

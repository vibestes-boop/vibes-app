'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { unblockCoHost } from '@/app/actions/live-prefs';

// -----------------------------------------------------------------------------
// UnblockCoHostButton — Client-Knopf in der CoHost-Sperrliste.
// Confirm → Action → router.refresh().
// -----------------------------------------------------------------------------

interface Props {
  blockedUserId: string;
  username: string | null;
}

export function UnblockCoHostButton({ blockedUserId, username }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const label = username ? `@${username}` : 'diesen Nutzer';
    if (!confirm(`${label} von der Co-Host-Sperrliste entfernen? Er/Sie kann dann wieder als Co-Host an deinen Lives teilnehmen.`))
      return;

    startTransition(async () => {
      await unblockCoHost(blockedUserId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={username ? `@${username} entblocken` : 'Co-Host entblocken'}
      className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>…</span>
        </>
      ) : (
        <span>Entblocken</span>
      )}
    </button>
  );
}

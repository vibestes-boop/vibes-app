'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { unblockUser } from '@/app/actions/blocks';

// -----------------------------------------------------------------------------
// UnblockButton — Client-Knopf in der Blocked-Users-Liste. Confirm-Dialog
// (window.confirm reicht, weil reversibel: User kann danach sofort wieder
// blocken) → Action → router.refresh für die RSC-Liste.
// -----------------------------------------------------------------------------

interface Props {
  targetUserId: string;
  username: string | null;
}

export function UnblockButton({ targetUserId, username }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    const label = username ? `@${username}` : 'diesen Nutzer';
    if (!confirm(`${label} entblocken? Er/Sie kann dann wieder dein Profil und deine Posts sehen.`))
      return;

    startTransition(async () => {
      const result = await unblockUser(targetUserId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
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
      {error && (
        <p className="text-[11px] text-rose-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

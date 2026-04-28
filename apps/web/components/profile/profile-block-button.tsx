'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldOff, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { blockUser } from '@/app/actions/blocks';

// -----------------------------------------------------------------------------
// ProfileBlockButton — v1.w.UI.54.
//
// 3-Punkte-Dropdown auf fremden Profilen für eingeloggte User.
// Aktuell ein Eintrag: „Blockieren" mit Bestätigungs-Dialog.
// Block führt zu / (Feed) — das blockierte Profil ist danach nicht mehr
// sichtbar (RLS auf profiles filtert geblockte User raus).
// -----------------------------------------------------------------------------

export function ProfileBlockButton({
  targetUserId,
  targetUsername,
}: {
  targetUserId: string;
  targetUsername: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleBlock = async () => {
    const confirmed = window.confirm(
      `@${targetUsername} blockieren?\n\nDieser Account kann dir dann nicht mehr folgen, dir keine Nachrichten schicken und deine Posts nicht sehen.`,
    );
    if (!confirmed) return;

    setPending(true);
    try {
      const result = await blockUser(targetUserId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`@${targetUsername} wurde blockiert.`);
      router.push('/');
    } finally {
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Weitere Optionen"
          disabled={pending}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => { e.preventDefault(); void handleBlock(); }}
        >
          <ShieldOff className="h-4 w-4" />
          <span>Blockieren</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { muteHost, unmuteHost } from '@/app/actions/live-prefs';

// -----------------------------------------------------------------------------
// MuteHostButton — v1.w.UI.156
//
// Bell-Toggle auf dem Public-Profil eines Creators. Zeigt:
//   Bell     → User bekommt Go-Live Push. Click → stummschalten.
//   BellOff  → User hat Go-Live Push stummgeschaltet. Click → reaktivieren.
//
// Nur für eingeloggte fremde User sichtbar (Server entscheidet welche Props).
// Optimistisches UI: State flippt sofort, bei Fehler Toast + Rollback.
//
// Parität zu mobile `UserProfileContent.tsx` Glocken-Toggle (lib/useMutedLiveHosts).
// -----------------------------------------------------------------------------

interface Props {
  hostId:         string;
  initiallyMuted: boolean;
}

export function MuteHostButton({ hostId, initiallyMuted }: Props) {
  const [muted, setMuted] = useState(initiallyMuted);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const willMute = !muted;
    setMuted(willMute); // optimistic

    startTransition(async () => {
      const result = willMute
        ? await muteHost(hostId)
        : await unmuteHost(hostId);

      if (!result.ok) {
        setMuted(!willMute); // rollback
        toast.error(result.error);
        return;
      }

      toast.success(
        willMute
          ? 'Go-Live Benachrichtigungen deaktiviert'
          : 'Go-Live Benachrichtigungen aktiviert',
      );
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={muted ? 'Go-Live Benachrichtigungen aktivieren' : 'Go-Live Benachrichtigungen deaktivieren'}
      title={muted ? 'Benachrichtigungen aktivieren' : 'Benachrichtigungen deaktivieren'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : muted ? (
        <BellOff className="h-4 w-4 text-orange-500" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
    </button>
  );
}

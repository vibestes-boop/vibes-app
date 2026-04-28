'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { UserPlus, UserCheck, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleFollow } from '@/app/actions/engagement';

// -----------------------------------------------------------------------------
// FollowButton — v1.w.UI.40 Follow-Graph live.
//
// v1.w.UI.149: Privates-Konto-Unterstützung.
//  • is_private=false: bisheriges Verhalten (sofort folgen/entfolgen)
//  • is_private=true:  "Folgen" → Follow-Request; zeigt "Anfrage gesendet" (Clock)
//                      "Anfrage gesendet" → Klick zieht Anfrage zurück
//
// Optimistisches UI: State wird sofort getoggelt, Server Action läuft im
// Hintergrund. Bei Fehler wird der State zurückgerollt + Toast.
// -----------------------------------------------------------------------------

export function FollowButton({
  isAuthenticated,
  isFollowing: initialIsFollowing,
  isPendingRequest: initialIsPendingRequest = false,
  isSelf,
  username,
  targetUserId,
}: {
  isAuthenticated: boolean;
  isFollowing: boolean;
  /** true = Viewer hat eine offene Follow-Anfrage an dieses private Konto. */
  isPendingRequest?: boolean;
  isSelf: boolean;
  username: string;
  /** Supabase-UUID des Profil-Inhabers — nötig für toggleFollow Server Action. */
  targetUserId: string;
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPendingRequest, setIsPendingRequest] = useState(initialIsPendingRequest);
  const [isTransitioning, startTransition] = useTransition();

  // Eigener Account → Profil bearbeiten
  if (isSelf) {
    return (
      <Button asChild variant="outline" size="sm" className="min-w-[120px]">
        <Link href={'/settings/profile' as Route}>Profil bearbeiten</Link>
      </Button>
    );
  }

  // Nicht eingeloggt → /login?next=...
  if (!isAuthenticated) {
    return (
      <Button asChild size="sm" className="min-w-[120px]">
        <Link href={`/login?next=${encodeURIComponent(`/u/${username}`)}` as Route}>
          <UserPlus className="h-4 w-4" />
          Folgen
        </Link>
      </Button>
    );
  }

  const handleClick = () => {
    const wasFollowing = isFollowing;
    const wasPending = isPendingRequest;

    // Optimistisches Update
    if (wasFollowing) {
      setIsFollowing(false);
    } else if (wasPending) {
      setIsPendingRequest(false);
    } else {
      // Wir wissen nicht ob privat; optimistisch als "wird pending" gesetzt
      // falls Server pending zurückgibt, bleibt das stimmen
      setIsFollowing(true);
    }

    startTransition(async () => {
      const result = await toggleFollow(targetUserId, wasFollowing, wasPending);

      if (!result.ok) {
        // Rollback
        setIsFollowing(wasFollowing);
        setIsPendingRequest(wasPending);
        toast.error('Aktion fehlgeschlagen', { description: result.error });
        return;
      }

      setIsFollowing(result.data.following);
      setIsPendingRequest(result.data.pending);

      if (result.data.following) {
        toast.success(`Du folgst jetzt @${username}`);
      } else if (result.data.pending) {
        toast.success(`Anfrage an @${username} gesendet`);
      } else if (wasPending) {
        toast.info(`Anfrage an @${username} zurückgezogen`);
      }
    });
  };

  const variant = isFollowing || isPendingRequest ? 'outline' : 'default';

  return (
    <Button
      size="sm"
      variant={variant}
      onClick={handleClick}
      disabled={isTransitioning}
      className="min-w-[120px]"
    >
      {isTransitioning ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck className="h-4 w-4" />
          Folgst du
        </>
      ) : isPendingRequest ? (
        <>
          <Clock className="h-4 w-4" />
          Anfrage gesendet
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Folgen
        </>
      )}
    </Button>
  );
}

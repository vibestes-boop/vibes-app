'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleFollow } from '@/app/actions/engagement';

// -----------------------------------------------------------------------------
// FollowButton — v1.w.UI.40 Follow-Graph live.
//
// Optimistisches UI: State wird sofort getoggelt, Server Action läuft im
// Hintergrund. Bei Fehler wird der State zurückgerollt + Toast.
//
// useTransition verhindert UI-Freeze während der Server Action läuft und
// gibt uns `isPending` für den Loading-Spinner gratis.
// -----------------------------------------------------------------------------

export function FollowButton({
  isAuthenticated,
  isFollowing: initialIsFollowing,
  isSelf,
  username,
  targetUserId,
}: {
  isAuthenticated: boolean;
  isFollowing: boolean;
  isSelf: boolean;
  username: string;
  /** Supabase-UUID des Profil-Inhabers — nötig für toggleFollow Server Action. */
  targetUserId: string;
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();

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
    setIsFollowing(!wasFollowing);

    startTransition(async () => {
      const result = await toggleFollow(targetUserId, wasFollowing);

      if (!result.ok) {
        setIsFollowing(wasFollowing);
        toast.error('Aktion fehlgeschlagen', { description: result.error });
        return;
      }

      setIsFollowing(result.data.following);

      if (result.data.following) {
        toast.success(`Du folgst jetzt @${username}`);
      }
    });
  };

  return (
    <Button
      size="sm"
      variant={isFollowing ? 'outline' : 'default'}
      onClick={handleClick}
      disabled={isPending}
      className="min-w-[120px]"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck className="h-4 w-4" />
          Folgst du
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

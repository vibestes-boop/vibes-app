'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

// -----------------------------------------------------------------------------
// FollowButton — Phase-2-Stub.
// Zeigt den aktuellen Status (follow / following), echte Mutations folgen in
// Phase 3 zusammen mit Feed/Notifications. Unauthenticated-User werden auf
// /login geschickt — mit `next` param für Rück-Redirect nach Login.
// -----------------------------------------------------------------------------

export function FollowButton({
  isAuthenticated,
  isFollowing: initialIsFollowing,
  isSelf,
  username,
}: {
  isAuthenticated: boolean;
  isFollowing: boolean;
  isSelf: boolean;
  username: string;
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  // Eigener Account → Edit-Profil-Link (führt zu Settings in Phase 5).
  // `/settings` kommt Phase 5 — bis dahin Route-Cast (Page existiert noch nicht).
  if (isSelf) {
    return (
      <Button asChild variant="outline" size="sm" className="min-w-[120px]">
        <Link href={'/settings' as Route}>Profil bearbeiten</Link>
      </Button>
    );
  }

  // Nicht eingeloggt → Button ist sichtbar aber führt zu /login?next=/u/{username}.
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

  // Eingeloggt + fremdes Profil — Phase-2-Stub: optimistisches Toggle lokal,
  // Toast weist darauf hin dass Follow-Graph erst in Phase 3 landet.
  const onClick = () => {
    setIsFollowing((prev) => !prev);
    toast('Follow-Funktion folgt in Kürze', {
      description: 'Web-Phase 3 bringt den Follow-Graphen. In der App bereits möglich.',
    });
  };

  return (
    <Button
      size="sm"
      variant={isFollowing ? 'outline' : 'default'}
      onClick={onClick}
      className="min-w-[120px]"
    >
      {isFollowing ? (
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

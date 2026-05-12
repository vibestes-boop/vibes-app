'use client';

/**
 * live-duet-invite-watcher.tsx
 *
 * v1.w.UI.187 — Thin client shell: verbindet useDuetInviteInbox-Hook mit
 * LiveDuetInviteModal.  Wird von der RSC-Viewer-Seite als reines
 * client-side Widget gemountet.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDuetInviteInbox, type DuetDirection } from './use-duet-invite-inbox';
import { LiveDuetInviteModal } from './live-duet-invite-modal';

interface Props {
  sessionId: string;
  viewerId:  string;
  direction?: DuetDirection | 'any';
}

export function LiveDuetInviteWatcher({ sessionId, viewerId, direction = 'host-to-viewer' }: Props) {
  const router = useRouter();
  const { topInvite, isResponding, acceptInvite, declineInvite } = useDuetInviteInbox({
    sessionId,
    viewerId,
    direction,
  });
  const acceptRefreshDelay = topInvite?.direction === 'viewer-to-host' ? 120 : 80;

  const handleAccept = useCallback(
    async (inviteId: string) => {
      const result = await acceptInvite(inviteId);
      if (!result) return;
      window.setTimeout(() => router.refresh(), acceptRefreshDelay);
    },
    [acceptInvite, acceptRefreshDelay, router],
  );

  const handleDecline = useCallback(
    async (inviteId: string) => {
      await declineInvite(inviteId);
      window.setTimeout(() => router.refresh(), 80);
    },
    [declineInvite, router],
  );

  if (!topInvite) return null;

  return (
    <LiveDuetInviteModal
      invite={topInvite}
      isResponding={isResponding}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );
}

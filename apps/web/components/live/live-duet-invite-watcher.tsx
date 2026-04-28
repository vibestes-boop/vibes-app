'use client';

/**
 * live-duet-invite-watcher.tsx
 *
 * v1.w.UI.187 — Thin client shell: verbindet useDuetInviteInbox-Hook mit
 * LiveDuetInviteModal.  Wird von der RSC-Viewer-Seite als reines
 * client-side Widget gemountet.
 */

import { useDuetInviteInbox } from './use-duet-invite-inbox';
import { LiveDuetInviteModal } from './live-duet-invite-modal';

interface Props {
  sessionId: string;
  viewerId:  string;
}

export function LiveDuetInviteWatcher({ sessionId, viewerId }: Props) {
  const { topInvite, isResponding, acceptInvite, declineInvite } = useDuetInviteInbox({
    sessionId,
    viewerId,
  });

  if (!topInvite) return null;

  return (
    <LiveDuetInviteModal
      invite={topInvite}
      isResponding={isResponding}
      onAccept={acceptInvite}
      onDecline={declineInvite}
    />
  );
}

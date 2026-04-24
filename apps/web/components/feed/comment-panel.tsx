'use client';

import { CommentsBody } from './comments-body';

// -----------------------------------------------------------------------------
// CommentPanel — Inline-Right-Column-Variante der Kommentar-Ansicht (v1.w.UI.11
// Phase C). Wird vom `HomeFeedShell` auf xl+ gerendert wenn der User auf einer
// Karte „Kommentare öffnen" getriggert hat; ersetzt dann die rechte
// Discover-Sidebar. Auf < xl bleibt der alte `CommentSheet`-Overlay-Fluss aktiv.
//
// Kein Radix-Dialog, kein Portal, kein Fokus-Trap — das Panel ist Teil des
// normalen Page-Layouts. Tastatur-Eskape wird im Shell über einen globalen
// `Escape`-Listener in die Context-Close-Action verdrahtet.
// -----------------------------------------------------------------------------

export interface CommentPanelProps {
  postId: string;
  allowComments: boolean;
  viewerId: string | null;
  onClose: () => void;
}

export function CommentPanel({ postId, allowComments, viewerId, onClose }: CommentPanelProps) {
  return (
    <div
      role="complementary"
      aria-label="Kommentare"
      className="sticky top-0 flex h-[100dvh] flex-col bg-background"
    >
      <CommentsBody
        postId={postId}
        allowComments={allowComments}
        viewerId={viewerId}
        variant="panel"
        onClose={onClose}
      />
    </div>
  );
}

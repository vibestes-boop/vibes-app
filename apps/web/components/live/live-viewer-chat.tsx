'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import type { LiveChatOverlayProps } from './live-chat-overlay';

const LiveChat = dynamic(
  () => import('./live-chat').then((mod) => mod.LiveChat),
  { ssr: false },
);

const LiveChatOverlay = dynamic(
  () => import('./live-chat-overlay').then((mod) => mod.LiveChatOverlay),
  { ssr: false },
);

type LiveViewerChatProps = LiveChatOverlayProps & {
  panelClassName?: string;
};

export function LiveViewerChat({
  panelClassName,
  ...props
}: LiveViewerChatProps) {
  const isDesktop = useDesktopViewerLayout();

  if (isDesktop === null) {
    return null;
  }

  if (isDesktop) {
    return (
      <LiveChat
        sessionId={props.sessionId}
        initialComments={props.initialComments}
        hostId={props.hostId}
        viewerId={props.viewerId}
        isHost={props.isHost}
        isModerator={props.isModerator}
        slowModeSeconds={props.slowModeSeconds}
        ended={props.ended}
        allowComments={props.allowComments}
        commentsLockedLabel={props.commentsLockedLabel}
        className={panelClassName}
      />
    );
  }

  return <LiveChatOverlay {...props} />;
}

function useDesktopViewerLayout() {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1280px)');
    const update = () => setMatches(query.matches);

    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return matches;
}

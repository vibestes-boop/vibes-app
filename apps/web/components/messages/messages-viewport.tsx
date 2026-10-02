'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** Safari's visual viewport shrinks for the keyboard while 100dvh can stay tall. */
export function MessagesViewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => ref.current?.style.setProperty('--messages-height', `${viewport?.height ?? window.innerHeight}px`);
    resize();
    viewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <div ref={ref} className="serlo-messages-viewport" data-inbox={pathname === '/messages'}>{children}</div>;
}

'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { GripHorizontal, Settings2 } from 'lucide-react';
import { LivePollPanel } from './live-poll-panel';
import type { ActiveLivePollSSR } from '@/lib/data/live';

interface LiveHostPollOverlayProps {
  sessionId: string;
  poll: ActiveLivePollSSR;
  hostId: string;
  onManage: () => void;
}

interface Position {
  x: number;
  y: number;
}

const PANEL_WIDTH = 260;
const PANEL_HEIGHT = 168;
const STORAGE_PREFIX = 'live-host-poll-overlay:';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function LiveHostPollOverlay({
  sessionId,
  poll,
  hostId,
  onManage,
}: LiveHostPollOverlayProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: Position;
  } | null>(null);
  const storageKey = `${STORAGE_PREFIX}${sessionId}`;
  const [position, setPosition] = useState<Position>({ x: 16, y: 92 });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Position>;
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        setPosition({ x: parsed.x, y: parsed.y });
      }
    } catch {
      // Broken local storage state should not break the host deck.
    }
  }, [storageKey]);

  const persistPosition = (next: Position) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // localStorage may be blocked; dragging should still work for this session.
    }
  };

  const moveTo = (next: Position) => {
    const parent = panelRef.current?.parentElement?.getBoundingClientRect();
    if (!parent) {
      setPosition(next);
      return;
    }
    const clamped = {
      x: clamp(next.x, 8, Math.max(8, parent.width - PANEL_WIDTH - 8)),
      y: clamp(next.y, 8, Math.max(8, parent.height - PANEL_HEIGHT - 8)),
    };
    setPosition(clamped);
    persistPosition(clamped);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveTo({
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      ref={panelRef}
      className="absolute z-40 w-[260px] max-w-[calc(100%-16px)]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/55 shadow-elevation-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5 text-white">
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="inline-flex min-w-0 flex-1 cursor-grab items-center gap-1.5 rounded-lg px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 active:cursor-grabbing"
            title="Umfrage verschieben"
          >
            <GripHorizontal className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Umfrage live</span>
          </button>
          <button
            type="button"
            onClick={onManage}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/15"
            aria-label="Umfrage verwalten"
            title="Umfrage verwalten"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <LivePollPanel
          sessionId={sessionId}
          poll={poll}
          viewerId={hostId}
          readOnly
          className="rounded-none border-0 bg-transparent shadow-none"
        />
      </div>
    </div>
  );
}

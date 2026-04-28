'use client';

// -----------------------------------------------------------------------------
// LiveStickerLayer — v1.w.UI.202 (viewer read-only) + v1.w.UI.207 (host mode)
//
// Read-only emoji-sticker overlay for the web live viewer.
// Mobile parity: app/live/watch/[id].tsx renders <LiveStickerLayer> with
// stickers from useActiveStickers() (read-only for viewers).
//
// v1.w.UI.207 — isHost mode:
//   • Stickers are pointer-draggable (move on drag-release → DB update).
//   • Right-click a sticker → context menu → soft-delete via removed_at.
//   • Drag is local (60fps, no network); DB write only on pointer-up.
//
// Positions in the DB are in mobile pixel space (default reference 390 × 844 pt).
// We convert them to CSS percentage so stickers appear at roughly the same
// relative spot on the 9:16 video frame regardless of actual pixel dimensions.
//
// Realtime: subscribes to `live_stickers` postgres_changes (INSERT / UPDATE /
// DELETE) and re-fetches the active set on any change.
// -----------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// Reference phone dimensions used when host placed the sticker
const REF_W = 390;
const REF_H = 844;

interface StickerRow {
  id: string;
  emoji: string;
  position_x: number;
  position_y: number;
  scale: number;
  rotation: number;
}

export interface LiveStickerLayerProps {
  sessionId: string;
  /**
   * v1.w.UI.207 — when true, host mode is active:
   *   - stickers are pointer-draggable
   *   - right-click opens a remove context menu
   */
  isHost?: boolean;
}

export function LiveStickerLayer({ sessionId, isHost = false }: LiveStickerLayerProps) {
  const [stickers, setStickers] = useState<StickerRow[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Drag state (refs so move/up handlers don't re-bind on every state change) ──
  const dragRef = useRef<{
    id: string;
    startPtrX: number;
    startPtrY: number;
    origPctX: number; // percentage of container width
    origPctY: number; // percentage of container height
  } | null>(null);

  // Local overrides while dragging — percentage coords (0-100)
  const localPosRef = useRef<Record<string, { pctX: number; pctY: number }>>({});
  const [localPos, setLocalPos] = useState<Record<string, { pctX: number; pctY: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // ── Fetch + realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    async function fetchStickers() {
      const { data } = await supabase
        .from('live_stickers')
        .select('id, emoji, position_x, position_y, scale, rotation')
        .eq('session_id', sessionId)
        .is('removed_at', null)
        .order('created_at', { ascending: true });
      setStickers((data ?? []) as StickerRow[]);
    }

    void fetchStickers();

    const channel = supabase
      .channel(`live-stickers-web-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_stickers',
          filter: `session_id=eq.${sessionId}`,
        },
        () => void fetchStickers(),
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [sessionId]);

  // ── Host-mode pointer handlers ──────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent, s: StickerRow) => {
    if (!isHost) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    // Capture so we keep receiving events even if pointer leaves the span
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dragRef.current = {
      id: s.id,
      startPtrX: e.clientX,
      startPtrY: e.clientY,
      origPctX: (s.position_x / REF_W) * 100,
      origPctY: (s.position_y / REF_H) * 100,
    };
    setDraggingId(s.id);
  }, [isHost]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const dxPct = ((e.clientX - dragRef.current.startPtrX) / rect.width) * 100;
    const dyPct = ((e.clientY - dragRef.current.startPtrY) / rect.height) * 100;
    const pctX = Math.max(2, Math.min(98, dragRef.current.origPctX + dxPct));
    const pctY = Math.max(2, Math.min(98, dragRef.current.origPctY + dyPct));

    localPosRef.current[dragRef.current.id] = { pctX, pctY };
    setLocalPos(prev => ({ ...prev, [dragRef.current!.id]: { pctX, pctY } }));
  }, []);

  const handlePointerUp = useCallback(async () => {
    if (!dragRef.current) return;
    const { id } = dragRef.current;
    const local = localPosRef.current[id];
    dragRef.current = null;
    setDraggingId(null);
    if (!local) return;

    // Convert percentage → mobile reference coords and persist
    const dbX = (local.pctX / 100) * REF_W;
    const dbY = (local.pctY / 100) * REF_H;
    const supabase = createClient();
    await supabase
      .from('live_stickers')
      .update({ position_x: dbX, position_y: dbY })
      .eq('id', id);

    // Clear local override after save — realtime re-fetch will render fresh DB value
    setLocalPos(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    delete localPosRef.current[id];
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    if (!isHost) return;
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ id, x: e.clientX, y: e.clientY });
  }, [isHost]);

  const handleRemove = useCallback(async (id: string) => {
    setCtxMenu(null);
    const supabase = createClient();
    await supabase
      .from('live_stickers')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', id);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (stickers.length === 0 && !isHost) return null;

  return (
    <>
      <div
        ref={containerRef}
        className={[
          'absolute inset-0 overflow-hidden',
          isHost ? '' : 'pointer-events-none',
        ].join(' ')}
        aria-hidden="true"
        onPointerMove={isHost ? handlePointerMove : undefined}
        onPointerUp={isHost ? () => { void handlePointerUp(); } : undefined}
      >
        {stickers.map((s) => {
          const local = localPos[s.id];
          const pctX = local ? local.pctX : (s.position_x / REF_W) * 100;
          const pctY = local ? local.pctY : (s.position_y / REF_H) * 100;
          const isDragging = draggingId === s.id;

          return (
            <span
              key={s.id}
              className={[
                'absolute select-none',
                isHost ? 'cursor-grab active:cursor-grabbing touch-none' : '',
                isDragging ? 'z-10 drop-shadow-lg' : '',
              ].join(' ')}
              style={{
                left: `${pctX}%`,
                top: `${pctY}%`,
                fontSize: `${Math.max(0.5, s.scale) * 2.8}rem`,
                transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                lineHeight: 1,
                // Slightly enlarge while dragging for visual feedback
                scale: isDragging ? '1.15' : '1',
                transition: isDragging ? 'none' : 'scale 150ms ease',
              }}
              onPointerDown={isHost ? (e) => handlePointerDown(e, s) : undefined}
              onContextMenu={isHost ? (e) => handleContextMenu(e, s.id) : undefined}
            >
              {s.emoji}
            </span>
          );
        })}
      </div>

      {/* Right-click context menu — host only */}
      {ctxMenu && isHost && (
        <>
          {/* Backdrop to dismiss */}
          <div
            className="fixed inset-0 z-50"
            onClick={() => setCtxMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
          />
          <div
            className="fixed z-50 min-w-[130px] rounded-lg border bg-popover p-1 shadow-lg"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              type="button"
              className="flex w-full items-center rounded px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              onClick={() => void handleRemove(ctxMenu.id)}
            >
              Sticker entfernen
            </button>
          </div>
        </>
      )}
    </>
  );
}

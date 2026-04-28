'use client';

// -----------------------------------------------------------------------------
// LiveStickerLayer — v1.w.UI.202
//
// Read-only emoji-sticker overlay for the web live viewer.
// Mobile parity: app/live/watch/[id].tsx renders <LiveStickerLayer> with
// stickers from useActiveStickers() (read-only for viewers).
//
// Positions in the DB are in mobile pixel space (default reference 390 × 844 pt).
// We convert them to CSS percentage so stickers appear at roughly the same
// relative spot on the 9:16 video frame regardless of actual pixel dimensions.
//
// Realtime: subscribes to `live_stickers` postgres_changes (INSERT / UPDATE /
// DELETE) and re-fetches the active set on any change.
// -----------------------------------------------------------------------------

import { useState, useEffect } from 'react';
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

interface LiveStickerLayerProps {
  sessionId: string;
}

export function LiveStickerLayer({ sessionId }: LiveStickerLayerProps) {
  const [stickers, setStickers] = useState<StickerRow[]>([]);

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

  if (stickers.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {stickers.map((s) => (
        <span
          key={s.id}
          className="absolute select-none"
          style={{
            left: `${(s.position_x / REF_W) * 100}%`,
            top: `${(s.position_y / REF_H) * 100}%`,
            fontSize: `${Math.max(0.5, s.scale) * 2.8}rem`,
            transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            lineHeight: 1,
          }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}

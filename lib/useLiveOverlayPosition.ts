/**
 * lib/useLiveOverlayPosition.ts
 *
 * v1.22.0 — Broadcast für Overlay-Positionen (Poll, Sticker, Produkt-Karten).
 *
 * Pattern: "Commit-on-Release"
 *   • Host sendet EINE Broadcast-Message pro Drag-End via `broadcastPosition()`
 *   • Viewer subscribt → `position` State enthält die letzte empfangene Position
 *
 * Channel-Name: `live-overlay-pos-{sessionId}`
 * Event-Name:   `pos:{overlayKey}` (z.B. 'pos:poll', 'pos:sticker-123', 'pos:product-42')
 *
 * Damit lassen sich später mehrere Overlays pro Session synchronisieren
 * (Poll + 5 Sticker + 2 Produkt-Karten), ohne zusätzliche Channels zu öffnen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface OverlayPosition {
  x: number;
  y: number;
}

/**
 * Syncronisiert eine Overlay-Position zwischen Host und Viewern.
 *
 * @param sessionId Aktive Live-Session ID (oder null → Hook inaktiv)
 * @param overlayKey Eindeutiger Key für dieses Overlay innerhalb der Session
 *                   z.B. 'poll' / 'sticker-{id}' / 'product-{id}'
 */
export function useLiveOverlayPosition(
  sessionId: string | null | undefined,
  overlayKey: string,
) {
  const [position, setPosition] = useState<OverlayPosition | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`live-overlay-pos-${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: `pos:${overlayKey}` }, (msg) => {
        const payload = msg.payload as OverlayPosition | undefined;
        if (!payload) return;
        if (typeof payload.x === 'number' && typeof payload.y === 'number') {
          setPosition({ x: payload.x, y: payload.y });
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, overlayKey]);

  /**
   * Host-Seite: sendet finale Position beim Release des Overlays.
   * Viewer erhalten EINE Message → smoothe 200ms-Transition.
   */
  const broadcastPosition = useCallback(
    (pos: OverlayPosition) => {
      const ch = channelRef.current;
      if (!ch) return;
      try {
        ch.send({
          type: 'broadcast',
          event: `pos:${overlayKey}`,
          payload: pos,
        });
      } catch (err) {
        __DEV__ && console.warn('[useLiveOverlayPosition] broadcast failed:', err);
      }
    },
    [overlayKey],
  );

  return { position, broadcastPosition };
}

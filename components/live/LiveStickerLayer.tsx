/**
 * components/live/LiveStickerLayer.tsx
 *
 * v1.22.0 — Rendert alle aktiven Sticker einer Live-Session als Overlay.
 *
 * Host-Modus:
 *   • Jeder Sticker ist draggable (via DraggableOverlay)
 *   • On-Release → broadcastet neue Position + persistiert sie in DB
 *   • Long-Press auf Sticker → entfernen
 *
 * Viewer-Modus:
 *   • Read-only Render der Sticker an ihrer jeweiligen Position
 *   • Remote-Position Broadcasts animieren sanft zu neuer Position
 */

import React, { useCallback } from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DraggableOverlay, type DraggablePosition } from './DraggableOverlay';
import { useLiveOverlayPosition } from '@/lib/useLiveOverlayPosition';
import type { LiveSticker } from '@/lib/useLiveStickers';

interface LayerProps {
  sessionId: string | null | undefined;
  stickers:  LiveSticker[];
  /** Host-Modus aktiviert Drag + Long-Press-Remove */
  isHost?:   boolean;
  /** Host: finale Position in DB speichern */
  onMove?:   (id: string, position: DraggablePosition) => void;
  /** Host: Sticker entfernen (Soft-Delete) */
  onRemove?: (id: string) => void;
}

export function LiveStickerLayer({
  sessionId, stickers, isHost, onMove, onRemove,
}: LayerProps) {
  if (!sessionId || stickers.length === 0) return null;

  return (
    <>
      {stickers.map((sticker) => (
        <LiveStickerItem
          key={sticker.id}
          sticker={sticker}
          sessionId={sessionId}
          isHost={!!isHost}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}
    </>
  );
}

// ─── Einzelner Sticker ──────────────────────────────────────────────────────

interface ItemProps {
  sticker:   LiveSticker;
  sessionId: string;
  isHost:    boolean;
  onMove?:   (id: string, position: DraggablePosition) => void;
  onRemove?: (id: string) => void;
}

function LiveStickerItem({ sticker, sessionId, isHost, onMove, onRemove }: ItemProps) {
  // Broadcast-Channel pro Sticker (Key: sticker-{id}) — ein Channel gesamt,
  // unterschiedliche Events → viele Sticker, wenig Netzwerk.
  const overlayKey = `sticker-${sticker.id}`;
  const { position: remotePos, broadcastPosition } = useLiveOverlayPosition(
    sessionId, overlayKey,
  );

  const handleRelease = useCallback((pos: DraggablePosition) => {
    // Host: 1) an alle Viewer broadcasten, 2) in DB persistieren
    broadcastPosition(pos);
    onMove?.(sticker.id, pos);
  }, [broadcastPosition, onMove, sticker.id]);

  const handleLongPress = useCallback(() => {
    if (!isHost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove?.(sticker.id);
  }, [isHost, onRemove, sticker.id]);

  // DB-Position als Startwert; Viewer bekommen zusätzlich Remote-Broadcasts.
  const dbPosition: DraggablePosition = {
    x: sticker.positionX,
    y: sticker.positionY,
  };

  return (
    <DraggableOverlay
      draggable={isHost}
      defaultPosition={dbPosition}
      remotePosition={isHost ? null : remotePos}
      onRelease={isHost ? handleRelease : undefined}
    >
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={450}
        disabled={!isHost}
        style={styles.stickerHitArea}
      >
        <View style={styles.stickerShadow}>
          <Text
            style={[
              styles.emoji,
              { transform: [
                { scale: sticker.scale },
                { rotate: `${sticker.rotation}deg` },
              ] },
            ]}
          >
            {sticker.emoji}
          </Text>
        </View>
      </Pressable>
    </DraggableOverlay>
  );
}

const styles = StyleSheet.create({
  stickerHitArea: {
    padding: 8,
  },
  stickerShadow: {
    // Schwacher Schatten damit Emoji auf bunten Streams sichtbar bleibt
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
  },
  emoji: {
    fontSize: 56,
    lineHeight: 66,
  },
});

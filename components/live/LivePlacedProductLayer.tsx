/**
 * components/live/LivePlacedProductLayer.tsx
 *
 * v1.22.0 — Rendert platzierte Produkt-Karten im Live-Stream.
 *
 * Host-Modus:
 *   • Jede Karte ist draggable (DraggableOverlay)
 *   • On-Release → broadcastet + persistiert neue Position
 *   • Long-Press → entfernt die Platzierung (Soft-Delete)
 *
 * Viewer-Modus:
 *   • Read-only, Remote-Position-Broadcasts werden sanft animiert
 *   • Tap auf Karte → öffnet `/shop/{productId}` (Produkt-Detail)
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ShoppingBag, Package } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { DraggableOverlay, type DraggablePosition } from './DraggableOverlay';
import { useLiveOverlayPosition } from '@/lib/useLiveOverlayPosition';
import type { PlacedProduct } from '@/lib/useLivePlacedProducts';

interface LayerProps {
  sessionId: string | null | undefined;
  products:  PlacedProduct[];
  /** Host-Modus aktiviert Drag + Long-Press-Unpin */
  isHost?:   boolean;
  onMove?:   (id: string, position: DraggablePosition) => void;
  onUnpin?:  (id: string) => void;
}

export function LivePlacedProductLayer({
  sessionId, products, isHost, onMove, onUnpin,
}: LayerProps) {
  if (!sessionId || products.length === 0) return null;

  return (
    <>
      {products.map((p) => (
        <PlacedProductCard
          key={p.id}
          product={p}
          sessionId={sessionId}
          isHost={!!isHost}
          onMove={onMove}
          onUnpin={onUnpin}
        />
      ))}
    </>
  );
}

// ─── Einzelne Produkt-Karte ─────────────────────────────────────────────────

interface CardProps {
  product:   PlacedProduct;
  sessionId: string;
  isHost:    boolean;
  onMove?:   (id: string, position: DraggablePosition) => void;
  onUnpin?:  (id: string) => void;
}

function PlacedProductCard({
  product, sessionId, isHost, onMove, onUnpin,
}: CardProps) {
  const router = useRouter();
  const overlayKey = `pproduct-${product.id}`;
  const { position: remotePos, broadcastPosition } = useLiveOverlayPosition(
    sessionId, overlayKey,
  );

  const handleRelease = useCallback((pos: DraggablePosition) => {
    broadcastPosition(pos);
    onMove?.(product.id, pos);
  }, [broadcastPosition, onMove, product.id]);

  const handleLongPress = useCallback(() => {
    if (!isHost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUnpin?.(product.id);
  }, [isHost, onUnpin, product.id]);

  const handleTap = useCallback(() => {
    // Host ignoriert Tap (nur Drag/Long-Press); Viewer öffnet Produkt-Seite.
    if (isHost) return;
    Haptics.selectionAsync();
    router.push(`/shop/${product.productId}`);
  }, [isHost, product.productId, router]);

  const dbPosition: DraggablePosition = {
    x: product.positionX,
    y: product.positionY,
  };

  return (
    <DraggableOverlay
      draggable={isHost}
      defaultPosition={dbPosition}
      remotePosition={isHost ? null : remotePos}
      onRelease={isHost ? handleRelease : undefined}
    >
      <Pressable
        onPress={handleTap}
        onLongPress={handleLongPress}
        delayLongPress={450}
        style={({ pressed }) => [
          styles.card,
          { opacity: pressed && !isHost ? 0.8 : 1 },
        ]}
      >
        {product.coverUrl ? (
          <Image source={product.coverUrl} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Package size={22} color="rgba(255,255,255,0.45)" />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
          <View style={styles.priceRow}>
            <ShoppingBag size={11} color="#fbbf24" strokeWidth={2.6} />
            <Text style={styles.price}>
              {product.priceCoins.toLocaleString('de-DE')}
            </Text>
          </View>
        </View>
      </Pressable>
    </DraggableOverlay>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_WIDTH = 170;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    padding: 6,
    gap: 8,
    // Schatten für bessere Abhebung auf bunten Streams
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});

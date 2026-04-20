/**
 * components/live/HostShopSheet.tsx
 *
 * v1.22.x — TikTok-Style Viewer-Katalog-Browser
 *
 * Öffnet sich, wenn der Viewer im Live-Stream unten auf die Shop-Tüte tippt.
 * Zeigt den gesamten aktiven Katalog des Hosts als 2-Spalten-Grid.
 * Tap auf ein Produkt → /shop/[id] (Detail-Seite).
 *
 * Independent von:
 *   • useLiveShopping (broadcast-basiertes Featured Product Pill)
 *   • useLivePlacedProducts (frei platzierte Karten auf Video)
 *
 * Wird nur gerendert, wenn `visible=true` UND der Host shop_enabled=true hat.
 * Die Caller-Komponente (watch/[id].tsx) steuert `visible` via
 * useLiveShopMode.shopEnabled + lokalem UI-State.
 */

import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { X as XIcon, ShoppingBag, Package } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useHostShopProducts } from '@/lib/useLiveShopMode';
import type { Product } from '@/lib/useShop';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

const GRID_PAD = 14;
const GRID_GAP = 10;
const CARD_WIDTH = (SCREEN_W - GRID_PAD * 2 - GRID_GAP) / 2;

interface Props {
  visible:      boolean;
  onClose:      () => void;
  hostId:       string | null | undefined;
  hostUsername: string | null | undefined;
}

export function HostShopSheet({ visible, onClose, hostId, hostUsername }: Props) {
  const router = useRouter();
  const { products, isLoading } = useHostShopProducts(hostId);

  const handlePress = useCallback((p: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
    // Kleines Delay für smoothere Sheet-Close Animation vor Navigation
    setTimeout(() => {
      router.push({ pathname: '/shop/[id]', params: { id: p.id } } as never);
    }, 120);
  }, [onClose, router]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

          <View style={styles.header}>
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <ShoppingBag size={16} color="#fff" strokeWidth={2.4} />
                <Text style={styles.title} numberOfLines={1}>
                  {hostUsername ? `Shop von @${hostUsername}` : 'Shop'}
                </Text>
                {products.length > 0 && (
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{products.length}</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <XIcon size={18} color="#fff" strokeWidth={2.4} />
              </Pressable>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#fbbf24" />
            </View>
          ) : products.length === 0 ? (
            <View style={styles.empty}>
              <Package size={40} color="rgba(255,255,255,0.35)" strokeWidth={1.4} />
              <Text style={styles.emptyTitle}>Keine Produkte</Text>
              <Text style={styles.emptyText}>
                {hostUsername ? `@${hostUsername}` : 'Der Host'} hat aktuell keine
                Produkte im Shop.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            >
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onPress={() => handlePress(p)} />
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Produkt-Karte ──────────────────────────────────────────────────────────

function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const isSoldOut = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 3;

  return (
    <Pressable
      onPress={onPress}
      disabled={isSoldOut}
      style={({ pressed }) => [
        card.wrap,
        { opacity: isSoldOut ? 0.55 : pressed ? 0.78 : 1 },
      ]}
    >
      <View style={card.imgWrap}>
        {product.cover_url ? (
          <Image source={product.cover_url} style={card.img} contentFit="cover" />
        ) : (
          <View style={[card.img, card.imgFallback]}>
            <ShoppingBag size={30} color="rgba(255,255,255,0.3)" strokeWidth={1.2} />
          </View>
        )}

        {isSoldOut && (
          <View style={card.soldOut}>
            <Text style={card.soldOutText}>Ausverkauft</Text>
          </View>
        )}
        {isLowStock && !isSoldOut && (
          <View style={card.lowStock}>
            <Text style={card.lowStockText}>Nur {product.stock} übrig</Text>
          </View>
        )}
      </View>

      <View style={card.info}>
        <Text style={card.title} numberOfLines={2}>{product.title}</Text>
        <View style={card.footer}>
          <Text style={card.price}>
            🪙 {product.price_coins.toLocaleString('de-DE')}
          </Text>
          {product.sold_count > 0 && (
            <Text style={card.sold}>
              {product.sold_count >= 1000
                ? `${(product.sold_count / 1000).toFixed(1)}K`
                : product.sold_count}× verk.
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: SCREEN_H * 0.82,
    minHeight: SCREEN_H * 0.5,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,12,0.88)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  countPill: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countPillText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loading: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },

  grid: {
    padding: GRID_PAD,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingBottom: 36,
  },
});

const card = StyleSheet.create({
  wrap: {
    width: CARD_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  imgWrap: { position: 'relative' },
  img: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  imgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOut: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  soldOutText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  lowStock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(245,158,11,0.92)',
    paddingVertical: 5,
    alignItems: 'center',
  },
  lowStockText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  info: {
    padding: 10,
    gap: 5,
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  price: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '900',
  },
  sold: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
});

/**
 * components/live/LiveShoppingUI.tsx
 *
 * Zwei Komponenten fürs Live-Shopping:
 *
 *  1. PinnedProductPill  — Viewer: gepinntes Produkt unten anzeigen + Kaufen-Button
 *  2. ProductSoldBanner  — Alle: "🛍 @username hat X gekauft!" Animation
 *  3. LiveShopHostPanel  — Host: eigene Produkte auswählen + pinnen
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  FlatList, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import {
  ShoppingBag, X, ChevronRight, Package, FileText, Box, Wrench,
} from 'lucide-react-native';
import { impactAsync, notificationAsync, ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
import { useMyProducts, useBuyProduct, type Product } from '@/lib/useShop';
import { useCoinsWallet } from '@/lib/useGifts';
import type { PinnedProduct, ProductSoldEvent } from '@/lib/useLiveShopping';
import { useTheme } from '@/lib/useTheme';
import { useRouter } from 'expo-router';

// ─── 1. PinnedProductPill ─────────────────────────────────────────────────────
//
// Erscheint unten im Viewer-Screen wenn Host ein Produkt pinnt.

interface PinnedProductPillProps {
  product:       PinnedProduct;
  onBought:      (event: ProductSoldEvent) => void; // informiert Hook → Broadcast
  viewerUsername: string;
}

export function PinnedProductPill({ product, onBought, viewerUsername }: PinnedProductPillProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { coins } = useCoinsWallet();
  const { buyProduct, isBuying } = useBuyProduct();
  const [showConfirm, setShowConfirm] = useState(false);
  const [bought, setBought] = useState(false);

  const canAfford = coins >= product.price;

  const handleBuy = useCallback(async () => {
    setShowConfirm(false);
    const result = await buyProduct(product.productId);

    if (result.success) {
      await notificationAsync(NotificationFeedbackType.Success);
      setBought(true);
      onBought({
        productId:      product.productId,
        productTitle:   product.title,
        buyerUsername:  viewerUsername,
        quantity:       1,
      });
      // Reset nach 3s
      setTimeout(() => setBought(false), 3000);
    } else if (result.error === 'insufficient_coins') {
      Alert.alert(
        'Nicht genug Coins',
        'Coins jetzt aufladen?',
        [
          { text: 'Nein', style: 'cancel' },
          { text: 'Coins kaufen', onPress: () => router.push('/coin-shop' as any) },
        ]
      );
    } else {
      Alert.alert('Fehler', 'Kauf fehlgeschlagen.');
    }
  }, [buyProduct, product, onBought, viewerUsername, router]);

  const CatIcon = product.category === 'digital' ? FileText
    : product.category === 'physical' ? Box
    : Wrench;

  return (
    <>
      <Pressable
        style={s.pill}
        onPress={() => {
          if (bought) return;
          impactAsync(ImpactFeedbackStyle.Light);
          if (!canAfford) { router.push('/coin-shop' as any); return; }
          setShowConfirm(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${product.title} kaufen`}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Cover */}
        {product.coverUrl ? (
          <Image source={{ uri: product.coverUrl }} style={s.pillCover} contentFit="cover" />
        ) : (
          <View style={s.pillCoverPlaceholder}>
            <CatIcon size={18} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
          </View>
        )}

        {/* Info */}
        <View style={s.pillInfo}>
          <Text style={s.pillTitle} numberOfLines={1}>{product.title}</Text>
          <Text style={s.pillPrice}>🪙 {product.price.toLocaleString('de-DE')} Coins</Text>
        </View>

        {/* Aktion */}
        {bought ? (
          <View style={s.pillBoughtBadge}>
            <Text style={s.pillBoughtText}>✓ Gekauft!</Text>
          </View>
        ) : isBuying ? (
          <ActivityIndicator color="#fff" style={{ marginRight: 12 }} />
        ) : (
          <View style={[s.pillBuyBtn, { backgroundColor: !canAfford ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.95)' }]}>
            <Text style={[s.pillBuyText, { color: !canAfford ? '#fff' : '#000' }]}>
              {!canAfford ? 'Aufladen →' : 'Kaufen'}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Bestätigungs-Sheet */}
      <Modal visible={showConfirm} transparent animationType="slide" onRequestClose={() => setShowConfirm(false)}>
        <Pressable style={s.overlay} onPress={() => setShowConfirm(false)}>
          <View style={s.confirmSheet}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={s.confirmTitle}>{product.title}</Text>
            <Text style={s.confirmPrice}>🪙 {product.price.toLocaleString('de-DE')} Coins</Text>
            <Text style={s.confirmBalance}>
              Guthaben: {coins.toLocaleString('de-DE')} → {(coins - product.price).toLocaleString('de-DE')}
            </Text>
            <View style={s.confirmBtns}>
              <Pressable style={s.confirmCancel} onPress={() => setShowConfirm(false)}>
                <Text style={s.confirmCancelText}>Abbrechen</Text>
              </Pressable>
              <Pressable style={s.confirmBuy} onPress={handleBuy}>
                <Text style={s.confirmBuyText}>Jetzt kaufen</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── 2. ProductSoldBanner ─────────────────────────────────────────────────────
//
// Erscheint kurz wenn jemand ein Produkt kauft. Wie Gift-Banner.

interface ProductSoldBannerProps {
  events: ProductSoldEvent[];
}

export function ProductSoldBanner({ events }: ProductSoldBannerProps) {
  if (events.length === 0) return null;
  const latest = events[0];

  return (
    <View style={s.soldBanner} pointerEvents="none">
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={s.soldBannerIcon}>
        <Text style={{ fontSize: 18 }}>🛍</Text>
      </View>
      <View style={s.soldBannerText}>
        <Text style={s.soldBannerUser} numberOfLines={1}>@{latest.buyerUsername}</Text>
        <Text style={s.soldBannerProduct} numberOfLines={1}>{`hat "${latest.productTitle}" gekauft!`}</Text>
      </View>
      <Text style={s.soldBannerCoins}>🪙 {latest.quantity}</Text>
    </View>
  );
}

// ─── 3. LiveShopHostPanel ─────────────────────────────────────────────────────
//
// Host-Sheet: Eigene Produkte auswählen und pinnen/entpinnen

interface LiveShopHostPanelProps {
  visible:        boolean;
  onClose:        () => void;
  pinnedProductId?: string | null;
  onPin:          (product: PinnedProduct) => void;
  onUnpin:        (productId: string) => void;
}

export function LiveShopHostPanel({
  visible, onClose, pinnedProductId, onPin, onUnpin,
}: LiveShopHostPanelProps) {
  const { data: products = [], isLoading } = useMyProducts();
  const activeProducts = products.filter(p => p.is_active && p.stock !== 0);

  const handlePin = useCallback((product: Product) => {
    impactAsync(ImpactFeedbackStyle.Medium);
    if (product.id === pinnedProductId) {
      onUnpin(product.id);
    } else {
      onPin({
        productId: product.id,
        title:     product.title,
        price:     product.price_coins,
        coverUrl:  product.cover_url,
        category:  product.category,
      });
    }
    onClose();
  }, [pinnedProductId, onPin, onUnpin, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.hostSheet}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Header */}
          <View style={s.hostSheetHeader}>
            <Text style={s.hostSheetTitle}>Produkt pinnen</Text>
            <Pressable onPress={onClose} hitSlop={16}>
              <X size={20} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </Pressable>
          </View>

          {pinnedProductId && (
            <Pressable
              style={s.unpinBtn}
              onPress={() => { onUnpin(pinnedProductId); onClose(); }}
            >
              <X size={14} color="#EF4444" strokeWidth={2.5} />
              <Text style={s.unpinText}>Produkt entpinnen</Text>
            </Pressable>
          )}

          {isLoading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 30 }} />
          ) : activeProducts.length === 0 ? (
            <View style={s.hostEmpty}>
              <ShoppingBag size={32} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
              <Text style={s.hostEmptyText}>Keine aktiven Produkte.{'\n'}Erstelle zuerst Produkte in deinem Shop.</Text>
            </View>
          ) : (
            <FlatList
              data={activeProducts}
              keyExtractor={p => p.id}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />}
              renderItem={({ item }) => {
                const isPinned = item.id === pinnedProductId;
                return (
                  <Pressable
                    style={[s.hostProduct, isPinned && s.hostProductPinned]}
                    onPress={() => handlePin(item)}
                  >
                    {item.cover_url ? (
                      <Image source={{ uri: item.cover_url }} style={s.hostProductCover} contentFit="cover" />
                    ) : (
                      <View style={s.hostProductCoverPlaceholder}>
                        <ShoppingBag size={16} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                      </View>
                    )}
                    <View style={s.hostProductInfo}>
                      <Text style={s.hostProductTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={s.hostProductPrice}>🪙 {item.price_coins.toLocaleString('de-DE')}</Text>
                    </View>
                    {isPinned ? (
                      <View style={s.pinnedBadge}><Text style={s.pinnedBadgeText}>LIVE 📌</Text></View>
                    ) : (
                      <ChevronRight size={16} color="rgba(255,255,255,0.3)" strokeWidth={2} />
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Pill
  pill: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
  },
  pillCover: { width: 56, height: 56, marginLeft: 0, borderTopLeftRadius: 15, borderBottomLeftRadius: 15 },
  pillCoverPlaceholder: {
    width: 56, height: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pillInfo: { flex: 1 },
  pillTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pillPrice: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  pillBuyBtn: { marginRight: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  pillBuyText: { fontSize: 13, fontWeight: '800' },
  pillBoughtBadge: { marginRight: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#16A34A' },
  pillBoughtText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Confirm
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  confirmSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 10, alignItems: 'center', overflow: 'hidden',
  },
  confirmTitle:   { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  confirmPrice:   { color: '#FBBF24', fontSize: 26, fontWeight: '800' },
  confirmBalance: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  confirmBtns: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  confirmCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center',
  },
  confirmCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },
  confirmBuy: { flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#fff' },
  confirmBuyText: { color: '#000', fontSize: 15, fontWeight: '800' },

  // Sold Banner
  soldBanner: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  soldBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  soldBannerText:    { flex: 1 },
  soldBannerUser:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  soldBannerProduct: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  soldBannerCoins:   { color: '#FBBF24', fontSize: 12, fontWeight: '700' },

  // Host Panel
  hostSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', overflow: 'hidden',
  },
  hostSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  hostSheetTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  unpinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(239,68,68,0.3)',
  },
  unpinText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  hostEmpty: { padding: 40, alignItems: 'center', gap: 12 },
  hostEmptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  hostProduct: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  hostProductPinned: { backgroundColor: 'rgba(255,255,255,0.07)' },
  hostProductCover:   { width: 50, height: 50, borderRadius: 10 },
  hostProductCoverPlaceholder: {
    width: 50, height: 50, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  hostProductInfo: { flex: 1 },
  hostProductTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hostProductPrice: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  pinnedBadge: {
    backgroundColor: '#16A34A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  pinnedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

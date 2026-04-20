/**
 * components/live/ProductPlaceSheet.tsx
 *
 * v1.22.0 — Modal mit den eigenen Shop-Produkten des Hosts.
 *   Host tippt auf ein Produkt → es wird als Karte im Stream platziert
 *   (Default-Position, dann frei verschiebbar).
 *
 * Bereits platzierte Produkte sind in der Liste ausgegraut (und zeigen
 * stattdessen "platziert") — Double-Pin ist durch Unique-Index geblockt.
 */

import React from 'react';
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
import { X as XIcon, Package, Check } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useMyProducts, type Product } from '@/lib/useShop';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible:            boolean;
  onClose:            () => void;
  onPick:             (productId: string) => void;
  /** IDs der bereits platzierten Produkte — werden als "aktiv" gekennzeichnet. */
  alreadyPlacedIds?:  Set<string>;
}

export function ProductPlaceSheet({
  visible, onClose, onPick, alreadyPlacedIds,
}: Props) {
  const { data: products, isLoading } = useMyProducts();
  const activeProducts = (products ?? []).filter((p) => p.is_active);

  const handlePick = (p: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPick(p.id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

          <View style={styles.header}>
            <Text style={styles.title}>Produkt platzieren</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <XIcon size={18} color="#fff" strokeWidth={2.4} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#fbbf24" />
            </View>
          ) : activeProducts.length === 0 ? (
            <View style={styles.empty}>
              <Package size={36} color="rgba(255,255,255,0.45)" strokeWidth={1.6} />
              <Text style={styles.emptyTitle}>Keine aktiven Produkte</Text>
              <Text style={styles.emptyText}>
                Lege im Shop ein Produkt an, dann kannst du es hier im Live platzieren.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {activeProducts.map((p) => {
                const isPlaced = alreadyPlacedIds?.has(p.id) ?? false;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => !isPlaced && handlePick(p)}
                    disabled={isPlaced}
                    style={({ pressed }) => [
                      styles.row,
                      { opacity: isPlaced ? 0.55 : pressed ? 0.7 : 1 },
                    ]}
                  >
                    {p.cover_url ? (
                      <Image source={p.cover_url} style={styles.rowCover} contentFit="cover" />
                    ) : (
                      <View style={[styles.rowCover, styles.rowCoverPlaceholder]}>
                        <Package size={22} color="rgba(255,255,255,0.45)" />
                      </View>
                    )}
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.rowPrice}>
                        {p.price_coins.toLocaleString('de-DE')} Coins
                      </Text>
                    </View>
                    {isPlaced ? (
                      <View style={styles.placedBadge}>
                        <Check size={14} color="#34d399" strokeWidth={2.8} />
                        <Text style={styles.placedBadgeText}>platziert</Text>
                      </View>
                    ) : (
                      <Text style={styles.placeHint}>Tippen</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: SCREEN_H * 0.72,
    minHeight: SCREEN_H * 0.42,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,12,0.85)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
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
    paddingVertical: 40,
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
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
    gap: 12,
  },
  rowCover: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  rowPrice: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  placeHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
  placedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  placedBadgeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

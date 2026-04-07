/**
 * components/live/GiftPicker.tsx
 *
 * Bottom-Sheet Modal: Geschenk-Auswahl während eines Livestreams.
 * Zeigt Coin-Balance + Geschenk-Katalog.
 * Sendet via useSendGift (atomic Supabase RPC).
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GIFT_CATALOG, formatCoins, type GiftItem } from '@/lib/gifts';
import { useCoinsWallet, useSendGift } from '@/lib/useGifts';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface GiftPickerProps {
  visible:         boolean;
  onClose:         () => void;
  recipientId:     string;
  recipientName:   string;
  liveSessionId:   string;
  onGiftSent?:     (giftId: string) => void;
}

// ─── Einzelne Gift-Karte ─────────────────────────────────────────────────────

function GiftCard({
  gift,
  selected,
  canAfford,
  onPress,
}: {
  gift: GiftItem;
  selected: boolean;
  canAfford: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={canAfford ? onPress : undefined}
      style={[
        styles.giftCard,
        selected && styles.giftCardSelected,
        !canAfford && styles.giftCardDisabled,
      ]}
    >
      <Text style={styles.giftEmoji}>{gift.emoji}</Text>
      <Text style={styles.giftName}>{gift.name}</Text>
      <View style={styles.giftCost}>
        <Text style={styles.coinIcon}>🪙</Text>
        <Text style={[styles.giftCostText, !canAfford && styles.giftCostTextDisabled]}>
          {formatCoins(gift.coinCost)}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function GiftPicker({
  visible,
  onClose,
  recipientId,
  recipientName,
  liveSessionId,
  onGiftSent,
}: GiftPickerProps) {
  const insets = useSafeAreaInsets();
  const { coins, loading: walletLoading, refetch } = useCoinsWallet();
  const { sendGift, isSending } = useSendGift();
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);

  const handleSend = useCallback(async () => {
    if (!selectedGift || isSending) return;

    const result = await sendGift(recipientId, liveSessionId, selectedGift.id);

    if (result.success) {
      refetch(); // Wallet aktualisieren
      onGiftSent?.(selectedGift.id);
      setSelectedGift(null);
      onClose();
    } else {
      const messages: Record<string, string> = {
        insufficient_coins: `Nicht genug Coins. Du hast ${formatCoins(coins)} Coins, benötigst ${formatCoins(selectedGift.coinCost)}.`,
        no_wallet:          'Wallet nicht gefunden. Bitte melde dich erneut an.',
        cannot_gift_yourself: 'Du kannst dir selbst keine Geschenke senden.',
        gift_not_found:     'Dieses Geschenk existiert nicht mehr.',
        network_error:      'Verbindungsfehler. Bitte versuche es erneut.',
      };
      Alert.alert('Fehler', messages[result.error] ?? 'Unbekannter Fehler');
    }
  }, [selectedGift, isSending, sendGift, recipientId, liveSessionId, onGiftSent, refetch, coins, onClose]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={() => { setSelectedGift(null); onClose(); }}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Geschenk senden</Text>
              <Text style={styles.subtitle}>an {recipientName}</Text>
            </View>
            {/* Coin Balance */}
            <View style={styles.balance}>
              {walletLoading ? (
                <ActivityIndicator size="small" color="#f59e0b" />
              ) : (
                <>
                  <Text style={styles.coinIconLarge}>🪙</Text>
                  <Text style={styles.balanceText}>{formatCoins(coins)}</Text>
                </>
              )}
              <Pressable style={styles.topUpBtn} onPress={() => Alert.alert('Coins kaufen', 'Apple IAP kommt in v1.3 👀')}>
                <Text style={styles.topUpText}>+ Coins</Text>
              </Pressable>
            </View>
          </View>

          {/* Gift Grid */}
          <FlatList
            data={GIFT_CATALOG}
            numColumns={4}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <GiftCard
                gift={item}
                selected={selectedGift?.id === item.id}
                canAfford={coins >= item.coinCost}
                onPress={() => setSelectedGift(item)}
              />
            )}
          />

          {/* Send Button */}
          <Pressable
            onPress={handleSend}
            disabled={!selectedGift || isSending}
            style={[styles.sendBtnWrapper, (!selectedGift || isSending) && styles.sendBtnDisabled]}
          >
            <LinearGradient
              colors={selectedGift ? ['#f43f5e', '#ec4899'] : ['#374151', '#374151']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendBtn}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>
                  {selectedGift
                    ? `${selectedGift.emoji} Senden — 🪙 ${formatCoins(selectedGift.coinCost)}`
                    : 'Geschenk auswählen'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coinIconLarge: {
    fontSize: 18,
  },
  balanceText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '700',
  },
  topUpBtn: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  topUpText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    gap: 10,
    paddingBottom: 16,
  },
  giftCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    margin: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  giftCardSelected: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244,63,94,0.15)',
  },
  giftCardDisabled: {
    opacity: 0.4,
  },
  giftEmoji: {
    fontSize: 30,
    marginBottom: 6,
  },
  giftName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  giftCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  coinIcon: {
    fontSize: 10,
  },
  giftCostText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
  },
  giftCostTextDisabled: {
    color: '#6b7280',
  },
  sendBtnWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  sendBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

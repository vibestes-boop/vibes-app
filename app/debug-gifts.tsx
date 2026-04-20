/**
 * app/debug-gifts.tsx — Geschenk-Test Screen
 * Testet die GiftAnimation direkt (ohne Broadcast-Infrastruktur).
 * Zugang: Settings → "Serlo v1.6.0" 7x tippen
 */

import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Zap } from 'lucide-react-native';
import { GiftAnimation } from '@/components/live/GiftAnimation';
import { useCoinsWallet } from '@/lib/useGifts';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { GIFT_CATALOG, GIFT_BY_ID, type GiftItem } from '@/lib/gifts';
import type { IncomingGift } from '@/lib/useGifts';

const DEBUG_SESSION_ID = 'debug-gift-test-session-001';

const SCREEN_W = 390; // approximation for burst positions

export default function DebugGiftsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [log, setLog] = useState<string[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  // Lokale Animations-Queue — direkt ohne Broadcast
  const [localGifts, setLocalGifts] = useState<IncomingGift[]>([]);

  const { coins, diamonds, loading: walletLoading, refetch } = useCoinsWallet();

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('de-DE');
    setLog((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 30));
  };

  useEffect(() => {
    addLog(`Bereit. User: @${profile?.username ?? '?'}`);
  }, []);

  const addCoins = async () => {
    if (!profile?.id) return;
    addLog('Lade Coins...');
    const { data, error } = await supabase.rpc('add_test_coins', {
      p_user_id: profile.id, p_coins: 10000, p_diamonds: 100,
    });
    if (error || !data?.success) {
      addLog(`❌ ${error?.message ?? data?.error}`);
    } else {
      addLog('✅ +10.000 Coins aufgeladen!');
      refetch();
    }
  };

  // Lokale Animation triggern
  const triggerLocalAnimation = (gift: GiftItem) => {
    const burstPositions = gift.burstEmojis.map(() =>
      Math.random() * (SCREEN_W - 60) + 20
    );
    const incoming: IncomingGift = {
      id: `${Date.now()}-${Math.random()}`,
      senderName: profile?.username ?? 'Du',
      senderAvatar: profile?.avatar_url ?? undefined,
      gift,
      burstPositions,
      receivedAt: Date.now(),
      comboCount: 1,
      comboKey:   `debug-${gift.id}`,
    };
    setLocalGifts((prev) => [...prev, incoming]);
    // Auto-Remove: Premium (Video) nach 17s, Normal nach 4s
    const isPremium = gift.coinCost >= 750;
    setTimeout(() => {
      setLocalGifts((prev) => prev.filter((g) => g.id !== incoming.id));
    }, isPremium ? 17_000 : 4_000);
  };

  const sendGift = async (giftId: string, giftName: string) => {
    if (!profile?.id || sending) return;
    setSending(giftId);
    addLog(`Sende ${giftName}...`);

    const { data, error } = await supabase.rpc('debug_send_gift', {
      p_live_session_id: DEBUG_SESSION_ID,
      p_gift_id: giftId,
    });
    setSending(null);

    if (error) {
      addLog(`❌ RPC Fehler: ${error.message}`);
      return;
    }
    if (data?.error) {
      addLog(`❌ ${data.error}${data.needed ? ` (brauchst ${data.needed} Coins)` : ''}`);
      return;
    }

    addLog(`✅ ${data.gift} gesendet! Balance: ${data.new_balance}`);
    refetch();

    // Animation direkt lokal triggern (testet GiftAnimation-Komponente)
    const gift = GIFT_BY_ID[giftId];
    if (gift) {
      triggerLocalAnimation(gift);
      addLog(`🎬 Animation gestartet für ${gift.emoji} ${gift.name}`);
    }
  };

  return (
    <View style={s.root}>
      {/* Animation Overlay — ganz oben */}
      <GiftAnimation gifts={localGifts} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={20} color="#9CA3AF" strokeWidth={2} />
        </Pressable>
        <Text style={s.title}>🎁 Gift Debug</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Wallet */}
        <View style={s.card}>
          <Text style={s.cardTitle}>💰 Wallet</Text>
          {walletLoading ? <ActivityIndicator color="#FBBF24" /> : (
            <View style={s.walletRow}>
              <View style={s.walletItem}>
                <Text style={s.walletValue}>{coins.toLocaleString()}</Text>
                <Text style={s.walletLabel}>🪙 Coins</Text>
              </View>
              <View style={s.walletItem}>
                <Text style={[s.walletValue, { color: '#60A5FA' }]}>{diamonds.toLocaleString()}</Text>
                <Text style={s.walletLabel}>💎 Diamonds</Text>
              </View>
            </View>
          )}
          <Pressable style={s.coinsBtn} onPress={addCoins}>
            <Zap size={14} color="#FBBF24" strokeWidth={2} />
            <Text style={s.coinsBtnText}>+10.000 Test-Coins</Text>
          </Pressable>
        </View>

        {/* Geschenke */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🎮 Geschenk senden → Animation direkt testen</Text>
          <Text style={s.hint}>Tippe → Coins werden abgezogen + Animation erscheint sofort oben</Text>
          <View style={s.giftGrid}>
            {GIFT_CATALOG.map((g) => {
              const canAfford = coins >= g.coinCost;
              const isSend = sending === g.id;
              return (
                <Pressable
                  key={g.id}
                  style={[s.giftBtn, !canAfford && s.giftBtnDisabled]}
                  onPress={() => sendGift(g.id, g.name)}
                  disabled={!canAfford || !!sending}
                >
                  {isSend
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text style={s.giftEmoji}>{g.emoji}</Text>
                  }
                  <Text style={[s.giftName, !canAfford && { color: '#4B5563' }]}>{g.name}</Text>
                  <Text style={[s.giftCost, !canAfford && { color: '#4B5563' }]}>🪙 {g.coinCost}</Text>
                </Pressable>
              );
            })}
          </View>
          {coins === 0 && (
            <Text style={[s.hint, { color: '#EF4444' }]}>⚠️ Zuerst Coins aufladen!</Text>
          )}
        </View>

        {/* Aktive Animationen */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🎬 Aktive Animationen ({localGifts.length})</Text>
          {localGifts.length === 0
            ? <Text style={s.hint}>Keine aktiven Animationen</Text>
            : localGifts.map((g) => (
              <View key={g.id} style={s.receivedRow}>
                <Text style={{ fontSize: 24 }}>{g.gift.emoji}</Text>
                <Text style={s.receivedName}>{g.gift.name} läuft…</Text>
              </View>
            ))
          }
        </View>

        {/* Log */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📋 Log</Text>
          {log.length === 0
            ? <Text style={s.hint}>Keine Events</Text>
            : log.map((entry, i) => (
              <Text key={i} style={s.logEntry}>{entry}</Text>
            ))
          }
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050508' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 16, paddingBottom: 80 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, gap: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  walletRow: { flexDirection: 'row', gap: 32 },
  walletItem: { alignItems: 'center', gap: 2 },
  walletValue: { color: '#FBBF24', fontSize: 26, fontWeight: '800' },
  walletLabel: { color: '#6B7280', fontSize: 12 },
  coinsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(251,191,36,0.3)',
    alignSelf: 'flex-start',
  },
  coinsBtnText: { color: '#FBBF24', fontSize: 13, fontWeight: '600' },
  hint: { color: '#4B5563', fontSize: 11, lineHeight: 16 },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  giftBtn: {
    width: '30%', alignItems: 'center', gap: 4, padding: 12,
    backgroundColor: 'rgba(29,185,84,0.08)', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)',
  },
  giftBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  giftEmoji: { fontSize: 28 },
  giftName: { color: '#fff', fontSize: 11, fontWeight: '600' },
  giftCost: { color: '#6B7280', fontSize: 10 },
  receivedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  receivedName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: { color: '#374151', fontSize: 10, lineHeight: 14 },
});

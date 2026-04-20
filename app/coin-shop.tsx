/**
 * app/coin-shop.tsx — Serlo Coin Shop (Premium Design)
 * Eigener Stil: Cremig-hell, Gold-Akzent, dunkler Header, nicht TikTok-Kopie.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Alert, ScrollView, Image, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCoinsWallet } from '@/lib/useGifts';
import { supabase } from '@/lib/supabase';

const COIN_PACKAGES = [
  { id: 'com.vibesapp.vibes.coins_100',  coins: 100,  price: 0.99,  priceStr: '0,99 €', badge: null },
  { id: 'com.vibesapp.vibes.coins_500',  coins: 500,  price: 3.99,  priceStr: '3,99 €', badge: 'Beliebt' },
  { id: 'com.vibesapp.vibes.coins_1200', coins: 1200, price: 8.99,  priceStr: '8,99 €', badge: null,    savings: '25% mehr' },
  { id: 'com.vibesapp.vibes.coins_3000', coins: 3000, price: 19.99, priceStr: '19,99 €', badge: 'Top Wert', savings: '50% mehr' },
];

const BORZ_COIN = require('../assets/borz-coin.png');

export default function CoinShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coins, loading: walletLoading, refetch } = useCoinsWallet();
  const [selected, setSelected] = useState(COIN_PACKAGES[1].id);
  const [purchasing, setPurchasing] = useState(false);
  const [offerings, setOfferings] = useState<any>(null);
  const [iapAvailable, setIapAvailable] = useState(false);

  const coinSpin = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(coinSpin, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(coinSpin, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    initRevenueCat();
  }, []);

  const coinScale = coinSpin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });

  async function initRevenueCat() {
    try {
      const { Purchases } = require('react-native-purchases');
      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
      if (!apiKey) return;

      // User-ID aus Supabase Auth holen
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      Purchases.configure({ apiKey });

      // Supabase User ID an RevenueCat übergeben → Webhook kann User identifizieren
      if (userId) {
        await Purchases.logIn(userId);
      }

      const offs = await Purchases.getOfferings();
      setOfferings(offs);
      setIapAvailable(true);
    } catch { setIapAvailable(false); }
  }

  const selectedPkg = COIN_PACKAGES.find(p => p.id === selected)!;

  async function handleBuy() {
    if (!iapAvailable) {
      Alert.alert('Nur im App Store', 'Käufe sind nur im fertigen App Store Build verfügbar.');
      return;
    }
    setPurchasing(true);
    try {
      const { Purchases } = require('react-native-purchases');
      const pkg = offerings?.current?.availablePackages?.find(
        (p: any) => p.product.identifier === selected
      );
      if (!pkg) throw new Error('Nicht gefunden');
      await Purchases.purchasePackage(pkg);
      await new Promise(r => setTimeout(r, 1500));
      await refetch();
      Alert.alert('🎉 Danke!', `${selectedPkg.coins} Borz Coins wurden gutgeschrieben.`);
    } catch (err: any) {
      if (err?.userCancelled) return;
      Alert.alert('Fehler', 'Kauf konnte nicht abgeschlossen werden.');
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <View style={s.root}>
      {/* ── Clean Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={16}>
          <Text style={s.backIcon}>‹</Text>
        </Pressable>
        <Text style={s.headerTitle}>Coins aufladen</Text>
        <View style={s.balancePill}>
          <Image source={BORZ_COIN} style={{ width: 18, height: 18 }} />
          {walletLoading
            ? <ActivityIndicator size="small" color="#F5A623" />
            : <Text style={s.balanceText}>{coins.toLocaleString('de-DE')}</Text>
          }
        </View>
      </View>

      {/* ── Cream body ── */}
      <ScrollView
        style={s.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 130 }]}
      >
        <Animated.View style={{ opacity: fadeIn }}>
          {/* Coin hero */}
          <View style={s.heroArea}>
            <Animated.Image
              source={BORZ_COIN}
              style={[s.heroCoin, { transform: [{ scale: coinScale }] }]}
            />
            <Text style={s.heroTitle}>Borz Coins</Text>
            <Text style={s.heroSub}>Sende Geschenke an Creator im Livestream</Text>
          </View>

          {/* Section label */}
          <Text style={s.sectionLabel}>Paket wählen</Text>

          {/* Grid */}
          <View style={s.grid}>
            {COIN_PACKAGES.map((pkg) => {
              const isSel = selected === pkg.id;
              return (
                <Pressable
                  key={pkg.id}
                  style={[s.card, isSel && s.cardSelected]}
                  onPress={() => setSelected(pkg.id)}
                >
                  {pkg.badge && (
                    <View style={[s.badge, pkg.badge === 'Top Wert' && s.badgeGold]}>
                      <Text style={s.badgeText}>{pkg.badge}</Text>
                    </View>
                  )}
                  {/* Checkmark */}
                  {isSel && (
                    <View style={s.checkmark}>
                      <Text style={s.checkmarkText}>✓</Text>
                    </View>
                  )}
                  <Image source={BORZ_COIN} style={s.cardCoin} />
                  <Text style={[s.cardAmount, isSel && s.cardAmountSel]}>
                    {pkg.coins >= 1000 ? `${pkg.coins / 1000}K` : pkg.coins}
                  </Text>
                  <Text style={s.cardCoinsLabel}>Coins</Text>
                  {(pkg as any).savings && (
                    <View style={s.savingsTag}>
                      <Text style={s.savingsTagText}>{(pkg as any).savings}</Text>
                    </View>
                  )}
                  <Text style={[s.cardPrice, isSel && s.cardPriceSel]}>{pkg.priceStr}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Payment strip */}
          <View style={s.paySection}>
            <Text style={s.payLabel}>Zahlungsmethoden</Text>
            <View style={s.payRow}>
              <View style={[s.payChip, s.payApple]}>
                <Text style={[s.payChipText, { color: '#fff' }]}>🍎 Apple Pay</Text>
              </View>
              <View style={s.payChip}>
                <Text style={[s.payChipText, { color: '#EB001B', fontWeight: '900' }]}>MC</Text>
              </View>
              <View style={s.payChip}>
                <Text style={[s.payChipText, { color: '#1A1F71', fontStyle: 'italic', fontWeight: '900' }]}>VISA</Text>
              </View>
              <View style={[s.payChip, { backgroundColor: '#003087' }]}>
                <Text style={[s.payChipText, { color: '#fff' }]}>PayPal</Text>
              </View>
            </View>
            <View style={s.secureRow}>
              <Text style={s.secureText}>🔒 Sichere Zahlung über Apple In-App-Käufe</Text>
            </View>
          </View>

          {/* Restore */}
          <Pressable onPress={async () => {
            if (!iapAvailable) return;
            try {
              const { Purchases } = require('react-native-purchases');
              await Purchases.restorePurchases(); await refetch();
              Alert.alert('✅', 'Käufe wiederhergestellt.');
            } catch { Alert.alert('Fehler', 'Wiederherstellung fehlgeschlagen.'); }
          }} style={s.restoreBtn}>
            <Text style={s.restoreText}>Käufe wiederherstellen</Text>
          </Pressable>

          <Text style={s.legal}>
            Coins sind nicht erstattbar und nicht übertragbar. Nach Bestätigung sofort gutgeschrieben.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* ── Sticky Buy Bar ── */}
      <View style={[s.buyBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={s.totalRow}>
          <View style={{ gap: 2 }}>
            <Text style={s.totalLabel}>Gesamt</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Image source={BORZ_COIN} style={{ width: 16, height: 16 }} />
              <Text style={s.totalCoins}>{selectedPkg.coins.toLocaleString('de-DE')} Coins</Text>
            </View>
          </View>
          <Text style={s.totalPrice}>{selectedPkg.priceStr}</Text>
        </View>
        <Pressable
          style={[s.buyBtn, purchasing && { opacity: 0.65 }]}
          onPress={handleBuy}
          disabled={purchasing}
        >
          <LinearGradient colors={['#2D0050', '#1A0030']} style={s.buyBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {purchasing
              ? <ActivityIndicator color="#F5A623" />
              : (
                <>
                  <Image source={BORZ_COIN} style={{ width: 20, height: 20 }} />
                  <Text style={s.buyBtnText}>Kaufen · {selectedPkg.priceStr}</Text>
                </>
              )
            }
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const GOLD = '#F5A623';
const GOLD_LIGHT = '#FFF8E8';
const PURPLE_SEL = '#6B21A8';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF8F5' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
    backgroundColor: '#FAF8F5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFEFEF',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#1A1A1A', fontSize: 26, lineHeight: 30 },
  headerTitle: { flex: 1, color: '#1A1A1A', fontSize: 17, fontWeight: '700' },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF4DC',
    borderWidth: 1, borderColor: '#FFE0A0',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
  },
  balanceText: { color: '#8B6000', fontWeight: '800', fontSize: 13 },

  heroArea: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  heroCoin: { width: 72, height: 72, marginBottom: 4 },
  heroTitle: { color: '#1A1A1A', fontSize: 22, fontWeight: '800' },
  heroSub: { color: '#999', fontSize: 13 },

  body: { flex: 1 },
  scroll: { padding: 16 },

  sectionLabel: {
    color: '#333', fontSize: 13, fontWeight: '600',
    marginBottom: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 24,
  },
  card: {
    width: '47%', backgroundColor: '#fff',
    borderRadius: 16, borderWidth: 2, borderColor: '#EFEFEF',
    paddingVertical: 18, paddingHorizontal: 10,
    alignItems: 'center', gap: 3, overflow: 'visible',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardSelected: {
    borderColor: GOLD,
    backgroundColor: GOLD_LIGHT,
  },
  badge: {
    position: 'absolute', top: -11, alignSelf: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, zIndex: 1,
  },
  badgeGold: { backgroundColor: '#916A00' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  checkmark: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
  },
  checkmarkText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  cardCoin: { width: 38, height: 38, marginBottom: 4 },
  cardAmount: { color: '#1A1A1A', fontSize: 26, fontWeight: '800', lineHeight: 30 },
  cardAmountSel: { color: '#7C3AED' },
  cardCoinsLabel: { color: '#AAA', fontSize: 11 },
  cardPrice: { color: '#666', fontSize: 14, fontWeight: '600', marginTop: 4 },
  cardPriceSel: { color: '#7C3AED', fontWeight: '700' },

  savingsTag: {
    backgroundColor: '#DCFCE7', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, marginTop: 2,
  },
  savingsTagText: { color: '#15803D', fontSize: 10, fontWeight: '700' },

  paySection: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5',
    paddingTop: 20, marginBottom: 8,
  },
  payLabel: { color: '#333', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  payRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  payChip: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, alignItems: 'center',
  },
  payApple: { backgroundColor: '#000' },
  payChipText: { fontSize: 12, fontWeight: '700', color: '#333' },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secureText: { color: '#999', fontSize: 12 },

  restoreBtn: { alignItems: 'center', paddingVertical: 14 },
  restoreText: { color: '#AAA', fontSize: 13 },
  legal: {
    color: '#CCC', fontSize: 11, textAlign: 'center',
    lineHeight: 16, paddingHorizontal: 8,
  },

  buyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEE',
    paddingTop: 14, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  totalLabel: { color: '#999', fontSize: 12 },
  totalCoins: { color: '#1A1A1A', fontWeight: '700', fontSize: 14 },
  totalPrice: { color: '#1A1A1A', fontSize: 22, fontWeight: '800' },

  buyBtn: { borderRadius: 14, overflow: 'hidden' },
  buyBtnGrad: {
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

import { COIN_SHOP_ENABLED } from '@/lib/featureFlags';
/**
 * app/coin-shop.tsx — Serlo Coin Shop (Premium Design)
 * Eigener Stil: Cremig-hell, Gold-Akzent, dunkler Header, nicht Short-Video-Kopie.
 */

import { RollupNumber } from '@/components/ui/RollupNumber';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useCoinsWallet } from '@/lib/useGifts';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import React,{ useEffect,useRef,useState } from 'react';
import {
ActivityIndicator,
Alert,
Animated,
Image,
Pressable,
ScrollView,
StyleSheet,
Text,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COIN_PACKAGES = [
  { id: 'com.vibesapp.vibes.coins_100',  coins: 100,  price: 0.99,  priceStr: '0,99 €', badge: null },
  { id: 'com.vibesapp.vibes.coins_500',  coins: 500,  price: 3.99,  priceStr: '3,99 €', badge: 'Beliebt' },
  { id: 'com.vibesapp.vibes.coins_1200', coins: 1200, price: 8.99,  priceStr: '8,99 €', badge: null,    savings: '25% mehr' },
  { id: 'com.vibesapp.vibes.coins_3000', coins: 3000, price: 19.99, priceStr: '19,99 €', badge: 'Top Wert', savings: '50% mehr' },
];

const SERLO_COIN = require('../assets/serlo-coin.png');

// Deep-Link-Guard (App-Store-v1): Solange der Coin-Shop deaktiviert ist,
// führt auch ein direkter /coin-shop-Link nur zurück zum Profil — der Apple-
// Reviewer darf nirgends auf nicht-eingereichte IAP-Produkte stoßen.
// Wrapper-Pattern statt Early-Return im Screen, damit die Hook-Reihenfolge
// der eigentlichen Komponente unangetastet bleibt.
export default function CoinShopGate() {
  if (!COIN_SHOP_ENABLED) return <Redirect href={'/(tabs)/profile' as any} />;
  return <CoinShopScreen />;
}

function CoinShopScreen() {
  useThemedStatusBar('light');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
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
  }, [coinSpin, fadeIn]);

  const coinScale = coinSpin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });

  async function initRevenueCat() {
    try {
// eslint-disable-next-line @typescript-eslint/no-require-imports
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
      Alert.alert(t('coinshop.appStoreOnlyTitle'), t('coinshop.appStoreOnlyText'));
      return;
    }
    setPurchasing(true);
    try {
// eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Purchases } = require('react-native-purchases');
      const pkg = offerings?.current?.availablePackages?.find(
        (p: any) => p.product.identifier === selected
      );
      if (!pkg) throw new Error('Nicht gefunden');
      await Purchases.purchasePackage(pkg);
      await new Promise(r => setTimeout(r, 1500));
      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('coinshop.thanksTitle'), t('coinshop.credited', { coins: selectedPkg.coins }));
    } catch (err: unknown) {
      // err.userCancelled: RevenueCat setzt diesen Flag wenn User abbricht — kein Alert
      if ((err as Record<string, unknown>)?.userCancelled) return;

      // RevenueCat strukturierte Fehlercodes auswerten
      const rcCode = (err as Record<string, unknown>)?.code as number | undefined;
      // PurchasesErrorCode: 2 = NetworkError, 7 = PaymentPending
      if (rcCode === 2) {
        Alert.alert(
          t('coinshop.noConnTitle'),
          t('coinshop.noConnText'),
          [{ text: t('coinshop.retry'), onPress: handleBuy }, { text: t('common.cancel'), style: 'cancel' }]
        );
      } else if (rcCode === 7) {
        Alert.alert(
          t('coinshop.pendingTitle'),
          t('coinshop.pendingText')
        );
      } else {
        Alert.alert(
          t('coinshop.buyFailedTitle'),
          t('coinshop.buyFailedText'),
          [{ text: t('common.ok') }]
        );
      }
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
          <Image source={SERLO_COIN} style={{ width: 18, height: 18 }} />
          {walletLoading
            ? <ActivityIndicator size="small" color="#F5A623" />
            : <RollupNumber value={coins} style={s.balanceText} />
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
              source={SERLO_COIN}
              style={[s.heroCoin, { transform: [{ scale: coinScale }] }]}
            />
            <Text style={s.heroTitle}>Serlo Coins</Text>
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
                  <Image source={SERLO_COIN} style={s.cardCoin} />
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
                <Text style={[s.payChipText, { color: '#EB001B', fontWeight: '700' }]}>MC</Text>
              </View>
              <View style={s.payChip}>
                <Text style={[s.payChipText, { color: '#1A1F71', fontStyle: 'italic', fontWeight: '700' }]}>VISA</Text>
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
              const { Purchases } = require('react-native-purchases');
              await Purchases.restorePurchases(); await refetch();
              Alert.alert(t('coinshop.restoredTitle'), t('coinshop.restoredText'));
            } catch { Alert.alert(t('coinshop.restoreFailedTitle'), t('coinshop.restoreFailedText')); }
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
              <Image source={SERLO_COIN} style={{ width: 16, height: 16 }} />
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
                  <Image source={SERLO_COIN} style={{ width: 20, height: 20 }} />
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
  balanceText: { color: '#8B6000', fontWeight: '600', fontSize: 13 },

  heroArea: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  heroCoin: { width: 72, height: 72, marginBottom: 4 },
  heroTitle: { color: '#1A1A1A', fontSize: 22, fontWeight: '600' },
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
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },

  checkmark: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
  },
  checkmarkText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  cardCoin: { width: 38, height: 38, marginBottom: 4 },
  cardAmount: { color: '#1A1A1A', fontSize: 26, fontWeight: '600', lineHeight: 30 },
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
  totalPrice: { color: '#1A1A1A', fontSize: 22, fontWeight: '600' },

  buyBtn: { borderRadius: 14, overflow: 'hidden' },
  buyBtnGrad: {
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

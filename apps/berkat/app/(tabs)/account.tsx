// Konto — wer du bist und was noch offen ist.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Package } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import {
  formatCartWindow,
  formatEuro,
  useServerClock,
  useUsernames,
} from '../../lib/useAuction';
import { useCheckoutCart } from '../../lib/useCheckout';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { ui, radius, space } from '../../theme/tokens';

type OpenCart = {
  id: string;
  seller_id: string;
  closes_at: string;
  itemCount: number;
  totalCents: number;
};

/** Offene Sammelkörbe des Käufers — je Verkäufer einer, jeder wird ein Paket. */
function useMyCarts(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-carts', userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    // Diese Abfrage läuft nicht im Takt — ohne das hier stünde nach der
    // Rückkehr aus dem Stripe-Browser weiterhin „noch offen" da, obwohl längst
    // bezahlt ist. Die App-weite Verkabelung dafür sitzt im Wurzel-Layout.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<OpenCart[]> => {
      const { data: carts, error } = await supabase
        .from('auction_carts')
        .select('id, seller_id, closes_at')
        .eq('buyer_id', userId!)
        // `checkout_pending` gehört dazu: Der Korb ist eingefroren, weil er
        // schon zur Kasse getragen wurde — die Zahlung steht aber noch aus.
        // Ohne diesen Zustand fände niemand seine angefangene Zahlung wieder.
        .in('status', ['open', 'checkout_pending'])
        .order('closes_at', { ascending: true });
      if (error) throw error;

      const rows = (carts ?? []) as { id: string; seller_id: string; closes_at: string }[];
      if (rows.length === 0) return [];

      const { data: won, error: wonError } = await supabase
        .from('live_auctions')
        .select('cart_id, current_bid_cents')
        .in(
          'cart_id',
          rows.map((c) => c.id),
        )
        .eq('status', 'sold');
      if (wonError) throw wonError;

      const items = (won ?? []) as { cart_id: string; current_bid_cents: number | null }[];
      return rows.map((cart) => {
        const mine = items.filter((item) => item.cart_id === cart.id);
        return {
          ...cart,
          itemCount: mine.length,
          totalCents: mine.reduce((sum, item) => sum + (item.current_bid_cents ?? 0), 0),
        };
      });
    },
  });
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myUserId = useSession((s) => s.userId);
  const profile = useSession((s) => s.profile);
  const { serverNow } = useServerClock();

  const { data: carts = [], refetch: refetchCarts } = useMyCarts(myUserId);

  // Beim Öffnen des Reiters neu laden — nicht nur beim ersten Aufbauen.
  //
  // Expo Router hält die Reiter-Bildschirme dauerhaft aufgebaut. Wer „Konto"
  // einmal geöffnet hat, sieht beim Zurückwechseln denselben Stand von vorhin:
  // kein Aufbauen, kein Fokuswechsel der App, also kein Nachladen. Genau so
  // stand am 14.08. „Noch nichts gewonnen" da, während im Live-Raum schon
  // „2 Artikel · 1 Paket" angezeigt wurde — die Pakete waren da, die Abfrage
  // war nur alt.
  useFocusEffect(
    useCallback(() => {
      void refetchCarts();
    }, [refetchCarts]),
  );
  const sellerNames = useUsernames(carts.map((c) => c.seller_id));

  const checkout = useCheckoutCart();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pay = async (cartId: string) => {
    setPayingId(cartId);
    setNotice(null);
    const result = await checkout(cartId);
    setPayingId(null);
    if (!result.ok) setNotice(result.message);
  };

  if (!myUserId) {
    return (
      <View style={[styles.screen, styles.center, { padding: space.xl }]}>
        <BerkatMark size={40} color={ui.brand} />
        <Text style={styles.gateTitle}>Noch nicht angemeldet</Text>
        <Text style={styles.gateBody}>
          Mit deinem Serlo-Konto kannst du mitbieten, folgen und verkaufen.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryButtonText}>Anmelden</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.md,
        paddingBottom: insets.bottom + space.xl,
      }}
    >
      <View style={styles.profileRow}>
        <Avatar uri={profile?.avatar_url} name={profile?.username} size={56} ring />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.name}>
            {profile?.username ?? 'Dein Konto'}
          </Text>
          {profile?.women_only_verified ? (
            <View style={styles.wozBadge}>
              <Lock size={11} color={ui.successInk} />
              <Text style={styles.wozText}>Frauen-Only freigegeben</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Deine Pakete</Text>
      {carts.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Noch nichts gewonnen</Text>
          <Text style={styles.cardBody}>
            Alles, was du bei einem Verkäufer ersteigerst, sammelt sich 24 Stunden lang in einem
            Paket — damit du nicht dreimal Versand zahlst.
          </Text>
        </View>
      ) : (
        carts.map((cart) => (
          <View key={cart.id} style={styles.card}>
            <View style={styles.cartHead}>
              <Package size={17} color={ui.text} />
              <Text style={styles.cardTitle}>{sellerNames[cart.seller_id] ?? '…'}</Text>
              <Text style={styles.cartTotal}>{formatEuro(cart.totalCents)}</Text>
            </View>
            <Text style={styles.cardBody}>
              {cart.itemCount} {cart.itemCount === 1 ? 'Artikel' : 'Artikel'} · 1 Paket ·{' '}
              {formatCartWindow(cart.closes_at, serverNow)}
            </Text>

            <Pressable
              style={[styles.payButton, payingId === cart.id && styles.payButtonBusy]}
              disabled={payingId !== null}
              onPress={() => void pay(cart.id)}
              accessibilityRole="button"
              accessibilityLabel={`${formatEuro(cart.totalCents)} bezahlen`}
            >
              {payingId === cart.id ? (
                <ActivityIndicator color={ui.goldInk} />
              ) : (
                <Text style={styles.payButtonText}>
                  {formatEuro(cart.totalCents)} bezahlen
                </Text>
              )}
            </Pressable>
            <Text style={styles.payHint}>Versandadresse gibst du auf der Bezahlseite ein.</Text>
          </View>
        ))
      )}

      {notice ? (
        <Pressable style={styles.notice} onPress={() => setNotice(null)}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.signOut}
        onPress={() => void supabase.auth.signOut()}
        accessibilityRole="button"
      >
        <Text style={styles.signOutText}>Abmelden</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },

  gateTitle: { fontSize: 18, fontWeight: '700', color: ui.text, marginTop: space.sm },
  gateBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
    lineHeight: 20,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  name: { fontSize: 22, fontWeight: '700', color: ui.text },
  wozBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 5,
    backgroundColor: ui.success,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  wozText: { fontSize: 11, fontWeight: '700', color: ui.successInk },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: ui.textMuted, marginBottom: space.sm },
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    marginBottom: space.md,
    gap: 5,
  },
  cartHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: ui.text },
  cartTotal: { fontSize: 16, fontWeight: '700', color: ui.text },
  cardBody: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
  payButton: {
    marginTop: space.sm,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonBusy: { opacity: 0.6 },
  payButtonText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  payHint: { fontSize: 11, color: ui.textMuted, textAlign: 'center' },
  notice: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.live,
    padding: space.md,
    marginTop: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text },

  primaryButton: {
    backgroundColor: ui.gold,
    borderRadius: radius.pill,
    height: 50,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
  signOut: {
    marginTop: space.lg,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: ui.text },
});

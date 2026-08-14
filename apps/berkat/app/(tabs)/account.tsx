// Konto — wer du bist und was noch offen ist.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, Lock, MessageSquare, Package, Truck } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { buyerStatus, useMyOrders } from '../../lib/useMyOrders';
import { trackingUrl } from '../../lib/useSellerOrders';
import {
  formatCartWindow,
  formatEuro,
  useServerClock,
  useUsernames,
} from '../../lib/useAuction';
import { useCheckoutCart } from '../../lib/useCheckout';
import { useUnreadMessageCount } from '../../lib/useDirectMessages';
import { useMyReviews, useOrderReviewActions } from '../../lib/useOrderReview';
import { RatingStars } from '../../components/RatingStars';
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
  const { data: orders = [], refetch: refetchOrders } = useMyOrders(myUserId);
  const { data: unreadMessages = 0, refetch: refetchUnread } = useUnreadMessageCount(myUserId);

  // Bewerten: was ich schon abgegeben habe, damit dieselbe Bestellung nicht
  // zweimal nach Sternen fragt.
  const { data: myReviews = {} } = useMyReviews(myUserId, orders.map((o) => o.id));
  const { confirmDelivered, submitReview } = useOrderReviewActions(myUserId);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const confirmArrived = useCallback(
    async (orderId: string) => {
      setConfirmingId(orderId);
      const res = await confirmDelivered(orderId);
      setConfirmingId(null);
      if (!res.ok) setNotice(res.message);
    },
    [confirmDelivered],
  );

  const rate = useCallback(
    async (orderId: string, rating: number) => {
      const res = await submitReview(orderId, rating);
      setNotice(res.ok ? 'Danke — das hilft den Nächsten. ⭐' : res.message);
    },
    [submitReview],
  );

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
      void refetchOrders();
      void refetchUnread();
    }, [refetchCarts, refetchOrders, refetchUnread]),
  );
  const sellerNames = useUsernames([
    ...carts.map((c) => c.seller_id),
    ...orders.map((o) => o.seller_id),
  ]);

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
          Mit einem Konto kannst du mitbieten, folgen und verkaufen. Deins von
          Serlo gilt hier auch.
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

      {/* Der einzige Weg zu eingehenden Nachrichten. Steht über den Paketen,
          weil eine Frage des Verkäufers zur Lieferadresse dringender ist als
          ein Paket, das ohnehin 24 Stunden Zeit hat. */}
      <Pressable
        style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
        onPress={() => router.push('/messages')}
        accessibilityRole="button"
        accessibilityLabel="Nachrichten"
      >
        <MessageSquare size={19} color={ui.text} />
        <Text style={styles.linkLabel}>Nachrichten</Text>
        {unreadMessages > 0 ? (
          <View style={styles.linkBadge}>
            <Text style={styles.linkBadgeText}>
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </Text>
          </View>
        ) : null}
        <ChevronRight size={18} color={ui.textMuted} />
      </Pressable>

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

      {/* Was schon bezahlt ist. Steht bewusst UNTER den offenen Paketen —
          eine wartende Zahlung ist dringender als eine erledigte. */}
      {orders.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { marginTop: space.lg }]}>Gekauft</Text>
          {orders.map((order) => {
            const link = trackingUrl(order.tracking_carrier, order.tracking_number);
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cartHead}>
                  <Package size={17} color={ui.text} />
                  <Text style={styles.cardTitle}>{sellerNames[order.seller_id] ?? '…'}</Text>
                  <Text style={styles.cartTotal}>
                    {Number(order.amount_eur).toFixed(2).replace('.', ',')} €
                  </Text>
                </View>

                <Text style={styles.orderStatus}>{buyerStatus(order.status)}</Text>

                {/* Die Bestellung trägt nur eine Zusammenfassung wie „3 Artikel
                    aus der Live-Show". Was tatsächlich drin liegt, weiß nur der
                    Sammelkorb — und genau das will man hier sehen. */}
                {order.items.length > 0 ? (
                  <View style={styles.orderItems}>
                    {order.items.map((item, index) => (
                      <Text key={`${order.id}-${index}`} numberOfLines={1} style={styles.orderItem}>
                        · {item}
                      </Text>
                    ))}
                  </View>
                ) : order.title ? (
                  <Text style={styles.cardBody}>{order.title}</Text>
                ) : null}

                {order.tracking_number ? (
                  // Kennt `trackingUrl` den Zusteller nicht, gibt es keinen
                  // Verfolgungs-Link. Dann steht die Nummer als schlichter Text
                  // da statt als Knopf, der nichts tut — abtippen kann man sie
                  // trotzdem.
                  link ? (
                    <Pressable
                      style={styles.trackRow}
                      onPress={() => void Linking.openURL(link)}
                      accessibilityRole="button"
                      accessibilityLabel="Sendung verfolgen"
                    >
                      <Truck size={15} color={ui.brand} />
                      <Text style={styles.trackText}>
                        {order.tracking_carrier ?? 'Sendung'} · {order.tracking_number}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.trackRow}>
                      <Truck size={15} color={ui.textMuted} />
                      <Text style={styles.trackPlain}>
                        {order.tracking_carrier ?? 'Sendung'} · {order.tracking_number}
                      </Text>
                    </View>
                  )
                ) : order.status === 'paid' ? (
                  <Text style={styles.payHint}>
                    Sobald der Verkäufer packt, steht die Sendungsnummer hier.
                  </Text>
                ) : null}

                {/* Der Abschluss der Kette. Ohne diesen Knopf erreicht keine
                    Bestellung je `delivered` — und `submit_order_review`
                    verlangt genau das, also könnte niemand je bewertet werden. */}
                {order.status === 'shipped' ? (
                  <Pressable
                    style={styles.arrivedButton}
                    disabled={confirmingId === order.id}
                    onPress={() => void confirmArrived(order.id)}
                    accessibilityRole="button"
                  >
                    <Check size={16} color={ui.brand} />
                    <Text style={styles.arrivedText}>
                      {confirmingId === order.id ? 'Einen Moment …' : 'Ist angekommen'}
                    </Text>
                  </Pressable>
                ) : null}

                {order.status === 'delivered' ? (
                  myReviews[order.id] ? (
                    <View style={styles.reviewDone}>
                      <RatingStars value={myReviews[order.id]} size={16} readOnly />
                      <Text style={styles.reviewDoneText}>Danke für die Bewertung 🙏</Text>
                    </View>
                  ) : (
                    <View style={styles.reviewBox}>
                      <Text style={styles.reviewPrompt}>
                        Wie war der Kauf bei {sellerNames[order.seller_id] ?? 'diesem Verkäufer'}?
                      </Text>
                      <RatingStars
                        value={0}
                        onChange={(rating) => void rate(order.id, rating)}
                      />
                      <Text style={styles.reviewHint}>
                        Deine Sterne zählen in seinen Schnitt — den sehen alle, die seine Show
                        aufmachen.
                      </Text>
                    </View>
                  )
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

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

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    marginBottom: space.lg,
  },
  linkRowPressed: { opacity: 0.6 },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: ui.text },
  linkBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBadgeText: { fontSize: 11, fontWeight: '800', color: ui.goldInk },

  arrivedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.brand,
    marginTop: space.md,
  },
  arrivedText: { fontSize: 14, fontWeight: '700', color: ui.brand },

  reviewBox: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
    gap: space.sm,
  },
  reviewPrompt: { fontSize: 14, fontWeight: '600', color: ui.text },
  reviewHint: { fontSize: 11, color: ui.textMuted, lineHeight: 16 },
  reviewDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  reviewDoneText: { fontSize: 12, color: ui.textMuted },
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

  orderStatus: { fontSize: 13, fontWeight: '600', color: ui.success },
  orderItems: { gap: 2, marginTop: 2 },
  orderItem: { fontSize: 13, color: ui.textMuted },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.xs,
    paddingVertical: 6,
  },
  trackText: { fontSize: 13, fontWeight: '600', color: ui.brand },
  trackPlain: { fontSize: 13, fontWeight: '600', color: ui.textMuted },
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

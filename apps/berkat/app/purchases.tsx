import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, ChevronDown, Package } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useSession } from '../lib/session';
import { buyerStatus, useMyOrders } from '../lib/useMyOrders';
import { formatCartWindow, formatEuro, useUsernames } from '../lib/useAuction';
import { useMyCarts, useLiveSellers, useUnassignedWins, type OpenCart } from '../lib/usePurchases';
import { usePurchaseClock } from '../lib/usePurchaseClock';
import { canPayCart, usePurchaseStatus } from '../lib/usePurchaseStatus';
import { useCheckoutCart } from '../lib/useCheckout';
import { strikeNotice, useMyStrikes } from '../lib/useUnpaidStrikes';
import { shippingHint, useShippingLookup } from '../lib/useShipping';
import { useMyReviews } from '../lib/useOrderReview';
import { goBack } from '../lib/nav';
import { RatingStars } from '../components/RatingStars';
import { PurchaseStatusCard } from '../components/PurchaseStatusCard';
import { NavigationRow } from '../components/NavigationRow';
import { ui, radius, space } from '../theme/tokens';
import { PressFeedback } from '../components/PressFeedback';

export default function PurchasesScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const router = useRouter();
  const { auctionId } = useLocalSearchParams<{ auctionId?: string }>();
  const myUserId = useSession(s => s.userId);
  const { data: selectedPurchase, refetch: refetchPurchase } = usePurchaseStatus(auctionId, myUserId, isFocused);
  const selectedCartId = selectedPurchase?.cart?.id;
  const { data: carts = [], refetch: refetchCarts, isLoading: cartsLoading, isError: cartsError } = useMyCarts(myUserId, isFocused);
  const serverNow = usePurchaseClock(isFocused, carts.filter(c => ['open', 'checkout_pending'].includes(c.status)).map(c => c.closes_at));
  const { data: orders = [], refetch: refetchOrders, isLoading: ordersLoading, isError: ordersError } = useMyOrders(myUserId, isFocused);
  const { data: wins = [], refetch: refetchWins, isLoading: winsLoading, isError: winsError } = useUnassignedWins(myUserId, isFocused);
  const { data: strikeCount = 0 } = useMyStrikes(myUserId);
  const strikeText = strikeNotice(strikeCount);
  const { data: liveSellers } = useLiveSellers(carts.map(c => c.seller_id), isFocused);
  const { data: myReviews = {} } = useMyReviews(myUserId, orders.map(o => o.id));
  const sellerNames = useUsernames([...carts.map(c => c.seller_id), ...orders.map(o => o.seller_id)]);
  useFocusEffect(useCallback(() => {
    if (!myUserId) return;
    void refetchCarts({ cancelRefetch: false });
    void refetchOrders({ cancelRefetch: false });
    void refetchWins({ cancelRefetch: false });
  }, [myUserId, refetchCarts, refetchOrders, refetchWins]));
  const checkout = useCheckoutCart();
  const shippingFor = useShippingLookup();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expiredExpanded, setExpiredExpanded] = useState(false);
  const refreshPurchases = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchCarts(), refetchOrders(), refetchWins(), ...(auctionId ? [refetchPurchase()] : [])]);
    } finally {
      setRefreshing(false);
    }
  };
  const [payNotice, setPayNotice] = useState<{ cartId: string; message: string } | null>(null);

  const checkoutBusy = useRef(false);
  const startCheckout = async (cartId: string) => {
    const cart = carts.find(c => c.id === cartId);
    if (checkoutBusy.current || cartsError) return;
    if (!canPayCart(cart, serverNow()) || !cart?.itemCount) {
      setPayNotice({ cartId, message: 'Dieses Paket kann aktuell nicht bezahlt werden. Bitte lade den Stand neu.' });
      void refetchCarts();
      return;
    }
    checkoutBusy.current = true;
    setPayingId(cartId);
    setPayNotice(null);
    try {
      const result = await checkout(cartId);
      if (!result.ok) setPayNotice({ cartId, message: result.message });
    } finally {
      checkoutBusy.current = false;
      setPayingId(null);
    }
  };

  const isWindowClosed = (c: OpenCart) => !canPayCart(c, serverNow());
  const activeCarts: OpenCart[] = [];
  const expiredCarts: OpenCart[] = [];
  for (const cart of carts) {
    (isWindowClosed(cart) ? expiredCarts : activeCarts).push(cart);
  }

  activeCarts.sort((a, b) => Number(b.id === selectedCartId) - Number(a.id === selectedCartId));

  const pay = async (cartId: string) => {
    const cart = carts.find((c) => c.id === cartId);
    const sellerLive = cart ? liveSellers?.has(cart.seller_id) : false;

    if (!cart || cart.status !== 'open' || !sellerLive) {
      await startCheckout(cartId);
      return;
    }

    Alert.alert(
      'Der Verkäufer sendet noch',
      'Wenn du jetzt bezahlst, ist dieses Paket zu. Alles, was du danach in der Show '
        + 'gewinnst, kommt in ein neues — mit eigenem Versand.',
      [
        { text: 'Warten', style: 'cancel' },
        { text: 'Trotzdem bezahlen', onPress: () => void startCheckout(cartId) },
      ],
    );
  };

  // Eine Darstellung für offene und abgelaufene Pakete. Nur ihre Position
  // und Sichtbarkeit ändern sich; Frist, Zahlung und Hinweise bleiben gleich.
  const renderCart = (cart: OpenCart) => (
    <View key={cart.id} style={styles.card}>
      <View style={styles.cartHead}>
        <Package size={17} color={ui.text} />
        <Text style={styles.cardTitle}>{sellerNames[cart.seller_id] ?? '…'}</Text>
        <Text style={styles.cartTotal}>{formatEuro(cart.totalCents)}</Text>
      </View>
      <Text style={styles.cardBody}>
        {cart.itemCount} Artikel · 1 Paket ·{' '}
        {cart.status === 'cancelled' ? 'Abgebrochen' : isWindowClosed(cart) ? 'Zahlungsfenster geschlossen' : formatCartWindow(cart.closes_at, serverNow)}
      </Text>

      {cart.status === 'checkout_pending' && !isWindowClosed(cart) ? (
        <Text style={styles.cartFrozen}>
          Zum Bezahlen vorgemerkt — dieses Paket nimmt nichts mehr auf. Was du danach
          gewinnst, kommt in ein neues, mit eigenem Versand.
        </Text>
      ) : null}

      {cart.items.length > 0 ? (
        <View style={styles.cartItems}>
          {cart.items.slice(0, 6).map((item) => (
            <PressFeedback kind="card"
              key={`${cart.id}-${item.id}`}
              style={[styles.cartRow]}
              onPress={() => router.push(`/listing/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} ansehen`}
            >
              <View style={styles.cartThumb}>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <Package size={16} color={ui.textMuted} />
                )}
              </View>
              <Text numberOfLines={2} style={styles.cartItemTitle}>
                {item.title}
              </Text>
              {item.price_cents !== null ? (
                <Text style={styles.cartItemPrice}>{formatEuro(item.price_cents)}</Text>
              ) : null}
              <ChevronRight size={16} color={ui.textMuted} />
            </PressFeedback>
          ))}
          {cart.items.length > 6 ? (
            <Text style={styles.cartMoreText}>
              +{cart.items.length - 6} weitere im Paket
            </Text>
          ) : null}
        </View>
      ) : null}

      {!isWindowClosed(cart) ? <PressFeedback
        style={[
          styles.payButton,
          payingId === cart.id && styles.payButtonBusy,
        ]}
        disabled={payingId !== null || cartsError || cart.itemCount === 0}
        onPress={() => void pay(cart.id)}
        accessibilityRole="button"
        accessibilityState={{ disabled: payingId !== null || cartsError || cart.itemCount === 0, busy: payingId === cart.id }}
        accessibilityLabel={
          cart.status === 'checkout_pending'
            ? `Bezahlen fortsetzen, ${formatEuro(cart.totalCents)}`
            : `${formatEuro(cart.totalCents)} bezahlen`
        }
      >
        {payingId === cart.id ? (
          <ActivityIndicator color={ui.goldInk} />
        ) : (
          <Text style={styles.payButtonText}>
            {cart.status === 'checkout_pending'
                ? `Bezahlen fortsetzen · ${formatEuro(cart.totalCents)}`
                : `${formatEuro(cart.totalCents)} bezahlen`}
          </Text>
        )}
      </PressFeedback> : null}

      <Text style={styles.payHint}>
        {isWindowClosed(cart)
          ? 'Dieses Paket ist geschlossen. Bei Fragen kannst du den Verkäufer über den Artikel kontaktieren.'
          : [shippingHint(shippingFor(cart.seller_id, cart.shippingTier)), 'Adresse gibst du auf der Bezahlseite ein.']
              .filter(Boolean)
              .join(' · ')}
      </Text>

      {payNotice?.cartId === cart.id ? (
        <PressFeedback onPress={() => setPayNotice(null)} style={styles.notice}>
          <Text style={styles.noticeText}>{payNotice.message}</Text>
        </PressFeedback>
      ) : null}

      {cart.status === 'open' && !isWindowClosed(cart) ? (
        <Text style={styles.payHint}>
          Was du in dieser Zeit noch bei {sellerNames[cart.seller_id] ?? 'diesem Verkäufer'}{' '}
          kaufst, kommt in dasselbe Paket — ein Versand.
        </Text>
      ) : null}
    </View>
  );

  return <View style={[styles.screen, { paddingTop: insets.top }]}>
    <View style={styles.purchaseHeader}>
      <PressFeedback onPress={() => goBack('/(tabs)/activity')} style={styles.back} accessibilityRole="button" accessibilityLabel="Zurück"><ChevronLeft size={24} color={ui.text} /></PressFeedback>
      <Text style={styles.purchaseTitle} accessibilityRole="header">Meine Käufe</Text>
    </View>
    {!myUserId ? <View style={[styles.center, { flex: 1, padding: space.xl }]}>
      <Package size={32} color={ui.brand} /><Text style={styles.gateTitle}>Deine Käufe an einem Ort</Text>
      <Text style={styles.gateBody}>Melde dich an, um deine Zuschläge, offenen Pakete und Bestellungen zu sehen.</Text>
      <PressFeedback style={styles.primaryButton} onPress={() => router.push('/login')} accessibilityRole="button"><Text style={styles.primaryButtonText}>Anmelden</Text></PressFeedback>
    </View> : <ScrollView style={styles.screen} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshPurchases()} tintColor={ui.brand} />}>
      <View key={fontScale}>
      {auctionId ? <PurchaseStatusCard auctionId={auctionId} userId={myUserId}
        localPackage={cartsError ? 'error' : cartsLoading ? 'loading' : activeCarts.some(c => c.id === selectedCartId) ? 'visible' : 'missing'}
        onRefreshPackage={() => void refetchCarts()} /> : null}
      {strikeText ? (
        <View style={[styles.card, styles.strikeCard]}>
          <Text style={styles.strikeTitle}>{strikeText.title}</Text>
          <Text style={styles.cardBody}>{strikeText.body}</Text>
        </View>
      ) : null}

      <Text accessibilityRole="header" style={styles.sectionLabel}>Deine Pakete</Text>
      {cartsLoading ? (
        <View style={styles.loadState}>
          <ActivityIndicator color={ui.brand} />
          <Text style={styles.cardBody}>Deine Pakete werden geladen …</Text>
        </View>
      ) : null}
      {cartsError ? (
        <View style={styles.card}>
          <Text style={styles.stateTitle}>Pakete gerade nicht erreichbar</Text>
          <Text style={styles.cardBody}>Lade sie noch einmal, damit du den aktuellen Stand siehst.</Text>
          <PressFeedback style={styles.retryButton} onPress={() => void refetchCarts()} accessibilityRole="button">
            <Text style={styles.retryText}>Erneut laden</Text>
          </PressFeedback>
        </View>
      ) : null}
      {!cartsLoading && !cartsError && activeCarts.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Package size={24} color={ui.brand} /></View>
          <View style={styles.emptyCopy}>
            <Text style={styles.stateTitle}>
              {expiredCarts.length > 0 ? 'Aktuell kein Paket offen' : 'Platz für deine nächsten Funde'}
            </Text>
            <Text style={styles.cardBody}>
              {expiredCarts.length > 0
                ? 'Deine geschlossenen Pakete findest du weiter unten.'
                : 'Hier sammelst und bezahlst du deine offenen Artikel. Ein Paket bleibt bis zu 24 Stunden offen.'}
            </Text>
          </View>
        </View>
      ) : null}
      {activeCarts.map(renderCart)}

      {ordersLoading || ordersError || orders.length > 0 ? (
        <>
          <Text accessibilityRole="header" style={styles.sectionLabel}>Gekauft</Text>
          {ordersLoading ? (
            <View style={styles.loadState}>
              <ActivityIndicator color={ui.brand} />
              <Text style={styles.cardBody}>Deine Käufe werden geladen …</Text>
            </View>
          ) : null}
          {ordersError ? (
            <View style={styles.card}>
              <Text style={styles.stateTitle}>Deine Käufe fehlen gerade</Text>
              <Text style={styles.cardBody}>Versuche es noch einmal. Deine Bestellungen bleiben erhalten.</Text>
              <PressFeedback style={styles.retryButton} onPress={() => void refetchOrders()} accessibilityRole="button">
                <Text style={styles.retryText}>Erneut laden</Text>
              </PressFeedback>
            </View>
          ) : null}
          {orders.map((order) => {
            return (
              // Die ganze Karte führt auf die Detailseite. Sie bleibt eine
              // Zusammenfassung — Adresse, Bestellnummer und das große Bild
              // stehen dort. Bei zwanzig Bestellungen wäre alles inline genau
              // die Wand, die der Verkaufen-Reiter am 16.08. war.
              <PressFeedback kind="card"
                key={order.id}
                style={[styles.card]}
                onPress={() => router.push(`/order/${order.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Bestellung bei ${sellerNames[order.seller_id] ?? 'Verkäufer'}, ${buyerStatus(order.status)}, ${order.items.map(item => item.title).join(', ') || order.title || ''} ansehen`}
              >
                <View style={styles.cartHead}>
                  <Package size={17} color={ui.text} />
                  <Text style={styles.cardTitle}>{sellerNames[order.seller_id] ?? '…'}</Text>
                  <Text style={styles.cartTotal}>
                    {Number(order.amount_eur).toFixed(2).replace('.', ',')} €
                  </Text>
                  <ChevronRight size={17} color={ui.textMuted} />
                </View>

                <Text style={styles.orderStatus}>{buyerStatus(order.status)}</Text>

                {order.items.length > 0 ? (
                  <View style={styles.orderItems}>
                    {order.items.map((item, index) => (
                      <View key={`${order.id}-${index}`} style={styles.orderItemRow}>
                        <View style={styles.orderThumb}>
                          {item.image_url ? (
                            <Image
                              source={{ uri: item.image_url }}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                              transition={120}
                            />
                          ) : (
                            <Package size={14} color={ui.textMuted} />
                          )}
                        </View>
                        <Text numberOfLines={2} style={styles.orderItem}>
                          {item.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : order.title ? (
                  <Text style={styles.cardBody}>{order.title}</Text>
                ) : null}

                {order.status === 'shipped' ? (
                  <Text style={styles.actionHint}>Angekommen? Hier eintragen →</Text>
                ) : order.status === 'delivered' && !myReviews[order.id] ? (
                  <Text style={styles.actionHint}>Noch nicht bewertet →</Text>
                ) : order.status === 'delivered' ? (
                  <View style={styles.reviewDone}>
                    <RatingStars value={myReviews[order.id]} size={15} readOnly />
                  </View>
                ) : order.tracking_number ? (
                  <Text style={styles.payHint}>
                    {order.tracking_carrier ?? 'Sendung'} · {order.tracking_number}
                  </Text>
                ) : (
                  <Text style={styles.payHint}>
                    Sobald der Verkäufer packt, steht die Sendungsnummer hier.
                  </Text>
                )}
              </PressFeedback>
            );
          })}
        </>
      ) : null}

      {expiredCarts.length > 0 ? (
        <View style={styles.expiredSection}>
          <PressFeedback
            style={[styles.expiredToggle]}
            onPress={() => setExpiredExpanded((expanded) => !expanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: expiredExpanded }}
            accessibilityLabel={`Letzte geschlossene Pakete, ${expiredCarts.length}`}
          >
            <Package size={20} color={ui.textMuted} />
            <View style={styles.linkCopy}>
              <Text style={styles.linkLabel}>Letzte geschlossene Pakete ({expiredCarts.length})</Text>
              <Text style={styles.linkHint}>Abgelaufen oder abgebrochen</Text>
            </View>
            {expiredExpanded ? <ChevronDown size={18} color={ui.textMuted} /> : <ChevronRight size={18} color={ui.textMuted} />}
          </PressFeedback>
          {expiredExpanded ? expiredCarts.map(renderCart) : null}
        </View>
      ) : null}

      {winsLoading || winsError || wins.length > 0 ? <View style={{ gap: space.sm }}>
        <Text style={styles.sectionLabel} accessibilityRole="header">Weitere Zuschläge</Text>
        {winsLoading ? <ActivityIndicator color={ui.brand} /> : winsError ? <NavigationRow title="Zuschläge erneut laden" detail="Dieser Bereich ist gerade nicht erreichbar." Icon={Package} onPress={() => void refetchWins()} /> : wins.map(w => <NavigationRow key={w.id} title={w.title} detail="Artikel und Abwicklung ansehen" Icon={Package} onPress={() => router.push(`/listing/${w.id}`)} />)}
      </View> : null}
      </View>
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  purchaseHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.sm },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  purchaseTitle: { flex: 1, fontSize: 24, lineHeight: 30, fontWeight: '800', color: ui.text },
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  gateTitle: { fontSize: 22, fontWeight: '700', color: ui.text, marginTop: space.sm },
  gateBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
    lineHeight: 20,
  },

  sectionLabel: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: ui.text, marginTop: space.md, marginBottom: space.md },
  expiredSection: { marginTop: space.xs, marginBottom: space.md },
  expiredToggle: { minHeight: 64, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  emptyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, backgroundColor: ui.card, borderRadius: radius.lg, marginBottom: space.md },
  emptyIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: ui.bg, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { flex: 1, minWidth: 0, gap: 5 },
  stateTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.text },
  loadState: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg, marginBottom: space.md },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, marginTop: space.xs, backgroundColor: ui.bg, borderRadius: radius.sm },
  retryText: { color: ui.brand, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  linkCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 3 },
  linkLabel: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text },
  linkHint: { fontSize: 12, lineHeight: 18, color: ui.textMuted },

  reviewDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  strikeCard: { borderColor: ui.live },
  strikeTitle: { fontSize: 15, fontWeight: '700', color: ui.live },
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
  cartItems: { gap: space.xs, marginTop: space.xs },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cartItemTitle: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.text },
  cartItemPrice: { fontSize: 14, fontWeight: '700', color: ui.text },
  cartThumb: {
    /* 4:5 wie jede Karte in dieser App — ein Quadrat schneidet hochkant
       fotografierte Ware oben und unten ab. */
    width: 48,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cartMoreText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: ui.textMuted, paddingVertical: space.xs },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: ui.text },
  // Rot wäre falsch — es ist kein Fehler, sondern eine Folge. Gedämpft, aber
  // nicht überlesbar: Sie erklärt einen zweiten Versandposten.
  cartFrozen: { fontSize: 12, color: ui.textMuted, marginTop: space.sm, lineHeight: 17 },
  cartTotal: { fontSize: 16, fontWeight: '700', color: ui.text },

  orderStatus: { fontSize: 13, fontWeight: '600', color: ui.success },
  // Kein Knopf, sondern ein Zeiger: Die Handlung liegt eine Ebene tiefer, und
  // der Pfeil sagt genau das.
  actionHint: { fontSize: 13, fontWeight: '700', color: ui.brand, marginTop: 2 },
  orderItems: { gap: 6, marginTop: space.sm },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  orderThumb: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orderItem: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19, color: ui.text },
  cardBody: { flexShrink: 1, fontSize: 13, color: ui.textMuted, lineHeight: 20 },
  payButton: {
    marginTop: space.sm,
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonBusy: { opacity: 0.6 },
  // ⚠️ Nicht bloss blasser, sondern GRAU. Ein abgeschwächtes Gold sieht aus
  // wie „lädt noch"; der Knopf ist aber endgültig tot, und das darf man ihm
  // ansehen, bevor man ihn antippt.
  payButtonText: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.goldInk, textAlign: 'center' },
  payHint: { fontSize: 12, lineHeight: 18, color: ui.textMuted, textAlign: 'center' },
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
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
});

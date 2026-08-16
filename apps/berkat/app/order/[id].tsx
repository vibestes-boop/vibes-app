// Eine Bestellung im Detail.
//
// WARUM ES DIESE SEITE GIBT
// Im Konto stand bis zum 16.08.2026 alles inline: Zustand, Artikel,
// Sendungsnummer, Adresse, Bewertungs-Sterne. Bei vier Bestellungen geht das.
// Bei zwanzig wird der Konto-Reiter exakt die Wand, die der Verkaufen-Reiter am
// selben Tag war — und die haben wir aus genau diesem Grund aufgeteilt.
//
// Whatnot macht es ebenso: Die Liste liegt unter Aktivität, ein Tipp öffnet
// eine eigene Bestell-Detailseite mit Sendungsverfolgung, Bestellnummer und
// Hilfe-Zugang (Help Center, „Find your order details").
//
// Und es ist der einzige Ort im Käufer-Bereich, an dem ein GROSSES Bild richtig
// ist. Nach der Regel aus Abschnitt 18: Die Übersicht beantwortet „wo ist mein
// Zeug" — Arbeitsfläche, kleine Vorschau. Hier ist der Artikel der Inhalt.

import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ChevronRight, Package, Truck } from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { buyerStatus, useMyOrder } from '../../lib/useMyOrders';
import { trackingUrl } from '../../lib/useSellerOrders';
import { useUsernames } from '../../lib/useAuction';
import { useMyReviews, useOrderReviewActions } from '../../lib/useOrderReview';
import { goBack } from '../../lib/nav';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { RatingStars } from '../../components/RatingStars';
import { ReviewSheet } from '../../components/ReviewSheet';
import { radius, space, ui } from '../../theme/tokens';

function euro(value: string | number): string {
  return `${Number(value).toFixed(2).replace('.', ',')} €`;
}

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: order, isLoading, refetch } = useMyOrder(id, myUserId);
  const sellerNames = useUsernames([order?.seller_id]);
  const orderIds = useMemo(() => (order ? [order.id] : []), [order]);
  const { data: myReviews = {} } = useMyReviews(myUserId, orderIds);
  const { confirmDelivered, submitReview } = useOrderReviewActions(myUserId);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const confirmArrived = useCallback(async () => {
    if (!order) return;
    setBusy(true);
    const res = await confirmDelivered(order.id);
    setBusy(false);
    if (!res.ok) setNotice(res.message);
    else void refetch();
  }, [order, confirmDelivered, refetch]);

  const rate = useCallback(
    async (rating: number, comment: string) => {
      if (!order) return;
      setBusy(true);
      const res = await submitReview(order.id, rating, comment);
      setBusy(false);
      setReviewing(null);
      setNotice(res.ok ? 'Danke — das hilft den Nächsten. ⭐' : res.message);
    },
    [order, submitReview],
  );

  if (isLoading || !order) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        {isLoading ? null : (
          <>
            <BerkatMark size={38} color={ui.sunken} />
            <Text style={styles.emptyTitle}>Diese Bestellung gibt es nicht</Text>
            <Text style={styles.emptyBody}>
              Vielleicht gehört sie zu einem anderen Konto.
            </Text>
          </>
        )}
      </View>
    );
  }

  const link = trackingUrl(order.tracking_carrier, order.tracking_number);
  const sellerName = sellerNames[order.seller_id] ?? 'Verkäufer';
  const hero = order.items.find((item) => item.image_url)?.image_url ?? null;
  const myRating = myReviews[order.id];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/account')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Bestellung</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
      >
        {/* Der Artikel groß — hier ist er der Inhalt und nicht die Zeile.
            Bei mehreren nimmt das große Bild den ersten, die übrigen stehen
            darunter als Liste; ein Raster aus drei Fotos beantwortet keine
            Frage, die man auf dieser Seite hat. */}
        <View style={styles.hero}>
          {hero ? (
            <Image
              source={{ uri: hero }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={160}
            />
          ) : (
            <Package size={34} color={ui.textMuted} />
          )}
        </View>

        <Text style={styles.status}>{buyerStatus(order.status)}</Text>
        <Text style={styles.total}>{euro(order.amount_eur)}</Text>
        <Text style={styles.meta}>
          {order.shipping_cents > 0
            ? `zzgl. ${euro(order.shipping_cents / 100)} Versand`
            : 'Versand inklusive'}
        </Text>

        <Pressable
          style={({ pressed }) => [styles.sellerRow, pressed && styles.pressed]}
          onPress={() => router.push(`/seller/${order.seller_id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Profil von ${sellerName}`}
        >
          <Avatar name={sellerName} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sellerLabel}>Verkäufer</Text>
            <Text numberOfLines={1} style={styles.sellerName}>
              {sellerName}
            </Text>
          </View>
          <ChevronRight size={18} color={ui.textMuted} />
        </Pressable>

        {order.items.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>
              {order.items.length === 1 ? 'Artikel' : `${order.items.length} Artikel`}
            </Text>
            <View style={styles.card}>
              {order.items.map((item, index) => (
                <View
                  key={`${order.id}-${index}`}
                  style={[styles.itemRow, index > 0 && styles.itemRowSplit]}
                >
                  <View style={styles.itemThumb}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={120}
                      />
                    ) : (
                      <Package size={15} color={ui.textMuted} />
                    )}
                  </View>
                  <Text numberOfLines={2} style={styles.itemTitle}>
                    {item.title}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Sendung */}
        <Text style={styles.sectionLabel}>Sendung</Text>
        <View style={styles.card}>
          {order.tracking_number ? (
            link ? (
              <Pressable
                style={styles.trackRow}
                onPress={() => void Linking.openURL(link)}
                accessibilityRole="button"
                accessibilityLabel="Sendung verfolgen"
              >
                <Truck size={17} color={ui.brand} />
                <Text style={styles.trackText}>
                  {order.tracking_carrier ?? 'Sendung'} · {order.tracking_number}
                </Text>
                <ChevronRight size={16} color={ui.brand} />
              </Pressable>
            ) : (
              // Kennt `trackingUrl` den Zusteller nicht, gibt es keinen Link.
              // Dann steht die Nummer als Text da statt als Knopf, der nichts
              // tut — abtippen kann man sie trotzdem.
              <View style={styles.trackRow}>
                <Truck size={17} color={ui.textMuted} />
                <Text style={styles.trackPlain}>
                  {order.tracking_carrier ?? 'Sendung'} · {order.tracking_number}
                </Text>
              </View>
            )
          ) : (
            <Text style={styles.cardBody}>
              {order.status === 'paid'
                ? 'Sobald der Verkäufer packt, steht die Sendungsnummer hier.'
                : 'Keine Sendungsnummer hinterlegt.'}
            </Text>
          )}

          {/* Der Abschluss der Kette. Ohne diesen Knopf erreicht keine
              Bestellung je `delivered` — und `submit_order_review` verlangt
              genau das, also könnte niemand je bewertet werden. */}
          {order.status === 'shipped' ? (
            <Pressable
              style={styles.arrivedButton}
              disabled={busy}
              onPress={() => void confirmArrived()}
              accessibilityRole="button"
            >
              <Check size={16} color={ui.brand} />
              <Text style={styles.arrivedText}>
                {busy ? 'Einen Moment …' : 'Ist angekommen'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Bewerten */}
        {order.status === 'delivered' ? (
          <>
            <Text style={styles.sectionLabel}>Bewertung</Text>
            <View style={styles.card}>
              {myRating ? (
                <View style={styles.reviewDone}>
                  <RatingStars value={myRating} size={18} readOnly />
                  <Text style={styles.cardBody}>Danke für die Bewertung 🙏</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.reviewPrompt}>Wie war der Kauf bei {sellerName}?</Text>
                  <RatingStars value={0} onChange={(value) => setReviewing(value)} />
                  <Text style={styles.cardBody}>
                    Deine Sterne zählen in seinen Schnitt — den sehen alle, die seine Show
                    aufmachen.
                  </Text>
                </>
              )}
            </View>
          </>
        ) : null}

        {/* Die Bestellnummer. Whatnot zeigt eine 9-stellige Order-ID für den
            Support; unsere ist eine UUID, deshalb nur der Anfang — er reicht,
            um eine Bestellung eindeutig zu benennen, und passt in eine Zeile. */}
        <Text style={styles.orderId}>Bestellung {order.id.slice(0, 8).toUpperCase()}</Text>

        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <ReviewSheet
        visible={reviewing !== null}
        sellerName={sellerName}
        initialRating={reviewing ?? 5}
        busy={busy}
        onClose={() => setReviewing(null)}
        onSubmit={(rating, comment) => void rate(rating, comment)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  pressed: { opacity: 0.6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  hero: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  status: { fontSize: 13, fontWeight: '700', color: ui.success, marginTop: space.lg },
  total: { fontSize: 28, fontWeight: '700', color: ui.text, marginTop: 2 },
  meta: { fontSize: 12, color: ui.textMuted, marginTop: 2 },

  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    marginTop: space.lg,
  },
  sellerLabel: { fontSize: 11, color: ui.textMuted },
  sellerName: { fontSize: 15, fontWeight: '700', color: ui.text },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ui.textMuted,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    gap: space.sm,
  },
  cardBody: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  itemRowSplit: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.line, paddingTop: space.sm },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemTitle: { flex: 1, fontSize: 14, color: ui.text },

  trackRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  trackText: { flex: 1, fontSize: 14, fontWeight: '700', color: ui.brand },
  trackPlain: { flex: 1, fontSize: 14, fontWeight: '600', color: ui.textMuted },

  arrivedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.brand,
    marginTop: space.xs,
  },
  arrivedText: { fontSize: 14, fontWeight: '700', color: ui.brand },

  reviewPrompt: { fontSize: 14, fontWeight: '600', color: ui.text },
  reviewDone: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  orderId: {
    fontSize: 11,
    color: ui.textMuted,
    textAlign: 'center',
    marginTop: space.xl,
    fontVariant: ['tabular-nums'],
  },

  notice: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    padding: space.md,
    marginTop: space.md,
  },
  noticeText: { fontSize: 13, color: ui.text, lineHeight: 19 },

  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 14, color: ui.textMuted, textAlign: 'center', lineHeight: 20 },
});

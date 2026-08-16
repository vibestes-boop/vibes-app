// Bestellungen — der einzige Verkäufer-Job mit einer Frist.
//
// WARUM ER EINEN EIGENEN BILDSCHIRM BEKOMMEN HAT
// Bis zum 16.08.2026 lag das im Verkaufen-Reiter ganz unten, nach zwei
// Formularen und dem Regal. Die Meldung „Bezahlt — bitte packen" führte auf
// `/(tabs)/sell`, also nach oben — der Verkäufer landete im Show-Formular und
// musste an allem vorbeiscrollen, um die Bestellung zu finden.
//
// Das ist teurer, als es aussieht: Die durchschnittliche Versandzeit ist eine
// der drei Kacheln auf seinem öffentlichen Profil. Jede Minute Sucherei zahlt
// er dort in Vertrauen.
//
// Die Regel aus `app/notifications.tsx` sagt es selbst: „Das Ziel ist der Ort,
// an dem man das TUN kann, was die Meldung sagt." Der ist jetzt hier.
//
// Trinkgeld steht mit auf dieser Seite, weil es dieselbe Frage beantwortet —
// was ist reingekommen — auch wenn dafür nichts zu packen ist.

import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Gift } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { formatEuro, useUsernames } from '../lib/useAuction';
import { orderErrorText, useMarkShipped, useSellerOrders } from '../lib/useSellerOrders';
import { useReceivedTips } from '../lib/useTip';
import { SellerOrders } from '../components/SellerOrders';
import { BerkatMark } from '../components/BerkatMark';
import { radius, space, ui } from '../theme/tokens';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: orders = [], refetch } = useSellerOrders(myUserId);
  const { data: tips = [], refetch: refetchTips } = useReceivedTips(myUserId);
  const tipperNames = useUsernames(tips.map((tip) => tip.sender_id));

  const markShipped = useMarkShipped(myUserId);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  // Stack-Bildschirme bleiben in Expo Router aufgebaut. Wer eine Sendung
  // einträgt, den Bildschirm verlässt und zurückkommt, sähe sonst den Stand
  // von vorhin (HANDOFF 3, eine Ebene tiefer).
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchTips();
    }, [refetch, refetchTips]),
  );

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([refetch(), refetchTips()]);
    } finally {
      setPulling(false);
    }
  }, [refetch, refetchTips]);

  // `markShipped` wirft im Fehlerfall, statt ein Ergebnis zurückzugeben —
  // deshalb try/catch und kein `res.ok`.
  const shipOrder = useCallback(
    async (orderId: string, carrier: string, tracking: string) => {
      setShippingId(orderId);
      setNotice(null);
      try {
        await markShipped(orderId, carrier, tracking);
        setNotice('Als versendet markiert — der Käufer bekommt eine Meldung. 📦');
        void refetch();
      } catch (error) {
        setNotice(orderErrorText(error instanceof Error ? error.message : String(error)));
      } finally {
        setShippingId(null);
      }
    },
    [markShipped, refetch],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Bestellungen</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
      >
        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        {/* Der grüne Balken mit „N warten aufs Packen" ist am 16.08.2026 wieder
            raus: Seit `SellerOrders` nach Zustand gruppiert, steht die Zahl
            schon in der Überschrift „Zu packen (N)" — und ein drittes Mal am
            Reiter-Abzeichen. Dreimal dieselbe Zahl ist keine Betonung, sondern
            Lärm. */}
        {orders.length === 0 ? (
          <View style={styles.empty}>
            <BerkatMark size={38} color={ui.sunken} />
            <Text style={styles.emptyTitle}>Noch keine Bestellung</Text>
            <Text style={styles.emptyBody}>
              Sobald jemand bezahlt hat, steht sie hier — mit Lieferadresse und einem Feld für die
              Sendungsnummer.
            </Text>
          </View>
        ) : (
          <SellerOrders orders={orders} busyId={shippingId} onShip={shipOrder} />
        )}

        {/* Trinkgeld kommt ohne Bestellung an. Ohne diese Liste wüsste ein
            Verkäufer nie, dass ihm jemand etwas dagelassen hat — und ein Danke,
            das niemand sieht, ist keins. */}
        {tips.length > 0 ? (
          <View style={{ marginTop: space.xl }}>
            <Text style={styles.sectionLabel}>Trinkgeld</Text>
            {tips.map((tip) => (
              <View key={tip.id} style={styles.tipRow}>
                <Gift size={17} color={ui.gold} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tipFrom}>{tipperNames[tip.sender_id] ?? '…'}</Text>
                  {tip.message ? (
                    <Text numberOfLines={2} style={styles.tipMessage}>
                      „{tip.message}"
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.tipAmount}>{formatEuro(tip.amount_cents)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },


  sectionLabel: { fontSize: 12, fontWeight: '600', color: ui.textMuted, marginBottom: space.sm },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    marginBottom: space.sm,
  },
  tipFrom: { fontSize: 14, fontWeight: '700', color: ui.text },
  tipMessage: { fontSize: 12, color: ui.textMuted, marginTop: 2, lineHeight: 17 },
  tipAmount: { fontSize: 15, fontWeight: '700', color: ui.text },

  notice: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    padding: space.md,
    marginBottom: space.md,
  },
  noticeText: { fontSize: 13, color: ui.text, lineHeight: 19 },

  empty: { alignItems: 'center', paddingTop: 72, gap: space.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  emptyBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    lineHeight: 20,
  },
});

// Preisvorschläge — was auf eine Antwort des Verkäufers wartet.
//
// ⚠️ WARUM ES DIESEN BILDSCHIRM GEBEN MUSSTE
// Der Preisvorschlag wurde am 18.08.2026 gebaut (HANDOFF 24), samt der
// bewussten Entscheidung, KEINEN neuen `notifications`-Typ dafür anzulegen —
// „ein Vorschlag ist nicht eilig genug". Richtig. Nur bekam er dadurch
// überhaupt keinen Ort:
//
//   • kein Push (bewusst)
//   • kein Eintrag in der Aktivität (nie gebaut)
//   • kein Abzeichen — obwohl `useOpenOfferCount` seit dem ersten Tag den
//     Kommentar „die Zahl für das Abzeichen" trägt und im ganzen Projekt genau
//     EINMAL vorkam: bei seiner eigenen Definition
//
// Ein Käufer schickte also einen Vorschlag, und der Verkäufer erfuhr es nur,
// wenn er zufällig genau diesen Artikel öffnete. Gefunden bei der Gesamtanalyse
// am 19.08.2026 — dieselbe Fehlerklasse wie die unsichtbare Beschreibung und
// `sellerKindNote()` ohne Aufrufer (HANDOFF 3).
//
// ⚠️ HIER WIRD NICHT GEANTWORTET, HIER WIRD GEFUNDEN.
// Annehmen, kontern und ablehnen bleiben im `OfferPanel` auf der Artikelseite —
// an EINER Stelle. Eine zweite Fassung derselben drei Knöpfe wäre exakt der
// Fehler, der bei den Angebots-Karten viermal auseinanderlief (HANDOFF 21), und
// diesmal an einer Stelle, an der über Geld entschieden wird.

import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Handshake } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { formatEuro, useUsernames } from '../lib/useAuction';
import { useSellerOffers, type SellerOffer } from '../lib/useOffers';
import { goBack } from '../lib/nav';
import { BerkatMark } from '../components/BerkatMark';
import { radius, space, ui } from '../theme/tokens';

/** „vor 3 Min", „vor 2 Std", „gestern" — wie in der Meldungsliste. */
function whenLabel(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std`;
  if (std < 48) return 'gestern';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export default function OffersScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: offers = [], refetch, isLoading } = useSellerOffers(myUserId);
  const buyerNames = useUsernames(offers.map((o) => o.buyer_id));
  const [pulling, setPulling] = useState(false);

  // Stack-Bildschirme bleiben aufgebaut (HANDOFF 3). Wer auf der Artikelseite
  // antwortet und zurückkommt, sähe hier sonst den Stand von vorhin.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  // Wer am Zug ist, entscheidet die Reihenfolge: `pending` wartet auf MICH,
  // `countered` auf den Käufer. Dieselbe Sortierregel wie bei „Überboten zuerst"
  // im Aktivitäts-Reiter (HANDOFF 39) — oben steht, was eine Handlung verlangt.
  const sorted = [...offers].sort(
    (a, b) => Number(a.status !== 'pending') - Number(b.status !== 'pending'),
  );
  const waiting = offers.filter((o) => o.status === 'pending').length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/sell')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Preisvorschläge</Text>
          {waiting > 0 ? (
            <Text style={styles.headerSub}>
              {waiting === 1 ? '1 wartet auf dich' : `${waiting} warten auf dich`}
            </Text>
          ) : null}
        </View>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
      >
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <BerkatMark size={36} color={ui.sunken} />
            <Text style={styles.emptyTitle}>
              {isLoading ? 'Wird geladen …' : 'Keine offenen Vorschläge'}
            </Text>
            <Text style={styles.emptyBody}>
              Wer handeln möchte, schickt dir hier einen Preis. Das geht nur bei Artikeln, an
              denen du „Preisvorschläge zulassen“ eingeschaltet hast.
            </Text>
          </View>
        ) : (
          sorted.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              buyer={buyerNames[offer.buyer_id]}
              onPress={() => router.push(`/listing/${offer.auction_id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function OfferRow({
  offer,
  buyer,
  onPress,
}: {
  offer: SellerOffer;
  buyer: string | undefined;
  onPress: () => void;
}) {
  const mine = offer.status === 'countered';
  // Der Betrag, um den es GERADE geht: beim Gegenvorschlag meiner, sonst seiner.
  const amount = mine ? (offer.counter_cents ?? offer.amount_cents) : offer.amount_cents;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${offer.title}, ${formatEuro(amount)} von ${buyer ?? 'jemandem'}`}
    >
      <View style={styles.thumb}>
        {offer.image_url ? (
          <Image
            source={{ uri: offer.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.title}>
          {offer.title}
        </Text>
        <View style={styles.amountRow}>
          <Text style={styles.amount}>{formatEuro(amount)}</Text>
          {/* Der Listenpreis daneben — ohne ihn sagt „35 €" nichts darüber,
              wie weit der Vorschlag vom Preis entfernt ist. */}
          {offer.buy_now_cents && offer.buy_now_cents !== amount ? (
            <Text style={styles.listPrice}>statt {formatEuro(offer.buy_now_cents)}</Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.meta}>
          {buyer ?? 'Jemand'} · {whenLabel(offer.created_at)}
        </Text>
      </View>

      {/* Gold heißt „du bist dran", grau „er ist dran". Die Farbe trägt hier
          die ganze Auskunft — sie ersetzt eine Spalte Text. */}
      <View style={[styles.pill, mine ? styles.pillWaiting : styles.pillDue]}>
        <Handshake size={11} color={mine ? ui.textMuted : ui.goldInk} />
        <Text style={[styles.pillText, mine ? styles.pillTextWaiting : styles.pillTextDue]}>
          {mine ? 'gekontert' : 'antworten'}
        </Text>
      </View>
      <ChevronRight size={16} color={ui.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: ui.text, textAlign: 'center' },
  headerSub: { fontSize: 12, color: ui.textMuted, textAlign: 'center', marginTop: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: ui.line,
    padding: space.md,
    marginBottom: space.sm,
  },
  // 48 Punkte: Hier wird gearbeitet, nicht gestöbert — die Größenregel aus
  // HANDOFF 18.
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  title: { fontSize: 14, fontWeight: '600', color: ui.text },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 1 },
  amount: { fontSize: 15, fontWeight: '700', color: ui.text },
  listPrice: { fontSize: 12, color: ui.textMuted, textDecorationLine: 'line-through' },
  meta: { fontSize: 11, color: ui.textMuted, marginTop: 2 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillDue: { backgroundColor: ui.gold },
  pillWaiting: { backgroundColor: ui.sunken },
  pillText: { fontSize: 10, fontWeight: '700' },
  pillTextDue: { color: ui.goldInk },
  pillTextWaiting: { color: ui.textMuted },

  empty: { alignItems: 'center', paddingVertical: space.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text, marginTop: space.sm },
  emptyBody: {
    fontSize: 13,
    color: ui.textMuted,
    textAlign: 'center',
    marginTop: space.xs,
    lineHeight: 19,
    paddingHorizontal: space.lg,
  },
});

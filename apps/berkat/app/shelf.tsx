// Das Regal — was ohne Show kaufbar bleibt.
//
// Lag bis zum 16.08.2026 im Verkaufen-Reiter zwischen Show-Regie und
// Bestellungen. Das war der Grund für eine Verwechslung, die beim ersten
// echten Gebrauch auffiel: Über dem Regal-Formular stand das Formular „Artikel
// auflegen" MIT Bild-Wähler, das Regal-Formular selbst hatte keinen — und es
// sah aus, als müsse man erst oben ein Bild wählen.
//
// Zwei Formulare direkt übereinander, die fast dasselbe tun aber verschiedene
// Ziele haben, sind eine Falle. Jetzt haben sie zwei Orte:
//
//   Verkaufen-Reiter → was JETZT in der Sendung passiert
//   dieser Bildschirm → was DAUERHAFT liegen bleibt
//
// Das Regal ist der ruhigere Job. Er hat keine Frist, aber er ist der einzige
// Grund, warum ein Fremder bei einem Verkäufer etwas tun kann, während der
// nicht sendet — also 94 % der Zeit (HANDOFF 17).

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { standingErrorText, useStandingActions } from '../lib/useStanding';
import { useSellerListings } from '../lib/useListings';
import { useMyListingViews } from '../lib/useListingViews';
import { useSavedCounts } from '../lib/useSaved';
import { LeftoverShelf } from '../components/LeftoverShelf';
import { StandingShelf } from '../components/StandingShelf';
import { radius, space, ui } from '../theme/tokens';

export default function ShelfScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const myProfile = useSession((s) => s.profile);

  const { data: standing = [], refetch } = useSellerListings(myUserId ?? undefined);
  const actions = useStandingActions(myUserId ?? undefined, myUserId);
  // ⚠️ Erst NACH `standing` — die Kennungen kommen aus der Liste. Die Abfrage
  // hält sich zurück, solange keine da sind (`enabled` im Hook).
  const { data: viewCounts } = useMyListingViews(standing.map((l) => l.id));
  // Dieselbe Abfrage wie auf der Startseite und im Marktplatz — derselbe
  // Zwischenspeicher, dieselben Schluessel.
  const { data: saveCounts } = useSavedCounts(standing.map((l) => l.id));
  const seenTotal = [...(viewCounts?.values() ?? [])].reduce((a, b) => a + b, 0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/sell')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Dein Regal</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
      >
        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        {/* ⚠️ EIN KNOPF, DER FUEHRT — KEIN AUFKLAPPER (21.09.2026).
            Hier sass derselbe Knopf, der das Formular auf- und zuklappte: Im
            geoeffneten Zustand hiess der groesste Knopf des Bildschirms
            „Formular einklappen", und das Regal rutschte unter zehn
            Eingabefelder. Das Formular hat seit heute einen eigenen Ort
            (`/listing/new`). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Neuen Artikel einstellen"
          onPress={() => router.push('/listing/new')}
          style={styles.create}
        >
          <Plus size={18} color={ui.card} />
          <Text style={styles.createText}>Neuen Artikel einstellen</Text>
        </Pressable>

        {/* Die kompakte Liste: Hier wird verwaltet, nicht gestöbert. Ein Tipp
            auf eine Zeile öffnet den Artikel so, wie ein Fremder ihn sieht —
            das ist die einzige Vorschau, die es gibt. Zurückziehen bleibt am
            Rand, weil es der häufige Handgriff ist. */}
        <StandingShelf
          listings={standing}
          isOwner
          viewCounts={viewCounts}
          saveCounts={saveCounts}
          /* ⚠️ Der Satz steht IN der Karte, nicht darunter. Bis zum
             21.09.2026 lagen zwei graue Fussnoten uebereinander: „Diese
             Artikel bleiben kaufbar" (in der Karte) und dieser hier
             (darunter). Er ersetzt den anderen, solange er gilt — sobald die
             erste Zahl da ist, kommt der alte zurueck. */
          hint={
            standing.length > 0 && seenTotal === 0
              ? 'Noch hat niemand hingesehen. Sobald jemand hinschaut, steht es hier an der Zeile — am schnellsten geht es über eine Sendung.'
              : undefined
          }
          busyId={busyId}
          onCancel={(item) => {
            setBusyId(item.id);
            void actions.cancel
              .mutateAsync(item.id)
              .then(() => setNotice('Zurückgezogen.'))
              .catch((e: unknown) =>
                setNotice(standingErrorText(e instanceof Error ? e.message : String(e))),
              )
              .finally(() => setBusyId(null));
          }}
          emptyText="Noch nichts drin. Über „Neuen Artikel einstellen“ legst du dein erstes Angebot an — auch zwischen deinen Shows kaufbar."
        />

        {/* ── Was aus Sendungen übrig ist ────────────────────────────────────
            Steht UNTER dem Regal, nicht darüber: Das Regal ist der Bestand,
            das hier ist die Nachlese. Rendert sich selbst weg, wenn nichts
            übrig ist — ein Abschnitt mit Leerzustand wäre an dieser Stelle
            eine Erinnerung an Misserfolge. */}
        <LeftoverShelf
          userId={myUserId}
          onNotice={setNotice}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Das „+" ist ein Zeichen, kein Schriftzeichen: Als Plus-Buchstabe im Text
     („+ Neuen Artikel einstellen") sass es auf der Grundlinie und las sich wie
     ein Tippfehler. */
  create: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.md, marginBottom: space.md, borderRadius: radius.pill, backgroundColor: ui.brand },
  createText: { fontSize: 15, fontWeight: '700', color: ui.card },
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

  notice: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    padding: space.md,
    marginBottom: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text, lineHeight: 19 },
});

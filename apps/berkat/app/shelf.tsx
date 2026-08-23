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
import { useFocusEffect } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { standingErrorText, useStandingActions } from '../lib/useStanding';
import { useSellerListings } from '../lib/useListings';
import { LeftoverShelf } from '../components/LeftoverShelf';
import { shelfBridgeErrorText, useShelfBridge } from '../lib/useShelfBridge';
import { useMyPlannedShows } from '../lib/useSchedule';
import { StandingComposer } from '../components/StandingComposer';
import { useSetShippingTier } from '../lib/useShippingTier';
import { useBerkatSeller, useDeclareSellerKind } from '../lib/useBerkatSeller';
import { StandingShelf } from '../components/StandingShelf';
import { radius, space, ui } from '../theme/tokens';

export default function ShelfScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const myProfile = useSession((s) => s.profile);

  const { data: standing = [], refetch } = useSellerListings(myUserId ?? undefined);
  const actions = useStandingActions(myUserId ?? undefined, myUserId);
  const { data: seller } = useBerkatSeller(myUserId);
  // Für „Wohin damit?" im Formular — die eigenen angekündigten Abende.
  const { data: plannedShows = [] } = useMyPlannedShows(myUserId);
  const bridge = useShelfBridge();
  const setTier = useSetShippingTier();
  const declareKind = useDeclareSellerKind(myUserId);
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
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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

        <StandingComposer
          busy={actions.create.isPending}
          canWomenOnly={Boolean(myProfile?.women_only_verified)}
          sellerKind={seller?.kind ?? null}
          onDeclareKind={(kind) =>
            void declareKind
              .mutateAsync({ kind })
              .then(() =>
                setNotice(
                  kind === 'business'
                    ? 'Als gewerblich eingetragen. Trag deine Anbieterangaben im Konto nach — sie stehen an jedem Angebot.'
                    : 'Als Privatperson eingetragen.',
                ),
              )
              .catch(() => setNotice('Das ließ sich gerade nicht speichern.'))
          }
          plans={plannedShows}
          onSubmit={(input) =>
            void actions.create
              .mutateAsync(input)
              .then(async (id) => {
                // ⚠️ ZWEI Rufe, und der zweite darf scheitern.
                //
                // `create_standing_listing` kennt keinen Termin — der Umzug ist
                // seit `20260821160000` eine eigene Funktion. Sie hier
                // hinterherzuschicken ist die kleinere Änderung, als die
                // Anlege-RPC um einen Parameter zu erweitern: Das wäre eine
                // Signatur-Änderung an einer Funktion, die schon in TestFlight
                // gerufen wird, und zwei Überladungen machen PostgREST
                // mehrdeutig (HTTP 300).
                //
                // Scheitert der Umzug, liegt der Artikel im Regal statt am
                // Termin — das ist der harmlose Ausgang, und der Verkäufer
                // erfährt ihn. Verloren geht nichts.
                // ⚠️ DRITTER Ruf, aus demselben Grund wie der zweite: Die
                // Versandstufe ist kein Parameter von `create_standing_listing`
                // (Signatur-Änderung unter einer laufenden App). Scheitert er,
                // liegt der Artikel mit NULL im Regal und wird als grosses
                // Paket abgerechnet — im Zweifel teurer für den Käufer statt
                // draufzahlen für den Verkäufer.
                if (input.shippingTier != null) {
                  try {
                    await setTier.mutateAsync({
                      auctionId: id,
                      tier: input.shippingTier as 1 | 2 | 3 | 4,
                    });
                  } catch {
                    /* Der Artikel steht; die Stufe lässt sich nachtragen. */
                  }
                }

                if (!input.planId) {
                  setNotice('Liegt im Regal — ab jetzt kaufbar. 🎉');
                  return;
                }
                try {
                  await bridge.toShow.mutateAsync({ id, planId: input.planId });
                  setNotice('Für den Abend vorgemerkt — startet dort bei 1 €. 🎉');
                } catch (e: unknown) {
                  setNotice(
                    `Angelegt, aber der Termin ließ sich nicht zuordnen: ${shelfBridgeErrorText(
                      e instanceof Error ? e.message : String(e),
                    )} Der Artikel liegt jetzt im Regal.`,
                  );
                }
              })
              .catch((e: unknown) =>
                setNotice(standingErrorText(e instanceof Error ? e.message : String(e))),
              )
          }
        />

        {/* Die kompakte Liste: Hier wird verwaltet, nicht gestöbert. Ein Tipp
            auf eine Zeile öffnet den Artikel so, wie ein Fremder ihn sieht —
            das ist die einzige Vorschau, die es gibt. Zurückziehen bleibt am
            Rand, weil es der häufige Handgriff ist. */}
        <StandingShelf
          listings={standing}
          isOwner
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
          emptyText="Noch nichts drin. Trag oben den ersten Artikel ein — er ist dann rund um die Uhr kaufbar, auch wenn du nicht sendest."
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
    </KeyboardAvoidingView>
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

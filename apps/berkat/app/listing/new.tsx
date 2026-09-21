// Artikel einstellen — ein eigener Bildschirm.
//
// ⚠️ WARUM DAS EIN BILDSCHIRM IST UND KEIN AUFKLAPPER (21.09.2026)
// Zaur: *„das ‚+Neuen Artikel einstellen' Formular ist auch vibecodet"*.
//
// Das Formular lag bis heute IM Regal-Bildschirm, hinter einem Knopf, der es
// auf- und zuklappte. Drei Folgen, jede für sich schon genug:
//
//   • Der größte, auffälligste Knopf des Bildschirms hieß im geöffneten
//     Zustand **„Formular einklappen"** — die Handlung, die am wenigsten
//     jemand will, in der Gestalt der wichtigsten. Der echte Abschicken-Knopf
//     lag acht Bildschirme tiefer.
//   • Das Regal selbst rutschte unter das Formular. Wer nachsehen wollte, was
//     schon drin liegt, scrollte an zehn Eingabefeldern vorbei.
//   • Es gab keine Überschrift. Man war in „Dein Regal" und füllte ein
//     Formular aus, das nirgends sagte, was es anlegt.
//
// Jetzt: eigener Ort, eigener Titel, ein Weg hinein und einer hinaus.
//
// ⚠️ DAS FORMULAR BLEIBT NACH DEM ANLEGEN STEHEN.
// `StandingComposer` setzt sich selbst zurück, behält aber Termin, PLZ und Ort
// — wer abends fünf Sachen einstellt, wohnt bei allen fünf gleich. Deshalb
// springt dieser Bildschirm nach dem Erfolg NICHT zurück ins Regal: Der
// schnelle Weg bleibt schnell. Die Bestätigung steht oben, „Fertig" im Kopf.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { goBack } from '../../lib/nav';
import { standingErrorText, useStandingActions } from '../../lib/useStanding';
import { shelfBridgeErrorText, useShelfBridge } from '../../lib/useShelfBridge';
import { useMyPlannedShows } from '../../lib/useSchedule';
import { StandingComposer } from '../../components/StandingComposer';
import { useSetShippingTier } from '../../lib/useShippingTier';
import { useBerkatSeller, useDeclareSellerKind } from '../../lib/useBerkatSeller';
import { radius, space, ui } from '../../theme/tokens';

export default function NewListingScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const myProfile = useSession((s) => s.profile);

  const actions = useStandingActions(myUserId ?? undefined, myUserId);
  const { data: seller } = useBerkatSeller(myUserId);
  // Für „Wohin damit?" — die eigenen angekündigten Abende.
  const { data: plannedShows = [] } = useMyPlannedShows(myUserId);
  const bridge = useShelfBridge();
  const setTier = useSetShippingTier();
  const declareKind = useDeclareSellerKind(myUserId);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/shelf')} style={styles.back}
          accessibilityRole="button" accessibilityLabel="Zurück zum Regal">
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Artikel einstellen</Text>
        {/* „Fertig" statt eines zweiten Pfeils: Wer etwas angelegt hat, hört
            hier auf — der Pfeil links heißt „abbrechen", dieser Weg heißt
            „ich bin durch". Erscheint erst, wenn wirklich etwas passiert ist. */}
        {notice ? (
          <Pressable hitSlop={10} onPress={() => goBack('/shelf')} style={styles.done}
            accessibilityRole="button" accessibilityLabel="Fertig, zurück zum Regal">
            <Text style={styles.doneText}>Fertig</Text>
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}
            accessibilityRole="button" accessibilityLabel="Hinweis schließen"
            accessibilityLiveRegion="polite">
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : (
          <Text style={styles.lede}>
            Dein Angebot liegt danach im Regal — rund um die Uhr kaufbar, auch wenn du
            gerade nicht sendest.
          </Text>
        )}

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
  back: { width: 60, height: 40, alignItems: 'center', justifyContent: 'center' },
  done: { width: 60, height: 40, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 15, fontWeight: '700', color: ui.brand },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  lede: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginBottom: space.xs },

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

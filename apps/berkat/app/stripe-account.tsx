/**
 * Dein Stripe-Konto — welches, seit wann, und was es gerade kann
 * ============================================================================
 *
 * ⚠️ WARUM ES DAS GIBT (22.09.2026)
 * Zaur: *„unter einstellungen in berkat sollte eine fläche sein wo mann stripe
 * account speichern kann."*
 *
 * Bis dahin gab es nur eine **Zeile mit einem Zustandswort** („bereit",
 * „unvollständig") und dahinter direkt Stripes Formular. Was fehlte, war die
 * Antwort auf die Frage, die davor kommt: **Welches Konto ist das eigentlich?**
 *
 * Der Abend, an dem das aufgefallen ist, erklärt den Bildschirm besser als jede
 * Begründung: Zaur suchte im Stripe-Dashboard nach seinem verbundenen Konto und
 * fand es nicht — es liegt in der **Sandbox**, nicht im Hauptkonto (Übergabe
 * 99). Ohne eine Kennung, nach der man suchen kann, sah es aus, als gäbe es das
 * Konto gar nicht. Seine nächste Frage war, ob er sein **echtes privates
 * Stripe-Konto** verbinden solle.
 *
 * ⚠️ Eine Sache, die man nirgends nachschlagen kann, lädt zum Raten ein. Beim
 * Geld rät niemand gut.
 *
 * ⚠️ DIESER BILDSCHIRM SPEICHERT NICHTS. Das Konto entsteht bei Stripe, und
 * der Zustand kommt vom Server (`berkat_seller_stripe`, gepflegt von der
 * Function und der Nachfrage aus Übergabe 100). Hier wird gezeigt und
 * angestossen — dieselbe Arbeitsteilung wie überall im Geldnahen: „Der Server
 * entscheidet, der Client zeigt an."
 */

import { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { goBack } from '../lib/nav';
import { errText } from '../lib/errorText';
import { useSession } from '../lib/session';
import {
  stripeConnectLabel,
  useStartStripeConnect,
  useStripeConnectInfo,
  type StripeConnectState,
} from '../lib/useStripeConnect';
import { PressFeedback } from '../components/PressFeedback';
import { radius, space, ui } from '../theme/tokens';

/**
 * Was der Zustand für den Verkäufer BEDEUTET — nicht, wie er heisst.
 *
 * ⚠️ „pending" und „ready" auseinanderzuhalten ist der ganze Zweck: Wer
 * „abgegeben" für „fertig" hält, sendet einen Abend lang, ohne dass jemand
 * kaufen kann.
 */
function meaning(state: StripeConnectState): string {
  switch (state) {
    case 'ready':
      return 'An deinen Artikeln steht „Kaufen". Das Geld geht direkt auf dieses Konto.';
    case 'pending':
      return 'Du hast alles abgegeben, Stripe prüft noch. Solange steht an deinen Artikeln „Nachricht schreiben" statt „Kaufen".';
    case 'incomplete':
      return 'Stripe fehlt noch etwas von dir. Solange steht an deinen Artikeln „Nachricht schreiben" statt „Kaufen".';
    default:
      return 'Noch kein Konto verbunden. Solange kann bei dir niemand kaufen — an deinen Artikeln steht „Nachricht schreiben".';
  }
}

function germanDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function StripeAccountScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const { data: info, isLoading, refetch } = useStripeConnectInfo(myUserId);
  const { start, isStarting } = useStartStripeConnect(myUserId);

  const state = info?.state ?? 'none';
  const label = stripeConnectLabel(state);

  const open = useCallback(() => {
    void start()
      .then(() => refetch())
      .catch((e) => Alert.alert('Das hat nicht geklappt', errText(e)));
  }, [start, refetch]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <PressFeedback hitSlop={10} onPress={() => goBack('/settings')}
          accessibilityRole="button" accessibilityLabel="Zurück">
          <ChevronLeft size={24} color={ui.text} />
        </PressFeedback>
        <Text accessibilityRole="header" style={s.headTitle}>Geld empfangen</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: space.xl }} color={ui.textMuted}
            accessibilityLabel="Stand wird geladen" />
        ) : (
          <>
            <View style={s.card}>
              <Text style={[
                s.state,
                label.tone === 'ok' && { color: ui.success },
                label.tone === 'muted' && { color: ui.textMuted },
              ]}>
                {label.text}
              </Text>
              <Text style={s.meaning}>{meaning(state)}</Text>
              {/* Stripes eigener Grund, wenn es einen gibt — wortwörtlich, nicht
                  übersetzt: Wer ihn bei Stripe sucht, findet ihn nur so wieder. */}
              {info?.disabledReason ? (
                <Text style={s.reason}>Stripe nennt als Grund: {info.disabledReason}</Text>
              ) : null}
            </View>

            {/* ── DAS KONTO ───────────────────────────────────────────────── */}
            {info?.accountId ? (
              <>
                <Text accessibilityRole="header" style={s.sectionLabel}>Verbundenes Konto</Text>
                <View style={s.card}>
                  {/* ⚠️ `selectable`: Genau dafür steht die Kennung hier. Wer sie
                      abtippt, vertippt sich — und sucht danach das falsche
                      Konto. */}
                  <Text selectable style={s.accountId}>{info.accountId}</Text>
                  {germanDate(info.connectedAt) ? (
                    <Text style={s.hint}>Verbunden seit {germanDate(info.connectedAt)}</Text>
                  ) : null}
                  {/* ⚠️ Der Satz, der am 22.09.2026 gefehlt hat. Das verbundene
                      Konto entsteht in derselben Umgebung wie der Schlüssel —
                      und das ist zurzeit die Sandbox. Wer im Hauptkonto sucht,
                      findet nichts und hält das Konto für nicht vorhanden. */}
                  <Text style={s.hint}>
                    Such danach in deinem Stripe-Dashboard unter „Verbundene Konten".
                    Solange Berkat im Testbetrieb läuft, steht es in der Sandbox —
                    oben links umschalten, sonst ist die Liste leer.
                  </Text>
                </View>
              </>
            ) : null}

            <PressFeedback style={[s.button, isStarting && s.buttonOff]}
              disabled={isStarting}
              accessibilityState={{ disabled: isStarting, busy: isStarting }}
              onPress={open} accessibilityRole="button">
              <Text style={s.buttonText}>
                {isStarting ? 'Stripe wird geöffnet …'
                  : state === 'ready' ? 'Bei Stripe ansehen'
                  : state === 'none' ? 'Konto verbinden'
                  : 'Bei Stripe fortsetzen'}
              </Text>
            </PressFeedback>

            {/* Kein „Konto trennen". Ein Verkäufer mit offenen Bestellungen, der
                seine Auszahlung kappt, hätte Geld unterwegs und keinen Empfänger
                — das gehört, wenn überhaupt, hinter eine Prüfung auf offene
                Pakete und nicht hinter einen Knopf. */}
            <Text style={s.foot}>
              Berkat sieht deine Kontodaten nie. Die Verbindung liegt bei Stripe;
              hier steht nur, ob sie steht.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  headTitle: { fontSize: 17, fontWeight: '600', color: ui.text },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: ui.textMuted,
    marginTop: space.lg, marginBottom: space.sm, marginLeft: space.xs,
  },
  card: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.md },
  state: { fontSize: 20, fontWeight: '700', color: ui.live },
  meaning: { fontSize: 14, lineHeight: 21, color: ui.text, marginTop: space.sm },
  reason: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: space.sm },
  accountId: { fontSize: 15, fontWeight: '600', color: ui.text },
  hint: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: space.sm },
  button: {
    minHeight: 48,
    marginTop: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
  },
  buttonOff: { backgroundColor: ui.sunken },
  buttonText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  foot: { fontSize: 12, lineHeight: 18, color: ui.textMuted, textAlign: 'center', marginTop: space.lg },
});

// Konto löschen — ein eigener Bildschirm, kein Dialog.
//
// WARUM EIN BILDSCHIRM UND KEIN `Alert.alert`
// Weil hier etwas zu erklären ist, das in zwei Zeilen nicht hineinpasst: Was
// gelöscht wird, was bleibt, und warum das Bleibende bleiben MUSS. Ein Dialog
// mit „Wirklich löschen?" wäre schneller und würde genau die Frage unbeantwortet
// lassen, die jeder hat — „ist mein Kauf dann weg?".
//
// Design-Gesetz 2 („Tiefs wärmer machen") gilt auch hier, aber anders als sonst:
// Nicht mit einem Augenzwinkern. Wer diesen Bildschirm öffnet, ist enttäuscht
// oder misstrauisch; der richtige Ton ist ruhig und vollständig, nicht munter.
//
// Der Weg ist absichtlich nicht bequem — Bestätigungswort tippen, dann ein
// zweiter Knopf. Nicht als Hürde, sondern weil er unumkehrbar ist. Apple 5.1.1(v)
// verlangt, dass er ERREICHBAR ist, nicht dass er leicht ist.

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, ShieldCheck, TriangleAlert } from 'lucide-react-native';

import { goBack } from '../lib/nav';
import {
  DELETION_FACTS,
  deleteAccountError,
  useDeleteAccount,
} from '../lib/useDeleteAccount';
import { radius, space, ui } from '../theme/tokens';

/** Groß geschrieben, damit es nicht versehentlich beim Tippen entsteht. */
const CONFIRM_WORD = 'LÖSCHEN';

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const del = useDeleteAccount();

  const armed = typed.trim().toUpperCase() === CONFIRM_WORD;

  const run = () => {
    if (!armed || del.isPending) return;
    setNotice(null);
    del
      .mutateAsync()
      .then(() => {
        // `replace`, nicht `push`: Zurück gibt es nicht mehr — das Konto ist weg.
        router.replace('/login');
      })
      .catch((err) => setNotice(deleteAccountError(err)));
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/account')} style={s.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={s.headerTitle}>Konto löschen</Text>
        <View style={s.back} />
      </View>

      {/* ⚠️ Die Tastatur verdeckte Eingabefeld UND Knopf, sobald man das Feld
          antippte — am 24.08.2026 am Gerät gesehen. Beide stehen am unteren Ende
          eines scrollenden Bildschirms, und ohne die Zeilen unten schiebt nichts
          sie hoch. Auf dem Bildschirm, der nicht scheitern darf, weil Apple
          5.1.1(v) ihn verlangt.

          `automaticallyAdjustKeyboardInsets` und NICHT der `KeyboardAvoidingView`
          aus `messages/[id].tsx`: Der Hausbrauch dort ist für einen festgenagelten
          Eingabebalken gebaut und läuft ohne das native Modul über
          `LayoutAnimation` — also mit genau dem Springen aus Abschnitt 79. Hier
          scrollt die Fläche ohnehin, und dann macht die native iOS-Anpassung des
          Inhalts-Randes dasselbe ruhiger und ohne Bibliothek. Wichtig, weil das
          Modul im TestFlight-Build 1.0.0 gar nicht steckt (`lib/keyboardKit.ts`)
          — der Bildschirm muss OHNE es funktionieren.

          Android braucht nichts davon: Dort verkleinert `softwareKeyboardLayoutMode`
          (Expo-Standard `resize`) schon das Fenster.

          `keyboardShouldPersistTaps="handled"` ist der zweite Teil des Fehlers:
          Ohne das verschluckt der erste Tipp auf „Konto endgültig löschen" nur die
          Tastatur, und man muss zweimal tippen. */}
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl }}
      >
        {/* ⚠️ Der Verweis zeigte zuerst auf „den letzten Teil" — und das war der
            Abmelde-Hinweis ganz unten, nicht der Absatz, der gemeint war. Ein
            Zeiger, der auf die falsche Stelle zeigt, ist schlimmer als keiner.
            Am 21.08.2026 am Gerät gesehen, im ersten Durchlauf überhaupt. */}
        <Text style={s.lead}>
          Das lässt sich nicht rückgängig machen. Lies kurz, was passiert — vor allem den
          grünen Kasten: Er beantwortet die Frage, die die meisten haben.
        </Text>

        <View style={[s.card, s.cardGone]}>
          <View style={s.cardHead}>
            <TriangleAlert size={16} color={ui.live} />
            <Text style={[s.cardTitle, { color: ui.live }]}>Das ist danach weg</Text>
          </View>
          {DELETION_FACTS.weg.map((line) => (
            <Text key={line} style={s.item}>
              · {line}
            </Text>
          ))}
        </View>

        <View style={[s.card, s.cardStays]}>
          <View style={s.cardHead}>
            <ShieldCheck size={16} color={ui.success} />
            <Text style={[s.cardTitle, { color: ui.success }]}>Das bleibt — ohne deinen Namen</Text>
          </View>
          {DELETION_FACTS.bleibt.map((line) => (
            <Text key={line} style={s.item}>
              · {line}
            </Text>
          ))}
          {/* Der wichtigste Absatz des Bildschirms. Ohne ihn liest sich die
              Liste darüber wie eine Ausrede; mit ihm ist sie eine Auskunft. */}
          <Text style={s.why}>{DELETION_FACTS.warum}</Text>
        </View>

        <Text style={s.confirmLabel}>
          Tipp <Text style={s.confirmWord}>{CONFIRM_WORD}</Text>, um zu bestätigen.
        </Text>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={ui.textMuted}
          style={[s.input, armed && s.inputArmed]}
          accessibilityLabel={`Zum Bestätigen ${CONFIRM_WORD} eingeben`}
        />

        {notice ? <Text style={s.notice}>{notice}</Text> : null}

        <Pressable
          onPress={run}
          disabled={!armed || del.isPending}
          style={({ pressed }) => [
            s.cta,
            !armed && s.ctaOff,
            pressed && armed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Konto endgültig löschen"
          accessibilityState={{ disabled: !armed || del.isPending }}
        >
          {del.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Check size={17} color={armed ? '#FFFFFF' : ui.textMuted} />
              <Text style={[s.ctaText, !armed && { color: ui.textMuted }]}>
                Konto endgültig löschen
              </Text>
            </>
          )}
        </Pressable>

        <Text style={s.footer}>
          Du kannst stattdessen auch einfach ausloggen — dann bleibt alles, wie es ist, und du
          kommst jederzeit zurück.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: ui.text },

  lead: { fontSize: 14, color: ui.textMuted, lineHeight: 21, marginBottom: space.lg },

  card: { borderRadius: radius.md, padding: space.md, marginBottom: space.md, borderWidth: 1 },
  cardGone: { borderColor: `${ui.live}33`, backgroundColor: `${ui.live}0D` },
  cardStays: { borderColor: `${ui.success}33`, backgroundColor: `${ui.success}0D` },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.sm },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  item: { fontSize: 13, color: ui.text, lineHeight: 20 },
  why: {
    fontSize: 13,
    color: ui.textMuted,
    lineHeight: 20,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },

  confirmLabel: { fontSize: 13, color: ui.textMuted, marginTop: space.sm },
  confirmWord: { fontWeight: '700', color: ui.text },
  input: {
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 16,
    fontWeight: '700',
    color: ui.text,
    marginTop: space.xs,
  },
  inputArmed: { borderColor: ui.live },

  notice: { fontSize: 13, color: ui.live, lineHeight: 20, marginTop: space.sm },

  // Rot, und das ist die einzige Stelle in Berkat, an der Rot eine FLÄCHE ist.
  // Sonst gilt „Rot ist die laufende Uhr, nie Fläche" (theme/tokens.ts) — hier
  // ist es die Ausnahme, weil der Knopf genau einmal gedrückt wird und danach
  // nichts mehr rückgängig zu machen ist.
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: ui.live,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    marginTop: space.lg,
  },
  ctaOff: { backgroundColor: ui.sunken },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  footer: { fontSize: 12, color: ui.textMuted, lineHeight: 19, marginTop: space.lg },
});

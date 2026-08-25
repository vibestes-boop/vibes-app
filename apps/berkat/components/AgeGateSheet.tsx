// „Wie alt bist du?" — einmal, bevor das erste Gebot zählt.
//
// Die Begründung steht in `lib/useAgeGate.ts`: Ein Gebot ist eine bindende
// Willenserklärung, und die eines Minderjährigen ist ohne die Eltern schwebend
// unwirksam (§§ 106-108 BGB). Der Riegel selbst liegt auf dem Server; dieses
// Blatt ist die Höflichkeit davor.
//
// ⚠️ DREI ZAHLENFELDER, KEIN DATUMS-WÄHLER.
// `@react-native-community/datetimepicker` ist ein NATIVES Modul und steckt im
// TestFlight-Build `1.0.0 (1)` nicht drin. Es einzubauen hiesse, eine
// Rechtspflicht an einen neuen Store-Build zu koppeln (Übergabe 12) — drei
// Felder gehen per OTA raus, heute.
//
// ⚠️ DIE FLÄCHE KOMMT VON AUSSEN.
// Berkat kennt zwei feste Flächen und keinen Hell-Dunkel-Umschalter (Übergabe
// 4): `ui` ist Sand, `stage` ist der Live-Raum. Dieses Blatt erscheint auf
// BEIDEN — beim Kauf auf der Artikelseite und beim Gebot im Stream. Deshalb
// sagt der Aufrufer, wo er sitzt, statt dass die Komponente rät. Ein helles
// Blatt mitten in einer laufenden Sendung wäre ein Blitz.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { ageGateError, toIsoDate, type BirthDateState } from '../lib/useAgeGate';
import { radius, space, stage, ui } from '../theme/tokens';

type Surface = 'ui' | 'stage';

/**
 * Die paar Töne, die dieses Blatt braucht — je Fläche einmal.
 *
 * ⚠️ `ui` und `stage` sind NICHT deckungsgleich benannt (`ui.bg` gegen
 * `stage.surface`). Die Zuordnung steht deshalb hier ausgeschrieben und nicht
 * als `theme[surface].bg` — ein Zugriff, der auf einer der beiden Flächen
 * `undefined` liefert, fällt nicht auf, er wird nur unsichtbar.
 */
const PALETTE: Record<Surface, {
  sheet: string; field: string; text: string; muted: string;
  line: string; lineStrong: string; accent: string; accentInk: string; warn: string;
}> = {
  ui: {
    sheet: ui.bg, field: ui.sunken, text: ui.text, muted: ui.textMuted,
    line: ui.line, lineStrong: ui.lineStrong,
    accent: ui.brand, accentInk: ui.bg, warn: ui.live,
  },
  stage: {
    sheet: stage.surface, field: stage.ink, text: stage.text, muted: stage.textMuted,
    line: stage.line, lineStrong: stage.lineStrong,
    accent: stage.gold, accentInk: stage.goldInk, warn: stage.live,
  },
};

type Props = {
  visible: boolean;
  surface?: Surface;
  /** `minor` schaltet das Blatt von „fragen" auf „absagen" um. */
  state: BirthDateState;
  busy?: boolean;
  /** Serverseitiger Fehlschlag, schon übersetzt. */
  notice?: string | null;
  onClose: () => void;
  onSubmit: (iso: string) => void;
};

export function AgeGateSheet({
  visible,
  surface = 'ui',
  state,
  busy,
  notice,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const c = PALETTE[surface];
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const blocked = state === 'minor';

  const submit = () => {
    const parsed = toIsoDate(day, month, year);
    if (parsed.iso === null) {
      setLocalError(parsed.error);
      return;
    }
    setLocalError(null);
    onSubmit(parsed.iso);
  };

  const field = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    len: number,
    label: string,
    grow?: boolean,
  ) => (
    <TextInput
      value={value}
      // Nur Ziffern durchlassen: Auf iOS trägt auch der Zahlenblock ein Komma,
      // und ein "1,2" im Tagesfeld wäre eine Fehlermeldung, die niemand
      // versteht.
      onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, len))}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      keyboardType="number-pad"
      maxLength={len}
      style={[
        s.field,
        { backgroundColor: c.field, borderColor: c.line, color: c.text },
        grow ? { flex: 1.4 } : { flex: 1 },
      ]}
      accessibilityLabel={label}
      editable={!blocked && !busy}
    />
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.backdrop} onPress={onClose} />
        <View
          style={[s.sheet, { backgroundColor: c.sheet, paddingBottom: insets.bottom || space.md }]}
        >
          <View style={[s.grabber, { backgroundColor: c.lineStrong }]} />
          <View style={s.head}>
            <Text style={[s.title, { color: c.text }]}>
              {blocked ? 'Mitbieten geht ab 18' : 'Kurz noch: dein Geburtsdatum'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Schließen">
              <X size={20} color={c.muted} />
            </Pressable>
          </View>

          {/* ⚠️ Der Text sagt, WARUM — und zwar in einem Satz, nicht als
              Paragraphenkette. „Ein Gebot ist ein verbindlicher Kauf" ist der
              Grund, den jeder sofort versteht; §§ 106-108 BGB stehen in der
              Migration, wo sie hingehören. Eine Abfrage, die nur fordert und
              nichts erklärt, fühlt sich nach Behörde an — und Berkat soll sich
              anfühlen wie ein wohlwollender Freund. */}
          <Text style={[s.explain, { color: c.muted }]}>
            {blocked
              ? 'Ein Gebot ist ein verbindlicher Kauf, und dafür muss man volljährig sein. Stöbern, zuschauen und schreiben kannst du weiterhin. 🙂'
              : 'Ein Gebot ist ein verbindlicher Kauf — deshalb fragen wir einmal nach dem Alter. Wir zeigen das Datum nirgends an.'}
          </Text>

          {!blocked ? (
            <>
              <View style={s.row}>
                {field(day, setDay, 'TT', 2, 'Tag')}
                {field(month, setMonth, 'MM', 2, 'Monat')}
                {field(year, setYear, 'JJJJ', 4, 'Jahr', true)}
              </View>

              {/* ⚠️ Der Satz steht VOR dem Knopf, nicht danach. Die Einmal-Regel
                  ist der Grund, warum ein Tippfehler hier teuer ist — wer das
                  erst hinterher liest, hat schon getippt. */}
              <Text style={[s.hint, { color: c.muted }]}>
                Das lässt sich später nicht mehr selbst ändern — schau lieber
                zweimal drauf.
              </Text>

              {localError ? (
                <Text style={[s.error, { color: c.warn }]}>{localError}</Text>
              ) : null}
              {notice ? <Text style={[s.error, { color: c.warn }]}>{notice}</Text> : null}

              <Pressable
                style={[
                  s.submit,
                  { backgroundColor: c.accent },
                  busy && { opacity: 0.4 },
                ]}
                disabled={busy}
                onPress={submit}
                accessibilityRole="button"
                accessibilityLabel="Geburtsdatum speichern"
              >
                <Text style={[s.submitText, { color: c.accentInk }]}>
                  {busy ? 'Einen Moment …' : 'Weiter'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[s.submit, { backgroundColor: c.accent }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Verstanden"
            >
              <Text style={[s.submitText, { color: c.accentInk }]}>Verstanden</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Der Fehlschlag vom Server, schon in Berkats Ton. */
export { ageGateError };

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  explain: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  field: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 12, lineHeight: 17 },
  submit: {
    height: 50,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  submitText: { fontSize: 16, fontWeight: '700' },
});

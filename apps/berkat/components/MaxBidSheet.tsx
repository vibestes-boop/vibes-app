// „Max. Gebot" — wie weit würdest du gehen?
//
// Das System bietet dann für dich mit, immer nur so viel wie nötig. Wichtig
// für den Kopf des Bietenden: der Betrag ist eine Obergrenze, keine Zahlung.
// Das steht deshalb ausdrücklich im Text und nicht im Kleingedruckten.

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
import { stage, radius, space } from '../theme/tokens';
import { formatEuro } from '../lib/useAuction';

type Props = {
  visible: boolean;
  /** Kleinster erlaubter Betrag in Cent */
  minCents: number;
  /** Bereits hinterlegtes Maximum, falls vorhanden */
  currentMaxCents: number | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (maxCents: number) => void;
};

/** Vorschläge relativ zum Mindestbetrag — spart Tippen im laufenden Stream. */
const STEPS = [0, 500, 1500, 4000];

export function MaxBidSheet({
  visible,
  minCents,
  currentMaxCents,
  busy,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');

  const parsed = (() => {
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    if (!cleaned) return null;
    const euro = Number(cleaned);
    if (!Number.isFinite(euro) || euro <= 0) return null;
    return Math.round(euro * 100);
  })();

  const tooLow = parsed !== null && parsed < minCents;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Das Feld hat autoFocus — ohne dies läge die Tastatur sofort darüber. */}
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom || space.md }]}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Text style={styles.title}>Max. Gebot</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Schließen">
            <X size={20} color={stage.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.explain}>
          Du legst fest, wie weit du gehen würdest. Berkat bietet für dich mit — immer nur so
          viel wie nötig. Bezahlt wird am Ende der Preis, bei dem du gewinnst, nicht dein
          Maximum.
        </Text>

        {currentMaxCents ? (
          <Text style={styles.current}>
            Bisher hinterlegt: {formatEuro(currentMaxCents)} · Erhöhen ist möglich, senken nicht.
          </Text>
        ) : null}

        <View style={styles.chipRow}>
          {STEPS.map((extra) => {
            const cents = minCents + extra;
            return (
              <Pressable
                key={extra}
                style={styles.chip}
                onPress={() => setValue(String(cents / 100))}
              >
                <Text style={styles.chipText}>{formatEuro(cents)}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder={String(minCents / 100)}
          placeholderTextColor={stage.textMuted}
          style={styles.input}
          autoFocus
        />

        {tooLow ? (
          <Text style={styles.error}>Mindestens {formatEuro(minCents)}.</Text>
        ) : null}

        <Pressable
          style={[styles.submit, (!parsed || tooLow || busy) && styles.submitOff]}
          disabled={!parsed || tooLow || busy}
          onPress={() => parsed && onSubmit(parsed)}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>
            {parsed && !tooLow ? `Bis ${formatEuro(parsed)} mitbieten` : 'Betrag eingeben'}
          </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: stage.surface,
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
    backgroundColor: stage.lineStrong,
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700', color: stage.text },
  explain: { fontSize: 13, color: stage.textMuted, lineHeight: 19 },
  current: { fontSize: 12, color: stage.gold },
  chipRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  chip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: stage.lineStrong,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: stage.text },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: stage.line,
    backgroundColor: stage.ink,
    paddingHorizontal: space.md,
    fontSize: 18,
    fontWeight: '700',
    color: stage.text,
  },
  error: { fontSize: 12, color: stage.live },
  submit: {
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: stage.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: 16, fontWeight: '700', color: stage.goldInk },
});

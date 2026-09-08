// „Max. Gebot" — wie weit würdest du gehen?
//
// Das System bietet dann für dich mit, immer nur so viel wie nötig. Wichtig
// für den Kopf des Bietenden: der Betrag ist eine Obergrenze, keine Zahlung.
// Das steht deshalb ausdrücklich im Text und nicht im Kleingedruckten.

import { useState } from 'react';

import { useWindowDimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetHeader } from './SheetHeader';
import { PressFeedback } from './PressFeedback';
import { useReducedMotion } from '../lib/useReducedMotion';
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
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
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
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      {/* Das Feld hat autoFocus — ohne dies läge die Tastatur sofort darüber. */}
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <SheetHeader title="Maximales Gebot" surface="stage" onClose={onClose} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <TextInput allowFontScaling={false}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder={String(minCents / 100)}
              placeholderTextColor={stage.textMuted}
              style={[styles.input, { fontSize: styles.input.fontSize * fontScale, lineHeight: styles.input.fontSize * 1.4 * fontScale }]}
              accessibilityLabel="Maximales Gebot in Euro"
              autoFocus
            />

            <Text key={`copy-0-${fontScale}`} style={styles.explain}>
              Du legst fest, wie weit du gehen würdest. Berkat bietet für dich mit — immer nur so
              viel wie nötig. Bezahlt wird am Ende der Preis, bei dem du gewinnst, nicht dein
              Maximum.
            </Text>

            {currentMaxCents ? (
              <Text key={`copy-1-${fontScale}`} style={styles.current}>
                Bisher hinterlegt: {formatEuro(currentMaxCents)} · Erhöhen ist möglich, senken nicht.
              </Text>
            ) : null}

            <View style={styles.chipRow}>
              {STEPS.map((extra) => {
                const cents = minCents + extra;
                return (
                  <PressFeedback
                    key={extra}
                    style={[styles.chip, parsed === cents && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: parsed === cents }}
                    onPress={() => setValue(String(cents / 100))}
                  >
                    <Text key={`copy-2-${fontScale}`} style={styles.chipText}>{formatEuro(cents)}</Text>
                  </PressFeedback>
                );
              })}
            </View>

            {tooLow ? (
              <Text key={`copy-3-${fontScale}`} style={styles.error}>Mindestens {formatEuro(minCents)}.</Text>
            ) : null}

          </ScrollView>
          <PressFeedback
            style={[styles.submit, (!parsed || tooLow || busy) && styles.submitOff]}
            disabled={!parsed || tooLow || busy}
            onPress={() => parsed && onSubmit(parsed)}
            accessibilityRole="button"
          >
            <Text key={`copy-4-${fontScale}`} style={styles.submitText}>
              {parsed && !tooLow ? `Bis ${formatEuro(parsed)} mitbieten` : 'Betrag eingeben'}
            </Text>
          </PressFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  body: { gap: space.sm, paddingBottom: space.sm },
  sheet: {
    overflow: 'hidden',
    maxHeight: '90%',
    backgroundColor: stage.surface,
    borderTopLeftRadius: radius.phone,
    borderTopRightRadius: radius.phone,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },

  explain: { fontSize: 13, color: stage.textMuted, lineHeight: 19 },
  current: { fontSize: 12, color: stage.gold },
  chipSelected: { borderColor: stage.gold, backgroundColor: stage.surfaceHigh },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: {
    flexGrow: 1,
    flexBasis: '40%',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: stage.lineStrong,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: stage.text },
  input: {
    minHeight: 48,
    paddingVertical: space.sm,
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
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: stage.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: 16, fontWeight: '700', color: stage.goldInk },
});

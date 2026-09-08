// Bewerten mit einem Satz dazu.
//
// Bis zum 16.08.2026 sammelte Berkat nur Sterne: `account.tsx` rief
// `submitReview(orderId, rating)` direkt beim Antippen des Sterns. Die RPC
// `submit_order_review` nimmt seit jeher ein `p_comment` entgegen, und
// `lib/useOrderReview.ts` reicht es durch — nur gefragt hat niemand danach.
// Auf dem Profil standen deshalb Texte, die es gar nicht geben konnte.
//
// Der Text ist FREIWILLIG. Ein Pflichtfeld würde die Bewertungsquote senken,
// und fünf Sterne ohne Worte sind immer noch fünf Sterne. Deshalb steht auf dem
// Knopf auch „Absenden" und nicht „Weiter" — man kann sofort fertig sein.

import { useEffect, useState } from 'react';

import { useWindowDimensions, ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetHeader } from './SheetHeader';
import { PressFeedback } from './PressFeedback';
import { useReducedMotion } from '../lib/useReducedMotion';
import { RatingStars } from './RatingStars';
import { ui, radius, space } from '../theme/tokens';

export const REVIEW_MAX = 280;

type Props = {
  visible: boolean;
  sellerName: string;
  /** Womit das Sheet aufgeht — der Stern, den man angetippt hat. */
  initialRating: number;
  busy: boolean;
  onSubmit: (rating: number, comment: string) => void;
  onClose: () => void;
};

export function ReviewSheet({
  visible,
  sellerName,
  initialRating,
  busy,
  onSubmit,
  onClose,
}: Props) {
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (visible) {
      setRating(initialRating);
      setComment('');
    }
  }, [visible, initialRating]);

  return (
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.wrap}
        pointerEvents="box-none"
      >
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <SheetHeader title="Deine Bewertung" subtitle={`Wie war der Kauf bei ${sellerName}?`} onClose={onClose} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <View style={s.stars}>
              <RatingStars value={rating} onChange={setRating} size={34} />
            </View>

            <TextInput allowFontScaling={false}
              value={comment}
              onChangeText={(text) => setComment(text.slice(0, REVIEW_MAX))}
              placeholder="Kam schnell an, alles wie beschrieben. (freiwillig)"
              placeholderTextColor={ui.textMuted}
              style={[s.input, { fontSize: s.input.fontSize * fontScale, lineHeight: s.input.fontSize * 1.4 * fontScale }]}
              multiline
              maxLength={REVIEW_MAX}
              textAlignVertical="top"
            />

            <Text key={`copy-0-${fontScale}`} style={s.hint}>
              Dein Name und dein Satz stehen danach öffentlich auf seinem Profil. Die Sterne zählen
              in seinen Schnitt.
            </Text>

          </ScrollView>
          <View style={s.footer}>
            <PressFeedback
              style={[s.primary, { marginTop: 0 }, (busy || rating < 1) && s.primaryOff]}
              disabled={busy || rating < 1}
              onPress={() => onSubmit(rating, comment)}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={ui.goldInk} />
              ) : (
                <Text key={`copy-1-${fontScale}`} style={s.primaryText}>Absenden</Text>
              )}
            </PressFeedback>

            <PressFeedback style={s.ghost} onPress={onClose} accessibilityRole="button">
              <Text key={`copy-2-${fontScale}`} style={s.ghostText}>Später</Text>
            </PressFeedback>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: ui.scrim },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    overflow: 'hidden',
    maxHeight: '88%',
    backgroundColor: ui.card,
    borderTopLeftRadius: radius.phone,
    borderTopRightRadius: radius.phone,
    padding: space.lg,
    paddingBottom: space.xl + space.lg,
    gap: space.sm,
  },

  stars: { alignItems: 'center', paddingVertical: space.md },

  input: {
    minHeight: 92,
    backgroundColor: ui.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    fontSize: 15,
    color: ui.text,
    lineHeight: 21,
  },
  hint: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },

  footer: { paddingTop: space.md, marginTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.line },
  primary: {
    minHeight: 50,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  primaryOff: { opacity: 0.5 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  ghost: { minHeight: 44, paddingVertical: space.sm, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
});

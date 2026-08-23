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
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (visible) {
      setRating(initialRating);
      setComment('');
    }
  }, [visible, initialRating]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.wrap}
      >
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.title}>Wie war der Kauf bei {sellerName}?</Text>

          <View style={s.stars}>
            <RatingStars value={rating} onChange={setRating} size={34} />
          </View>

          <TextInput
            value={comment}
            onChangeText={(text) => setComment(text.slice(0, REVIEW_MAX))}
            placeholder="Kam schnell an, alles wie beschrieben. (freiwillig)"
            placeholderTextColor={ui.textMuted}
            style={s.input}
            multiline
            maxLength={REVIEW_MAX}
            textAlignVertical="top"
          />

          <Text style={s.hint}>
            Dein Name und dein Satz stehen danach öffentlich auf seinem Profil. Die Sterne zählen
            in seinen Schnitt.
          </Text>

          <Pressable
            style={[s.primary, (busy || rating < 1) && s.primaryOff]}
            disabled={busy || rating < 1}
            onPress={() => onSubmit(rating, comment)}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={ui.goldInk} />
            ) : (
              <Text style={s.primaryText}>Absenden</Text>
            )}
          </Pressable>

          <Pressable style={s.ghost} onPress={onClose} accessibilityRole="button">
            <Text style={s.ghostText}>Später</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: ui.scrim },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: ui.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl + space.lg,
    gap: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: ui.lineStrong,
    marginBottom: space.sm,
  },
  title: { fontSize: 18, fontWeight: '700', color: ui.text },
  stars: { alignItems: 'center', paddingVertical: space.md },

  input: {
    minHeight: 92,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    fontSize: 15,
    color: ui.text,
    lineHeight: 21,
  },
  hint: { fontSize: 11, color: ui.textMuted, lineHeight: 16 },

  primary: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  primaryOff: { opacity: 0.5 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
});

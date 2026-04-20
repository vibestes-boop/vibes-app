/**
 * components/shop/ReviewSheet.tsx
 * Bottom-Sheet zum Abgeben / Bearbeiten einer Produktbewertung
 */
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Star, X, Send } from 'lucide-react-native';
import { useSubmitReview, useMyReview } from '@/lib/useProductReviews';
import * as Haptics from 'expo-haptics';

interface ReviewSheetProps {
  productId: string;
  orderId:   string;
  productTitle: string;
  visible: boolean;
  onClose: () => void;
}

// ─── Stern-Auswahl ────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={s.stars}>
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <Pressable
          key={n}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(n); }}
          hitSlop={8}
        >
          <Star
            size={36}
            color={n <= value ? '#FFFFFF' : 'rgba(255,255,255,0.15)'}
            fill={n <= value ? '#FFFFFF' : 'transparent'}
            strokeWidth={1.5}
          />
        </Pressable>
      ))}
    </View>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
export function ReviewSheet({ productId, orderId, productTitle, visible, onClose }: ReviewSheetProps) {
  const { data: existing } = useMyReview(productId);
  const { mutateAsync: submit, isPending } = useSubmitReview();

  const [rating, setRating]   = useState<number>(0);
  const [comment, setComment] = useState('');

  // Vorhandene Bewertung vorladen
  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setComment(existing.comment ?? '');
    } else {
      setRating(0);
      setComment('');
    }
  }, [existing, visible]);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Bewertung fehlt', 'Bitte wähle 1-5 Sterne aus.');
      return;
    }
    try {
      await submit({
        productId,
        orderId,
        rating:           rating as 1|2|3|4|5,
        comment:          comment.trim() || undefined,
        existingReviewId: existing?.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e: any) {
      Alert.alert('Fehler', e.message ?? 'Bewertung konnte nicht gespeichert werden.');
    }
  };

  const ratingLabel = ['', '😕 Schlecht', '😐 Na ja', '😊 Okay', '😄 Gut', '🤩 Ausgezeichnet'][rating] ?? '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{existing ? 'Bewertung bearbeiten' : 'Produkt bewerten'}</Text>
            <Text style={s.headerSub} numberOfLines={1}>{productTitle}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
            <X size={20} color="rgba(255,255,255,0.5)" />
          </Pressable>
        </View>

        {/* Sterne */}
        <View style={s.section}>
          <StarPicker value={rating} onChange={setRating} />
          {ratingLabel ? <Text style={s.ratingLabel}>{ratingLabel}</Text> : null}
        </View>

        {/* Kommentar */}
        <View style={s.section}>
          <Text style={s.label}>Kommentar <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={s.input}
            placeholder="Teile deine Erfahrung mit anderen..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={300}
            textAlignVertical="top"
            returnKeyType="done"
          />
          <Text style={s.charCount}>{comment.length}/300</Text>
        </View>

        {/* Submit */}
        <Pressable
          style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.8 }, rating === 0 && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isPending || rating === 0}
        >
          {isPending
            ? <ActivityIndicator color="#000" size="small" />
            : <>
                <Send size={16} color="#000" strokeWidth={2} />
                <Text style={s.submitText}>{existing ? 'Aktualisieren' : 'Bewertung absenden'}</Text>
              </>
          }
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Inline Sterne-Anzeige (für Produktliste) ────────────────────────────────
export function StarDisplay({ rating, count }: { rating?: number | null; count?: number }) {
  if (!rating || !count) return null;
  return (
    <View style={s.display}>
      <Star size={12} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
      <Text style={s.displayText}>{rating.toFixed(1)}</Text>
      {count > 0 && <Text style={s.displayCount}>({count})</Text>}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  sheet:  { flex: 1, backgroundColor: '#050508', paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 32 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  section: { marginBottom: 28 },

  stars: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  ratingLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500', textAlign: 'center' },

  label:    { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 },
  optional: { color: 'rgba(255,255,255,0.25)', fontWeight: '400' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 14,
    color: '#fff', fontSize: 15, lineHeight: 22,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 100,
  },
  charCount: { color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'right', marginTop: 6 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 16, marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.3 },
  submitText: { color: '#000', fontSize: 16, fontWeight: '800' },

  // Inline Anzeige
  display: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  displayText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  displayCount: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
});

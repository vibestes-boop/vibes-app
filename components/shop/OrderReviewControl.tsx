/**
 * components/shop/OrderReviewControl.tsx — Bewertung einer gelieferten Echtgeld-
 * Bestellung (Käufer↔Verkäufer). Zeigt die eigene (änderbare) Bewertung + die von
 * der Gegenseite erhaltene; öffnet ein Modal mit Sternen + optionalem Text.
 */
import { useSubmitOrderReview, type OrderReview } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import {
ActivityIndicator,
Alert,
Modal,
Pressable,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';

function Stars({ value, onPress, size = 18 }: { value: number; onPress?: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const icon = (
          <Star
            size={size}
            color={filled ? '#F59E0B' : 'rgba(130,130,130,0.45)'}
            fill={filled ? '#F59E0B' : 'transparent'}
            strokeWidth={2}
          />
        );
        return onPress ? (
          <Pressable key={n} onPress={() => onPress(n)} hitSlop={4}>{icon}</Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}

export function OrderReviewControl({
  orderId,
  role,
  myReview,
  receivedReview,
}: {
  orderId: string;
  role: 'buyer' | 'seller';
  myReview?: OrderReview | null;
  receivedReview?: OrderReview | null;
}) {
  const { colors } = useTheme();
  const submit = useSubmitOrderReview();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [comment, setComment] = useState(myReview?.comment ?? '');

  const targetLabel = role === 'seller' ? 'Käufer' : 'Verkäufer';

  const openModal = () => {
    setRating(myReview?.rating ?? 0);
    setComment(myReview?.comment ?? '');
    setOpen(true);
  };

  const save = () => {
    if (rating < 1) { Alert.alert('Sterne wählen', 'Bitte 1–5 Sterne auswählen.'); return; }
    submit.mutate(
      { orderId, rating, comment },
      {
        onSuccess: () => setOpen(false),
        onError: () => Alert.alert('Hoppla', 'Hat nicht geklappt — gleich nochmal?'),
      },
    );
  };

  return (
    <View style={{ gap: 6, paddingTop: 4 }}>
      {myReview ? (
        <Pressable onPress={openModal} style={s.row} hitSlop={4}>
          <Text style={[s.recvLabel, { color: colors.text.muted }]}>Deine Bewertung:</Text>
          <Stars value={myReview.rating} size={16} />
          <Text style={[s.link, { color: colors.text.muted }]}>· ändern</Text>
        </Pressable>
      ) : (
        <Pressable onPress={openModal} style={[s.rateBtn, { borderColor: colors.border.subtle }]} hitSlop={4}>
          <Star size={14} color={colors.text.primary} strokeWidth={2} />
          <Text style={[s.rateText, { color: colors.text.primary }]}>{targetLabel} bewerten</Text>
        </Pressable>
      )}

      {receivedReview ? (
        <View style={{ gap: 2 }}>
          <View style={s.row}>
            <Text style={[s.recvLabel, { color: colors.text.muted }]}>Du wurdest bewertet:</Text>
            <Stars value={receivedReview.rating} size={13} />
          </View>
          {receivedReview.comment ? (
            <Text style={[s.recvComment, { color: colors.text.secondary }]}>
              {`„${receivedReview.comment}“`}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={[s.title, { color: colors.text.primary }]}>{targetLabel} bewerten</Text>
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Stars value={rating} onPress={setRating} size={34} />
            </View>
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder="Optional: ein paar Worte…"
              placeholderTextColor={colors.text.muted}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={1000}
            />
            <Pressable
              onPress={save}
              disabled={submit.isPending}
              style={[s.saveBtn, { backgroundColor: colors.text.primary, opacity: submit.isPending ? 0.6 : 1 }]}
            >
              {submit.isPending
                ? <ActivityIndicator size="small" color={colors.bg.primary} />
                : <Text style={[s.saveText, { color: colors.bg.primary }]}>Speichern</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { fontSize: 12.5, fontWeight: '600' },
  rateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, height: 34,
  },
  rateText: { fontSize: 12.5, fontWeight: '700' },
  recvLabel: { fontSize: 12, fontWeight: '500' },
  recvComment: { fontSize: 12.5, fontWeight: '500', fontStyle: 'italic', lineHeight: 17 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, gap: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingTop: 12, minHeight: 80, fontSize: 14, textAlignVertical: 'top' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 12, marginTop: 2 },
  saveText: { fontSize: 14, fontWeight: '700' },
});

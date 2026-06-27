/**
 * components/shop/OrderDisputeControl.tsx — Problem an einer Bestellung melden
 * (Käufer/Verkäufer, ab Bezahlung) + Streit-Status anzeigen. Klärung läuft über
 * den Admin (Web). Auf der App: melden + Status sehen.
 */
import { useReportOrderDispute, type OrderDispute } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { AlertTriangle } from 'lucide-react-native';
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

const REASONS: { value: string; label: string; role?: 'buyer' | 'seller' }[] = [
  { value: 'not_received', label: 'Ware nicht erhalten', role: 'buyer' },
  { value: 'damaged', label: 'Ware beschädigt', role: 'buyer' },
  { value: 'not_as_described', label: 'Nicht wie beschrieben', role: 'buyer' },
  { value: 'not_paid', label: 'Käufer zahlt nicht', role: 'seller' },
  { value: 'fraud', label: 'Betrugsverdacht' },
  { value: 'other', label: 'Sonstiges' },
];
const REASON_LABEL: Record<string, string> = Object.fromEntries(REASONS.map((r) => [r.value, r.label]));

export function OrderDisputeControl({
  orderId,
  role,
  dispute,
}: {
  orderId: string;
  role: 'buyer' | 'seller';
  dispute?: OrderDispute | null;
}) {
  const { colors } = useTheme();
  const report = useReportOrderDispute();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');

  const options = REASONS.filter((r) => !r.role || r.role === role);

  const submit = () => {
    if (!reason) { Alert.alert('Grund wählen', 'Bitte einen Grund auswählen.'); return; }
    report.mutate(
      { orderId, reason, detail },
      {
        onSuccess: () => { setOpen(false); setReason(''); setDetail(''); Alert.alert('Gemeldet', 'Wir kümmern uns drum. 🙏'); },
        onError: () => Alert.alert('Hoppla', 'Hat nicht geklappt — gleich nochmal?'),
      },
    );
  };

  if (dispute) {
    const isOpen = dispute.status === 'open';
    return (
      <View style={[s.banner, { borderColor: 'rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.08)' }]}>
        <AlertTriangle size={13} color="#D97706" strokeWidth={2.2} />
        <Text style={[s.bannerText, { color: '#B45309' }]}>
          {isOpen ? `In Klärung: ${REASON_LABEL[dispute.reason] ?? dispute.reason}` : 'Streit geklärt ✓'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => { setReason(''); setDetail(''); setOpen(true); }} hitSlop={6} style={{ paddingTop: 4 }}>
        <Text style={[s.reportLink, { color: colors.text.muted }]}>Problem melden</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={[s.title, { color: colors.text.primary }]}>Problem melden</Text>
            <View style={s.chips}>
              {options.map((o) => {
                const active = reason === o.value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => setReason(o.value)}
                    style={[s.chip, { borderColor: colors.border.subtle, backgroundColor: active ? colors.text.primary : 'transparent' }]}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: active ? colors.bg.primary : colors.text.secondary }}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder="Was ist passiert? (optional)"
              placeholderTextColor={colors.text.muted}
              value={detail}
              onChangeText={setDetail}
              multiline
              maxLength={2000}
            />
            <Pressable
              onPress={submit}
              disabled={report.isPending}
              style={[s.btn, { backgroundColor: colors.text.primary, opacity: report.isPending ? 0.6 : 1 }]}
            >
              {report.isPending
                ? <ActivityIndicator size="small" color={colors.bg.primary} />
                : <Text style={[s.btnText, { color: colors.bg.primary }]}>Melden</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 4 },
  bannerText: { fontSize: 12, fontWeight: '700', flex: 1 },
  reportLink: { fontSize: 12.5, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingTop: 12, minHeight: 70, fontSize: 14, textAlignVertical: 'top' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 12 },
  btnText: { fontSize: 14, fontWeight: '700' },
});

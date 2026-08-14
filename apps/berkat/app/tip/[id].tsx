// Trinkgeld geben.
//
// Der Ton ist hier wichtiger als sonst: Niemand MUSS Trinkgeld geben, und die
// Seite darf sich nicht anfühlen wie eine Rechnung. Deshalb ein Satz, der
// erklärt, warum es das gibt — und kein voreingestellter Betrag, der eine
// Erwartung setzt.
//
// Was hier bewusst NICHT steht: kein „Boost". Whatnot verkauft damit
// Sichtbarkeit in der Show. Das wäre eine Werbefläche mit eigenen Regeln
// (wer sieht was, warum, und wie kennzeichnet man es) — und die gehört nicht
// nebenbei in einen Trinkgeld-Bildschirm.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Gift } from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { useProfiles, formatEuro } from '../../lib/useAuction';
import { TIP_MAX_CENTS, TIP_MIN_CENTS, TIP_PRESETS, useSendTip } from '../../lib/useTip';
import { Avatar } from '../../components/Avatar';
import { radius, space, ui } from '../../theme/tokens';

export default function TipScreen() {
  const { id: recipientId, session: sessionId } = useLocalSearchParams<{
    id: string;
    session?: string;
  }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const sendTip = useSendTip();

  const profiles = useProfiles(recipientId ? [recipientId] : []);
  const recipient = profiles[recipientId ?? ''];
  const name = recipient?.username ?? 'den Verkäufer';

  const [preset, setPreset] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const customCents = (() => {
    const cleaned = custom.replace(/\s/g, '').replace(',', '.');
    if (!cleaned) return null;
    const euro = Number(cleaned);
    if (!Number.isFinite(euro) || euro <= 0) return null;
    return Math.round(euro * 100);
  })();

  const amountCents = customCents ?? preset;
  const outOfRange =
    amountCents !== null && (amountCents < TIP_MIN_CENTS || amountCents > TIP_MAX_CENTS);
  const ready = amountCents !== null && !outOfRange && !busy;

  const submit = useCallback(async () => {
    if (!recipientId || amountCents === null) return;
    if (!myUserId) {
      router.push('/login');
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await sendTip({
      recipientId,
      amountCents,
      message,
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    });
    setBusy(false);
    if (!res.ok) setNotice(res.message);
  }, [recipientId, amountCents, message, myUserId, sendTip, sessionId]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Trinkgeld</Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 52}
      >
        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.recipient}>
            <Avatar uri={recipient?.avatarUrl} name={recipient?.username} size={56} ring />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.recipientName}>
                {recipient?.username ?? '…'}
              </Text>
              <Text style={styles.recipientHint}>
                Eine Show zu moderieren ist Arbeit. Wenn dir der Abend gefallen hat, sag danke —
                ganz ohne etwas zu kaufen.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Wie viel?</Text>
          <View style={styles.chipRow}>
            {TIP_PRESETS.map((cents) => {
              const active = preset === cents && !customCents;
              return (
                <Pressable
                  key={cents}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    setPreset(cents);
                    setCustom('');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {formatEuro(cents)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={custom}
            onChangeText={(t) => {
              setCustom(t);
              if (t) setPreset(null);
            }}
            keyboardType="decimal-pad"
            placeholder="Eigener Betrag in €"
            placeholderTextColor={ui.textMuted}
            style={styles.input}
          />
          {outOfRange ? (
            <Text style={styles.error}>
              Zwischen {formatEuro(TIP_MIN_CENTS)} und {formatEuro(TIP_MAX_CENTS)}.
            </Text>
          ) : null}

          <Text style={[styles.label, { marginTop: space.lg }]}>Ein Wort dazu? (optional)</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Danke für die schöne Show!"
            placeholderTextColor={ui.textMuted}
            style={[styles.input, styles.messageInput]}
            multiline
            maxLength={140}
          />

          {notice ? (
            <Pressable style={styles.notice} onPress={() => setNotice(null)}>
              <Text style={styles.noticeText}>{notice}</Text>
            </Pressable>
          ) : null}

          <Text style={styles.legal}>
            Ein Trinkgeld ist keine Zahlung für Ware — es entsteht kein Kauf, kein Versand und kein
            Widerrufsrecht. Bezahlt wird auf der Stripe-Seite.
          </Text>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom || space.md }]}>
          <Pressable
            style={[styles.submit, !ready && styles.submitOff]}
            disabled={!ready}
            onPress={() => void submit()}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={ui.goldInk} />
            ) : (
              <>
                <Gift size={18} color={ui.goldInk} />
                <Text style={styles.submitText}>
                  {amountCents && !outOfRange
                    ? `${formatEuro(amountCents)} an ${name}`
                    : 'Betrag wählen'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  body: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  recipient: { flexDirection: 'row', gap: space.md, marginBottom: space.xl },
  recipientName: { fontSize: 18, fontWeight: '700', color: ui.text },
  recipientHint: { fontSize: 13, color: ui.textMuted, lineHeight: 19, marginTop: 3 },

  label: { fontSize: 13, fontWeight: '600', color: ui.textMuted, marginBottom: space.sm },
  chipRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  chip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.lineStrong,
    paddingVertical: 11,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: ui.brand, borderColor: ui.brand },
  chipText: { fontSize: 14, fontWeight: '700', color: ui.text },
  chipTextActive: { color: '#FFFFFF' },

  input: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.line,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: ui.text,
  },
  messageInput: { height: 88, paddingTop: 13, textAlignVertical: 'top' },
  error: { fontSize: 12, color: ui.live, marginTop: space.xs },

  notice: {
    marginTop: space.md,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    padding: space.md,
  },
  noticeText: { fontSize: 13, color: ui.text },

  legal: { fontSize: 11, color: ui.textMuted, lineHeight: 16, marginTop: space.lg },

  footer: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  submit: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  submitOff: { opacity: 0.4 },
  submitText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
});

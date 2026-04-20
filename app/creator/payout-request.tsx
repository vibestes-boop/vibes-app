/**
 * app/creator/payout-request.tsx — Auszahlungs-Anfrage
 * Design: App-native Monochrom-Stil
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CreditCard, Mail, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/lib/useTheme';
import { useAuthStore } from '@/lib/authStore';
import { useCreatorEarnings, fmtNum } from '@/lib/useAnalytics';
import { supabase } from '@/lib/supabase';
import { notificationAsync, NotificationFeedbackType, impactAsync, ImpactFeedbackStyle } from 'expo-haptics';

const MIN_PAYOUT = 2500;
const RATE       = 0.02; // 1 Diamond = 2 Cent

export default function PayoutRequestScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuthStore();
  const userId   = profile?.id ?? null;

  const { data: ea } = useCreatorEarnings(userId, 28);
  const balance   = ea?.diamonds_balance ?? 0;
  const euroAmount = (balance * RATE).toFixed(2);
  const eligible  = balance >= MIN_PAYOUT;

  const [method,    setMethod]    = useState<'iban' | 'paypal'>('iban');
  const [iban,      setIban]      = useState('');
  const [paypal,    setPaypal]    = useState('');
  const [note,      setNote]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!userId || !eligible) return;
    if (method === 'iban'   && !iban.trim())   { setError('Bitte gib deine IBAN ein.');   return; }
    if (method === 'paypal' && !paypal.trim()) { setError('Bitte gib deine E-Mail ein.'); return; }
    setLoading(true);
    setError(null);
    impactAsync(ImpactFeedbackStyle.Medium);
    const { error: err } = await supabase
      .from('payout_requests')
      .insert({
        creator_id:      userId,
        diamonds_amount: balance,
        euro_amount:     parseFloat(euroAmount),
        iban:            method === 'iban'   ? iban.trim().toUpperCase()   : null,
        paypal_email:    method === 'paypal' ? paypal.trim().toLowerCase() : null,
        note:            note.trim() || null,
      });
    setLoading(false);
    if (err) { setError(err.message); return; }
    notificationAsync(NotificationFeedbackType.Success);
    setSubmitted(true);
  };

  // ── Erfolg ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
        <View style={[s.headerMin, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={16} style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={s.center}>
          <View style={[s.successIcon, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <CheckCircle2 size={32} color={colors.text.primary} strokeWidth={1.5} />
          </View>
          <Text style={[s.successTitle, { color: colors.text.primary }]}>Anfrage gestellt</Text>
          <Text style={[s.successSub, { color: colors.text.muted }]}>
            {balance} 💎 ≈ {euroAmount}€{'\n'}
            Bearbeitung: 5–10 Werktage
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[s.primaryBtn, { borderColor: colors.border.subtle, borderWidth: 1 }]}
            accessibilityRole="button"
          >
            <Text style={[s.primaryBtnText, { color: colors.text.secondary }]}>Zurück</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.bg.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>Auszahlung</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Balance */}
        <View style={[s.balanceCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.balanceLabel, { color: colors.text.muted }]}>Verfügbar</Text>
            <Text style={[s.balanceValue, { color: colors.text.primary }]}>
              {fmtNum(balance)} 💎
            </Text>
            <Text style={[s.balanceEur, { color: colors.text.muted }]}>≈ {euroAmount}€</Text>
          </View>
          {!eligible && (
            <View style={[s.warningPill, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
              <Text style={[s.warningPillText, { color: colors.text.muted }]}>
                Noch {fmtNum(MIN_PAYOUT - balance)} 💎
              </Text>
            </View>
          )}
        </View>

        {/* Mindestbetrag-Hinweis */}
        {!eligible && (
          <View style={[s.infoBox, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <AlertCircle size={14} color={colors.text.muted} strokeWidth={2} />
            <Text style={[s.infoText, { color: colors.text.muted }]}>
              Mindestbetrag: {fmtNum(MIN_PAYOUT)} 💎 ≈ {(MIN_PAYOUT * RATE).toFixed(0)}€.
            </Text>
          </View>
        )}

        {/* Methode */}
        <Text style={[s.inputLabel, { color: colors.text.muted }]}>AUSZAHLUNGSMETHODE</Text>
        <View style={s.methodRow}>
          {([
            { id: 'iban' as const,   Icon: CreditCard, label: 'SEPA / IBAN' },
            { id: 'paypal' as const, Icon: Mail,        label: 'PayPal'      },
          ]).map(({ id, Icon, label }) => (
            <Pressable
              key={id}
              onPress={() => setMethod(id)}
              style={[
                s.methodBtn,
                {
                  borderColor: method === id ? colors.text.primary : colors.border.subtle,
                  backgroundColor: method === id ? colors.text.primary : 'transparent',
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: method === id }}
            >
              <Icon size={15} color={method === id ? colors.bg.primary : colors.text.muted} strokeWidth={2} />
              <Text style={[s.methodLabel, { color: method === id ? colors.bg.primary : colors.text.muted }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* IBAN / PayPal Input */}
        <Text style={[s.inputLabel, { color: colors.text.muted }]}>
          {method === 'iban' ? 'IBAN' : 'PAYPAL E-MAIL'}
        </Text>
        <TextInput
          style={[s.input, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle, color: colors.text.primary }]}
          value={method === 'iban' ? iban : paypal}
          onChangeText={method === 'iban' ? setIban : setPaypal}
          placeholder={method === 'iban' ? 'DE89 3704 0044 0532 0130 00' : 'deine@email.com'}
          placeholderTextColor={colors.text.muted}
          autoCapitalize={method === 'iban' ? 'characters' : 'none'}
          keyboardType={method === 'paypal' ? 'email-address' : 'default'}
          autoCorrect={false}
        />

        {/* Notiz */}
        <Text style={[s.inputLabel, { color: colors.text.muted }]}>NOTIZ (OPTIONAL)</Text>
        <TextInput
          style={[s.input, s.inputMulti, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle, color: colors.text.primary }]}
          value={note}
          onChangeText={setNote}
          placeholder="Optionaler Hinweis…"
          placeholderTextColor={colors.text.muted}
          multiline
          numberOfLines={3}
        />

        {error && (
          <View style={[s.infoBox, { backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }]}>
            <AlertCircle size={14} color="#EF4444" strokeWidth={2} />
            <Text style={{ color: '#EF4444', fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        )}

        {/* CTA */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading || !eligible}
          style={[s.primaryBtn, { backgroundColor: colors.text.primary, opacity: (!eligible || loading) ? 0.35 : 1, marginTop: 8 }]}
          accessibilityRole="button"
        >
          {loading
            ? <ActivityIndicator color={colors.bg.primary} />
            : <Text style={[s.primaryBtnText, { color: colors.bg.primary }]}>Auszahlung beantragen →</Text>
          }
        </Pressable>

        <Text style={[s.disclaimer, { color: colors.text.muted }]}>
          5–10 Werktage Bearbeitung ·  Min. {fmtNum(MIN_PAYOUT)} 💎 ≈ {(MIN_PAYOUT * RATE).toFixed(0)}€
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  headerMin: { paddingHorizontal: 16, paddingBottom: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },

  balanceCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 18, marginBottom: 14 },
  balanceLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 4 },
  balanceValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  balanceEur: { fontSize: 12, marginTop: 4 },
  warningPill: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  warningPillText: { fontSize: 11, fontWeight: '700' },

  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 14 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 14 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 4 },
  inputMulti: { height: 80, textAlignVertical: 'top' },

  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  methodLabel: { fontSize: 13, fontWeight: '700' },

  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  primaryBtnText: { fontSize: 15, fontWeight: '800' },

  disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 14 },

  successIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  successTitle: { fontSize: 26, fontWeight: '900' },
  successSub: { fontSize: 15, textAlign: 'center', lineHeight: 24 },
});

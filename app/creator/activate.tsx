/**
 * app/creator/activate.tsx — Creator-Modus aktivieren
 * Design: App-native Monochrom-Stil
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Gift, ShoppingBag, Video, TrendingUp,
  Diamond, CheckCircle2, Sparkles,
} from 'lucide-react-native';
import { useTheme } from '@/lib/useTheme';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { impactAsync, notificationAsync, ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

const BENEFITS = [
  { icon: Gift,        label: 'Gift-Einnahmen',  desc: '70% aller Gifts gehen direkt an dich' },
  { icon: ShoppingBag, label: 'Mini-Shop',        desc: 'Verkaufe Produkte direkt in deinem Profil' },
  { icon: Video,       label: 'Live-Shopping',    desc: 'Präsentiere Produkte live im Stream' },
  { icon: TrendingUp,  label: 'Creator Studio',   desc: 'Vollständiges Analytics-Dashboard' },
  { icon: Diamond,     label: 'Auszahlung',       desc: 'Ab 2.500 💎 (~50€) auszahlbar' },
];

export default function CreatorActivateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, setProfile } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Bereits Creator?
  if (profile?.is_creator || success) {
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
          <Text style={[s.successTitle, { color: colors.text.primary }]}>Du bist Creator</Text>
          <Text style={[s.successSub, { color: colors.text.muted }]}>
            Creator Studio ist jetzt freigeschaltet.
          </Text>
          <Pressable
            onPress={() => router.replace('/creator/dashboard' as any)}
            style={[s.primaryBtn, { backgroundColor: colors.text.primary }]}
            accessibilityRole="button"
          >
            <Text style={[s.primaryBtnText, { color: colors.bg.primary }]}>Creator Studio öffnen →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleActivate = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    impactAsync(ImpactFeedbackStyle.Medium);
    const { data, error: err } = await supabase
      .from('profiles')
      .update({ is_creator: true })
      .eq('id', profile.id)
      .select()
      .single();
    setLoading(false);
    if (err) { setError(err.message); return; }
    setProfile({ ...profile, ...data });
    notificationAsync(NotificationFeedbackType.Success);
    setSuccess(true);
  };

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>Creator werden</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
      >
        {/* Tagline */}
        <View style={s.taglineWrap}>
          <View style={[s.taglineBadge, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <Sparkles size={12} color={colors.text.primary} strokeWidth={2} />
            <Text style={[s.taglineBadgeText, { color: colors.text.primary }]}>Kostenlos · Sofort · Jederzeit deaktivierbar</Text>
          </View>
          <Text style={[s.taglineTitle, { color: colors.text.primary }]}>
            Monetarisiere{'\n'}deine Inhalte
          </Text>
          <Text style={[s.taglineSub, { color: colors.text.muted }]}>
            Werde Teil der Creator-Community und verdiene mit deinem Content.
          </Text>
        </View>

        {/* Benefits */}
        <Text style={[s.sectionLabel, { color: colors.text.muted }]}>WAS DU BEKOMMST</Text>
        <View style={[s.benefitTable, { borderColor: colors.border.subtle }]}>
          {BENEFITS.map(({ icon: Icon, label, desc }, i) => (
            <View
              key={label}
              style={[
                s.benefitRow,
                i < BENEFITS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle },
              ]}
            >
              <View style={[s.benefitIconWrap, { backgroundColor: colors.bg.elevated }]}>
                <Icon size={16} color={colors.text.primary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.benefitLabel, { color: colors.text.primary }]}>{label}</Text>
                <Text style={[s.benefitDesc,  { color: colors.text.muted }]}>{desc}</Text>
              </View>
              <CheckCircle2 size={14} color={colors.text.secondary} strokeWidth={2} />
            </View>
          ))}
        </View>

        {/* Einnahmen-Tabelle */}
        <Text style={[s.sectionLabel, { color: colors.text.muted, marginTop: 24 }]}>EINNAHMEN-SPLIT</Text>
        <View style={[s.splitTable, { borderColor: colors.border.subtle }]}>
          {[
            { src: 'Gifts',          creator: '70%', platform: '30%' },
            { src: 'Shop-Verkäufe', creator: '92%', platform: '8%'  },
          ].map((row, i, arr) => (
            <View key={row.src} style={[s.splitRow, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle }]}>
              <Text style={[s.splitSrc,      { color: colors.text.secondary }]}>{row.src}</Text>
              <Text style={[s.splitCreator,  { color: colors.text.primary }]}>{row.creator}</Text>
              <Text style={[s.splitPlatform, { color: colors.text.muted }]}>{row.platform} Plattform</Text>
            </View>
          ))}
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}

        {/* CTA */}
        <Pressable
          onPress={handleActivate}
          disabled={loading}
          style={[s.primaryBtn, { backgroundColor: colors.text.primary, opacity: loading ? 0.6 : 1, marginTop: 24 }]}
          accessibilityRole="button"
          accessibilityLabel="Creator-Modus aktivieren"
        >
          {loading
            ? <ActivityIndicator color={colors.bg.primary} />
            : <Text style={[s.primaryBtnText, { color: colors.bg.primary }]}>Jetzt Creator werden</Text>
          }
        </Pressable>

        <Text style={[s.disclaimer, { color: colors.text.muted }]}>
          Kostenlos. Keine Exklusivität. Jederzeit deaktivierbar.{'\n'}
          Mit der Aktivierung stimmst du den Creator-Bedingungen zu.
        </Text>
      </ScrollView>
    </View>
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

  taglineWrap: { paddingVertical: 32, gap: 12 },
  taglineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  taglineBadgeText: { fontSize: 11, fontWeight: '700' },
  taglineTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 38 },
  taglineSub: { fontSize: 15, lineHeight: 22 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },

  benefitTable: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  benefitIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  benefitLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  benefitDesc: { fontSize: 12, lineHeight: 16 },

  splitTable: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  splitRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 0 },
  splitSrc:      { flex: 1, fontSize: 13, fontWeight: '600' },
  splitCreator:  { fontSize: 15, fontWeight: '900', marginRight: 12 },
  splitPlatform: { fontSize: 11, fontWeight: '500' },

  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8 },

  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },

  disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 14 },

  successIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  successTitle: { fontSize: 26, fontWeight: '900', marginTop: 4 },
  successSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});

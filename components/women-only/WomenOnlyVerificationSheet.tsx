/**
 * WomenOnlyVerificationSheet.tsx
 * 
 * Bottom-Sheet für die Women-Only Zone Verifikation.
 * 3-Screen-Flow:
 *   1. Was ist die Women-Only Zone? (Info)
 *   2. Bestätigung (Selbstdeklaration Level 1)
 *   3. Willkommen! (Erfolg)
 */

import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Shield, CheckCircle2, Lock } from 'lucide-react-native';
import { useTheme } from '@/lib/useTheme';
import { useWomenOnly } from '@/lib/useWomenOnly';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_H } = Dimensions.get('window');

type Step = 'info' | 'confirm' | 'success';

interface WomenOnlyVerificationSheetProps {
  visible: boolean;
  onClose: () => void;
  onVerified?: () => void;
}

export function WomenOnlyVerificationSheet({
  visible,
  onClose,
  onVerified,
}: WomenOnlyVerificationSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { activateLevel1 } = useWomenOnly();

  const [step, setStep] = useState<Step>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setStep('info');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { error: err } = await activateLevel1();

    setLoading(false);

    if (err) {
      setError(err);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('success');
    onVerified?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={s.backdrop} onPress={handleClose} />

      <View style={[s.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.bg.primary }]}>

        {/* ── Ziehgriff ── */}
        <View style={[s.handle, { backgroundColor: colors.border.default }]} />

        {/* ── Schließen Button ── */}
        <Pressable style={s.closeBtn} onPress={handleClose} hitSlop={12}>
          <X size={20} stroke={colors.icon.muted} strokeWidth={2} />
        </Pressable>

        {/* ══════════ STEP 1: INFO ══════════ */}
        {step === 'info' && (
          <View style={s.content}>
            {/* Premium Gradient Header */}
            <LinearGradient
              colors={['#F43F5E', '#A855F7', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.iconCircle}
            >
              <Text style={s.iconEmoji}>🌸</Text>
            </LinearGradient>

            <Text style={[s.title, { color: colors.text.primary }]}>
              Women-Only Zone
            </Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>
              Ein geschützter Raum nur für Frauen
            </Text>

            {/* Feature-Liste */}
            <View style={s.featureList}>
              {[
                { icon: '🔒', text: 'Kein Mann sieht deine Women-Only Inhalte' },
                { icon: '👗', text: 'Teile Outfits und Videos ohne Sorgen' },
                { icon: '🌸', text: 'Sei Teil einer sicheren Community' },
                { icon: '✨', text: 'Exklusiver Premium-Content nur für Frauen' },
              ].map((f) => (
                <View key={f.text} style={s.featureRow}>
                  <Text style={s.featureIcon}>{f.icon}</Text>
                  <Text style={[s.featureText, { color: colors.text.secondary }]}>
                    {f.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Technischer Hinweis */}
            <View style={[s.infoBox, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
              <Shield size={14} stroke={colors.text.muted} strokeWidth={2} />
              <Text style={[s.infoBoxText, { color: colors.text.muted }]}>
                Technisch gesichert: Women-Only Posts sind auf Datenbankebene
                gesperrt — sie werden nie an nicht-verifizierte Nutzer gesendet.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setStep('confirm')}
            >
              <LinearGradient
                colors={['#F43F5E', '#A855F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtnGradient}
              >
                <Text style={s.primaryBtnText}>Weiter →</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* ══════════ STEP 2: BESTÄTIGUNG ══════════ */}
        {step === 'confirm' && (
          <View style={s.content}>
            <LinearGradient
              colors={['#F43F5E', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.iconCircle}
            >
              <Lock size={28} stroke="#fff" strokeWidth={2} />
            </LinearGradient>

            <Text style={[s.title, { color: colors.text.primary }]}>
              Bestätigung
            </Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>
              Du erklärst, dass du eine Frau bist und diese Zone nutzen möchtest.
            </Text>

            {/* Info zur Selbstdeklaration */}
            <View style={[s.infoBox, { backgroundColor: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.2)' }]}>
              <Text style={[s.infoBoxText, { color: colors.text.secondary }]}>
                Durch Bestätigen erklärst du verbindlich, dass du weiblich bist.
                Falsche Angaben führen zum dauerhaften Account-Ausschluss (AGB §3).
              </Text>
            </View>

            {error && (
              <Text style={s.errorText}>{error}</Text>
            )}

            <Pressable
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleConfirm}
              disabled={loading}
            >
              <LinearGradient
                colors={['#F43F5E', '#A855F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtnGradient}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryBtnText}>Ja, ich bin eine Frau ✓</Text>
                }
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.secondaryBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setStep('info')}
            >
              <Text style={[s.secondaryBtnText, { color: colors.text.muted }]}>
                Zurück
              </Text>
            </Pressable>
          </View>
        )}

        {/* ══════════ STEP 3: ERFOLG ══════════ */}
        {step === 'success' && (
          <View style={s.content}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.iconCircle}
            >
              <CheckCircle2 size={28} stroke="#fff" strokeWidth={2} />
            </LinearGradient>

            <Text style={[s.title, { color: colors.text.primary }]}>
              Willkommen! 🌸
            </Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>
              Du hast jetzt Zugang zur Women-Only Zone.
            </Text>

            <View style={s.featureList}>
              {[
                '✅ Du siehst Women-Only Posts im Feed',
                '✅ Du kannst Women-Only Live-Streams beitreten',
                '✅ Du kannst eigene Women-Only Posts erstellen',
                '✅ Dein Profil zeigt das 🌸 Badge',
              ].map((line) => (
                <View key={line} style={s.featureRow}>
                  <Text style={[s.featureText, { color: colors.text.secondary }]}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleClose}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtnGradient}
              >
                <Text style={s.primaryBtnText}>Los geht's!</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
    maxHeight: SCREEN_H * 0.88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingTop: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  featureList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    width: '100%',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  primaryBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
});

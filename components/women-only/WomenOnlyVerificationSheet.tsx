/**
 * WomenOnlyVerificationSheet.tsx — Beitritts-Sheet der Women-Only Zone.
 *
 * Drei Schritte: info → confirm → sent.
 * Seit dem Freigabe-Modell (16.7.2026) endet der Flow mit „Antrag ist da" —
 * Zugang gibt es erst nach Admin-Freigabe, nicht sofort.
 *
 * Design-Sprache: Theme-Sheet (bg.elevated), monochrome Lucide-Icons,
 * EIN Rose-Akzent — keine Gradients, keine Emoji-Icons.
 */

import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
import { useWomenOnly } from '@/lib/useWomenOnly';
import * as Haptics from 'expo-haptics';
import { Bell, Clock, Flower2, Lock, Radio, ShieldCheck, Users, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_H } = Dimensions.get('window');

type Step = 'info' | 'confirm' | 'sent';

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
  const { t } = useI18n();
  const { requestAccess } = useWomenOnly();

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

    const { error: err } = await requestAccess();

    setLoading(false);

    if (err) {
      setError(err);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('sent');
    onVerified?.();
  };

  const INFO_FEATURES = [
    { Icon: Lock, text: t('woz.featPrivacy') },
    { Icon: Radio, text: t('woz.featShare') },
    { Icon: Users, text: t('woz.featFeed') },
  ];

  const SENT_STEPS = [
    { Icon: Clock, text: t('woz.sentStep1') },
    { Icon: Bell, text: t('woz.sentStep2') },
    { Icon: Lock, text: t('woz.sentStep3') },
  ];

  const primaryBtn = [s.primaryBtn, { backgroundColor: colors.text.primary }];
  const primaryBtnText = [s.primaryBtnText, { color: colors.bg.primary }];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={s.backdrop} onPress={handleClose} />

      <View style={[s.sheet, { paddingBottom: insets.bottom + 24, backgroundColor: colors.bg.elevated }]}>
        <View style={[s.handle, { backgroundColor: colors.border.default }]} />

        <Pressable style={s.closeBtn} onPress={handleClose} hitSlop={12}>
          <X size={20} color={colors.icon.muted} strokeWidth={2} />
        </Pressable>

        {/* ══════════ STEP 1: INFO ══════════ */}
        {step === 'info' && (
          <View style={s.content}>
            <View style={[s.iconCircle, { backgroundColor: `${colors.accent.rose}14` }]}>
              <Flower2 size={28} color={colors.accent.rose} strokeWidth={1.8} />
            </View>

            <Text style={[s.title, { color: colors.text.primary }]}>{t('woz.title')}</Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>{t('woz.gateSub')}</Text>

            <View style={s.featureList}>
              {INFO_FEATURES.map(({ Icon, text }) => (
                <View key={text} style={s.featureRow}>
                  <View style={[s.featureIconWrap, { backgroundColor: colors.bg.secondary }]}>
                    <Icon size={15} color={colors.text.primary} strokeWidth={2} />
                  </View>
                  <Text style={[s.featureText, { color: colors.text.secondary }]}>{text}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [...primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setStep('confirm')}
            >
              <Text style={primaryBtnText}>{t('woz.next')}</Text>
            </Pressable>
          </View>
        )}

        {/* ══════════ STEP 2: BESTÄTIGUNG ══════════ */}
        {step === 'confirm' && (
          <View style={s.content}>
            <View style={[s.iconCircle, { backgroundColor: colors.bg.secondary }]}>
              <Lock size={26} color={colors.text.primary} strokeWidth={2} />
            </View>

            <Text style={[s.title, { color: colors.text.primary }]}>{t('woz.confirmTitle')}</Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>{t('woz.confirmSub')}</Text>

            <View style={[s.infoBox, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
              <Text style={[s.infoBoxText, { color: colors.text.muted }]}>{t('woz.confirmNote')}</Text>
            </View>

            {error && <Text style={s.errorText}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [...primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg.primary} />
                : <Text style={primaryBtnText}>{t('woz.confirmCta')}</Text>}
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.secondaryBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setStep('info')}
            >
              <Text style={[s.secondaryBtnText, { color: colors.text.muted }]}>{t('woz.back')}</Text>
            </Pressable>
          </View>
        )}

        {/* ══════════ STEP 3: ANTRAG GESENDET ══════════ */}
        {step === 'sent' && (
          <View style={s.content}>
            <View style={[s.iconCircle, { backgroundColor: `${colors.accent.rose}14` }]}>
              <ShieldCheck size={28} color={colors.accent.rose} strokeWidth={2} />
            </View>

            <Text style={[s.title, { color: colors.text.primary }]}>{t('woz.sentTitle')}</Text>
            <Text style={[s.subtitle, { color: colors.text.secondary }]}>{t('woz.sentSub')}</Text>

            <View style={s.featureList}>
              {SENT_STEPS.map(({ Icon, text }) => (
                <View key={text} style={s.featureRow}>
                  <View style={[s.featureIconWrap, { backgroundColor: colors.bg.secondary }]}>
                    <Icon size={15} color={colors.text.primary} strokeWidth={2} />
                  </View>
                  <Text style={[s.featureText, { color: colors.text.secondary }]}>{text}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [...primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleClose}
            >
              <Text style={primaryBtnText}>{t('woz.sentDone')}</Text>
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
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    paddingTop: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  featureList: {
    width: '100%',
    gap: 12,
    marginBottom: 22,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
  },
  infoBoxText: {
    fontSize: 12,
    lineHeight: 18,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
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

/**
 * WomenOnlyBlur.tsx
 *
 * Overlay über women_only-Posts, wenn die Betrachterin (noch) keinen Zugang
 * zur Women-Only Zone hat. Tippen öffnet das Beitritts-Sheet.
 *
 * Liegt immer auf Medien → feste Hell-auf-Dunkel-Fläche (dunkler Scrim),
 * ein dezenter Rose-Akzent am Icon — kein Gradient, kein Emoji.
 */

import { WomenOnlyVerificationSheet } from '@/components/women-only/WomenOnlyVerificationSheet';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';

interface WomenOnlyBlurProps {
  /** Größe des Containers (für den Overlay) */
  style?: object;
}

const ROSE = '#F43F5E'; // Medien-Overlay ist theme-unabhängig (immer auf dunklem Scrim)

export function WomenOnlyBlur({ style }: WomenOnlyBlurProps) {
  const [showSheet, setShowSheet] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <Pressable
        style={[s.overlay, style]}
        onPress={() => setShowSheet(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('woz.blurTitle')} — ${t('woz.blurSub')}`}
      >
        <View style={s.iconCircle}>
          <Lock size={18} color={ROSE} strokeWidth={2.2} />
        </View>
        <Text style={s.label}>{t('woz.blurTitle')}</Text>
        <Text style={s.sub}>{t('woz.blurSub')}</Text>
      </Pressable>

      <WomenOnlyVerificationSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 10,
    backgroundColor: 'rgba(10,10,14,0.82)',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,63,94,0.16)',
    marginBottom: 4,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  sub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
});

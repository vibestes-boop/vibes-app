/**
 * WomenOnlyBlur.tsx
 * 
 * Overlay das angezeigt wird wenn ein Post women_only=true ist
 * und die aktuelle Nutzerin keinen Zugang zur Women-Only Zone hat.
 * 
 * Tippen öffnet das Verifikations-Sheet.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WomenOnlyVerificationSheet } from '@/components/women-only/WomenOnlyVerificationSheet';

interface WomenOnlyBlurProps {
  /** Größe des Containers (für den Overlay) */
  style?: object;
}

export function WomenOnlyBlur({ style }: WomenOnlyBlurProps) {
  const [showSheet, setShowSheet] = useState(false);

  return (
    <>
      <Pressable
        style={[s.overlay, style]}
        onPress={() => setShowSheet(true)}
        accessibilityRole="button"
        accessibilityLabel="Women-Only Inhalt — Tippen zum Verifizieren"
      >
        <LinearGradient
          colors={['rgba(244,63,94,0.75)', 'rgba(168,85,247,0.85)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={s.lockEmoji}>🔒</Text>
        <Text style={s.label}>Women-Only</Text>
        <Text style={s.sub}>Tippen zum Verifizieren</Text>
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
  },
  lockEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
});

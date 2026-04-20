/**
 * app/create/ar-camera.tsx
 * AR-Kamera Route mit Expo Go Guard
 *
 * In Expo Go: zeigt Placeholder (VisionCamera nicht verfügbar)
 * In Production/Dev Build: vollständige AR-Kamera
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Expo Go Detection ────────────────────────────────────────────────────────
const isExpoGo = Constants.appOwnership === 'expo';

// ─── Dynamischer Import — nur wenn NICHT Expo Go ──────────────────────────────
// Verhindert VisionCamera crash in Expo Go beim Routen-Laden
type ARScreenProps = {
  onMediaCaptured: (uri: string, type: 'photo' | 'video') => void;
  onClose: () => void;
};

let ARCameraScreen: React.ComponentType<ARScreenProps> | null = null;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ARCameraScreen = require('@/components/camera/ARCameraScreen').ARCameraScreen;
  } catch {
    ARCameraScreen = null;
  }
}

// ─── Expo Go Placeholder ──────────────────────────────────────────────────────
function ExpoGoPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0D1A', '#1a0a2e']}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.emoji}>🎨</Text>
      <Text style={styles.title}>AR Filter</Text>
      <Text style={styles.subtitle}>
        AR Filter sind in der nächsten{'\n'}App-Version verfügbar.{'\n\n'}
        Teste sie im Production Build.
      </Text>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <LinearGradient
          colors={['#FFFFFF', '#A855F7']}
          style={styles.backBtnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.backBtnText}>← Zurück</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Route ───────────────────────────────────────────────────────────────
export default function ARCameraRoute() {
  const router = useRouter();

  const handleClose = () => router.back();

  const handleMediaCaptured = (uri: string, type: 'photo' | 'video') => {
    if (type === 'photo') {
      router.replace({ pathname: '/create' as any, params: { mediaUri: uri, mediaType: 'image' } });
    } else {
      router.replace({ pathname: '/create/trim' as any, params: { mediaUri: uri } });
    }
  };

  // Expo Go oder VisionCamera nicht verfügbar
  if (!ARCameraScreen) {
    return <ExpoGoPlaceholder onBack={handleClose} />;
  }

  return (
    <ARCameraScreen
      onMediaCaptured={handleMediaCaptured}
      onClose={handleClose}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  backBtn: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  backBtnGrad: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

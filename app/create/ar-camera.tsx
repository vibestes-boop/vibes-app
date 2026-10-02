/**
 * app/create/ar-camera.tsx
 * AR-Kamera Route mit Expo Go Guard
 *
 * In Expo Go: zeigt Placeholder (VisionCamera nicht verfügbar)
 * In Production/Dev Build: vollständige AR-Kamera
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { NativeModules,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';

type ARScreenProps = {
  onMediaCaptured: (uri: string, type: 'photo' | 'video') => void;
  onClose: () => void;
};

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
  useThemedStatusBar('light');
  const router = useRouter();
  // Expo Router evaluates routes before they are visited. Defer native camera
  // imports until this screen opens, and only when its native module exists.
  const ARCameraScreen = useMemo<React.ComponentType<ARScreenProps> | null>(() => {
    if (!NativeModules.CameraView) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@/components/camera/ARCameraScreen').ARCameraScreen;
    } catch { return null; }
  }, []);

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
    fontWeight: '600',
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

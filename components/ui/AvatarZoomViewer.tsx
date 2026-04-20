/**
 * AvatarZoomViewer.tsx
 * Fullscreen Avatar Zoom — erscheint bei LongPress auf Profilbild.
 * Dark-Overlay + Spring-Animation + Tap-to-close
 */
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
// Reanimated via require() — Hermes-sicher
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _ra = require('react-native-reanimated') as any;
const _ns = _ra?.default ?? _ra;
const AnimatedView = _ns?.View ?? View;
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const IMG_SIZE = Math.min(W * 0.82, 340);

interface Props {
  visible: boolean;
  avatarUrl: string | null | undefined;
  initials: string;
  onClose: () => void;
}

export function AvatarZoomViewer({ visible, avatarUrl, initials, onClose }: Props) {
  const scale   = useSharedValue(0.55);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 180 });
      scale.value   = withSpring(1, { damping: 16, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 140 });
      scale.value   = withTiming(0.65, { duration: 140 });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Dark Blur-Ersatz */}
        <AnimatedView style={[StyleSheet.absoluteFill, styles.backdrop, bgStyle]} />

        {/* Avatar — groß */}
        <AnimatedView style={[styles.avatarWrap, imgStyle]}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.fallback]}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
        </AnimatedView>

        {/* Dismiss-Hinweis */}
        <AnimatedView style={[styles.hint, bgStyle]}>
          <Text style={styles.hintText}>Tippen zum Schließen</Text>
        </AnimatedView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  avatarWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 30,
  },
  avatar: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: IMG_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  fallback: {
    backgroundColor: '#0e4a58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontSize: IMG_SIZE * 0.3,
    fontWeight: '800',
    letterSpacing: -2,
  },
  hint: {
    position: 'absolute',
    bottom: H * 0.12,
  },
  hintText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

/**
 * CreateSheet.tsx
 * TikTok-Style Creation Flow — Bottom Sheet mit 3 visuell reichen Karten.
 * Ersetzt den hässlichen Alert.alert Dialog.
 */
import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Zap, Radio } from 'lucide-react-native';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const ReAnimated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onPost: () => void;
  onStory: () => void;
  onLive: () => void;
}

// ── Pulsierender Live-Dot ─────────────────────────────────────────────────────
function PulsingDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 700, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 700 }),
        withTiming(0.8, { duration: 700 }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={s.dotWrapper}>
      <ReAnimated.View style={[s.dotRing, pulseStyle]} />
      <View style={s.dotCore} />
    </View>
  );
}

// ── Einzelne Create-Karte ─────────────────────────────────────────────────────
function CreateCard({
  label,
  sublabel,
  colors,
  icon,
  isLive = false,
  onPress,
  delay = 0,
}: {
  label: string;
  sublabel: string;
  colors: [string, string, ...string[]];
  icon?: React.ReactNode;
  isLive?: boolean;
  onPress: () => void;
  delay?: number;
}) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Jede Karte erscheint mit leichtem Versatz (staggered)
    const t = setTimeout(() => {
      scale.value = withSpring(1, { damping: 18, stiffness: 220 });
      opacity.value = withTiming(1, { duration: 180 });
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <ReAnimated.View style={[s.cardWrap, cardStyle]}>
      <Pressable
        onPressIn={() => { pressScale.value = withSpring(0.93, { damping: 20, stiffness: 300 }); }}
        onPressOut={() => { pressScale.value = withSpring(1, { damping: 15, stiffness: 250 }); }}
        onPress={onPress}
        style={{ flex: 1 }}
      >
        <ReAnimated.View style={[{ flex: 1 }, pressStyle]}>
          <LinearGradient colors={colors} style={s.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {/* Glow-Overlay */}
            <View style={s.cardGlow} />

            {isLive ? <PulsingDot /> : icon}

            <View style={s.cardTextWrap}>
              <Text style={s.cardLabel}>{label}</Text>
              <Text style={s.cardSub}>{sublabel}</Text>
            </View>
          </LinearGradient>
        </ReAnimated.View>
      </Pressable>
    </ReAnimated.View>
  );
}

// ── Haupt CreateSheet ─────────────────────────────────────────────────────────
export function CreateSheet({ visible, onClose, onPost, onStory, onLive }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_H);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { damping: 26, stiffness: 260, mass: 0.9 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_H, { duration: 240, easing: Easing.in(Easing.cubic) });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  const handleAction = (action: () => void) => {
    onClose();
    // Kleines Delay damit Sheet erst schließt, dann Seite öffnet
    setTimeout(action, 120);
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <ReAnimated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </ReAnimated.View>

      {/* Sheet */}
      <ReAnimated.View style={[s.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>
        {/* Drag Handle */}
        <View style={s.handle} />

        {/* Titel */}
        <Text style={s.title}>Erstellen</Text>

        {/* Die 3 Karten */}
        <View style={s.cardsRow}>
          <CreateCard
            label="Post"
            sublabel="Foto oder Video"
            colors={['#1E3A5F', '#1a6bb5', '#0EA5E9']}
            icon={<Camera size={38} color="#fff" strokeWidth={1.8} />}
            onPress={() => handleAction(onPost)}
            delay={0}
          />
          <CreateCard
            label="Story"
            sublabel="24h sichtbar"
            colors={['#6D1A6E', '#C026D3', '#F0ABFC']}
            icon={<Zap size={38} color="#fff" strokeWidth={1.8} />}
            onPress={() => handleAction(onStory)}
            delay={60}
          />
          <CreateCard
            label="Live"
            sublabel="Jetzt senden"
            colors={['#7F1D1D', '#DC2626', '#FCA5A5']}
            isLive
            onPress={() => handleAction(onLive)}
            delay={120}
          />
        </View>

        {/* Abbrechen */}
        <Pressable style={s.cancelBtn} onPress={onClose}>
          <Text style={s.cancelText}>Abbrechen</Text>
        </Pressable>
      </ReAnimated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0D0D14',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.3,
  },

  // Karten
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  cardWrap: {
    flex: 1,
    height: 180,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
    padding: 12,
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardTextWrap: {
    alignItems: 'center',
    gap: 2,
  },
  cardLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cardSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Live Dot
  dotWrapper: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,80,80,0.7)',
  },
  dotCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
  },

  // Cancel
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    fontWeight: '600',
  },
});

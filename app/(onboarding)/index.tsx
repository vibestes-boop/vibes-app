import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Heart,SlidersHorizontal,Users } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import {
useAnimatedStyle,
useSharedValue,
withDelay,
withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

// labelKey-Muster: Konstanten tragen nur Keys, t() läuft am Renderpunkt.
const FEATURES = [
  {
    icon: SlidersHorizontal,
    color: '#FFFFFF',
    titleKey: 'onboarding.feat1Title',
    descKey: 'onboarding.feat1Desc',
  },
  {
    icon: Users,
    color: '#34D399',
    titleKey: 'onboarding.feat2Title',
    descKey: 'onboarding.feat2Desc',
  },
  {
    icon: Heart,
    color: '#F472B6',
    titleKey: 'onboarding.feat3Title',
    descKey: 'onboarding.feat3Desc',
  },
] as const;

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[number];
  index: number;
}) {
  const Icon = feature.icon;
  const { t } = useI18n();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  // Reanimated: einmalige Entry-Animation pro Karte (Shared Values, nur Mount)
  useEffect(() => {
    opacity.value = withDelay(400 + index * 150, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(400 + index * 150, withTiming(0, { duration: 150 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- index + Shared Values absichtlich nicht in deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <BlurView intensity={30} tint="dark" style={styles.cardBlur}>
        <View style={[styles.cardIcon, { backgroundColor: `${feature.color}20` }]}>
          <Icon size={22} color={feature.color} strokeWidth={1.8} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{t(feature.titleKey)}</Text>
          <Text style={styles.cardDesc}>{t(feature.descKey)}</Text>
        </View>
      </BlurView>
    </Animated.View>
  );
}

export default function OnboardingWelcome() {
  useThemedStatusBar('light');
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const btnOpacity = useSharedValue(0);
  const btnTranslate = useSharedValue(20);

  // Reanimated: Welcome-Screen nur beim ersten Mount
  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 700 });
    logoScale.value = withTiming(1, { duration: 200 });
    btnOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
    btnTranslate.value = withDelay(900, withTiming(0, { duration: 150 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Shared Values, nur Mount
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTranslate.value }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#0d0520', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />

      {/* Decorative glow */}
      <View style={styles.glow} />

      <View style={[styles.inner, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Text style={styles.logo}>Serlo</Text>
          <View style={styles.logoDot} />
          <Text style={styles.tagline}>{t('onboarding.welcomeTagline')}</Text>
        </Animated.View>

        {/* Feature Cards */}
        <View style={styles.cards}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.titleKey} feature={f} index={i} />
          ))}
        </View>

        {/* CTA Button */}
        <Animated.View style={[styles.btnWrap, btnStyle]}>
          <Pressable
            style={styles.btn}
            onPress={() => router.push('/(onboarding)/username')}
          >
            <LinearGradient
              colors={['#CCCCCC', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              <Text style={styles.btnText}>{t('onboarding.letsGo')}</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.hint}>{t('onboarding.setupHint')}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#CCCCCC',
    opacity: 0.12,
    top: -80,
    alignSelf: 'center',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  logoWrap: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontSize: 52,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginTop: -16,
    marginLeft: 4,
    alignSelf: 'center',
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  cards: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 17,
  },
  btnWrap: {
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
});

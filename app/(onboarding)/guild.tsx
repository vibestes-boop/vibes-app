import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, Sparkles, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';

const GUILD_COLORS: Record<string, [string, string]> = {
  'Pod Alpha': ['#CCCCCC', '#FFFFFF'],
  'Pod Beta': ['#0EA5E9', '#38BDF8'],
  'Pod Gamma': ['#059669', '#34D399'],
  'Pod Delta': ['#D97706', '#FBBF24'],
  'Pod Epsilon': ['#DC2626', '#F87171'],
};

export default function OnboardingGuild() {
  const insets = useSafeAreaInsets();
  const { profile, fetchProfile } = useAuthStore();
  const [guildName, setGuildName] = useState<string | null>(null);
  const [guildDesc, setGuildDesc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0.3);
  const textOpacity = useSharedValue(0);
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    if (!profile?.guild_id) return;

    supabase
      .from('guilds')
      .select('name, description')
      .eq('id', profile.guild_id)
      .single()
      .then(({ data }) => {
        if (data) {
          setGuildName(data.name);
          setGuildDesc(data.description);

          // Entry animations
          scale.value = withDelay(100, withTiming(1, { duration: 200 }));
          opacity.value = withDelay(100, withTiming(1, { duration: 600 }));
          glow.value = withRepeat(
            withSequence(
              withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
              withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
          );
          textOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
          btnOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated Shared Values; Trigger nur guild_id
  }, [profile?.guild_id]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: (1 - textOpacity.value) * 20 }],
  }));

  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: (1 - btnOpacity.value) * 16 }],
  }));

  const colors = guildName ? (GUILD_COLORS[guildName] ?? ['#CCCCCC', '#FFFFFF']) : ['#CCCCCC', '#FFFFFF'];

  const handleFinish = async () => {
    if (!profile?.id) return;
    setLoading(true);

    await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', profile.id);

    await fetchProfile(profile.id);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#0d0520', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated glow */}
      <Animated.View style={[styles.glowCircle, { backgroundColor: colors[0] }, glowStyle]} />

      <View style={[styles.inner, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>

        {/* Step indicator — 4 Schritte */}
        <View style={styles.stepRow}>
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepActive]} />
        </View>

        <Text style={styles.title}>Dein Guild wartet{'\n'}auf dich.</Text>

        {/* Guild Badge */}
        <Animated.View style={[styles.badgeWrap, badgeStyle]}>
          <BlurView intensity={40} tint="dark" style={styles.badgeBlur}>
            <LinearGradient
              colors={[`${colors[0]}30`, `${colors[1]}10`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={[styles.guildIcon, { backgroundColor: `${colors[0]}25` }]}>
              <Users size={36} color={colors[1]} strokeWidth={1.5} />
            </View>
            <Text style={[styles.guildName, { color: colors[1] }]}>
              {guildName ?? '...'}
            </Text>
            <View style={styles.sparkleRow}>
              <Sparkles size={12} color={colors[1]} strokeWidth={1.5} />
              <Text style={[styles.guildTag, { color: `${colors[1]}99` }]}>
                Dein Micro-Pod
              </Text>
              <Sparkles size={12} color={colors[1]} strokeWidth={1.5} />
            </View>
          </BlurView>
        </Animated.View>

        {/* Description */}
        <Animated.View style={[styles.descWrap, textStyle]}>
          <Text style={styles.descTitle}>
            Willkommen in deiner Community!
          </Text>
          <Text style={styles.descText}>
            {guildDesc
              ? `Du bist Teil von „${guildName}" – ${guildDesc}. Hier siehst du jeden Post deiner 150 Gleichgesinnten, chronologisch und ohne Algorithmus.`
              : 'Du wirst gleich deinem Guild zugewiesen...'}
          </Text>

          <View style={styles.factRow}>
            <View style={styles.fact}>
              <Text style={[styles.factNum, { color: colors[1] }]}>150</Text>
              <Text style={styles.factLabel}>Mitglieder</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <Text style={[styles.factNum, { color: colors[1] }]}>100%</Text>
              <Text style={styles.factLabel}>Sichtbarkeit</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <Text style={[styles.factNum, { color: colors[1] }]}>Kein</Text>
              <Text style={styles.factLabel}>Algorithmus</Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={btnStyle}>
          <Pressable style={styles.btn} onPress={handleFinish} disabled={loading}>
            <LinearGradient
              colors={loading ? ['#4B5563', '#4B5563'] : [colors[0], colors[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.btnText}>Vibes entdecken</Text>
                  <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  glowCircle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    top: -120,
    alignSelf: 'center',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 24,
    justifyContent: 'space-between',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  step: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepDone: { backgroundColor: '#FFFFFF' },
  stepActive: { backgroundColor: '#CCCCCC' },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  badgeWrap: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeBlur: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  guildIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guildName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sparkleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guildTag: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  descWrap: { gap: 16 },
  descTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  descText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 22,
  },
  factRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  fact: { alignItems: 'center', gap: 2 },
  factNum: { fontSize: 18, fontWeight: '800' },
  factLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  factDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  btn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

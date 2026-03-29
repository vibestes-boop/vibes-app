/**
 * interests.tsx — Onboarding Schritt 3: Interesse-Auswahl
 * Der User wählt 3+ Kategorien → werden als preferred_tags in DB gespeichert.
 * Gibt dem Algorithmus sofortigen Kontext — löst das Cold-Start-Problem.
 */
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';

// ── Interesse-Kategorien ─────────────────────────────────────────────────────
const INTERESTS = [
  { tag: 'Musik',       emoji: '🎵', color: '#22D3EE' },
  { tag: 'Sport',       emoji: '⚽', color: '#34D399' },
  { tag: 'Kunst',       emoji: '🎨', color: '#F472B6' },
  { tag: 'Tech',        emoji: '💻', color: '#60A5FA' },
  { tag: 'Gaming',      emoji: '🎮', color: '#FB923C' },
  { tag: 'Reisen',      emoji: '✈️', color: '#FBBF24' },
  { tag: 'Kochen',      emoji: '🍳', color: '#4ADE80' },
  { tag: 'Mode',        emoji: '👗', color: '#E879F9' },
  { tag: 'Natur',       emoji: '🌿', color: '#22D3EE' },
  { tag: 'Film',        emoji: '🎬', color: '#F87171' },
  { tag: 'Business',    emoji: '📈', color: '#818CF8' },
  { tag: 'Fitness',     emoji: '💪', color: '#FCD34D' },
] as const;

const MIN_SELECTED = 3;

export default function OnboardingInterests() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const gridOpacity = useSharedValue(0);
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    titleOpacity.value = withTiming(1, { duration: 400 });
    subtitleOpacity.value = withDelay(150, withTiming(1, { duration: 400 }));
    gridOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    btnOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const subStyle   = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const gridStyle  = useAnimatedStyle(() => ({ opacity: gridOpacity.value }));
  const btnStyle   = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: (1 - btnOpacity.value) * 16 }],
  }));

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const canProceed = selected.size >= MIN_SELECTED;

  const handleContinue = async () => {
    if (!canProceed || !profile?.id) return;
    setSaving(true);
    try {
      // preferred_tags in DB speichern — Feed-Algorithmus nutzt diese sofort
      await supabase
        .from('profiles')
        .update({ preferred_tags: Array.from(selected) })
        .eq('id', profile.id);
    } catch {
      // Nicht-kritisch: User kommt trotzdem weiter
    } finally {
      setSaving(false);
      router.push('/(onboarding)/guild');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#0d0520', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />
      <View style={styles.glow} />

      <View style={[styles.inner, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        {/* Step indicator — jetzt 4 Schritte */}
        <View style={styles.stepRow}>
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepActive]} />
          <View style={styles.step} />
        </View>

        {/* Header */}
        <Animated.View style={[styles.header, titleStyle]}>
          <Text style={styles.title}>Was begeistert{'\n'}dich?</Text>
        </Animated.View>
        <Animated.Text style={[styles.subtitle, subStyle]}>
          Wähle mindestens {MIN_SELECTED} Themen — wir zeigen dir sofort die besten Vibes.
        </Animated.Text>

        {/* Interesse-Grid */}
        <Animated.View style={[styles.gridWrap, gridStyle]}>
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {INTERESTS.map((item) => {
              const isOn = selected.has(item.tag);
              return (
                <Pressable
                  key={item.tag}
                  onPress={() => toggle(item.tag)}
                  style={({ pressed }) => [
                    styles.chip,
                    isOn && { borderColor: item.color, backgroundColor: `${item.color}18` },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.chipEmoji}>{item.emoji}</Text>
                  <Text style={[styles.chipLabel, isOn && { color: item.color }]}>
                    {item.tag}
                  </Text>
                  {isOn && (
                    <View style={[styles.checkBadge, { backgroundColor: item.color }]}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Zähler + CTA */}
        <Animated.View style={[styles.bottom, btnStyle]}>
          <Text style={styles.counter}>
            {selected.size < MIN_SELECTED
              ? `Noch ${MIN_SELECTED - selected.size} auswählen`
              : `${selected.size} ausgewählt ✓`}
          </Text>
          <Pressable
            style={[styles.btn, !canProceed && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!canProceed || saving}
          >
            <LinearGradient
              colors={canProceed ? ['#0891B2', '#22D3EE'] : ['#1F1F2E', '#1F1F2E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={[styles.btnText, !canProceed && styles.btnTextDim]}>
                    Weiter
                  </Text>
                  <ChevronRight size={20} color={canProceed ? '#fff' : '#555'} strokeWidth={2.5} />
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
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#0891B2',
    opacity: 0.1,
    top: -80,
    alignSelf: 'center',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 20,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  step: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepDone: { backgroundColor: '#22D3EE' },
  stepActive: { backgroundColor: '#0891B2' },
  header: {},
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 20,
  },
  gridWrap: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  checkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { gap: 12 },
  counter: {
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  btn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnDisabled: { opacity: 0.5 },
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
  btnTextDim: { color: '#555' },
});

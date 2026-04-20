/**
 * StoryRingAvatar — wiederverwendbarer Avatar mit Story-Ring
 *
 * • Holt Story-Daten aus useGuildStories() (shared cache, kein extra Request)
 * • Bunt = ungesehene Stories, Grau = gesehen, kein Ring = keine Stories
 * • Klick öffnet Story-Viewer direkt
 *
 * Ring-Architektur (3 Schichten, von außen nach innen):
 *  1. LinearGradient-Kreis  — TOTAL px, ring-farbig
 *  2. Gap-Kreis             — TOTAL - 2*RING, Seitenhintergrundfarbe
 *  3. Avatar-Kreis          — size px, mit Bild oder Icon
 */
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { useGuildStories } from '@/lib/useStories';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import { useTheme } from '@/lib/useTheme';

interface StoryRingAvatarProps {
  userId: string;
  avatarUrl: string | null;
  /** Avatar-Durchmesser in px (default: 40) */
  size?: number;
  /** Initials (Fallback wenn kein Bild) */
  initials?: string;
  /** Fallback-Gradient für Initialen-Avatar */
  fallbackColors?: [string, string];
  /** Zusätzlicher Style für den äußersten Wrapper */
  style?: object;
  /** Wenn gesetzt → eigene onPress-Logik statt Story-Viewer */
  onPress?: () => void;
}

export function StoryRingAvatar({
  userId,
  avatarUrl,
  size = 40,
  initials = '?',
  fallbackColors = ['#0e4a58', '#083344'],
  style,
  onPress,
}: StoryRingAvatarProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: storyGroups = [] } = useGuildStories();
  const openViewer = useStoryViewerStore((s) => s.open);

  const storyGroup = storyGroups.find((g) => g.userId === userId);
  const hasStories = (storyGroup?.stories?.length ?? 0) > 0;
  const hasUnviewed = storyGroup?.hasUnviewed ?? false;

  // Maße: 2.5px Ring + 2px Gap pro Seite → total 9px mehr als Avatar
  const RING  = hasStories ? 2.5 : 0;
  const GAP   = hasStories ? 2   : 0;
  const TOTAL = size + (RING + GAP) * 2;

  // Ringfarben: immer auf jedem Hintergrund sichtbar (kein Weiß!)
  const ringColors: [string, string] = hasStories && hasUnviewed
    ? ['#F472B6', '#A855F7']   // Pink → Lila  (ungesehen)
    : hasStories
      ? ['#9CA3AF', '#6B7280'] // Grau          (gesehen)
      : ['transparent', 'transparent'];

  const handlePress = () => {
    if (onPress) { onPress(); return; }
    if (storyGroup && hasStories) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openViewer(storyGroup, storyGroups);
      router.push('/story-viewer' as any);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={6}
      style={[{ width: TOTAL, height: TOTAL }, style]}
      accessibilityRole="button"
      accessibilityLabel={hasStories ? 'Story ansehen' : undefined}
    >
      {/* Schicht 1: Gradient-Ring (füllte gesamten TOTAL-Kreis) */}
      <LinearGradient
        colors={ringColors}
        style={[StyleSheet.absoluteFill, { borderRadius: TOTAL / 2 }]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
      />

      {/* Schicht 2: Gap — Farbe des Seiten-Hintergrunds, deckt den Innenteil des Rings ab */}
      <View
        style={{
          position: 'absolute',
          top: RING,
          left: RING,
          right: RING,
          bottom: RING,
          borderRadius: (TOTAL - RING * 2) / 2,
          backgroundColor: colors.bg.primary,
        }}
      />

      {/* Schicht 3: Avatar selbst — size x size, rund, mit Bild oder Initialen-Icon */}
      <View
        style={{
          position: 'absolute',
          top: RING + GAP,
          left: RING + GAP,
          right: RING + GAP,
          bottom: RING + GAP,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: colors.bg.elevated,
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.elevated },
            ]}
          >
            <User size={Math.round(size * 0.42)} color={colors.text.muted} strokeWidth={1.5} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

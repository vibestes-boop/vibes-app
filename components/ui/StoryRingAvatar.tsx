/**
 * StoryRingAvatar — wiederverwendbarer Avatar mit Story-Ring
 *
 * • Holt Story-Daten aus useGuildStories() (shared cache, kein extra Request)
 * • Bunt = ungesehene Stories, Grau = gesehen, kein Ring = keine Stories
 * • Klick öffnet Story-Viewer direkt
 */
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useGuildStories } from '@/lib/useStories';
import { useStoryViewerStore } from '@/lib/storyViewerStore';

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
  const router = useRouter();
  const { data: storyGroups = [] } = useGuildStories();
  const openViewer = useStoryViewerStore((s) => s.open);

  const storyGroup = storyGroups.find((g) => g.userId === userId);
  const hasStories = (storyGroup?.stories?.length ?? 0) > 0;
  const hasUnviewed = storyGroup?.hasUnviewed ?? false;

  // Ring: 3px Padding + 2px Ring-Dicke = 5px außen
  const PADDING = hasStories ? 3 : 0;
  const RING_SIZE = size + (hasStories ? PADDING * 2 + 2 : 0);

  const ringColors: [string, string] = hasStories && hasUnviewed
    ? ['#22D3EE', '#F472B6']
    : hasStories
      ? ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.15)']
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
      style={[{ width: RING_SIZE, height: RING_SIZE }, style]}
      accessibilityRole="button"
      accessibilityLabel={hasStories ? 'Story ansehen' : undefined}
    >
      <LinearGradient
        colors={ringColors}
        style={[StyleSheet.absoluteFill, { borderRadius: RING_SIZE / 2 }]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
      />
      {/* Innerer Avatar-Wrapper mit kleinem Abstand vom Ring */}
      <View style={{
        position: 'absolute',
        top: PADDING,
        left: PADDING,
        right: PADDING,
        bottom: PADDING,
        borderRadius: (RING_SIZE - PADDING * 2) / 2,
        overflow: 'hidden',
        backgroundColor: '#0A0A0A',
      }}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <LinearGradient colors={fallbackColors} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: Math.round(size * 0.35) }}>
              {initials.slice(0, 2).toUpperCase()}
            </Text>
          </LinearGradient>
        )}
      </View>
    </Pressable>
  );
}

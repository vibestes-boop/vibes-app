/**
 * ProfileHighlightsRow.tsx
 * Story-Highlights horizontal scroll row — erscheint zwischen Avatar-Section
 * und Posts-Grid im eigenen Profil.
 */
import { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PlusCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useStoryHighlights,
  useRemoveHighlight,
  type StoryHighlight,
} from '@/lib/useStoryHighlights';

function HighlightBubble({
  highlight,
  isOwn,
  onPress,
  onLongPress,
}: {
  highlight: StoryHighlight;
  isOwn: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.bubble}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`Highlight: ${highlight.title}`}
    >
      {/* Thumbnail */}
      <View style={styles.bubbleThumb}>
        <LinearGradient
          colors={['#0891B2', '#A855F7']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {highlight.media_url ? (
          <Image
            source={{ uri: highlight.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
        {/* Subtle vignette */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.35)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Label */}
      <Text style={styles.bubbleLabel} numberOfLines={1}>
        {highlight.title}
      </Text>
    </Pressable>
  );
}

export function ProfileHighlightsRow({
  userId,
  isOwn,
}: {
  userId: string | null;
  isOwn: boolean;
}) {
  const { data: highlights = [], isLoading } = useStoryHighlights(userId);
  const removeHighlight = useRemoveHighlight();

  const handleLongPress = (highlight: StoryHighlight) => {
    if (!isOwn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `"${highlight.title}" entfernen?`,
      'Das Highlight wird aus deinem Profil gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: () => removeHighlight.mutate(highlight.id),
        },
      ]
    );
  };

  if (!isLoading && highlights.length === 0 && !isOwn) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* "+ Neu" Bubble (nur für eigenes Profil) */}
        {isOwn && (
          <View style={styles.bubble}>
            <View style={[styles.bubbleThumb, styles.addThumb]}>
              <PlusCircle size={26} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
            </View>
            <Text style={styles.bubbleLabel}>Neu</Text>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#22D3EE" size="small" />
          </View>
        ) : (
          highlights.map((h) => (
            <HighlightBubble
              key={h.id}
              highlight={h}
              isOwn={isOwn}
              onPress={() => {/* Navigate to story-viewer */ }}
              onLongPress={() => handleLongPress(h)}
            />
          ))
        )}
      </ScrollView>

      {highlights.length === 0 && isOwn && !isLoading && (
        <Text style={styles.emptyHint}>
          Tippe + um Stories als Highlights zu speichern
        </Text>
      )}
    </View>
  );
}

const BUBBLE_SIZE = 64;

const styles = StyleSheet.create({
  container: {
    paddingBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingVertical: 8,
  },
  bubble: {
    alignItems: 'center',
    gap: 5,
    width: BUBBLE_SIZE,
  },
  bubbleThumb: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  addThumb: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bubbleLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    width: BUBBLE_SIZE + 8,
  },
  loadingWrap: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingBottom: 6,
  },
});

/**
 * ProfileHighlightsRow.tsx — Highlights 2.0
 *
 * • "+" öffnet visuellen Instagram-style Thumbnail-Picker (HighlightPickerSheet)
 * • Stories UND Posts als Highlight speicherbar
 * • media_url direkt im Highlight gespeichert → läuft nicht ab
 * • Long-Press → Highlight löschen
 */
import {
  View, Text, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PlusCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  useStoryHighlights, useAddHighlight, useRemoveHighlight,
  useMyStoryArchive, useMyPostsForHighlight, type StoryHighlight, type HighlightItem,
} from '@/lib/useStoryHighlights';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import type { StoryGroup } from '@/lib/useStories';
import { HighlightPickerSheet } from './HighlightPickerSheet';
import { useTheme } from '@/lib/useTheme';

const BUBBLE_SIZE = 66;

// ── Einzelne Highlight-Blase ──────────────────────────────────────────────────
function HighlightBubble({
  highlight, isOwn, onPress, onLongPress,
}: {
  highlight: StoryHighlight;
  isOwn: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={styles.bubble}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={420}
      accessibilityRole="button"
      accessibilityLabel={`Highlight: ${highlight.title}`}
    >
      <View style={styles.bubbleThumb}>
        <LinearGradient
          colors={['#CCCCCC', '#A855F7']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        {(highlight.thumbnail_url || highlight.media_url) ? (
          <Image
            source={{ uri: highlight.thumbnail_url || highlight.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text style={[styles.bubbleLabel, { color: colors.text.secondary }]} numberOfLines={1}>
        {highlight.title}
      </Text>
    </Pressable>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export function ProfileHighlightsRow({
  userId, isOwn,
}: {
  userId: string | null;
  isOwn: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: highlights = [], isLoading } = useStoryHighlights(userId);
  const { mutate: removeHighlight } = useRemoveHighlight();
  const { mutate: addHighlight, isPending: isAdding } = useAddHighlight();
  const { data: storyArchive = [] } = useMyStoryArchive();
  const { data: postArchive = [] } = useMyPostsForHighlight();
  const openViewer = useStoryViewerStore((s) => s.open);
  const [pickerVisible, setPickerVisible] = useState(false);

  // ── Highlight-Liste → StoryGroup konvertieren ─────────────────────────────
  const toGroup = (h: StoryHighlight): StoryGroup => {
    const itemsToShow = h.items.length > 0
      ? h.items
      : [{ media_url: h.media_url, media_type: h.media_type as 'image' | 'video', thumbnail_url: h.thumbnail_url }];
    return {
      userId: h.id,          // ← Highlight-ID (NICHT user_id!) → findIndex findet korrekte Position
      username: h.title,
      avatar_url: h.thumbnail_url || h.media_url,
      hasUnviewed: false,
      stories: itemsToShow.map((item, idx) => ({
        // ✔ Echte story_id verwenden wenn verfügbar → useStoryLike kann Likes persistieren
        // Fallback auf h.id-idx nur für Post-Highlights ohne story_id
        id: h.story_id ?? `${h.id}-${idx}`,
        user_id: h.user_id,   // ← echte user_id bleibt erhalten (für Profil-Link im Viewer)
        media_url: item.media_url,
        media_type: item.media_type,
        created_at: h.created_at,
        username: h.title,
        avatar_url: h.thumbnail_url || h.media_url,
        viewed: true,
        interactive: null,
      })),
    };
  };

  // ── Highlight im Story-Viewer öffnen ──────────────────────────────────────
  const handleHighlightPress = (h: StoryHighlight) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Alle Highlights als Gruppen → Viewer springt automatisch zum nächsten
    const allGroups = highlights.map(toGroup);
    const clickedGroup = allGroups[highlights.indexOf(h)] ?? allGroups[0];
    openViewer(clickedGroup, allGroups);
    router.push('/story-viewer' as any);
  };

  // ── Long-Press: Highlight löschen ────────────────────────────────────────
  const handleLongPress = (h: StoryHighlight) => {
    if (!isOwn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `"${h.title}" entfernen?`,
      'Das Highlight wird aus deinem Profil gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Entfernen', style: 'destructive', onPress: () => removeHighlight(h.id) },
      ]
    );
  };

  // ── "+" Button → Picker öffnen ───────────────────────────────────────────
  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPickerVisible(true);
  };

  // ── Picker: Mehrere Stories ausgewählt + Titel vergeben ──────────────────
  const handlePickerConfirm = (items: HighlightItem[], title: string) => {
    addHighlight({
      type: 'story',
      storyId: null, // Multi-Item → kein einzelner story_id Verweis
      items,
      title,
    });
  };

  if (!isLoading && highlights.length === 0 && !isOwn) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.secondary }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* "+" Neu — nur eigenes Profil */}
        {isOwn && (
          <Pressable
            style={styles.bubble}
            onPress={handleAddPress}
            accessibilityRole="button"
            accessibilityLabel="Neues Highlight erstellen"
          >
            <View style={[
              styles.bubbleThumb,
              styles.addThumb,
              { borderColor: colors.border.strong, backgroundColor: 'transparent' },
            ]}>
              {isAdding
                ? <ActivityIndicator color={colors.accent.primary} size="small" />
                : <PlusCircle size={28} color={colors.text.primary} strokeWidth={1.5} />
              }
            </View>
            <Text style={[styles.bubbleLabel, { color: colors.text.muted }]}>Neu</Text>
          </Pressable>
        )}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#FFFFFF" size="small" />
          </View>
        ) : (
          highlights.map((h) => (
            <HighlightBubble
              key={h.id}
              highlight={h}
              isOwn={isOwn}
              onPress={() => handleHighlightPress(h)}
              onLongPress={() => handleLongPress(h)}
            />
          ))
        )}
      </ScrollView>

      {highlights.length === 0 && isOwn && !isLoading && (
        <Text style={[styles.emptyHint, { color: colors.text.muted }]}>
          Tippe + um Stories zu highlighten · Long-Press auf Post zum Pinnen
        </Text>
      )}

      {/* ── Visueller Thumbnail-Picker ── */}
      <HighlightPickerSheet
        visible={pickerVisible}
        stories={storyArchive}
        posts={postArchive}
        onClose={() => setPickerVisible(false)}
        onConfirm={handlePickerConfirm}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    paddingBottom: 4,
    // backgroundColor via inline (bg.secondary)
  },
  scrollContent: { paddingHorizontal: 16, gap: 14, paddingVertical: 10 },
  bubble: { alignItems: 'center', gap: 6, width: BUBBLE_SIZE },
  bubbleThumb: {
    width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: BUBBLE_SIZE / 2,
    overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(128,128,128,0.2)',
    alignItems: 'center', justifyContent: 'center',
    // backgroundColor: transparent — Highlight-Bild füllt die Blase
  },
  addThumb: {
    borderStyle: 'dashed',
    // borderColor + backgroundColor via inline
  },
  bubbleLabel: {
    // color via inline (theme-aware)
    fontSize: 10, fontWeight: '600',
    textAlign: 'center', width: BUBBLE_SIZE + 10,
  },
  loadingWrap: {
    width: BUBBLE_SIZE, height: BUBBLE_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyHint: {
    // color via inline (theme-aware)
    fontSize: 11, textAlign: 'center',
    paddingHorizontal: 32, paddingBottom: 6, lineHeight: 17,
  },
});

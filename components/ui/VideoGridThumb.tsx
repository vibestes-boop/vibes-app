/**
 * VideoGridThumb — Zeigt Videos als Thumbnail im Grid.
 *
 * Strategie (neu, nach thumbnail_url Migration):
 *   - thumbnailUrl vorhanden → statisches JPG via expo-image (kein Video-Decoder!)
 *   - thumbnailUrl null/undefined → Fallback: expo-av Video mit shouldPlay=false
 *
 * Performance-Impact:
 *   - Statisches Bild: ~0 MB RAM extra, sofort sichtbar
 *   - Video-Fallback: Video-Decoder initialisiert + erstes Frame decodiert (kostspielig)
 */
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Play } from 'lucide-react-native';

type Props = {
  uri: string;
  thumbnailUrl?: string | null;
  style?: object;
};

export function VideoGridThumb({ uri, thumbnailUrl, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {thumbnailUrl ? (
        // ✅ Statisches Thumbnail — kein Video-Decoder nötig
        <Image
          source={{ uri: thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          placeholder={{ blurhash: 'L00000fQfQfQfQfQfQfQfQfQfQfQ' }}
        />
      ) : (
        // ⚡ Fallback für alte Videos ohne Thumbnail
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
          isMuted
          isLooping={false}
        />
      )}
      {/* Play-Icon Overlay — immer sichtbar */}
      <View style={styles.playOverlay}>
        <Play size={16} color="#fff" fill="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  playOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    padding: 4,
  },
});

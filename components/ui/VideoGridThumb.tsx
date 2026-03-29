/**
 * VideoGridThumb – zeigt das erste Frame eines Videos als Grid-Thumbnail.
 *
 * Strategie: expo-av Video mit shouldPlay={false} rendert das erste Frame
 * ohne abzuspielen. Das funktioniert für Remote-URLs in Expo Go.
 * expo-video-thumbnails schlägt bei Remote-URLs fehl → wird nicht mehr verwendet.
 */
import { View, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Play } from 'lucide-react-native';

export function VideoGridThumb({ uri, style }: { uri: string; style?: object }) {
  return (
    <View style={[styles.container, style]}>
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isMuted
        isLooping={false}
      />
      {/* Play-Overlay */}
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

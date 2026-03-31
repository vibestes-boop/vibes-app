import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { EXPLORE_ITEM_HEIGHT, EXPLORE_ITEM_WIDTH } from './exploreConstants';
import { exploreStyles as styles } from './exploreStyles';
import type { ExplorePostThumb } from '@/lib/useExplore';

/**
 * ExploreGridItem — Performance-optimiert
 *
 * Videos werden als statisches Image (Thumbnail) angezeigt, NICHT als expo-av Video.
 * Grund: In einem Grid mit 60 Posts würden 60 gleichzeitige Video-Initialisierungen
 * den JS-Thread blockieren und den Screen extrem verlangsamen.
 *
 * Wenn der User auf ein Video klickt, navigiert er zu post/[id] wo es normal abgespielt wird.
 */
export function ExploreGridItem({ item }: { item: ExplorePostThumb }) {
  const isVideo = item.media_type === 'video';
  return (
    <Pressable
      style={styles.gridItem}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
    >
      {item.media_url ? (
        <>
          {/* Immer Image — kein expo-av Video im Grid */}
          <Image
            source={{ uri: item.media_url }}
            style={styles.gridImage}
            contentFit="cover"
          />
          {/* Play-Indikator für Videos */}
          {isVideo && (
            <View style={styles.gridVideoOverlay}>
              <View style={styles.gridPlayBtn}>
                <Play size={12} color="#fff" fill="#fff" />
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={[styles.gridImage, styles.gridPlaceholder]}>
          <Text style={styles.placeholderText}>{item.caption?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </View>
      )}
    </Pressable>
  );
}

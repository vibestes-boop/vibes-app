import type { ExplorePostThumb } from '@/lib/useExplore';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Heart,Play } from 'lucide-react-native';
import { Pressable,Text,View } from 'react-native';
import { exploreStyles as styles } from './exploreStyles';

/** 1234 → "1.2K", <1000 → "1234" */
function fmtCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);
}

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
  const likes = item.like_count ?? 0;
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
          {/* Like-Zahl unten links (TikTok-Stil) — nur bei populären Posts */}
          {likes > 0 && (
            <View style={styles.gridStat} pointerEvents="none">
              <Heart size={11} color="#fff" fill="#fff" strokeWidth={0} />
              <Text style={styles.gridStatText}>{fmtCount(likes)}</Text>
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

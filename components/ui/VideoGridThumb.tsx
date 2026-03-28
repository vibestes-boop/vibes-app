import { useEffect, useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Play } from 'lucide-react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';

const MAX_CACHE_SIZE = 80;
const thumbCache = new Map<string, string>();
const cacheOrder: string[] = [];

function setCache(key: string, value: string) {
  if (thumbCache.has(key)) {
    cacheOrder.splice(cacheOrder.indexOf(key), 1);
  }
  thumbCache.set(key, value);
  cacheOrder.push(key);
  while (cacheOrder.length > MAX_CACHE_SIZE) {
    const oldest = cacheOrder.shift()!;
    thumbCache.delete(oldest);
  }
}

export function VideoGridThumb({ uri, style }: { uri: string; style?: object }) {
  const [thumb, setThumb] = useState<string | null>(thumbCache.get(uri) ?? null);

  useEffect(() => {
    if (thumbCache.has(uri)) return;
    VideoThumbnails.getThumbnailAsync(uri, { time: 1000 })
      .then((r) => {
        setCache(uri, r.uri);
        setThumb(r.uri);
      })
      .catch(() => {});
  }, [uri]);

  return (
    <View style={[styles.container, style]}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#4B5563" />
        </View>
      )}
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
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    padding: 4,
  },
});

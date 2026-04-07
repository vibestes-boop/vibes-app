import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { VideoGridThumb } from '@/components/ui/VideoGridThumb';
import { profileStyles as s } from './profileStyles';
import type { ProfilePostGridItem } from './types';

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatRepostTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);
  const diffW = Math.floor(diffD / 7);
  if (diffMin < 60) return `${diffMin} Min.`;
  if (diffH < 24) return `${diffH} Std.`;
  if (diffD < 7) return `${diffD} T.`;
  if (diffW < 5) return `${diffW} W.`;
  // Älteres Datum: "28. März"
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}

export function ProfileGridCell({
  post,
  onPress,
  onLongPress,
}: {
  post: ProfilePostGridItem;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const [imageError, setImageError] = useState(false);

  const showFallback = !post.media_url || imageError;
  const viewCount = post.view_count ?? 0;

  return (
    <Pressable
      style={s.cell}
      onPressIn={() => {
        scale.value = withTiming(0.93, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 80 });
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        {!showFallback && post.media_type === 'video' && (
          <VideoGridThumb
            uri={post.media_url!}
            thumbnailUrl={post.thumbnail_url}
            style={s.cellImg}
          />
        )}
        {!showFallback && post.media_type !== 'video' && (
          <Image
            source={{ uri: post.media_url! }}
            style={s.cellImg}
            contentFit="cover"
            transition={200}
            placeholder={{ blurhash: 'L00000fQfQfQfQfQfQfQfQfQfQfQ' }}
            onError={() => setImageError(true)}
          />
        )}
        {showFallback && (
          <View style={[s.cellText, { backgroundColor: '#1a0533' }]}>
            <Text style={s.cellCaption} numberOfLines={4}>
              {post.caption}
            </Text>
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={s.cellGrad}
          pointerEvents="none"
        />
        {/* View Count — TikTok-Style "▷ 12.4K" unten links */}
        {viewCount > 0 && !post.reposted_at && (
          <View style={gcs.viewCountWrap}>
            <Text style={gcs.viewCountText}>▷ {formatViews(viewCount)}</Text>
          </View>
        )}
        {/* Repost-Zeitstempel — "↺ 3 T." unten links (nur im Reposts-Tab) */}
        {!!post.reposted_at && (
          <View style={gcs.viewCountWrap}>
            <Text style={gcs.viewCountText}>↺ {formatRepostTime(post.reposted_at)}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const gcs = StyleSheet.create({
  viewCountWrap: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

import { DISCOVERY_MEDIA_GAP } from '@/lib/exploreLayout';
import type { ExplorePostThumb } from '@/lib/useExplore';
import { useTheme } from '@/lib/useTheme';
import { useI18n } from '@/lib/i18n';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Heart, ImageIcon, Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Use an actual video thumbnail; never send an MP4 to an image decoder. */
export function ExploreGridItem({ item, width }: { item: ExplorePostThumb; width?: number }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const isVideo = item.media_type === 'video';
  const uri = isVideo ? item.thumbnail_url : item.media_url;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <Pressable style={({ pressed }) => [s.card, { width, flex: width ? undefined : 1, backgroundColor: colors.bg.secondary, borderColor: colors.border.default, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
    accessibilityRole="button" accessibilityLabel={item.caption || t('nativeUi.posts')}>
    <View style={[s.image, { backgroundColor: colors.bg.elevated }]}>
      {uri && uri !== failedUri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} onError={() => setFailedUri(uri)} recyclingKey={item.id} /> :
        <View style={s.placeholder}>{isVideo ? <Play color={colors.icon.muted} size={30} /> : <ImageIcon color={colors.icon.muted} size={30} />}</View>}
      {isVideo && <View style={s.play}><Play size={12} color="#FFFFFF" fill="#FFFFFF" /></View>}
      {(item.like_count ?? 0) > 0 && <View style={s.stat}><Heart size={12} color="#FFFFFF" /><Text style={s.count}>{(item.like_count ?? 0).toLocaleString()}</Text></View>}
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.78)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
    {item.profiles?.username && <Pressable accessibilityRole="button" accessibilityLabel={`@${item.profiles.username}`} onPress={event => { event.stopPropagation(); if (item.author_id) router.push({ pathname: '/user/[id]', params: { id: item.author_id } }); }} style={s.author}>
      {item.profiles.avatar_url ? <Image source={{ uri: item.profiles.avatar_url }} style={s.avatar} contentFit="cover" /> : <View style={[s.avatar, s.initial, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{item.profiles.username[0]?.toUpperCase()}</Text></View>}
      <Text numberOfLines={1} style={s.authorName}>@{item.profiles.username}</Text>
    </Pressable>}
    </View>
    {item.caption ? <Text style={[s.caption, { color: colors.text.primary }]} numberOfLines={2}>{item.caption}</Text> : null}
  </Pressable>;
}
const s = StyleSheet.create({
  card: { borderRadius: 15, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: DISCOVERY_MEDIA_GAP, alignSelf: 'flex-start' },
  image: { width: '100%', aspectRatio: 4 / 5 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  author: { position: 'absolute', left: 0, right: 0, bottom: 3, minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  avatar: { width: 22, height: 22, borderRadius: 11 }, initial: { alignItems: 'center', justifyContent: 'center' }, authorName: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', flex: 1, minWidth: 0 },
  caption: { paddingHorizontal: 10, paddingBottom: 10, paddingTop: 8, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  play: { position: 'absolute', top: 9, right: 9, padding: 7, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.62)' },
  stat: { position: 'absolute', top: 9, left: 9, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.62)' },
  count: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
});

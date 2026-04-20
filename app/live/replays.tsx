/**
 * app/live/replays.tsx
 * Live Replays — vergangene Lives nachschauen
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Play, Eye, Clock, Users } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ─── Typen ───────────────────────────────────────────────────────────────────
interface ReplaySession {
  id:           string;
  title:        string | null;
  replay_url:   string;
  thumbnail_url: string | null;
  replay_views: number;
  peak_viewers: number;
  ended_at:     string | null;
  host: {
    id:         string;
    username:   string | null;
    avatar_url: string | null;
  } | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
function useReplays() {
  return useQuery<ReplaySession[]>({
    queryKey: ['live-replays'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select(`
          id, title, replay_url, thumbnail_url,
          replay_views, peak_viewers, ended_at,
          host:host_id ( id, username, avatar_url )
        `)
        .eq('is_replayable', true)
        .not('replay_url', 'is', null)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(40);

      if (error) throw error;
      return (data ?? []) as unknown as ReplaySession[];
    },
  });
}

// ─── Dauer formatieren ───────────────────────────────────────────────────────
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return `vor ${d}d`;
  if (h >= 1) return `vor ${h}h`;
  return 'Gerade eben';
}

// ─── Replay Card ─────────────────────────────────────────────────────────────
function ReplayCard({ item }: { item: ReplaySession }) {
  const handlePlay = () => {
    // v1.18.0: dedizierter Replay-Player (expo-video) — ersetzt die
    // vorherige LiveEndedOverlay-Abzweigung in watch/[id].tsx.
    // View-Count wird vom Replay-Screen selbst erhöht.
    router.push({
      pathname: '/live/replay/[id]' as any,
      params:   { id: item.id },
    });
  };

  const handleHostPress = () => {
    if (item.host?.id) {
      router.push({ pathname: '/user/[id]', params: { id: item.host.id } });
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [css.card, pressed && { opacity: 0.85 }]}
      onPress={handlePlay}
    >
      {/* Thumbnail */}
      <View style={css.thumbWrap}>
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={css.thumb}
            contentFit="cover"
          />
        ) : (
          <View style={[css.thumb, css.thumbFallback]}>
            <Play size={32} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        {/* Play-Overlay */}
        <View style={css.playOverlay}>
          <View style={css.playBtn}>
            <Play size={18} color="#fff" fill="#fff" />
          </View>
        </View>
        {/* Replay Badge */}
        <View style={css.replayBadge}>
          <Text style={css.replayBadgeText}>REPLAY</Text>
        </View>
      </View>

      {/* Info */}
      <View style={css.info}>
        {/* Host */}
        <Pressable style={css.hostRow} onPress={handleHostPress}>
          {item.host?.avatar_url ? (
            <Image source={{ uri: item.host.avatar_url }} style={css.hostAvatar} contentFit="cover" />
          ) : (
            <View style={[css.hostAvatar, css.hostAvatarFallback]}>
              <Text style={css.hostInitial}>{(item.host?.username ?? '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <Text style={css.hostName}>@{item.host?.username ?? 'Unbekannt'}</Text>
          <Text style={css.timeAgo}>{timeAgo(item.ended_at)}</Text>
        </Pressable>

        {/* Titel */}
        {item.title ? (
          <Text style={css.title} numberOfLines={2}>{item.title}</Text>
        ) : null}

        {/* Stats */}
        <View style={css.statsRow}>
          <View style={css.stat}>
            <Eye size={12} color="rgba(255,255,255,0.4)" />
            <Text style={css.statText}>{item.replay_views.toLocaleString()} Views</Text>
          </View>
          <View style={css.stat}>
            <Users size={12} color="rgba(255,255,255,0.4)" />
            <Text style={css.statText}>{item.peak_viewers} Peak</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={css.empty}>
      <Clock size={52} color="rgba(255,255,255,0.12)" />
      <Text style={css.emptyTitle}>Keine Replays</Text>
      <Text style={css.emptySub}>
        Beendete Lives erscheinen hier sobald Hosts sie als Replay verfügbar machen.
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ReplaysScreen() {
  const insets = useSafeAreaInsets();
  const { data: replays = [], isLoading, refetch, isRefetching } = useReplays();

  return (
    <View style={css.root}>
      {/* Header */}
      <View style={[css.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={css.backBtn}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <View>
          <Text style={css.headerTitle}>Live Replays</Text>
          {replays.length > 0 && (
            <Text style={css.headerSub}>{replays.length} verfügbar</Text>
          )}
        </View>
        <View style={{ width: 34 }} />
      </View>

      {isLoading ? (
        <View style={css.loader}>
          <ActivityIndicator color="rgba(255,255,255,0.5)" size="large" />
        </View>
      ) : (
        <FlatList
          data={replays}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ReplayCard item={item} />}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 32, gap: 12 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const css = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050508' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    height: 200,
    backgroundColor: '#111',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  replayBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  replayBadgeText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8,
  },

  // Info
  info: { padding: 12, gap: 6 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hostAvatar: { width: 28, height: 28, borderRadius: 14 },
  hostAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  hostInitial: { color: '#fff', fontSize: 11, fontWeight: '700' },
  hostName: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  timeAgo: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 19 },
  statsRow: { flexDirection: 'row', gap: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  emptySub: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

/**
 * app/live/replay/[id].tsx
 *
 * v1.18.0 — Live-Replay Player.
 *
 * Route-Param:
 *   id  → entweder eine `live_recordings.id` ODER eine `live_sessions.id`
 *         (wir probieren beides, sodass bestehende Deeplinks auf Sessions
 *         weiterhin funktionieren).
 *
 * Layout:
 *   Vollbild Portrait-Video (expo-video) mit Play/Pause-Tap,
 *   Back-Button, Host-Header, Share-Button, View-Count.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ArrowLeft, Share2, Eye, Clock, Play, Pause, AlertCircle, Radio, Scissors,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import {
  useReplay, useReplayForSession, incrementReplayViews, isReplayPlayable,
  type LiveRecording,
} from '@/lib/useLiveRecording';
import { useSessionClipHotspots } from '@/lib/useLiveClips';

// ─── Minimaler Host-Lookup ──────────────────────────────────────────────────

interface ReplayHostInfo {
  id:         string;
  username:   string | null;
  avatar_url: string | null;
}

interface ReplaySessionMeta {
  id:            string;
  title:         string | null;
  ended_at:      string | null;
  peak_viewers:  number;
  like_count:    number | null;
  comment_count: number | null;
  host:          ReplayHostInfo | null;
  // Fallback wenn kein live_recordings-Row existiert (Legacy-Replays aus v1.17):
  replay_url:    string | null;
  thumbnail_url: string | null;
  replay_views:  number;
}

function useReplaySessionMeta(sessionId: string | null | undefined) {
  return useQuery<ReplaySessionMeta | null>({
    queryKey:  ['replay-session-meta', sessionId],
    enabled:   !!sessionId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('live_sessions')
        .select(`
          id, title, ended_at, peak_viewers, like_count, comment_count,
          replay_url, thumbnail_url, replay_views,
          host:host_id ( id, username, avatar_url )
        `)
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...(data as any),
        host: Array.isArray((data as any).host) ? (data as any).host[0] ?? null : (data as any).host,
      } as ReplaySessionMeta;
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(secs: number | null | undefined): string {
  if (!secs || secs <= 0) return '';
  const mins = Math.floor(secs / 60);
  const s    = Math.floor(secs % 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${mins}:${String(s).padStart(2, '0')}`;
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function ReplayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Versuche zuerst: id = recording_id
  const byRecId = useReplay(id);
  // Parallel: id = session_id  (falls recording_id-Query null zurückkommt)
  const byIdAsSession = useReplayForSession(id);
  const recording: LiveRecording | null = byRecId.data ?? byIdAsSession.data ?? null;

  // Session-Metadaten für Host-Info und Legacy-Replay-URL
  const sessionId = recording?.sessionId ?? id;
  const meta = useReplaySessionMeta(sessionId);

  // v1.18.0 — Clip-Marker Hotspots (nur sichtbar wenn RLS erlaubt: Host + eigene)
  const { data: hotspots = [] } = useSessionClipHotspots(sessionId);
  const topHotspots = hotspots.slice(0, 5);

  // URL: neu aus live_recordings, sonst legacy replay_url
  const videoUrl = recording?.fileUrl ?? meta.data?.replay_url ?? null;
  const thumbnailUrl = recording?.thumbnailUrl ?? meta.data?.thumbnail_url ?? null;
  const isPlayable   = (recording && isReplayPlayable(recording)) || !!meta.data?.replay_url;

  // View-Count einmalig inkrementieren sobald das Video initialisiert ist
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!recording?.id || viewedRef.current) return;
    viewedRef.current = true;
    incrementReplayViews(recording.id);
  }, [recording?.id]);

  // Legacy-Pfad: replay_views über direkten UPDATE inkrementieren
  useEffect(() => {
    if (recording || viewedRef.current || !meta.data || !meta.data.replay_url) return;
    viewedRef.current = true;
    supabase
      .from('live_sessions')
      .update({ replay_views: (meta.data.replay_views ?? 0) + 1 })
      .eq('id', meta.data.id)
      .then(() => {}, () => {});
  }, [recording, meta.data]);

  const player = useVideoPlayer(videoUrl ?? '', (p) => {
    p.loop = false;
    p.play();
  });

  const [isPlaying, setIsPlaying] = useState(true);
  useEffect(() => {
    const sub = player.addListener('playingChange', (ev: any) => {
      setIsPlaying(!!(ev?.isPlaying ?? ev));
    });
    return () => sub?.remove?.();
  }, [player]);

  const togglePlay = () => {
    Haptics.selectionAsync();
    if (isPlaying) player.pause();
    else player.play();
  };

  const seekTo = (secs: number) => {
    Haptics.selectionAsync();
    try {
      (player as any).currentTime = Math.max(0, secs);
      player.play();
    } catch { /* no-op */ }
  };

  const handleShare = async () => {
    if (!meta.data) return;
    try {
      await Share.share({
        message: meta.data.title
          ? `Replay: ${meta.data.title}`
          : `Replay von @${meta.data.host?.username ?? 'Unbekannt'}`,
        url: videoUrl ?? undefined,
      });
    } catch { /* user cancelled */ }
  };

  // ── Loading ─────────────────────────────────────────────────────────────
  if (byRecId.isLoading && byIdAsSession.isLoading && meta.isLoading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color="#8b5cf6" size="large" />
      </View>
    );
  }

  // ── Kein Replay gefunden / nicht abspielbar ─────────────────────────────
  if (!isPlayable || !videoUrl) {
    const statusMsg = recording?.status === 'processing'
      ? 'Das Replay wird gerade verarbeitet. Schau in wenigen Minuten noch mal vorbei.'
      : recording?.status === 'failed'
        ? `Replay konnte nicht erstellt werden${recording.errorMessage ? `: ${recording.errorMessage}` : '.'}`
        : 'Für dieses Live gibt es kein Replay.';
    return (
      <View style={[s.root, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[s.backBtn, { top: insets.top + 12 }]}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <View style={[s.center, { flex: 1, paddingHorizontal: 32, gap: 12 }]}>
          <AlertCircle size={48} color="rgba(255,255,255,0.18)" />
          <Text style={s.emptyTitle}>Kein Replay verfügbar</Text>
          <Text style={s.emptySub}>{statusMsg}</Text>
        </View>
      </View>
    );
  }

  // ── Player ──────────────────────────────────────────────────────────────
  const host = meta.data?.host;
  const title = meta.data?.title;

  return (
    <View style={s.root}>
      <Pressable onPress={togglePlay} style={StyleSheet.absoluteFill}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      </Pressable>

      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <Pressable onPress={togglePlay} style={[StyleSheet.absoluteFill, s.pauseOverlay]}>
          <View style={s.playBtn}>
            <Play size={28} color="#fff" fill="#fff" />
          </View>
        </Pressable>
      )}

      {/* Top Bar: Back + Share */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.iconBtn}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <View style={s.replayBadge}>
          <Radio size={12} color="#fff" />
          <Text style={s.replayBadgeText}>REPLAY</Text>
        </View>
        <Pressable onPress={handleShare} hitSlop={12} style={s.iconBtn}>
          <Share2 size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Bottom Info Bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 14 }]} pointerEvents="box-none">
        {/* v1.18.0 — Clip-Marker Hotspots (Jump-to-Moment) */}
        {topHotspots.length > 0 && (
          <View style={s.hotspotRow}>
            <View style={s.hotspotLabel}>
              <Scissors size={12} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
              <Text style={s.hotspotLabelText}>Clip-Momente</Text>
            </View>
            <View style={s.hotspotChips}>
              {topHotspots.map((h) => (
                <Pressable
                  key={`${h.sessionId}-${h.windowStart}`}
                  onPress={() => seekTo(h.windowStart)}
                  style={s.hotspotChip}
                  hitSlop={6}
                >
                  <Text style={s.hotspotChipTime}>{fmtDuration(h.windowStart)}</Text>
                  <Text style={s.hotspotChipCount}>×{h.markerCount}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Host */}
        <View style={s.hostRow}>
          {host?.avatar_url ? (
            <Image source={{ uri: host.avatar_url }} style={s.hostAvatar} contentFit="cover" />
          ) : (
            <View style={[s.hostAvatar, s.hostAvatarFallback]}>
              <Text style={s.hostInitial}>{(host?.username ?? '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.hostName}>@{host?.username ?? 'Unbekannt'}</Text>
            {title ? <Text style={s.title} numberOfLines={2}>{title}</Text> : null}
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Eye size={13} color="rgba(255,255,255,0.65)" strokeWidth={2.2} />
            <Text style={s.statText}>
              {fmtNum((recording?.viewCount ?? 0) + (meta.data?.replay_views ?? 0))} Views
            </Text>
          </View>
          {recording?.durationSecs ? (
            <View style={s.stat}>
              <Clock size={13} color="rgba(255,255,255,0.65)" strokeWidth={2.2} />
              <Text style={s.statText}>{fmtDuration(recording.durationSecs)}</Text>
            </View>
          ) : null}
          {!isPlaying && (
            <Pressable onPress={togglePlay} hitSlop={8} style={s.stat}>
              <Pause size={13} color="rgba(255,255,255,0.65)" strokeWidth={2.2} />
              <Text style={s.statText}>Pausiert</Text>
            </Pressable>
          )}
        </View>
      </View>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#050508' },
  center: { alignItems: 'center', justifyContent: 'center' },

  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  replayBadge: {
    flex: 1,
    alignSelf: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  replayBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  pauseOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  playBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },

  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hostAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  hostAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  hostInitial: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hostName:    { color: '#fff', fontSize: 14, fontWeight: '700' },
  title:       { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, lineHeight: 17 },

  // v1.18.0 — Clip Hotspots
  hotspotRow: {
    gap: 6,
  },
  hotspotLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hotspotLabelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hotspotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hotspotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,92,246,0.5)',
  },
  hotspotChipTime: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hotspotChipCount: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
  },

  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

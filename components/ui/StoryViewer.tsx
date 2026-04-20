import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
  TextInput, Keyboard, Alert, Modal, Platform,
  KeyboardEvent, ScrollView, Share, Linking, AppState,
  Animated as RNAnimated, Easing as EasingRN,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// expo-file-system v19: Legacy-API für cacheDirectory + downloadAsync
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue, useAnimatedStyle, withTiming, withSequence,
  runOnJS, Easing,
} from 'react-native-reanimated';
import { X, Heart, Send, Share2, UserPlus, UserCheck, Check, Copy, Flag, EyeOff, Download, Search as SearchIcon, Eye } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { setStringAsync as clipboardSetString } from 'expo-clipboard';

import { BlurView } from 'expo-blur';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StoryGroup, Story } from '@/lib/useStories';
import { useMarkStoryViewed, useMyStoryVote, useStoryPollResults, useVoteStoryPoll } from '@/lib/useStories';
import { useStoryComments, useAddStoryComment, type StoryComment } from '@/lib/useStoryComments';
import { StoryViewersSheet } from '@/components/ui/StoryViewersSheet';
import { useFollow } from '@/lib/useFollow';
import { useAuthStore } from '@/lib/authStore';
import { useOrCreateConversation, useSendMessage } from '@/lib/useMessages';
import { Video, ResizeMode } from 'expo-av';

// expo-video optional (z. B. ohne natives Modul in Expo Go)
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const expoVideo = require('expo-video');
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch {
  /* kein expo-video */
}

const { width: W } = Dimensions.get('window');
const IMAGE_DURATION = 5000;
const MAX_VIDEO_DURATION = 15000;
const USE_EXPO_VIDEO = VideoView !== null && useVideoPlayer !== null;

type Props = {
  group: StoryGroup;
  allGroups: StoryGroup[];
  visible: boolean;
  onClose: () => void;
  onNextGroup: () => void;
  onPrevGroup: () => void;
};

// ── Video-Komponenten ────────────────────────────────────────────────────────
function NativeVideoStory({ uri, isPaused, onDurationKnown }: { uri: string; isPaused: boolean; onDurationKnown: (ms: number) => void }) {
  const player = useVideoPlayer(uri, (p: any) => { p.loop = false; p.muted = false; p.play(); });
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', () => {
      const dur = player.duration;
      if (dur && dur > 0) onDurationKnown(Math.min(dur * 1000, MAX_VIDEO_DURATION));
    });
    return () => sub.remove();
  }, [player, onDurationKnown]);

  // Video pausieren/fortsetzen wenn gehalten
  useEffect(() => {
    if (!player) return;
    if (isPaused) {
      try { player.pause(); } catch { }
    } else {
      try { player.play(); } catch { }
    }
  }, [isPaused, player]);

  // contain = volles Video sichtbar (kein Schneiden)
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

function FallbackVideoStory({ uri, isPaused, onDurationKnown }: { uri: string; isPaused: boolean; onDurationKnown: (ms: number) => void }) {
  const fixedRef = useRef(false);
  return (
    <Video
      key={uri} source={{ uri }} style={StyleSheet.absoluteFill}
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay={!isPaused}
      isLooping={false} isMuted={false}
      onPlaybackStatusUpdate={(s: any) => {
        if (!s.isLoaded || fixedRef.current) return;
        if (s.durationMillis && s.durationMillis > 0) {
          fixedRef.current = true;
          onDurationKnown(Math.min(s.durationMillis, MAX_VIDEO_DURATION));
        }
      }}
    />
  );
}

// ── Floating Heart — Doppel-Tap-Animation ─────────────────────────────────────
type FloatingHeartItem = { id: number; x: number; y: number };
function FloatingHeart({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const opacity   = useRef(new RNAnimated.Value(1)).current;
  const scale     = useRef(new RNAnimated.Value(0)).current;
  const translateY= useRef(new RNAnimated.Value(0)).current;
  const rotate    = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(scale,      { toValue: 1,    friction: 4, tension: 180, useNativeDriver: true }),
      RNAnimated.timing(translateY, { toValue: -130, duration: 1500, useNativeDriver: true }),
      RNAnimated.sequence([
        RNAnimated.timing(rotate, { toValue: -1, duration: 110, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue:  1, duration: 110, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue: -1, duration: 110, useNativeDriver: true }),
        RNAnimated.timing(rotate, { toValue:  0, duration:  90, useNativeDriver: true }),
      ]),
      RNAnimated.sequence([
        RNAnimated.delay(850),
        RNAnimated.timing(opacity, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    ]).start();
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rotateInterp = rotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-10deg', '0deg', '10deg'] });
  return (
    <RNAnimated.View
      style={[{ position: 'absolute', width: 120, height: 120, left: x - 60, top: y - 60, alignItems: 'center', justifyContent: 'center' },
              { opacity, transform: [{ translateY }, { scale }, { rotate: rotateInterp }] }]}
      pointerEvents="none"
    >
      <Heart size={100} color="#EE1D52" fill="#EE1D52" />
    </RNAnimated.View>
  );
}

// ── Story Like Hook (story_id → story_likes Tabelle) ─────────────────────────
function useStoryLike(storyId: string | undefined) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  const { data: liked = false } = useQuery({
    queryKey: ['story-like', userId, storyId],
    queryFn: async () => {
      if (!userId || !storyId) return false;
      const { data } = await supabase
        .from('story_likes')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId && !!storyId,
    staleTime: 1000 * 60,
  });

  // useRef → stabil über Re-renders (plain object würde bei jedem Render neu erstellt = Bug)
  const fkErrorRef = useRef(false);

  const toggle = useMutation({
    onMutate: async () => {
      fkErrorRef.current = false;
      await queryClient.cancelQueries({ queryKey: ['story-like', userId, storyId] });
      queryClient.setQueryData(['story-like', userId, storyId], (old: boolean) => !old);
    },
    mutationFn: async () => {
      if (!userId || !storyId) return;
      if (liked) {
        const { error } = await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId });
        // FK-Violation (23503) oder anderer Fehler → onError wird aufgerufen
        if (error) throw error;
      }
    },
    onError: (err: any) => {
      // FK-Violation (23503): Original-Story abgelaufen/gelöscht (z.B. Highlight über alte Story)
      // → Optimistisches Update BEHALTEN, kein Rollback, kein Re-fetch
      if (err?.code === '23503') { fkErrorRef.current = true; return; }
      // Alle anderen Fehler: Rollback
      queryClient.setQueryData(['story-like', userId, storyId], liked);
    },
    onSettled: () => {
      // Nach FK-Fehler KEIN invalidate → verhindert dass refetch das optimistische Update überschreibt
      if (fkErrorRef.current) return;
      queryClient.invalidateQueries({ queryKey: ['story-like', userId, storyId] });
    },
  });

  return { liked, toggle: toggle.mutate };
}

// ── Story Poll Overlay ────────────────────────────────────────────────────────
function StoryPollOverlay({
  storyId,
  poll,
}: {
  storyId: string;
  poll: { type: 'poll'; question: string; options: [string, string] };
  onVote?: () => void;
}) {
  const { data: myVote, isLoading: voteLoading } = useMyStoryVote(storyId);
  const { data: results = { counts: [0, 0] as [number, number], total: 0 } } = useStoryPollResults(storyId);
  const { mutate: vote, isPending: voting } = useVoteStoryPoll();

  const hasVoted = myVote !== null && myVote !== undefined;
  const total = results.total;

  const pct = (idx: number) => {
    if (total === 0) return 0;
    return Math.round((results.counts[idx] / total) * 100);
  };

  return (
    <View style={{
      position: 'absolute',
      bottom: 160,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(0,0,0,0.65)',
      borderRadius: 20,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
        {poll.question}
      </Text>

      {poll.options.map((opt, idx) => {
        const p = pct(idx);
        const isChosen = hasVoted && myVote === idx;
        return (
          <Pressable
            key={idx}
            disabled={voteLoading || voting || hasVoted}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              vote({ storyId, optionIdx: idx });
            }}
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              height: 44,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: isChosen ? 1.5 : 1,
              borderColor: isChosen ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
              justifyContent: 'center',
            }}
          >
            {/* Prozent-Balken hinter dem Text */}
            {hasVoted && (
              <View style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${p}%`,
                backgroundColor: isChosen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
              }} />
            )}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
              alignItems: 'center',
            }}>
              <Text style={{
                color: isChosen ? '#FFFFFF' : '#fff',
                fontWeight: '700',
                fontSize: 13,
              }}>{opt}</Text>
              {hasVoted && (
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }}>
                  {p}%
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}

      {hasVoted && (
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center' }}>
          {total} {total === 1 ? 'Stimme' : 'Stimmen'}
        </Text>
      )}
    </View>
  );
}

// ── Like Button ──────────────────────────────────────────────────────────────
function LikeBtn({ storyId }: { storyId: string | undefined }) {
  const { liked, toggle } = useStoryLike(storyId);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = () => {
    toggle();
    Haptics.impactAsync(!liked ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withTiming(0.65, { duration: 60 }),
      withTiming(1.35, { duration: 80 }),
      withTiming(1, { duration: 80 }),
    );
  };
  return (
    <Pressable onPress={press} hitSlop={12}>
      <Animated.View style={anim}>
        <Heart size={28} color={liked ? '#F472B6' : '#fff'} fill={liked ? '#F472B6' : 'transparent'} strokeWidth={1.8} />
      </Animated.View>
    </Pressable>
  );
}

// ── TikTok-Style Share Sheet ─────────────────────────────────────────────────
type ShareTarget = { id: string; username: string | null; avatar_url: string | null };

const APP_SHARE_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬', color: '#25D366' },
  { id: 'telegram', label: 'Telegram', emoji: '✈️', color: '#2CA5E0' },
  { id: 'copy', label: 'Link', icon: Copy, color: '#6366f1' },
  { id: 'more', label: 'Mehr', icon: Share2, color: '#374151' },
];

const ACTION_BUTTONS = [
  { id: 'report', label: 'Melden', icon: Flag, color: '#ef4444' },
  { id: 'notinterested', label: 'Kein Interesse', icon: EyeOff, color: '#6B7280' },
  { id: 'download', label: 'Herunterladen', icon: Download, color: '#6B7280' },
];

function InAppShareModal({
  visible,
  storyUsername,
  storyMediaUrl,
  onClose,
}: {
  visible: boolean;
  storyUsername: string;
  storyMediaUrl: string;
  onClose: () => void;
}) {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const { mutateAsync: getOrCreateConv } = useOrCreateConversation();
  const { mutateAsync: sendMsg } = useSendMessage();

  const { data: users = [] } = useQuery<ShareTarget[]>({
    queryKey: ['share-user-list'],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .neq('id', currentUserId)
        .order('username')
        .limit(50);
      return (data ?? []) as ShareTarget[];
    },
    enabled: visible && !!currentUserId,
    staleTime: 1000 * 60 * 5,
  });

  const storyLink = `https://vibes.app/story/${storyUsername}`;

  const filtered = search.trim()
    ? users.filter((u) => u.username?.toLowerCase().includes(search.toLowerCase()))
    : users;

  const toggleUser = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSendToUsers = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      await Promise.all(
        Array.from(selected).map(async (userId) => {
          const convId = await getOrCreateConv(userId);
          await sendMsg({
            conversationId: convId,
            content: `📸 Story von @${storyUsername}`,
            // ← storyMediaUrl + storyAuthor übergeben → Empfänger sieht Thumbnail
            storyMediaUrl: storyMediaUrl,
            storyAuthor: storyUsername,
          });
        })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelected(new Set());
      setSearch('');
      onClose();
    } catch {
      Alert.alert('Fehler', 'Story konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  };

  const handleAppShare = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (id) {
      case 'whatsapp':
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(`📸 Story von @${storyUsername} auf Vibes: ${storyLink}`)}`).catch(() => Alert.alert('WhatsApp nicht installiert'));
        break;
      case 'telegram':
        Linking.openURL(`tg://msg_url?url=${encodeURIComponent(storyLink)}&text=${encodeURIComponent(`Story von @${storyUsername}`)}`).catch(() => Alert.alert('Telegram nicht installiert'));
        break;
      case 'copy':
        clipboardSetString(storyLink).catch(() => { });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Link kopiert ✓', storyLink);
        break;
      case 'more':
        Share.share({ message: `📸 Story von @${storyUsername} auf Vibes: ${storyLink}`, url: storyLink });
        break;
    }
  };

  const handleAction = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    switch (id) {
      case 'report':
        Alert.alert('Melden', 'Wähle einen Grund:', [
          { text: 'Spam', onPress: () => Alert.alert('Gemeldet', 'Danke.') },
          { text: 'Unangemessener Inhalt', onPress: () => Alert.alert('Gemeldet', 'Danke.') },
          { text: 'Abbrechen', style: 'cancel' },
        ]);
        break;
      case 'notinterested':
        Alert.alert('Verstanden', 'Weniger Stories dieser Art.');
        break;
      case 'download':
        (async () => {
          try {
            if (!storyMediaUrl) {
              Alert.alert('Fehler', 'Kein Medium verfügbar.');
              return;
            }
            // Dateiendung ermitteln
            const ext = storyMediaUrl.includes('.mp4') ? 'mp4'
              : storyMediaUrl.includes('.mov') ? 'mov'
              : storyMediaUrl.includes('.webm') ? 'webm'
              : 'jpg';
            const localUri = FileSystem.cacheDirectory + `story_${Date.now()}.${ext}`;

            // Herunterladen in Cache
            const { uri } = await FileSystem.downloadAsync(storyMediaUrl, localUri);

            // Native Share-Sheet → User kann in Fotos, Dateien etc. speichern
            await Share.share(
              { url: uri, message: `Story von @${storyUsername}` },
              { dialogTitle: 'Story speichern' }
            );
          } catch (err: any) {
            if (err?.message?.includes('cancel')) return; // User hat abgebrochen
            Alert.alert('Fehler', 'Story konnte nicht gespeichert werden.');
          }
        })();
        break;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.overlay} onPress={onClose}>
        <Pressable style={ss.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={ss.handle} />

          {/* ── Reihe 1: App-User ─────────────────────────────────────────── */}
          <Text style={ss.sectionLabel}>Senden an</Text>

          {/* Suchfeld */}
          <View style={ss.searchRow}>
            <SearchIcon size={15} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={ss.searchInput}
              placeholder="Suchen…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>

          {/* Horizontale User-Liste */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.userScroll} contentContainerStyle={ss.userScrollContent}>
            {filtered.length === 0 ? (
              <Text style={ss.emptyUsers}>Keine User</Text>
            ) : (
              filtered.map((u) => {
                const chosen = selected.has(u.id);
                return (
                  <Pressable key={u.id} style={ss.userItem} onPress={() => toggleUser(u.id)}>
                    <View style={[ss.userAvatarWrap, chosen && ss.userAvatarChosen]}>
                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={ss.userAvatar} />
                      ) : (
                        <View style={[ss.userAvatar, ss.userAvatarFallback]}>
                          <Text style={ss.userAvatarText}>{(u.username ?? '?')[0].toUpperCase()}</Text>
                        </View>
                      )}
                      {chosen && (
                        <View style={ss.checkBadge}>
                          <Check size={10} color="#fff" strokeWidth={3} />
                        </View>
                      )}
                    </View>
                    <Text style={ss.userLabel} numberOfLines={1}>
                      {u.username ?? '?'}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Senden-Button */}
          {selected.size > 0 && (
            <Pressable style={[ss.sendBtn, sending && { opacity: 0.5 }]} onPress={handleSendToUsers} disabled={sending}>
              <Send size={16} color="#fff" />
              <Text style={ss.sendBtnText}>{sending ? 'Senden…' : `Senden (${selected.size})`}</Text>
            </Pressable>
          )}

          <View style={ss.divider} />

          {/* ── Reihe 2: Externe Apps ─────────────────────────────────────── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.appRow}>
            {APP_SHARE_OPTIONS.map((opt) => {
              const IconComp = (opt as any).icon;
              return (
                <Pressable key={opt.id} style={ss.appItem} onPress={() => handleAppShare(opt.id)}>
                  <View style={[ss.appIcon, { backgroundColor: opt.color }]}>
                    {(opt as any).emoji
                      ? <Text style={ss.appEmoji}>{(opt as any).emoji}</Text>
                      : <IconComp size={22} color="#fff" strokeWidth={1.8} />
                    }
                  </View>
                  <Text style={ss.appLabel}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={ss.divider} />

          {/* ── Reihe 3: Aktionen ─────────────────────────────────────────── */}
          <View style={ss.actionRow}>
            {ACTION_BUTTONS.map((btn) => {
              const IconComp = btn.icon;
              return (
                <Pressable key={btn.id} style={ss.actionItem} onPress={() => handleAction(btn.id)}>
                  <View style={[ss.actionIcon, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
                    <IconComp size={22} color={btn.color} strokeWidth={1.8} />
                  </View>
                  <Text style={ss.actionLabel}>{btn.label}</Text>
                </Pressable>
              );
            })}
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── TikTok-Style Story Kommentar-Sheet ─────────────────────────────────────────

function StoryCommentsSheet({
  visible,
  comments,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  storyId: string;
  comments: StoryComment[];
  onClose: () => void;
  onSubmit: (text: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSubmit(trimmed);
      setText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Fehler', 'Kommentar konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Vollflächiger Container mit flex-end damit Sheet von unten erscheint */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Transparentes Backdrop — Klick schließt das Sheet */}
        <Pressable
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={onClose}
        />
        <View style={[sc.sheet, { paddingBottom: insets.bottom + 8 }]}>
          {/* Handle */}
          <View style={sc.handle} />
          <Text style={sc.title}>Kommentare</Text>

          {/* Kommentar-Liste */}
          <ScrollView
            style={sc.list}
            contentContainerStyle={sc.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {comments.length === 0 ? (
              <View style={sc.empty}>
                <Text style={sc.emptyIcon}>💬</Text>
                <Text style={sc.emptyText}>Noch keine Kommentare.</Text>
                <Text style={sc.emptyHint}>Sei der Erste!</Text>
              </View>
            ) : (
              comments.map((c) => {
                const username = c.profiles?.username ?? 'User';
                const avatar = c.profiles?.avatar_url;
                const initial = username[0]?.toUpperCase() ?? '?';
                const timeAgo = formatTimeAgo(c.created_at);
                return (
                  <View key={c.id} style={sc.row}>
                    {/* Avatar */}
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={sc.avatar} contentFit="cover" />
                    ) : (
                      <View style={[sc.avatar, sc.avatarFallback]}>
                        <Text style={sc.avatarText}>{initial}</Text>
                      </View>
                    )}
                    {/* Content */}
                    <View style={sc.content}>
                      <View style={sc.nameRow}>
                        <Text style={sc.username}>@{username}</Text>
                        <Text style={sc.time}>{timeAgo}</Text>
                      </View>
                      <Text style={[sc.commentText, c.is_emoji && sc.emojiText]}>
                        {c.content}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Input */}
          <View style={sc.inputRow}>
            <TextInput
              ref={inputRef}
              style={sc.input}
              placeholder="Kommentieren…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={text}
              onChangeText={setText}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              multiline={false}
            />
            {text.trim().length > 0 && (
              <Pressable onPress={handleSend} disabled={sending} style={sc.sendBtn}>
                <Send size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const sc = StyleSheet.create({
  sheet: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '45%',   // immer mindestens halber Bildschirm sichtbar
    maxHeight: '80%',   // niemals zu groß
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff', fontSize: 16, fontWeight: '800',
    textAlign: 'center', marginBottom: 14,
  },
  list: { flex: 1, minHeight: 120 },
  listContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 16, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },

  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  content: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  time: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  commentText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  emojiText: { fontSize: 24 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 12, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
});

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
export function StoryViewer({ group, allGroups, visible, onClose, onNextGroup, onPrevGroup }: Props) {
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const [showViewers, setShowViewers] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [replyMode, setReplyMode] = useState<'dm' | 'public'>('public');
  const [showEmojis, setShowEmojis] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const { mutate: markViewed } = useMarkStoryViewed();
  const { mutateAsync: getOrCreateConv } = useOrCreateConversation();
  const { mutateAsync: sendMsg, isPending: sending } = useSendMessage();
  const { mutateAsync: addComment, isPending: addingComment } = useAddStoryComment();

  // Progress: RNAnimated (wie FeedItem.tsx) — zuverlässiger als Reanimated+CJS-Hack
  const progressAnim = useRef(new RNAnimated.Value(0)).current;
  const progressRef = useRef(0); // aktuellen 0-1 Wert verfolgen
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationFixedRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const holdProgressRef = useRef(0);
  const wasHoldingRef = useRef(false);

  const currentStory: Story | undefined = group.stories[storyIndex];
  const isOwnStory = currentStory?.user_id === currentUserId;
  // useStoryComments braucht currentStory.id — Hook ist weiter oben, nutzt currentStory?.id
  const { data: storyComments = [] } = useStoryComments(currentStory?.id ?? null);

  const { isFollowing, toggle: toggleFollow, isOwnProfile } =
    useFollow(currentStory?.user_id ?? null);

  // Bei Story-Wechsel (Tippen links/rechts oder Gruppe wechseln):
  // → Kommentar-Sheet schließen, Emoji-Picker schließen, Reply-Text löschen
  useEffect(() => { setStoryIndex(0); setShowComments(false); setShowEmojis(false); setReplyText(''); }, [group.userId]);
  useEffect(() => { setShowComments(false); setShowEmojis(false); }, [storyIndex]);


  // Keyboard-Höhe tracken für manuelles Verschieben der Bottom-Bar
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => setKbHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0),
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const goNext = useCallback(() => {
    if (storyIndex < group.stories.length - 1) setStoryIndex((i) => i + 1);
    else onNextGroup();
  }, [storyIndex, group.stories.length, onNextGroup]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) setStoryIndex((i) => i - 1);
    else onPrevGroup();
  }, [storyIndex, onPrevGroup]);

  const startProgress = useCallback((duration: number) => {
    timerRef.current && clearTimeout(timerRef.current);
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    progressRef.current = 0;
    RNAnimated.timing(progressAnim, {
      toValue: 1,
      duration,
      easing: EasingRN.linear,
      useNativeDriver: false, // width kann keinen native driver nutzen
    }).start();
    timerRef.current = setTimeout(() => goNext(), duration);
  }, [goNext, progressAnim]);

  // Story pausieren wenn Keyboard offen, Share-Modal offen, User hält oder App im Hintergrund
  const [isHolding, setIsHolding] = useState(false);
  const [isAppBackground, setIsAppBackground] = useState(false);

  // ── Doppel-Tap: Like + Herz-Animation ─────────────────────────────────────
  const { liked: storyLiked, toggle: toggleStoryLike } = useStoryLike(currentStory?.id);
  const [hearts, setHearts] = useState<FloatingHeartItem[]>([]);
  const heartIdRef   = useRef(0);
  const lastTapRef   = useRef(0);          // Zeitstempel des letzten Taps
  const tapTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null); // Nav-Delay

  const spawnHeart = useCallback((x: number, y: number) => {
    const id = heartIdRef.current++;
    setHearts((prev) => [...prev, { id, x, y }]);
  }, []);

  // Story wechselt → ausstehende Nav-Timer resetten
  useEffect(() => {
    if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
    lastTapRef.current = 0;
  }, [storyIndex]);

  // Cleanup bei Unmount
  useEffect(() => () => { if (tapTimerRef.current) clearTimeout(tapTimerRef.current); }, []);

  // AppState: beim Minimieren/App-Switcher pausieren
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      setIsAppBackground(nextState !== 'active');
    });
    return () => sub.remove();
  }, []);

  const isPaused = kbHeight > 0 || shareOpen || isHolding || isAppBackground || showComments;

  // Hold-Handler: Fortschritt merken + Animation stoppen
  const handleHoldStart = useCallback(() => {
    holdProgressRef.current = progressRef.current;
    wasHoldingRef.current = true;
    progressAnim.stopAnimation();
    // Timer stoppen — verhindert auto-goNext während gehalten
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setIsHolding(true);
  }, [progressAnim]);

  const handleHoldEnd = useCallback(() => {
    // Beim Loslassen: Animation sofort HIER fortsetzen (nicht auf useEffect warten)
    // Verhindert den Sprung der durch die React-State-Zyklen entstehen würde.
    if (wasHoldingRef.current && currentStory) {
      const saved = holdProgressRef.current;
      const isVideo = currentStory.media_type === 'video';
      const totalDur = isVideo ? MAX_VIDEO_DURATION : IMAGE_DURATION;

      wasHoldingRef.current = false;
      holdProgressRef.current = 0;

      if (saved > 0 && saved < 0.99) {
        const remaining = Math.round((1 - saved) * totalDur);
        // Sofort den gespeicherten Wert setzen — kein sichtbares Flash
        progressAnim.stopAnimation();
        progressAnim.setValue(saved);
        progressRef.current = saved;
        RNAnimated.timing(progressAnim, {
          toValue: 1,
          duration: remaining,
          easing: EasingRN.linear,
          useNativeDriver: false,
        }).start();
        timerRef.current = setTimeout(() => goNext(), remaining);
      } else {
        startProgress(isVideo ? MAX_VIDEO_DURATION : IMAGE_DURATION);
      }
    }
    setIsHolding(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressAnim, currentStory, startProgress, goNext]);

  useEffect(() => {
    if (isPaused) {
      progressAnim.stopAnimation();
      timerRef.current && clearTimeout(timerRef.current);
      return;
    }
    if (!visible || !currentStory) return;
    // Wenn Hold gerade beendet wurde: handleHoldEnd hat die Animation bereits
    // direkt gestartet → hier nichts tun (wasHoldingRef wurde schon auf false gesetzt)
    if (!wasHoldingRef.current) {
      // Normaler Story-Start (kein Resume nach Hold)
      startProgress(currentStory.media_type === 'video' ? MAX_VIDEO_DURATION : IMAGE_DURATION);
    }
    wasHoldingRef.current = false;
    holdProgressRef.current = 0;
    return () => { timerRef.current && clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, currentStory?.id, visible]);

  useEffect(() => {
    if (!visible || !currentStory || isPaused) return;
    markViewed(currentStory.id);
    durationFixedRef.current = false;
    // Nächste Story bereits jetzt prefetchen während die aktuelle läuft
    const nextStory = group.stories[storyIndex + 1];
    if (nextStory?.media_url && nextStory.media_type !== 'video') {
      Image.prefetch?.(nextStory.media_url).catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markViewed + isPaused bewusst
  }, [currentStory?.id, visible]);

  const handleDurationKnown = useCallback((ms: number) => {
    if (durationFixedRef.current) return;
    durationFixedRef.current = true;
    startProgress(ms);
  }, [startProgress]);

  // progressRef listener: aktuellen Wert für Hold-Resume verfolgen
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => { progressRef.current = value; });
    return () => progressAnim.removeListener(id);
  }, [progressAnim]);

  const segW = group.stories.length > 0
    ? (W - 24 - 4 * (group.stories.length - 1)) / group.stories.length
    : W - 24;

  // RNAnimated interpolate: width 0 → segW (kein Reanimated nötig)
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, segW],
  });

  // ─ TikTok-style Tap-Flash ─
  const flashLeft = useSharedValue(0);
  const flashRight = useSharedValue(0);
  const flashLeftStyle = useAnimatedStyle(() => ({ opacity: flashLeft.value }));
  const flashRightStyle = useAnimatedStyle(() => ({ opacity: flashRight.value }));

  const handleGoPrev = () => {
    flashLeft.value = withSequence(withTiming(0.18, { duration: 40 }), withTiming(0, { duration: 80 }));
    goPrev();
  };
  const handleGoNext = () => {
    flashRight.value = withSequence(withTiming(0.18, { duration: 40 }), withTiming(0, { duration: 80 }));
    goNext();
  };

  // ── Refs für Nav-Handler: immer aktuellste Version — löst stale-Closure-Problem in handleTap ──
  const navPrevRef = useRef(handleGoPrev);
  const navNextRef = useRef(handleGoNext);
  navPrevRef.current = handleGoPrev;
  navNextRef.current = handleGoNext;

  // ── Tipp-Handler: Doppel-Tap = Like, Einfach-Tap (verzögert) = Nav ─────────
  const handleTap = useCallback((pageX: number, pageY: number) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Doppel-Tap → like + Herz (kein Unlike bei Doppel-Tap, wie TikTok)
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      lastTapRef.current = 0;
      if (!storyLiked) toggleStoryLike();
      spawnHeart(pageX, pageY);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Erster Tap → 300ms warten auf möglichen Doppel-Tap, dann navigieren
      lastTapRef.current = now;
      const savedX = pageX;
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        // Refs verwenden → immer aktuelles handleGoPrev/handleGoNext (kein stale closure)
        if (savedX < W * 0.35) navPrevRef.current();
        else                   navNextRef.current();
      }, 300);
    }
  }, [storyLiked, toggleStoryLike, spawnHeart]);

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || !currentStory?.user_id || sending || addingComment) return;
    try {
      Keyboard.dismiss();
      if (replyMode === 'dm') {
        const convId = await getOrCreateConv(currentStory.user_id);
        await sendMsg({
          conversationId: convId,
          content: text,
          storyMediaUrl: currentStory.media_url ?? undefined,   // Thumbnail
          storyAuthor: currentStory.username ?? undefined,    // @username
        });
      } else {
        await addComment({ storyId: currentStory.id, content: text, isEmoji: false });
      }
      setReplyText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Fehler', 'Nachricht konnte nicht gesendet werden.');
    }
  };

  const handleEmojiReact = async (emoji: string) => {
    if (!currentStory?.user_id || sending || addingComment) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (replyMode === 'dm') {
        const convId = await getOrCreateConv(currentStory.user_id);
        await sendMsg({
          conversationId: convId,
          content: emoji,
          storyMediaUrl: currentStory.media_url ?? undefined,
          storyAuthor: currentStory.username ?? undefined,
        });
      } else {
        await addComment({ storyId: currentStory.id, content: emoji, isEmoji: true });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { /* ignore */ }
  };

  if (!visible || !currentStory) return null;
  const isVideo = currentStory.media_type === 'video';

  return (
    <View style={styles.screen}>
      {/* ── Media — contain: Bild immer vollständig sichtbar, kein Zoom/Cropping ── */}
      {isVideo ? (
        USE_EXPO_VIDEO
          ? <NativeVideoStory uri={currentStory.media_url} isPaused={isPaused} onDurationKnown={handleDurationKnown} />
          : <FallbackVideoStory uri={currentStory.media_url} isPaused={isPaused} onDurationKnown={handleDurationKnown} />
      ) : (
        <Image
          source={{ uri: currentStory.media_url }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          priority="high"
          transition={200}
          placeholder={{ blurhash: 'L00000fQfQfQfQfQfQfQfQfQfQfQ' }}
          cachePolicy="memory-disk"
        />
      )}

      {/* ── Vignetten: subtiler Gradient (wie TikTok — kein harter schwarzer Block) ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.05)', 'transparent']}
        style={styles.vignetteTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)']}
        style={styles.vignetteBottom}
        pointerEvents="none"
      />

      {/* ── Fortschrittsbalken ── */}
      <View style={[styles.progressRow, { top: insets.top + 8 }]} pointerEvents="none">
        {group.stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            {i < storyIndex
              ? <View style={styles.progressFillFull} />
              : i === storyIndex
                ? <RNAnimated.View style={[styles.progressFillAnim, { width: progressWidth }]} />
                : null}
          </View>
        ))}
      </View>

      {/* ── Autor-Header ── */}
      <View style={[styles.header, { top: insets.top + 24 }]}>
        <Pressable
          onPress={() => { onClose(); router.push({ pathname: '/user/[id]', params: { id: currentStory.user_id } }); }}
          style={styles.headerLeft}
        >
          {currentStory.avatar_url ? (
            <Image source={{ uri: currentStory.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarText}>{(currentStory.username ?? '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerUsername}>@{currentStory.username ?? '?'}</Text>
            <Text style={styles.headerTime}>{formatTimeAgo(currentStory.created_at)}</Text>
          </View>
        </Pressable>

        {!isOwnStory && !isOwnProfile && (
          <Pressable
            onPress={() => { toggleFollow(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            hitSlop={8}
          >
            {isFollowing ? <UserCheck size={14} color="#fff" /> : <UserPlus size={14} color="#fff" />}
            <Text style={styles.followBtnText}>{isFollowing ? 'Gefolgt' : 'Folgen'}</Text>
          </Pressable>
        )}

        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
          <X size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* ── Einheitliche Tap-Zone: Einfach = Nav, Doppel = Like+Herz ── */}
      <Pressable
        style={styles.tapFull}
        onPress={(evt) => handleTap(evt.nativeEvent.pageX, evt.nativeEvent.pageY)}
        onLongPress={handleHoldStart}
        onPressOut={handleHoldEnd}
        delayLongPress={150}
      >
        {/* Flash-Overlays für visuelles Nav-Feedback */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, width: W * 0.35, backgroundColor: '#fff' }, flashLeftStyle]} pointerEvents="none" />
        <Animated.View style={[{ position: 'absolute', right: 0, top: 0, bottom: 0, width: W * 0.65, backgroundColor: '#fff' }, flashRightStyle]} pointerEvents="none" />
      </Pressable>

      {/* Fliegende Herzen bei Doppel-Tap */}
      {hearts.map((h) => (
        <FloatingHeart
          key={h.id}
          x={h.x}
          y={h.y}
          onDone={() => setHearts((prev) => prev.filter((hh) => hh.id !== h.id))}
        />
      ))}

      {/* ── Pause-Indikator (erscheint beim Halten) ── */}
      {isHolding && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <View style={styles.pauseIcon}>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </View>
        </View>
      )}

      {/* ── Poll-Overlay ── */}
      {currentStory.interactive?.type === 'poll' && (
        <StoryPollOverlay
          storyId={currentStory.id}
          poll={currentStory.interactive}
          onVote={() => { /* Timer pausiert durch isPaused */ }}
        />
      )}

      {/* ── Bottom-Bar ── */}
      <View style={[styles.bottomBar, { bottom: kbHeight + Math.max(insets.bottom, 10) }]}>
        {isOwnStory ? (
          // Eigene Story: Viewer-Zähler + Like + Share
          <View style={styles.ownStoryActions}>
            <Pressable
              style={styles.viewersBtn}
              onPress={() => { setShowViewers(true); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Story-Aufrufe anzeigen"
            >
              <Eye size={20} color="rgba(255,255,255,0.85)" strokeWidth={1.8} />
            </Pressable>
            <Text style={styles.ownStoryHint}>Deine Story</Text>
            <LikeBtn storyId={currentStory.id} />
            <Pressable onPress={() => setShareOpen(true)} hitSlop={12}>
              <Share2 size={26} color="#fff" strokeWidth={1.8} />
            </Pressable>
          </View>
        ) : (
          // Fremde Story: Emoji-Reaktionen + DM/Öffentlich Toggle + Reply
          <>
            {/* Emoji Quick-React Row — erscheint bei Fokus */}
            {showEmojis && (
              <View style={styles.emojiRow}>
                {['😍', '😂', '😮', '😇', '❤️', '👏', '🔥', '🎉'].map((em) => (
                  <Pressable
                    key={em}
                    style={styles.emojiBtn}
                    onPress={() => handleEmojiReact(em)}
                    hitSlop={6}
                  >
                    <Text style={styles.emojiBtnText}>{em}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <BlurView intensity={40} tint="dark" style={styles.replyBlur}>
              {/* Mode-Toggle: DM ↔ Öffentlich */}
              <Pressable
                style={[styles.modeToggle, replyMode === 'public' && styles.modeTogglePublic]}
                onPress={() => {
                  setReplyMode(m => m === 'dm' ? 'public' : 'dm');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                hitSlop={6}
              >
                <Text style={styles.modeToggleText}>
                  {replyMode === 'dm' ? '✉️' : '💬'}
                </Text>
              </Pressable>

              <TextInput
                ref={inputRef}
                style={styles.replyInput}
                placeholder={replyMode === 'dm'
                  ? `DM an @${currentStory.username ?? '?'}…`
                  : 'Öffentlich kommentieren…'}
                placeholderTextColor="rgba(255,255,255,0.45)"
                value={replyText}
                onChangeText={setReplyText}
                returnKeyType="send"
                onSubmitEditing={handleSendReply}
                onFocus={() => setShowEmojis(true)}
                onBlur={() => setTimeout(() => setShowEmojis(false), 200)}
                blurOnSubmit={false}
              />
              {replyText.length > 0 ? (
                <Pressable onPress={handleSendReply} hitSlop={8} style={styles.sendIconBtn}>
                  <Send size={18} color="#FFFFFF" />
                </Pressable>
              ) : (
                replyMode === 'public' && (
                  <Pressable
                    style={styles.commentCount}
                    onPress={() => {
                      Keyboard.dismiss();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowComments(true);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.commentCountText}>
                      {storyComments.length > 0 ? storyComments.length : '💬'}
                    </Text>
                  </Pressable>
                )
              )}
            </BlurView>
            <LikeBtn storyId={currentStory.id} />
            <Pressable onPress={() => { Keyboard.dismiss(); setShareOpen(true); }} hitSlop={12}>
              <Share2 size={26} color="#fff" strokeWidth={1.8} />
            </Pressable>
          </>
        )}
      </View>

      {/* ── In-App Share Modal ── */}
      <InAppShareModal
        visible={shareOpen}
        storyUsername={currentStory.username ?? '?'}
        storyMediaUrl={currentStory.media_url}
        onClose={() => setShareOpen(false)}
      />

      {/* ── TikTok-Style Kommentar-Sheet ── */}
      <StoryCommentsSheet
        visible={showComments}
        storyId={currentStory.id}
        comments={storyComments}
        onClose={() => setShowComments(false)}
        onSubmit={async (text) => {
          await addComment({ storyId: currentStory.id, content: text, isEmoji: false });
        }}
      />

      {/* ── Story-Viewer-Liste (nur für eigene Stories) ── */}
      <StoryViewersSheet
        visible={showViewers}
        storyId={isOwnStory ? currentStory.id : null}
        onClose={() => setShowViewers(false)}
        onNavigateToProfile={onClose}
      />
    </View>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 1) return `vor ${h}h`;
  if (m >= 1) return `vor ${m}min`;
  return 'gerade eben';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  vignetteTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 220,
    zIndex: 1,
  },
  vignetteBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 260,
    zIndex: 1,
  },
  progressRow: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4, zIndex: 10 },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.30)',
    overflow: 'hidden',
  },
  // Vergangene Stories: statisch voll
  progressFillFull: {
    position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  // Aktuelle Story: width-Animation via Reanimated (JS-Thread, fine for 3px bar)
  progressFillAnim: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    // width wird animiert via progressStyle
  },

  header: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  headerAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  headerUsername: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  headerTime: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  closeBtn: { padding: 4 },

  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.3)' },
  followBtnActive: { borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.15)' },
  followBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Tap-Zonen lassen 130px unten frei für Bottom-Bar
  tapFull: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 130, zIndex: 5 },
  // tapLeft / tapRight werden nicht mehr als Pressables verwendet (werden durch tapFull ersetzt)
  tapLeft:  { position: 'absolute', left: 0, top: 0, bottom: 130, width: W * 0.35, zIndex: 5 },
  tapRight: { position: 'absolute', right: 0, top: 0, bottom: 130, width: W * 0.65, zIndex: 5 },

  bottomBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 20 },

  replyBlur: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 24, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  replyInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 0 },
  sendIconBtn: { marginLeft: 8 },

  // ── Emoji Quick-React Row ──────────────────────────────────────────────────
  emojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  emojiBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnText: { fontSize: 20 },

  // ── Mode Toggle (DM / Öffentlich) ─────────────────────────────────────────
  modeToggle: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  modeTogglePublic: { backgroundColor: 'rgba(255,255,255,0.15)' },
  modeToggleText: { fontSize: 16 },

  // ── Kommentar-Zähler ──────────────────────────────────────────────────────
  commentCount: {
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  commentCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  ownStoryActions: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  ownStoryHint: { color: 'rgba(255,255,255,0.45)', fontSize: 13, flex: 1 },
  viewersBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Pause-Indikator beim Lang-Drücken
  pauseOverlay: {
    position: 'absolute', inset: 0,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 50,
  },
  pauseIcon: {
    flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 14, borderRadius: 40,
  },
  pauseBar: {
    width: 5, height: 26, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.90)',
  },
});

// ── TikTok Share Sheet Styles ─────────────────────────────────────────────────
const ss = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: 34,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 14 },
  sectionLabel: { color: '#fff', fontSize: 15, fontWeight: '700', paddingHorizontal: 18, marginBottom: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14, marginHorizontal: 18 },

  // ── Reihe 1: User-Suche & horizontale Liste ──
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 13 },
  userScroll: { marginBottom: 4 },
  userScrollContent: { paddingHorizontal: 14, gap: 6 },
  userItem: { alignItems: 'center', width: 66, gap: 5 },
  userAvatarWrap: { position: 'relative' },
  userAvatarChosen: {},
  userAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  userAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  checkBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#111118',
  },
  userLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center', width: 62 },
  emptyUsers: { color: 'rgba(255,255,255,0.3)', fontSize: 13, paddingHorizontal: 4, paddingVertical: 6 },
  sendBtn: {
    marginHorizontal: 18, marginTop: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 8,
  },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Reihe 2: App-Icons ──
  appRow: { paddingHorizontal: 14, gap: 8 },
  appItem: { alignItems: 'center', width: 68, gap: 6 },
  appIcon: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  appEmoji: { fontSize: 26 },
  appLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center' },

  // ── Reihe 3: Aktions-Buttons ──
  actionRow: { flexDirection: 'row', paddingHorizontal: 18, gap: 10 },
  actionItem: { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center' },
});

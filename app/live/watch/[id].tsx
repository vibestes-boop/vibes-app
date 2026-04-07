/**
 * live/watch/[id].tsx
 * Zuschauer-Ansicht eines Live-Streams via LiveKit.
 * Braucht Dev-Build: npx expo run:ios / npx expo run:android
 */
import { useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Users, Send, VolumeX, Volume2, Heart, Flag, Smile } from 'lucide-react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
// react-native-reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = {
  View: _animNS?.View ?? _animMod?.View,
  Text: _animNS?.Text ?? _animMod?.Text,
};
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  withSpring,
  withDelay,
  FadeInDown,
  Easing,
} from 'react-native-reanimated';

import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
  AudioSession,
} from '@livekit/react-native';
import { Track, RoomEvent } from 'livekit-client';  // Track.Source lebt in livekit-client, nicht @livekit/react-native
import type { TrackPublication } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import {
  useLiveSession,
  useLiveViewer,
  useLiveComments,
  useLiveReactions,
  usePinComment,
  reportLive,
  fetchLiveKitToken,
  type LiveComment,
  type LiveReaction,
} from '@/lib/useLiveSession';
import { useAuthStore } from '@/lib/authStore';
import { useFollow } from '@/lib/useFollow';
import { LiveUserSheet } from '@/components/live/LiveUserSheet';
import ExpoGoPlaceholder from '@/components/live/ExpoGoPlaceholder';
import { GiftPicker } from '@/components/live/GiftPicker';
import { GiftAnimation } from '@/components/live/GiftAnimation';
import { useGiftStream } from '@/lib/useGifts';
// expo-constants: default import causes _interopRequireDefault TypeError in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _cMod = require('expo-constants') as any; const Constants = _cMod?.default ?? _cMod;

const EMOJIS = ['❤️', '🔥', '👏', '😱', '💜'];
const { width: SCREEN_W } = Dimensions.get('window');

// Zahlen formatieren: 1200 → "1.2K"
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── TikTok-Style Floating Heart (Reaktion-Feed) ─────────────────────────────
function FloatingHeart({ reaction }: { reaction: LiveReaction }) {
  const x = SCREEN_W * 0.52 + Math.random() * (SCREEN_W * 0.28);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 7, stiffness: 140 });
    translateY.value = withTiming(-300, { duration: 2600 });
    opacity.value = withDelay(1800, withTiming(0, { duration: 800 }));
    rotate.value = withRepeat(
      withSequence(
        withTiming(-0.18, { duration: 280 }),
        withTiming(0.18, { duration: 280 }),
      ),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}rad` },
    ],
    opacity: opacity.value,
    left: x,
  }));

  return (
    <Animated.View style={[s.floatingHeartWrap, animStyle]}>
      <Heart size={56} color="#FF2D55" fill="#FF2D55" />
    </Animated.View>
  );
}

// ─── Tap-to-Like Herz — spawnt am Tap-Ort, fliegt hoch ────────────────────────
type TapHeartItem = { id: number; x: number; y: number };

function TapHeart({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const scale = useSharedValue(0);
  const floatY = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.5, { damping: 7, stiffness: 220 }),
      withTiming(1.15, { duration: 150, easing: Easing.out(Easing.cubic) })
    );
    floatY.value = withTiming(-110, { duration: 1700, easing: Easing.out(Easing.quad) });
    rot.value = withRepeat(
      withSequence(withTiming(-8, { duration: 180 }), withTiming(8, { duration: 180 })),
      4, true
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(900, withTiming(0, { duration: 800 }))
    );
    const t = setTimeout(onDone, 1750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x - 60 },
      { translateY: y - 60 + floatY.value },
      { scale: scale.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[{ position: 'absolute', width: 120, height: 120, left: 0, top: 0 }, style]}
      pointerEvents="none"
    >
      <Heart size={120} color="#EE1D52" fill="#EE1D52" />
    </Animated.View>
  );
}

// ─── Floating Reaktions-Bubble ────────────────────────────────────────────────
function ReactionBubble({ reaction }: { reaction: LiveReaction }) {
  if (reaction.emoji === '❤️') return <FloatingHeart reaction={reaction} />;

  const left = 20 + Math.random() * 140;
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withTiming(-220, { duration: 2800 });
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 2700 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Werte nur beim Mount starten
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    left,
  }));

  return (
    <Animated.View style={[s.reactionBubble, style]}>
      <Text style={s.reactionEmoji}>{reaction.emoji}</Text>
    </Animated.View>
  );
}

// ─── Kommentar-Zeile ──────────────────────────────────────────────────
function CommentRow({
  comment,
  onUserPress,
}: {
  comment: LiveComment;
  onUserPress?: (userId: string) => void;
}) {
  const isSystem = (comment as any).isSystem;
  const avatar = comment.profiles?.avatar_url;
  const initials = comment.profiles?.username?.[0]?.toUpperCase() ?? '?';
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={s.commentRow}>
      {isSystem ? (
        <Text style={s.systemText}>{comment.text}</Text>
      ) : (
        <Pressable
          onPress={() => onUserPress?.(comment.user_id)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <Text style={s.commentUser}>@{comment.profiles?.username ?? 'User'} </Text>
          <Text style={s.commentText}>{comment.text}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// ─── Remote Video (Host-Stream) ───────────────────────────────────────────────
function RemoteVideoView({ hostAvatar }: { hostAvatar?: string | null }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const remoteTrack = tracks.find((t) => !t.participant?.isLocal);

  // Echtzeit-Erkennung ob Host-Kamera gemuted ist (z.B. App-Wechsel)
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const room = useContext(RoomContext);

  useEffect(() => {
    if (!room) return;
    const onMuted = (pub: TrackPublication) => {
      if (pub.source === Track.Source.Camera) setIsCameraMuted(true);
    };
    const onUnmuted = (pub: TrackPublication) => {
      if (pub.source === Track.Source.Camera) setIsCameraMuted(false);
    };
    room.on(RoomEvent.TrackMuted, onMuted);
    room.on(RoomEvent.TrackUnmuted, onUnmuted);
    return () => {
      room.off(RoomEvent.TrackMuted, onMuted);
      room.off(RoomEvent.TrackUnmuted, onUnmuted);
    };
  }, [room]);

  if (!remoteTrack) {
    // Noch kein Stream → Avatar-Placeholder
    return (
      <View style={s.videoPlaceholder}>
        {hostAvatar ? (
          <Image source={{ uri: hostAvatar }} style={s.hostAvatar} contentFit="cover" />
        ) : (
          <View style={[s.hostAvatar, s.hostAvatarFallback]}>
            <Text style={s.hostInitial}>?</Text>
          </View>
        )}
        <ActivityIndicator color="rgba(255,255,255,0.5)" style={{ marginTop: 16 }} />
        <Text style={s.connectingText}>Verbinde …</Text>
      </View>
    );
  }

  return (
    <>
      <VideoTrack
        trackRef={remoteTrack as any}
        style={StyleSheet.absoluteFill as any}
        objectFit="cover"
      />
      {/* TikTok-Style "Live pausiert"-Overlay: erscheint wenn Host App wechselt */}
      {isCameraMuted && (
        <View style={StyleSheet.absoluteFill}>
          {/* Blurred Avatar als Hintergrund */}
          {hostAvatar ? (
            <Image
              source={{ uri: hostAvatar }}
              style={StyleSheet.absoluteFill as any}
              contentFit="cover"
              blurRadius={22}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a14' }]} />
          )}
          {/* Dark Dim */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />
          {/* Inhalt */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {hostAvatar ? (
              <Image
                source={{ uri: hostAvatar }}
                style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }}
                contentFit="cover"
              />
            ) : null}
            {/* Pause-Icon */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              <View style={{ width: 5, height: 28, borderRadius: 3, backgroundColor: '#fff' }} />
              <View style={{ width: 5, height: 28, borderRadius: 3, backgroundColor: '#fff' }} />
            </View>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 }}>
              Live pausiert
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>
              Der Host hat die App kurz gewechselt.{'\n'}Warte kurz, es geht gleich weiter.
            </Text>
          </View>
        </View>
      )}
    </>
  );
}


// ─── TikTok-Style "Live beendet"-Overlay ──────────────────────────────────────
function LiveEndedOverlay({
  session,
  isFollowing,
  isOwnProfile,
  onFollow,
  onBack,
}: {
  session: import('@/lib/useLiveSession').LiveSession | null | undefined;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onFollow: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Auto-navigate nach 5s
  useEffect(() => {
    const t = setTimeout(onBack, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const host = session?.profiles;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Blurried Avatar als Hintergrund */}
      {host?.avatar_url ? (
        <Image
          source={{ uri: host.avatar_url }}
          style={StyleSheet.absoluteFill as any}
          contentFit="cover"
          blurRadius={28}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a14' }]} />
      )}
      {/* Dunkles Dim-Overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />

      {/* Content */}
      <View style={[s2.endedContent, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
        {/* Host Avatar */}
        <View style={s2.endedAvatarWrap}>
          {host?.avatar_url ? (
            <Image
              source={{ uri: host.avatar_url }}
              style={s2.endedAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[s2.endedAvatar, { backgroundColor: '#0891B2', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800' }}>
                {host?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <View style={s2.endedAvatarRing} />
        </View>

        <Text style={s2.endedUsername}>@{host?.username ?? 'User'}</Text>
        <Text style={s2.endedTitle}>hat das Live beendet</Text>
        <Text style={s2.endedSubtitle}>Danke für deine Teilnahme 💜</Text>

        {/* Stats */}
        <View style={s2.endedStats}>
          <View style={s2.endedStat}>
            <Text style={s2.endedStatNum}>{session?.viewer_count ?? 0}</Text>
            <Text style={s2.endedStatLabel}>Zuschauer</Text>
          </View>
          <View style={s2.endedStatDivider} />
          <View style={s2.endedStat}>
            <Text style={s2.endedStatNum}>{session?.like_count ?? 0}</Text>
            <Text style={s2.endedStatLabel}>Likes</Text>
          </View>
          <View style={s2.endedStatDivider} />
          <View style={s2.endedStat}>
            <Text style={s2.endedStatNum}>{session?.comment_count ?? 0}</Text>
            <Text style={s2.endedStatLabel}>Kommentare</Text>
          </View>
        </View>

        {/* Follow-Button */}
        {!isOwnProfile && !isFollowing && (
          <Pressable onPress={onFollow} style={s2.endedFollowBtn}>
            <Text style={s2.endedFollowText}>+ Folgen</Text>
          </Pressable>
        )}
        {!isOwnProfile && isFollowing && (
          <View style={[s2.endedFollowBtn, { backgroundColor: 'rgba(74,222,128,0.18)', borderColor: '#4ade80' }]}>
            <Text style={[s2.endedFollowText, { color: '#4ade80' }]}>✓ Du folgst bereits</Text>
          </View>
        )}

        {/* Zurück-Button */}
        <Pressable onPress={onBack} style={s2.endedBackBtn}>
          <Text style={s2.endedBackText}>Zurück zum Feed</Text>
        </Pressable>

        <Text style={s2.endedAutoClose}>Weiterleitung in 5 Sekunden …</Text>
      </View>
    </View>
  );
}

const s2 = StyleSheet.create({
  endedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  endedAvatarWrap: { position: 'relative', marginBottom: 8 },
  endedAvatar: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
  },
  endedAvatarRing: {
    position: 'absolute',
    top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 67,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  endedUsername: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  endedTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  endedSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  endedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  endedStat: { alignItems: 'center', gap: 3, minWidth: 70 },
  endedStatNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
  endedStatLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  endedStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 8 },
  endedFollowBtn: {
    width: '100%',
    backgroundColor: '#EE1D52',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  endedFollowText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  endedBackBtn: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  endedBackText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600' },
  endedAutoClose: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 },
});

// ─── Inner Watch UI (innerhalb LiveKitRoom) ───────────────────────────────────
function WatchUI({ sessionId }: { sessionId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuthStore();

  const { data: session } = useLiveSession(sessionId);
  useLiveViewer(sessionId);
  const { comments, sendComment, sendSystemEvent } = useLiveComments(sessionId);
  const { reactions, sendReaction } = useLiveReactions(sessionId);
  const { pinnedComment } = usePinComment(sessionId);
  const { isFollowing, toggle: toggleFollow, isOwnProfile } =
    useFollow(session?.host_id ?? null);
  const flatRef = useRef<FlatList>(null);
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [liveEnded, setLiveEnded] = useState(false);
  const [userScrolling, setUserScrolling] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [tapHearts, setTapHearts] = useState<TapHeartItem[]>([]);
  const tapHeartIdRef = useRef(0);
  const joinedRef = useRef(false);

  // ─── Gift System ──────────────────────────────────────────────────────────────────────
  const [giftPickerVisible, setGiftPickerVisible] = useState(false);
  const { gifts: incomingGifts } = useGiftStream(sessionId);

  // System-Event: beigetreten (einmalig nach Session-Load)
  useEffect(() => {
    if (!session || !profile || joinedRef.current) return;
    joinedRef.current = true;
    sendSystemEvent(`👋 @${profile.username} ist beigetreten`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, profile?.id]);




  // Alle Remote-Audio-Tracks holen (nur vom Host, nicht lokal)
  const audioTracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }])
    .filter((t) => !t.participant?.isLocal);

  // Audio-Tracks: Mute-State anwenden wenn User Lautsprecher-Button drückt.
  // Subscription selbst wird automatisch durch autoSubscribe (Standard) gehandhabt.
  useEffect(() => {
    audioTracks.forEach((t) => {
      const ms = (t.publication?.track as any)?.mediaStreamTrack as MediaStreamTrack | undefined;
      if (ms) ms.enabled = !muted;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, audioTracks]);

  // iOS/Android Audio-Session für Viewer konfigurieren (vor LiveKit-Connect):
  // Ohne eigenes Mikro bleibt die Audio-Session im Standard-Modus ('soloAmbient' / 'inCommunication').
  // Für Viewer muss 'playback' (iOS) / 'media' (Android) gesetzt werden damit Remote-Audio
  // über den Lautsprecher hörbar ist.
  useEffect(() => {
    AudioSession.configureAudio({
      ios: { defaultOutput: 'speaker' },
      android: {
        audioTypeOptions: {
          manageAudioFocus: true,
          audioMode: 'normal',
          audioFocusMode: 'gain',
          audioStreamType: 'music',
          audioAttributesUsageType: 'media',
          audioAttributesContentType: 'unknown',
        },
      },
    });
    AudioSession.startAudioSession().catch(() => {});
    if (Platform.OS === 'ios') {
      // iOS: AVAudioSession auf 'playback' setzen sobald kein lokaler Track publiziert wird
      AudioSession.setAppleAudioConfiguration({
        audioCategory: 'playback',
        audioCategoryOptions: ['mixWithOthers'],
        audioMode: 'spokenAudio',
      }).catch(() => {});
    }
    return () => {
      AudioSession.stopAudioSession().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portrait-Lock — Live-Stream ist immer vertikal
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
    return () => {
      ScreenOrientation.unlockAsync().catch(() => { });
    };
  }, []);


  const dotOpacity = useSharedValue(1);
  useEffect(() => {
    dotOpacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur einmalig starten
  }, []);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  useEffect(() => {
    if (comments.length > 0 && !userScrolling) {
      flatRef.current?.scrollToEnd({ animated: true });
    }
  }, [comments.length, userScrolling]);

  // Live beendet → Redirect (Fallback für den Fall dass Overlay schon geschlossen)
  useEffect(() => {
    if (session?.status === 'ended' && !liveEnded) setLiveEnded(true);
  }, [session?.status, liveEnded]);

  const submit = () => {
    if (!input.trim()) return;
    sendComment(input.trim());
    setInput('');
    Keyboard.dismiss();
  };

  const handleScreenTap = (x: number, y: number) => {
    // Herz am Tap-Ort spawnen
    const newId = tapHeartIdRef.current++;
    setTapHearts((prev) => [...prev, { id: newId, x, y }]);
    // Reaktion senden (Echtzeit für alle Zuschauer)
    sendReaction('❤️');
  };

  const host = session?.profiles;

  // TikTok-Style: Live beendet Overlay
  if (liveEnded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <LiveEndedOverlay
          session={session}
          isFollowing={isFollowing}
          isOwnProfile={isOwnProfile}
          onFollow={toggleFollow}
          onBack={() => router.replace('/(tabs)')}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Host-Video */}
      <RemoteVideoView hostAvatar={host?.avatar_url} />

      {/* HD-Badge — oben links am Video */}
      <View style={s.hdBadge} pointerEvents="none">
        <Text style={s.hdBadgeText}>HD</Text>
      </View>

      {/* Blur-Hintergrund wenn kein Video */}
      {host?.avatar_url && (
        <Image
          source={{ uri: host.avatar_url }}
          style={[StyleSheet.absoluteFill, { opacity: 0.18, zIndex: -1 }]}
          contentFit="cover"
          blurRadius={18}
        />
      )}

      {/* Overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.88)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Gesamter Screen: Tap → Herz am Tap-Ort */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPressIn={(evt) => handleScreenTap(evt.nativeEvent.locationX, evt.nativeEvent.locationY)}
      />

      {/* Floating Reaktionen (von anderen Usern) */}
      <View style={s.reactionsLayer} pointerEvents="none">
        {reactions.map((r) => <ReactionBubble key={r.id} reaction={r} />)}
      </View>

      {/* Tap-Herzen — je eins pro Tap, fliegen am Tap-Ort hoch */}
      {tapHearts.map((h) => (
        <TapHeart
          key={h.id}
          x={h.x}
          y={h.y}
          onDone={() => setTapHearts((prev) => prev.filter((hh) => hh.id !== h.id))}
        />
      ))}

      {/* Oben — TikTok style */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ArrowLeft size={20} stroke="#fff" strokeWidth={2.2} />
        </Pressable>

        <View style={s.hostInfo}>
          {host?.avatar_url ? (
            <Image source={{ uri: host.avatar_url }} style={s.hostAvatarSmall} contentFit="cover" />
          ) : (
            <View style={[s.hostAvatarSmall, s.hostAvatarSmallFallback]}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                {host?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <Text style={s.hostName} numberOfLines={1}>@{host?.username ?? '...'}</Text>
          {!isOwnProfile && (
            <Pressable
              onPress={toggleFollow}
              style={[s.followBtn, isFollowing && s.followBtnActive]}
              hitSlop={8}
            >
              <Text style={s.followBtnText}>{isFollowing ? '✓' : '+'}</Text>
            </Pressable>
          )}
        </View>

        <View style={s.livePill}>
          <Animated.View style={[s.liveDot, dotStyle]} />
          <Text style={s.liveLabel}>LIVE</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={s.viewerBadge}>
            <Users size={13} stroke="#fff" strokeWidth={2} />
            <Text style={s.viewerCount}>{session?.viewer_count ?? 0}</Text>
          </View>
          {!isOwnProfile && (
            <Pressable onPress={() => setReportModalVisible(true)} hitSlop={12} style={s.reportBtn}>
              <Flag size={16} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Titel */}
      {session?.title ? (
        <View style={[s.titleWrap, { top: insets.top + 56 }]}>
          <Text style={s.titleText} numberOfLines={1}>{session.title}</Text>
        </View>
      ) : null}

      {/* Gepinnter Kommentar (Viewer: read-only) */}
      {pinnedComment && !(pinnedComment as any).isSystem && (
        <View style={[s.pinnedBanner, { top: insets.top + (session?.title ? 90 : 58) }]}>
          <Text style={s.pinnedLabel}>📌</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.pinnedUser}>@{pinnedComment.profiles?.username ?? 'User'}</Text>
            <Text style={s.pinnedText} numberOfLines={2}>{pinnedComment.text}</Text>
          </View>
        </View>
      )}

      {/* Kommentare */}
      <View style={[s.commentsArea, { bottom: insets.bottom + 55 }]}>
        <FlatList
          ref={flatRef}
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CommentRow
              comment={item}
              onUserPress={(uid) => setSelectedUserId(uid)}
            />
          )}
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          onScrollBeginDrag={() => setUserScrolling(true)}
          onScrollEndDrag={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 20)
              setUserScrolling(false);
          }}
          onMomentumScrollEnd={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 20)
              setUserScrolling(false);
          }}
        />
      </View>

      {/* Kommentar-Leiste */}
      <View style={[s.commentBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={s.inputWrap}>
          <Pressable
            onPress={() => { Keyboard.dismiss(); setEmojiPickerVisible(true); }}
            hitSlop={6}
            style={s.smileBtn}
          >
            <Smile size={19} stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
          </Pressable>
          <TextInput
            style={s.input}
            placeholder="Kommentieren …"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={submit}
            returnKeyType="send"
            selectionColor="#22D3EE"
            maxLength={300}
          />
        </View>
        {input.trim().length > 0 ? (
          <Pressable onPress={submit} hitSlop={8} style={s.sendBtn}>
            <Send size={20} stroke="#22D3EE" strokeWidth={2.2} />
          </Pressable>
        ) : (
          // Geschenk-Button (sichtbar wenn kein Text eingegeben)
          <Pressable
            hitSlop={8}
            style={s.giftBtn}
            onPress={() => setGiftPickerVisible(true)}
          >
            <Text style={s.giftBtnEmoji}>🎁</Text>
          </Pressable>
        )}
      </View>

      {/* Rechte Aktions-Spalte — TikTok style */}
      <View style={[s.rightActions, { bottom: insets.bottom + 70 }]} pointerEvents="box-none">
        <Pressable
          style={s.rightActionBtn}
          onPress={() => {
            const newId = tapHeartIdRef.current++;
            setTapHearts((prev) => [...prev, { id: newId, x: SCREEN_W * 0.85, y: 420 }]);
            sendReaction('❤️');
          }}
        >
          <Heart size={32} color="#fff" fill="transparent" strokeWidth={1.8} />
          <Text style={s.rightActionCount}>{fmtNum(session?.like_count ?? 0)}</Text>
        </Pressable>
        <Pressable style={s.rightActionBtn} onPress={() => setMuted((v) => !v)}>
          {muted
            ? <VolumeX size={28} color="#EF4444" strokeWidth={1.8} />
            : <Volume2 size={28} color="rgba(255,255,255,0.9)" strokeWidth={1.8} />}
        </Pressable>
      </View>

      {/* Emoji-Picker Bottom-Sheet */}
      <Modal
        transparent
        visible={emojiPickerVisible}
        animationType="slide"
        onRequestClose={() => setEmojiPickerVisible(false)}
      >
        <Pressable
          style={s.emojiPickerBackdrop}
          onPress={() => setEmojiPickerVisible(false)}
        >
          <View style={[s.emojiPickerSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.emojiPickerHandle} />
            <Text style={s.emojiPickerTitle}>Reaktion senden</Text>
            <View style={s.emojiPickerGrid}>
              {EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={({ pressed }) => [s.emojiPickerBtn, pressed && { opacity: 0.7, transform: [{ scale: 1.15 }] }]}
                  onPress={() => {
                    sendReaction(emoji);
                    setEmojiPickerVisible(false);
                  }}
                >
                  <Text style={s.emojiPickerEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Gift Animation Overlay ──────────────────────────────────────── */}
      <GiftAnimation gifts={incomingGifts} />

      {/* ─── Gift Picker Modal ─────────────────────────────────────────── */}
      <GiftPicker
        visible={giftPickerVisible}
        onClose={() => setGiftPickerVisible(false)}
        recipientId={session?.host_id ?? ''}
        recipientName={session?.profiles?.username ?? ''}
        liveSessionId={sessionId}
      />

      {/* Report Modal */}
      <Modal
        transparent
        visible={reportModalVisible}
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <Pressable style={s.reportBackdrop} onPress={() => setReportModalVisible(false)}>
          <View style={s.reportSheet}>
            {reportSent ? (
              <>
                <Text style={s.reportTitle}>✅ Gemeldet</Text>
                <Text style={s.reportSub}>Danke für dein Feedback. Wir prüfen den Inhalt.</Text>
                <Pressable style={s.reportDone} onPress={() => { setReportModalVisible(false); setReportSent(false); }}>
                  <Text style={s.reportDoneText}>Schließen</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.reportTitle}>Live melden</Text>
                <Text style={s.reportSub}>Warum möchtest du dieses Live melden?</Text>
                {(['inappropriate', 'spam', 'violence', 'other'] as const).map((reason) => (
                  <Pressable
                    key={reason}
                    style={s.reportOption}
                    onPress={async () => {
                      await reportLive(sessionId, reason);
                      setReportSent(true);
                    }}
                  >
                    <Text style={s.reportOptionText}>
                      {reason === 'inappropriate' && '🚫 Unangemessener Inhalt'}
                      {reason === 'spam' && '📢 Spam'}
                      {reason === 'violence' && '⚠️ Gewalt'}
                      {reason === 'other' && '📝 Sonstiges'}
                    </Text>
                  </Pressable>
                ))}
                <Pressable style={s.reportCancel} onPress={() => setReportModalVisible(false)}>
                  <Text style={s.reportCancelText}>Abbrechen</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* TikTok-Style User Info Sheet */}
      <LiveUserSheet
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onMention={(username) => {
          setInput((prev) => `${prev}@${username} `);
          setSelectedUserId(null);
        }}
        onReport={() => {
          setSelectedUserId(null);
          setReportModalVisible(true);
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Screen (lädt LiveKit Token dann verbindet) ───────────────────────────────
export default function LiveWatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useLiveSession(id);

  // Hooks MÜSSEN vor allen bedingten Returns stehen (Rules of Hooks)
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  // Guard: verhindert dass onError mehrfach feuert (z.B. 'Client initiated disconnect'
  // nach dem ersten Fehler, wenn der Router die Komponente unmountet)
  const isHandlingError = useRef(false);




  useEffect(() => {
    if (!session?.room_name) return;
    fetchLiveKitToken(session.room_name, false)
      .then((res) => {
        if (!res) { setTokenError(true); return; }
        setLkToken(res.token);
        setLkUrl(res.url);
      })
      .catch((err) => {
        __DEV__ && console.error('[LiveWatch] Token fetch failed:', err);
        setTokenError(true);
      });
  }, [session?.room_name]);

  // Timeout: erst starten wenn Session geladen aber nach 20s noch kein room_name vorhanden
  // (z.B. Session ist in DB aber room_name wurde nie gesetzt)
  // Dep: session?.id und session?.room_name (stable primitives) statt ganzes Objekt
  useEffect(() => {
    if (!session?.id) return;    // session noch nicht geladen
    if (session.room_name) return; // room_name da → kein Timeout nötig
    const t = setTimeout(() => {
      if (!lkToken) setTokenError(true);
    }, 20_000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.room_name, lkToken]);

  // Globaler Safety-Timeout: läuft nur bis lkToken vorhanden ist
  // Dep [lkToken]: Timeout bricht ab sobald Token erfolgreich geholt wurde
  // Verhindert auch dass Retry durch altlaufenden Timer sofort wieder in Fehler fällt
  useEffect(() => {
    if (lkToken) return; // schon verbunden → kein Timeout
    const t = setTimeout(() => {
      if (!lkToken && !tokenError) setTokenError(true);
    }, 25_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lkToken]);


  // Expo Go Placeholder (nach den Hooks — Rules of Hooks einhalten!)
  if (Constants.appOwnership === 'expo') {
    return <ExpoGoPlaceholder onBack={() => router.replace('/(tabs)')} icon="📺" />;
  }

  if (tokenError) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }]}>
        <Text style={{ color: '#EF4444', fontSize: 40 }}>📡</Text>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' }}>
          Verbindung fehlgeschlagen
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>
          Das Live ist möglicherweise beendet oder deine Verbindung ist zu schwach.
        </Text>
        <Pressable
          onPress={() => {
            setTokenError(false);
            // Retry: Token erneut holen wenn room_name vorhanden
            if (session?.room_name) {
              fetchLiveKitToken(session.room_name, false)
                .then((res) => {
                  if (!res) { setTokenError(true); return; }
                  setLkToken(res.token);
                  setLkUrl(res.url);
                })
                .catch(() => setTokenError(true));
            }
          }}
          style={[s.backBtnCenter, { backgroundColor: 'rgba(34,211,238,0.15)', marginTop: 8 }]}
        >
          <Text style={{ color: '#22D3EE', fontWeight: '700', fontSize: 15 }}>🔄 Erneut versuchen</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={s.backBtnCenter}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  if (!lkToken || !lkUrl) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', gap: 16 }]}>
        <ActivityIndicator color="#22D3EE" size="large" />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
          {session?.profiles?.username
            ? `@${session.profiles.username} ist LIVE`
            : 'Live lädt …'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Verbinde mit Stream …</Text>
      </View>
    );
  }


  return (
    <View style={s.root}>
      <LiveKitRoom
        serverUrl={lkUrl}
        token={lkToken}
        connect
        // Viewer: kein lokales Mikro publishen (audio=false).
        // Remote-Audio wird automatisch subscribed (LiveKit autoSubscribe=true).
        // iOS Audio-Session wird manuell via AudioSession.configureAudio() gesteuert (siehe WatchUI).
        audio={false}
        video={false}
        onError={(err) => {
          // LiveKit feuert onError auch bei transienten Fehlern (ICE reconnect, kurze Netz-Unterbrechung).
          // Das SDK versucht automatisch neu zu verbinden — wir zeigen NUR den Fehlerscreen,
          // navigieren aber NICHT sofort weg. User kann "Erneut versuchen" drücken.
          // Bekannte harmlose Fehler filtern:
          const msg = err.message ?? '';
          const isHarmless =
            msg.includes('Client initiated disconnect') ||
            msg.includes('signal connection closed') ||
            msg.includes('reconnect');
          if (isHarmless) {
            __DEV__ && console.warn('[LiveWatch] Transient LK error (ignored):', msg);
            return;
          }
          if (isHandlingError.current) return;
          isHandlingError.current = true;
          __DEV__ && console.error('[LiveWatch] LiveKit fatal error:', msg);
          setTokenError(true); // Zeige Fehlerscreen — kein sofortiges router.replace
        }}
      >
        <WatchUI sessionId={id} />
      </LiveKitRoom>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  videoPlaceholder: {
    position: 'absolute', top: '25%', left: 0, right: 0,
    alignItems: 'center', gap: 12, zIndex: 2,
  },
  hostAvatar: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: '#EF4444',
  },
  hostAvatarFallback: { backgroundColor: '#0891B2', alignItems: 'center', justifyContent: 'center' },
  hostInitial: { color: '#fff', fontSize: 44, fontWeight: '900' },
  connectingText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 },

  reactionsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 110,
    zIndex: 5,
  } as any,
  reactionBubble: {
    position: 'absolute', bottom: 0,
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 26 },
  floatingHeartWrap: {
    position: 'absolute',
    bottom: 80,
    zIndex: 6,
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, zIndex: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnCenter: {
    paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderRadius: 16,
  },
  hostInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  hostAvatarSmall: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  hostAvatarSmallFallback: { backgroundColor: '#0891B2', alignItems: 'center', justifyContent: 'center' },
  hostName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
  liveLabel: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  viewerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  viewerCount: { color: '#fff', fontSize: 13, fontWeight: '700' },

  titleWrap: {
    position: 'absolute', alignSelf: 'center', zIndex: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16, paddingVertical: 5, borderRadius: 14,
  },
  titleText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },

  emojiRow: {
    position: 'absolute', right: 14,
    gap: 8, zIndex: 15,
  },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },

  commentsArea: {
    position: 'absolute', left: 0, right: 80,
    maxHeight: 240, paddingHorizontal: 14, zIndex: 10,
  },
  commentRow: {
    paddingVertical: 2,
    marginBottom: 3,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  commentAvatar: {
    width: 24, height: 24, borderRadius: 12,
    flexShrink: 0, marginTop: 1,
  },
  commentAvatarFallback: {
    backgroundColor: '#0891B2',
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarInitial: { color: '#fff', fontSize: 10, fontWeight: '800' },
  commentTextWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  commentUser: { color: '#FFFC00', fontWeight: '800', fontSize: 13 },
  commentText: { color: '#fff', fontSize: 13, flexShrink: 1 },
  systemText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontStyle: 'italic' },

  commentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 72,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.0)',
    zIndex: 30,
  },
  myAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', flexShrink: 0 },
  myAvatarFallback: { backgroundColor: '#0891B2', alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  input: { flex: 1, color: '#fff', fontSize: 14, padding: 0, margin: 0 },
  sendBtn: { padding: 4, flexShrink: 0 },
  smileBtn: {
    marginRight: 6,
    flexShrink: 0,
  },

  followBtn: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  followBtnActive: { borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.2)' },
  followBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 17 },
  // Right-side action column
  rightActions: {
    position: 'absolute', right: 10,
    alignItems: 'center', gap: 22, zIndex: 25,
  },
  rightActionBtn: { alignItems: 'center', gap: 5 },
  rightActionCount: {
    color: '#fff', fontSize: 12, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  muteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  muteBtnActive: { backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: '#EF4444' },
  dmBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Pinned Comment Banner (watch screen)
  pinnedBanner: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#22D3EE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    zIndex: 20,
  },
  pinnedLabel: { color: '#22D3EE', fontSize: 14 },
  pinnedUser: { color: '#22D3EE', fontWeight: '700', fontSize: 12 },
  pinnedText: { color: '#fff', fontSize: 12 },

  // Report Button
  reportBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Like-Counter Badge
  likeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,45,85,0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.35)',
  },
  likeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // HD-Badge
  hdBadge: {
    position: 'absolute',
    top: 60,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 5,
  },
  hdBadgeText: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // Report Modal
  reportBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  reportTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  reportSub: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  reportOption: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  reportOptionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  reportCancel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  reportCancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center' },
  reportDone: {
    backgroundColor: '#22D3EE',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  reportDoneText: { color: '#000', fontSize: 15, fontWeight: '800', textAlign: 'center' },

  // ── Emoji-Picker Bottom-Sheet ────────────────────────────────────────────────
  emojiPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  emojiPickerSheet: {
    backgroundColor: '#141420',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  emojiPickerHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  emojiPickerTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emojiPickerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 8,
  },
  emojiPickerBtn: {
    width: 64, height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emojiPickerEmoji: { fontSize: 32 },
  giftBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244,63,94,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(244,63,94,0.5)',
  },
  giftBtnEmoji: { fontSize: 20 },
});

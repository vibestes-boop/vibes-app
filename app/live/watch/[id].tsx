/**
 * live/watch/[id].tsx
 * Zuschauer-Ansicht eines Live-Streams via LiveKit.
 * Braucht Dev-Build: npx expo run:ios / npx expo run:android
 */
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Animated as RNAnimated,
  PanResponder,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sentry from '@sentry/react-native';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { X, Share2, Video, Search, Users, Send, VolumeX, Volume2, Heart, Flag, Smile, Scissors, ShoppingBag, BarChart3 } from 'lucide-react-native';
import { useClipNow } from '@/lib/useLiveClips';
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
import { Track, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import type { TrackPublication } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import {
  useLiveSession,
  useLiveViewer,
  useLiveComments,
  useLiveReactions,
  usePinComment,
  useChatModeration,
  reportLive,
  fetchLiveKitToken,
  useIsFollowingHost,
  useActiveLiveSessions,
  type LiveComment,
  type LiveReaction,
} from '@/lib/useLiveSession';
// v1.23 — Moderatoren-Befugnisse im Viewer: Mod kann aus dem Chat direkt
// Timeout/Pin/Delete auslösen. Der Schreibschutz liegt in der DB (SECURITY
// DEFINER RPCs prüfen Host ODER Mod), wir unlocken clientseitig nur die UI.
import { useLiveModerators } from '@/lib/useLiveModerators';
// v1.24 — Welcome-Toast beim Live-Join für Follower + Top-Fans
import { useLiveWelcome } from '@/lib/useLiveWelcome';
import { WelcomeToast } from '@/components/live/WelcomeToast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/authStore';
import { useFollow } from '@/lib/useFollow';
import { LiveUserSheet } from '@/components/live/LiveUserSheet';
import { LivePollStartSheet } from '@/components/live/LivePollStartSheet';
import ExpoGoPlaceholder from '@/components/live/ExpoGoPlaceholder';
import { GiftPicker } from '@/components/live/GiftPicker';
import { GiftAnimation } from '@/components/live/GiftAnimation';
import { useGiftStream, useTopGifters } from '@/lib/useGifts';
import { useLiveShopping } from '@/lib/useLiveShopping';
import { PinnedProductPill, ProductSoldBanner } from '@/components/live/LiveShoppingUI';
import { TopGifterBadge } from '@/components/live/TopGifterBadge';
// v1.22.2 — Viewer-Seite: gleiche TikTok-Style Top-Zuschauer*innen Sheet wie Host.
import ViewerListSheet from '@/components/ui/ViewerListSheet';
import { useLiveGoal } from '@/lib/useLiveGoal';
import { LiveGoalBar } from '@/components/live/LiveGoalBar';
import { useActiveLivePoll } from '@/lib/useLivePolls';
import { LivePollOverlay } from '@/components/live/LivePollOverlay';
import { useLiveOverlayPosition } from '@/lib/useLiveOverlayPosition';
import { useActiveStickers } from '@/lib/useLiveStickers';
import { LiveStickerLayer } from '@/components/live/LiveStickerLayer';
import { useActivePlacedProducts } from '@/lib/useLivePlacedProducts';
import { LivePlacedProductLayer } from '@/components/live/LivePlacedProductLayer';
import { useLiveShopMode, useHostShopProducts } from '@/lib/useLiveShopMode';
import { HostShopSheet } from '@/components/live/HostShopSheet';
import { useKeepAwake } from 'expo-keep-awake';
import { useCoHostViewer, useLiveCoHosts } from '@/lib/useCoHost';
import { useDuettInbox } from '@/lib/useDuett';
import { DuettInviteModal } from '@/components/live/DuettInviteModal';
import { PiPWindow } from '@/components/live/PiPWindow';
import { BattleBar } from '@/components/live/BattleBar';
import { useBattle } from '@/lib/useBattle';
import type { Participant } from 'livekit-client';
import { LiveReactionIcon, LIVE_REACTION_EMOJIS } from '@/components/live/LiveReactionIcon';
// expo-constants: default import causes _interopRequireDefault TypeError in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _cMod = require('expo-constants') as any; const Constants = _cMod?.default ?? _cMod;

// TikTok-Style Reactions — unsere eigenen SVG-Icons (keine Apple-Smileys!)
const EMOJIS = LIVE_REACTION_EMOJIS;
const { width: SCREEN_W } = Dimensions.get('window');

// Zahlen formatieren: 1200 → "1.2K"
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── TikTok-Style Floating Heart (Reaktion-Feed — kommt von rechts unten) ──────
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
      <LiveReactionIcon emoji="❤️" size={36} />
    </Animated.View>
  );
}

// ─── TAP-Position Herz — erscheint genau wo getippt wurde ────────────────────
interface TapHeart {
  id: number;
  x: number;
  y: number;
}

/**
 * TapHeartBurst — EIN Herz pro Tap am Finger-Punkt.
 *
 * Jede Instanz hat komplett eigene randomisierte Parameter (Drift, Sway, Dauer,
 * Rotation, Skalierung), damit mehrere schnell hintereinander getippte Herzen
 * unabhängig voneinander floaten und nicht synchron aussehen.
 */
function TapHeartBurst({ tapHeart, onDone }: { tapHeart: TapHeart; onDone: (id: number) => void }) {
  return (
    <TapHeartParticle
      x={tapHeart.x}
      y={tapHeart.y}
      onDone={() => onDone(tapHeart.id)}
    />
  );
}

function TapHeartParticle({
  x, y, onDone,
}: { x: number; y: number; onDone: () => void }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale     = useSharedValue(0);
  const opacity   = useSharedValue(0);
  const rotate    = useSharedValue((Math.random() - 0.5) * 0.6); // -30°..+30°

  // Randomisierte Animations-Parameter — damit jedes Herz unabhängig floatet.
  // Alle Werte EINMAL per useRef berechnen → stable über Re-Renders.
  const params = useRef({
    driftY:     180 + Math.random() * 140,         // 180–320px hoch
    driftX:     (Math.random() - 0.5) * 80,        // ±40px seitlich
    swayMag:    12 + Math.random() * 16,           // Schwingung ±12–28px
    swayPeriod: 600 + Math.random() * 500,         // 600–1100ms pro Schwing
    duration:   1100 + Math.random() * 500,        // 1.1–1.6s Lebensdauer
    peakScale:  1.1 + Math.random() * 0.3,         // 1.1–1.4 Pop
    rotateEnd:  (Math.random() - 0.5) * 1.0,       // ±0.5rad Drift-Rotation
  }).current;

  useEffect(() => {
    const doneTimer = setTimeout(onDone, params.duration + 200);

    // Aufpoppen + am Ende ausblenden
    scale.value   = withSequence(
      withSpring(params.peakScale, { damping: 5, stiffness: 260 }),
      withTiming(0.85, { duration: 200 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 80 }),
      withDelay(params.duration * 0.55, withTiming(0, { duration: params.duration * 0.45 })),
    );

    // Haupt-Bewegung nach oben + leichter X-Drift + kontinuierliche Rotation
    translateY.value = withTiming(-params.driftY, { duration: params.duration });
    rotate.value     = withTiming(params.rotateEnd, { duration: params.duration });

    // Seitliche Schwingung: loopt so lange das Herz sichtbar ist (ergibt Sinus-Path)
    translateX.value = withRepeat(
      withSequence(
        withTiming(params.driftX + params.swayMag, { duration: params.swayPeriod }),
        withTiming(params.driftX - params.swayMag, { duration: params.swayPeriod }),
      ),
      -1,
      true,
    );

    return () => clearTimeout(doneTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x - 18,
    top:  y - 18,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}rad` },
    ],
    opacity: opacity.value,
    zIndex: 200,
  }));

  return (
    <Animated.View style={style} pointerEvents="none">
      <LiveReactionIcon emoji="❤️" size={36} />
    </Animated.View>
  );
}

// ─── Floating Reaktions-Bubble ────────────────────────────────────────────────
// WARN 7 Fix: Hooks dürfen nicht nach bedingtem Return stehen.
// Deshalb zwei separate Komponenten: FloatingHeart + OtherReactionBubble.
function OtherReactionBubble({ reaction }: { reaction: LiveReaction }) {
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
      <LiveReactionIcon emoji={reaction.emoji} size={42} />
    </Animated.View>
  );
}

function ReactionBubble({ reaction }: { reaction: LiveReaction }) {
  if (reaction.emoji === '❤️') return <FloatingHeart reaction={reaction} />;
  return <OtherReactionBubble reaction={reaction} />;
}

// ─── Kommentar-Zeile ──────────────────────────────────────────────────
/**
 * CommentRow (watch/[id].tsx)
 *
 * Perf: `memo` + stabile Handler-Refs statt per-Item-Closures.
 * Parent übergibt `onUserSelect` + `onModerate` (beide via useCallback stabil).
 * Row baut seine onPress/onLongPress intern aus `comment` — dadurch sind
 * CommentRow-Props bei unveränderten Chat-Items referentiell gleich und
 * `memo` kann re-renders existierender Rows überspringen.
 */
function CommentRowComponent({
  comment,
  isHost,
  isModerator,
  isTopGifter,
  onUserSelect,
  onModerate,
}: {
  comment: LiveComment;
  /** v1.23: Username-Badges */
  isHost?: boolean;
  isModerator?: boolean;
  isTopGifter?: boolean;
  /** STABILE Handler (useCallback im Parent) */
  onUserSelect: (userId: string) => void;
  /** null → keine Moderations-Optionen (non-Mod-Kontext); stabil via useCallback */
  onModerate: ((comment: LiveComment) => void) | null;
}) {
  const isSystem = (comment as any).isSystem;
  const avatar = comment.profiles?.avatar_url;
  const username = comment.profiles?.username ?? 'User';
  const initials = username[0]?.toUpperCase() ?? '?';

  const handlePress = useCallback(() => {
    if (isSystem) return;
    onUserSelect(comment.user_id);
  }, [isSystem, onUserSelect, comment.user_id]);

  const handleLongPress = useCallback(() => {
    if (isSystem || !onModerate) return;
    onModerate(comment);
  }, [isSystem, onModerate, comment]);

  return (
    <Animated.View entering={FadeInDown.duration(200)} style={s.commentRow}>
      {isSystem ? (
        <Text style={s.systemText}>{comment.text}</Text>
      ) : (
        <Pressable
          onPress={handlePress}
          onLongPress={onModerate ? handleLongPress : undefined}
          delayLongPress={500}
          style={s.commentInner}
        >
          {/* Avatar — links, oben ausgerichtet */}
          {avatar ? (
            <Image source={{ uri: avatar }} style={s.commentAvatar} contentFit="cover" />
          ) : (
            <View style={[s.commentAvatar, s.commentAvatarFallback]}>
              <Text style={s.commentAvatarInitial}>{initials}</Text>
            </View>
          )}
          {/* Vertikal: Zeile 1 = Username + Badges, Zeile 2 = Text */}
          <View style={s.commentStack}>
            <View style={s.commentUserRow}>
              <Text style={s.commentUser} numberOfLines={1}>{username}</Text>
              {isHost ? (
                <View style={[s.commentBadge, s.commentBadgeHost]}>
                  <Text style={s.commentBadgeText}>HOST</Text>
                </View>
              ) : null}
              {isModerator ? (
                <View style={[s.commentBadge, s.commentBadgeMod]}>
                  <Text style={s.commentBadgeText}>🛡 MOD</Text>
                </View>
              ) : null}
              {isTopGifter ? (
                <View style={[s.commentBadge, s.commentBadgeGifter]}>
                  <Text style={s.commentBadgeText}>★ TOP</Text>
                </View>
              ) : null}
            </View>
            <Text style={s.commentText}>{comment.text}</Text>
          </View>
        </Pressable>
      )}
    </Animated.View>
  );
}

const CommentRow = memo(CommentRowComponent);


// ─── Remote Video (Host-Stream) ───────────────────────────────────────────────
// ⚠️ BUG FIX: hostId-Prop ergänzt damit bei Duet der richtige Track angezeigt wird.
// Ohne das würde useTracks() den Co-Host-Track als "Host-Video" zurückgeben.
function RemoteVideoView({ hostAvatar, hostId }: { hostAvatar?: string | null; hostId?: string | null }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  // Host-Track: nicht lokal UND wenn hostId bekannt, nur dieser Participant
  const remoteTrack = tracks.find((t) => {
    if (t.participant?.isLocal) return false;
    if (hostId && t.participant?.identity && t.participant.identity !== hostId) return false;
    return true;
  });
  // ⚠️ CRASH-FIX: withPlaceholder=true liefert TrackReferencePlaceholder-Objekte
  // OHNE .publication wenn der Host noch keinen Track published hat. <VideoTrack>
  // greift intern auf trackRef.publication.track zu → TypeError im RemoteVideoView.
  // Wir behandeln alles ohne publication wie "noch kein Track" → Avatar-Placeholder.
  const hasPublishedTrack =
    !!(remoteTrack as { publication?: { track?: unknown } } | undefined)?.publication?.track;

  // Echtzeit-Erkennung ob Host-Kamera gemuted ist (z.B. App-Wechsel)
  // ⚠️ BUG FIX: Nur Host-Participant prüfen — sonst zeigt Co-Host-Mute fals
  //    "Live pausiert"-Overlay.
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const room = useContext(RoomContext);

  useEffect(() => {
    if (!room) return;
    const onMuted = (pub: TrackPublication, participant: import('livekit-client').Participant) => {
      if (pub.source !== Track.Source.Camera) return;
      if (participant.isLocal) return;
      if (hostId && participant.identity !== hostId) return; // Nur Host
      setIsCameraMuted(true);
    };
    const onUnmuted = (pub: TrackPublication, participant: import('livekit-client').Participant) => {
      if (pub.source !== Track.Source.Camera) return;
      if (participant.isLocal) return;
      if (hostId && participant.identity !== hostId) return; // Nur Host
      setIsCameraMuted(false);
    };
    room.on(RoomEvent.TrackMuted, onMuted);
    room.on(RoomEvent.TrackUnmuted, onUnmuted);
    return () => {
      room.off(RoomEvent.TrackMuted, onMuted);
      room.off(RoomEvent.TrackUnmuted, onUnmuted);
    };
  }, [room, hostId]);

  if (!remoteTrack || !hasPublishedTrack) {
    // Noch kein Stream (oder nur Placeholder) → Avatar-Placeholder
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


// ─── Phase 3: Grid-Remote-Tile ────────────────────────────────────────
// Rendert einen einzelnen Remote-Participant (anderer Co-Host) in einer
// Grid-Kachel. Funktioniert viewer-side — der eigene Stream wird separat
// via LocalCoHostCameraView gerendert.
function GridRemoteTile({ userId, username }: { userId: string; username: string }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<{
    participant: Participant;
    publication: TrackPublication;
    source: Track.Source;
  } | null>(null);
  const [micMuted, setMicMuted] = useState(false);

  useEffect(() => {
    if (!room || !userId) return;
    const sync = () => {
      for (const [, p] of room.remoteParticipants) {
        if (p.identity === userId) {
          const pub = p.getTrackPublication(Track.Source.Camera);
          if (pub && pub.track) {
            setTrackRef({ participant: p, publication: pub, source: Track.Source.Camera });
          } else {
            setTrackRef(null);
          }
          const micPub = p.getTrackPublication(Track.Source.Microphone);
          setMicMuted(!micPub || micPub.isMuted || !micPub.track);
          return;
        }
      }
      setTrackRef(null);
      setMicMuted(true);
    };
    sync();
    const evs = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
    ] as const;
    evs.forEach((e) => room.on(e, sync));
    return () => { evs.forEach((e) => room.off(e, sync)); };
  }, [room, userId]);

  return (
    <>
      {trackRef ? (
        <VideoTrack
          trackRef={trackRef as any}
          style={StyleSheet.absoluteFill as any}
          objectFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d1a' }]}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>verbindet…</Text>
        </View>
      )}
      <View style={s.duetLabelBadge} pointerEvents="none">
        <Text style={s.duetLabelText} numberOfLines={1}>
          {micMuted ? '🔇 ' : ''}@{username}
        </Text>
      </View>
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
  isReplay = false,
}: {
  session: import('@/lib/useLiveSession').LiveSession | null | undefined;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onFollow: () => void;
  onBack: () => void;
  isReplay?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // Auto-navigate nach 5s — nicht im Replay-Modus (User ist freiwillig hier)
  useEffect(() => {
    if (isReplay) return;
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
            <View style={[s2.endedAvatar, { backgroundColor: '#CCCCCC', alignItems: 'center', justifyContent: 'center' }]}>
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
function WatchUI({
  sessionId,
  onRequestPublisherUpgrade,
}: {
  sessionId: string;
  // Wird aufgerufen, sobald coHostStatus === 'accepted'. Holt einen Token
  // mit canPublish=true und triggert internen LiveKit-Reconnect. Gibt true
  // zurück wenn der Upgrade geklappt hat, false sonst.
  onRequestPublisherUpgrade: () => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuthStore();

  // WOZ-Guard zuerst — MUSS vor allen anderen Hooks stehen (Rules of Hooks)
  const { canAccessWomenOnly } = useWomenOnly();

  // Bildschirm an lassen während des Live-Streams
  useKeepAwake();

  const { data: session } = useLiveSession(sessionId);
  useLiveViewer(sessionId);
  // Phase 6: Viewer muss Moderation-Einstellungen des Hosts kennen
  // (Word-Filter, Slow-Mode). Timeouts werden im Hook selbst via Broadcast
  // + initialer DB-Fetch empfangen, egal ob der Host diese Variablen setzt.
  const { comments, sendComment, sendSystemEvent, deleteComment, selfTimeoutUntil } = useLiveComments(
    sessionId,
    session?.moderation_enabled ?? false,
    session?.moderation_words ?? [],
    session?.slow_mode_seconds ?? 0,
  );
  const { reactions, sendReaction } = useLiveReactions(sessionId);
  const { goal, justReached } = useLiveGoal(sessionId);

  // ── Live-Polls (v1.18.0) ────────────────────────────────────────────────
  const { poll: activePoll, myVote: pollMyVote, vote: pollVote, isVoting: pollIsVoting } =
    useActiveLivePoll(sessionId);

  // ── Poll-Position Broadcast (v1.22.0) ────────────────────────────────────
  // Viewer empfängt die Position, die Host zuletzt gesetzt hat, und zieht das
  // Poll-Overlay animiert dorthin.
  const { position: pollRemotePosition } = useLiveOverlayPosition(sessionId, 'poll');

  // ── Live-Stickers (v1.22.0) — Read-Only für Viewer ───────────────────────
  const { stickers: activeStickers } = useActiveStickers(sessionId);

  // ── Live-Placed-Products (v1.22.0) — Read-Only für Viewer ────────────────
  const { products: placedProducts } = useActivePlacedProducts(sessionId);

  // ── Live-Shop-Mode (v1.22.x) — Katalog-Tüte ──────────────────────────────
  const { shopEnabled } = useLiveShopMode(sessionId);
  const { count: shopCount } = useHostShopProducts(
    shopEnabled ? (session?.host_id ?? null) : null,
  );
  const [shopSheetVisible, setShopSheetVisible] = useState(false);

  // ── Live-Clips (v1.18.0) — Viewer markiert einen Moment im Stream ──────
  const { clip: clipNow, isClipping } = useClipNow(sessionId, session?.started_at ?? null);
  const [clipToastVisible, setClipToastVisible] = useState(false);
  const clipToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (clipToastTimerRef.current) clearTimeout(clipToastTimerRef.current);
    };
  }, []);
  const handleClip = useCallback(async () => {
    if (!sessionId || isClipping) return;
    try {
      await clipNow();
      setClipToastVisible(true);
      if (clipToastTimerRef.current) clearTimeout(clipToastTimerRef.current);
      clipToastTimerRef.current = setTimeout(() => setClipToastVisible(false), 1800);
    } catch { /* Double-Klick in gleicher Sek wird stumm geschluckt */ }
  }, [sessionId, isClipping, clipNow]);
  const { topGifters } = useTopGifters(sessionId, 3);
  const { pinnedComment, pinComment } = usePinComment(sessionId);

  // v1.23 — Moderator-Status + Chat-Moderations-Aktionen für Viewer-Mods.
  // modIds enthält alle Session-Mods (inkl. uns selbst, falls zutreffend).
  // Der Hook sub'd auf postgres_changes — sobald der Host uns grant'd,
  // erscheint die UI ohne Refresh.
  const { modIds: sessionModIds } = useLiveModerators(sessionId);
  // v1.27.2 — Aktive CoHosts bekommen Chat-Mod-Rechte automatisch. Der
  // Realtime-Subscribe läuft hier früh damit useChatModeration den Gate
  // kennt, bevor die Comment-Liste rendert. DB-seitig greift ohnehin der
  // erweiterte `is_live_session_moderator`-Helper (Migration v1.27.2), der
  // aktive Cohosts als Mod behandelt — das hier gleicht nur das UI-Gate an.
  const { cohosts: earlyActiveCoHosts } = useLiveCoHosts(sessionId);
  const isActiveCoHostMe = !!profile?.id
    && earlyActiveCoHosts.some((c) => c.userId === profile.id);
  const isSessionModerator = (!!profile?.id && sessionModIds.has(profile.id))
    || isActiveCoHostMe;
  const { timeoutUser: modTimeoutUser } = useChatModeration(
    isSessionModerator ? sessionId : null,
  );
  // v1.24 — Welcome-Toast: Viewer meldet sich selbst an (announceSelf: true)
  // und sieht gleichzeitig andere Join-Events. RPC filtert serverseitig
  // auf Follower / Top-Fans — non-qualifizierende Viewer sind silent.
  const { welcomes } = useLiveWelcome(sessionId, { announceSelf: true });
  const { isFollowing, toggle: toggleFollow, isOwnProfile } =
    useFollow(session?.host_id ?? null);
  // BUG 4 Fix: Followers-Only-Chat Enforcement
  // useIsFollowingHost ist genauer als useFollow (prüft DB via RPC, hat Realtime)
  const isFollowingForChat = useIsFollowingHost(sessionId, session?.host_id ?? null);
  const flatRef = useRef<FlatList>(null);
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [liveEnded, setLiveEnded] = useState(false);
  const [userScrolling, setUserScrolling] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const tapHeartIdRef = useRef(0);
  const [tapHearts, setTapHearts] = useState<TapHeart[]>([]);
  const joinedRef = useRef(false);

  // ─── Women-Only Guard: ALLE Hooks sind oben deklariert → sicheres early return ──
  if (session && (session as any).women_only && !canAccessWomenOnly) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        <LinearGradient
          colors={['rgba(244,63,94,0.2)', 'rgba(168,85,247,0.1)', 'transparent']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}
        >
          <Text style={{ fontSize: 56, marginBottom: 20 }}>🔒</Text>
          <Text style={{ color: '#F43F5E', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>
            Women-Only Live
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 40 }}>
            Dieser Live-Stream ist nur für verifizierte Frauen zugänglich.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: 'rgba(244,63,94,0.15)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.4)', borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 }}
          >
            <Text style={{ color: '#F43F5E', fontSize: 15, fontWeight: '700' }}>Zurück</Text>
          </Pressable>
        </LinearGradient>
      </View>
    );
  }

  // ─── Keyboard tracking (RNAnimated, nicht Reanimated) ─────────────────────────
  const keyboardBottom = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      RNAnimated.timing(keyboardBottom, {
        toValue: e.endCoordinates.height,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      RNAnimated.timing(keyboardBottom, {
        toValue: 0,
        duration: e.duration ?? 200,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [keyboardBottom]);

  // ─── Share Sheet ───────────────────────────────────────────────────────────────
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  // v1.27.4 — Poll-Start-Sheet für aktive CoHosts (Host hat eigene UI in host.tsx)
  const [pollSheetVisible, setPollSheetVisible] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Schau dir @${host?.username ?? ''} live an auf Serlo! 🎥`,
        url: `https://serlo.social/live/${sessionId}`,
      });
    } catch (_) {}
  };

  // ─── Gift System ──────────────────────────────────────────────────────────────────────
  const [giftPickerVisible, setGiftPickerVisible] = useState(false);
  // v1.22.2 — Viewer tippt auf Zuschauer-Count → Top-Zuschauer*innen Sheet
  const [viewersVisible, setViewersVisible] = useState(false);
  const { gifts: incomingGifts, channelRef: giftChannelRef } = useGiftStream(sessionId);

  // ─── Live-Shopping ───────────────────────────────────────────────────────────────────────────────
  const { pinnedProduct: shopPinnedProduct, soldEvents, broadcastSold } = useLiveShopping(sessionId);

  // System-Event: beigetreten (einmalig nach Session-Load)
  useEffect(() => {
    if (!session || !profile || joinedRef.current) return;
    joinedRef.current = true;
    sendSystemEvent(`👋 @${profile.username} ist beigetreten`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, profile?.id]);

  // ─── Co-Host / Duet ─────────────────────────────────────────────────────────────
  const room = useContext(RoomContext);
  const roomName = session?.room_name ?? null;
  const {
    status: coHostStatus,
    layout: coHostLayout,
    battleDuration: coHostBattleDuration,
    forceMutedAudio,
    forceMutedVideo,
    kickInfo,
    requestJoin,
    leaveCoHost,
    markActive,
    dismissKickInfo,
    acceptFromInvite,
  } = useCoHostViewer(sessionId, roomName);

  // v1.19: Duett-Invite-Inbox (eingehende host-to-viewer Einladungen).
  // Wir schränken auf die aktuell-beobachtete Session ein, damit die Karte
  // session-relevant ist — weitere Invites anderer Sessions sind niedriger priorisiert.
  const duetInbox = useDuettInbox(sessionId);

  // Phase 3: Live-Liste aller aktuell aktiven Co-Hosts (max 8). Wird für
  // Grid-Layout gebraucht — jede Viewer-Instanz rendert dieselben Kacheln.
  // v1.27.2: Hook-Aufruf ist nach oben verschoben (siehe earlyActiveCoHosts),
  // hier nur noch Alias damit die Grid-Layout-Referenzen unverändert bleiben.
  const activeCoHosts = earlyActiveCoHosts;

  // Phase 1.3: Kick-Info vom Host → Alert mit Grund anzeigen (einmalig pro Kick)
  useEffect(() => {
    if (!kickInfo) return;
    Alert.alert(
      '🚫 Aus dem Duet entfernt',
      kickInfo.blocked
        ? `Der Host hat dich entfernt.\nGrund: ${kickInfo.reason}\n\nDu kannst in dieser Session nicht erneut beitreten.`
        : `Der Host hat dich entfernt.\nGrund: ${kickInfo.reason}`,
      [{ text: 'OK', onPress: dismissKickInfo }],
      { onDismiss: dismissKickInfo }
    );
  }, [kickInfo, dismissKickInfo]);

  // PiP-Swap: wenn true → Host-Video ist PiP, eigene Kamera ist Vollbild
  const [pipSwapped, setPipSwapped] = useState(false);

  // Wenn Co-Host akzeptiert: AudioSession umschalten + lokale Kamera + Mikrofon publishen
  // ⚠️ BUG 1 FIX: AudioSession muss VOR createLocalVideoTrack auf 'playAndRecord' 
  //    umgeschaltet werden. iOS blockiert Mikrofon wenn Session-Kategorie falsch.
  // ⚠️ BUG 6 FIX: publishTrack() funktioniert jetzt weil Token canPublish=true hat.
  useEffect(() => {
    if (coHostStatus === 'idle') {
      // pipSwapped zurücksetzen wenn Duet endet
      setPipSwapped(false);
      // ⚠️ BUG FIX: Tracks stoppen wenn Host das Duet beendet (co-host-ended Event)
      // Ohne das läuft die Kamera des Viewers unsichtbar weiter — Akkuverschwendung + Hardware-Block
      try {
        const localP = room?.localParticipant;
        if (localP) {
          for (const [, pub] of localP.trackPublications) {
            if (pub.track) {
              localP.unpublishTrack(pub.track).catch(() => {});
              pub.track.stop();
            }
          }
        }
      } catch { /* ignorieren */ }
    }
    if (coHostStatus !== 'accepted' || !room) return;
    let cancelled = false;
    (async () => {
      try {
        Sentry.addBreadcrumb({
          category: 'cohost',
          level: 'info',
          message: 'Co-Host accepted → starting publish flow',
          data: { sessionId, roomName: session?.room_name ?? null },
        });

        // ⚠️ CRITICAL FIX — Publisher-Upgrade funktionierte nicht, weil
        // livekit-client bei room.connect(url, newToken) auf einer bereits
        // verbundenen Session sofort mit "already connected to room" bailed
        // und den neuen Token IGNORIERT. Resultat: publishTrack() failt mit
        // "insufficient permissions" weil die Session canPublish=false behält.
        // Fix: Room EXPLIZIT disconnecten, damit der Reconnect mit neuem Token
        // eine frische Auth macht. Kurzer Video-Blip (~1-2s) ist akzeptabel.
        // @see https://github.com/livekit/client-sdk-js → Room.connect() skip logic
        Sentry.addBreadcrumb({
          category: 'cohost',
          level: 'info',
          message: 'Disconnecting room for clean token swap',
        });
        await new Promise<void>((resolve) => {
          if (cancelled) { resolve(); return; }
          const safetyTimeout = setTimeout(() => {
            room.off(RoomEvent.Disconnected, onDisc);
            resolve();
          }, 2000);
          const onDisc = () => {
            clearTimeout(safetyTimeout);
            room.off(RoomEvent.Disconnected, onDisc);
            resolve();
          };
          room.on(RoomEvent.Disconnected, onDisc);
          room.disconnect().catch(() => { /* disconnect-errors egal */ });
        });
        if (cancelled) return;

        // ⚠️ SECURITY FIX (Finding 3.4b):
        // ZUERST Publisher-Token nachladen. Erst danach hat die LiveKit-Session
        // canPublish=true — vorher würde der SFU publishTrack() ablehnen.
        // Durch den vorherigen Disconnect nutzt LiveKitRoom's useEffect nun
        // den neuen Token für eine frische Auth (statt "already connected").
        const upgraded = await onRequestPublisherUpgrade();
        if (cancelled) return;
        if (!upgraded) {
          __DEV__ && console.warn('[CoHost] Publisher-Upgrade fehlgeschlagen');
          Sentry.captureMessage('Co-Host publisher upgrade failed', {
            level: 'error',
            tags: { area: 'cohost', stage: 'upgrade' },
            extra: { sessionId, roomName: session?.room_name ?? null },
          });
          return;
        }
        Sentry.addBreadcrumb({
          category: 'cohost',
          level: 'info',
          message: 'Co-Host publisher upgrade OK',
        });

        // Warten bis der Reconnect abgeschlossen ist. LiveKitRoom wechselt
        // bei Token-Änderung intern auf 'connecting' → 'connected'. Wir hören
        // auf RoomEvent.SignalConnected (zeigt an: Auth mit neuem Token ok).
        await new Promise<void>((resolve) => {
          if (cancelled) { resolve(); return; }
          // Connection-State-Check: wenn Room bereits 'connected' und Room-Sid
          // frisch → direkt weiter. Sonst auf Event warten (max 5s Safety).
          const timeout = setTimeout(() => {
            room.off(RoomEvent.SignalConnected, onSig);
            room.off(RoomEvent.Reconnected,     onRec);
            resolve();
          }, 5000);
          const onSig = () => { clearTimeout(timeout); room.off(RoomEvent.SignalConnected, onSig); room.off(RoomEvent.Reconnected, onRec); resolve(); };
          const onRec = () => { clearTimeout(timeout); room.off(RoomEvent.SignalConnected, onSig); room.off(RoomEvent.Reconnected, onRec); resolve(); };
          room.on(RoomEvent.SignalConnected, onSig);
          room.on(RoomEvent.Reconnected,     onRec);
        });
        if (cancelled) return;

        // ⚠️ BUG 1 FIX: iOS AudioSession ZUERST auf playAndRecord setzen
        // Muss vor createLocalVideoTrack/createLocalAudioTrack passieren!
        // ⚠️ AUDIO-ROUTING FIX (1.14.10): 'defaultToSpeaker' ist KRITISCH.
        // Ohne diese Option routet iOS bei playAndRecord+videoChat auf die
        // Hörmuschel (earpiece) — Audio kommt dann extrem leise raus, der
        // Co-Host denkt es funktioniert nicht. 'mixWithOthers' entfernt, da
        // Live-Streams exklusive Audio-Kontrolle brauchen. A2DP für bessere
        // Bluetooth-Qualität (matching LiveKit RN iOS-Defaults).
        //
        // ⚠️ v1.22.1 FIX: startAudioSession() muss NACH setAppleAudioConfiguration
        // aber VOR createLocalAudioTrack aufgerufen werden. Der Mount-Once-Effect
        // hat die Session zwar initial gestartet, aber die Kategorie wurde jetzt
        // auf 'playAndRecord' gewechselt — iOS aktiviert die neue Kategorie erst
        // mit einem erneuten startAudioSession()-Call. Ohne diesen Call läuft
        // createLocalAudioTrack() in eine halb-aktive Session → Mic bleibt hardware-
        // seitig tot und der publishierte Audio-Track ist stumm.
        if (Platform.OS === 'ios') {
          await AudioSession.setAppleAudioConfiguration({
            audioCategory: 'playAndRecord',
            audioCategoryOptions: ['allowBluetooth', 'allowBluetoothA2DP', 'allowAirPlay', 'defaultToSpeaker'],
            audioMode: 'videoChat',
          }).catch(() => {});
          // Session mit neuer Kategorie re-aktivieren — sonst bleibt Mic still.
          await AudioSession.startAudioSession().catch(() => {});
          // Kurze iOS-Settle-Zeit bis AVAudioSession tatsächlich aktiv ist.
          await new Promise<void>((r) => setTimeout(r, 120));
          if (cancelled) return;
        }

        // Kamera-Track direkt erstellen und publishen
        Sentry.addBreadcrumb({ category: 'cohost', level: 'info', message: 'createLocalVideoTrack' });
        const videoTrack = await createLocalVideoTrack({
          facingMode: 'user',
          resolution: { width: 720, height: 1280, frameRate: 30 },
        });
        if (cancelled) { videoTrack.stop(); return; }
        Sentry.addBreadcrumb({ category: 'cohost', level: 'info', message: 'publishTrack video' });
        await room.localParticipant.publishTrack(videoTrack);

        // Audio-Track direkt erstellen und publishen
        Sentry.addBreadcrumb({ category: 'cohost', level: 'info', message: 'createLocalAudioTrack' });
        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
        });
        if (cancelled) { audioTrack.stop(); return; }
        Sentry.addBreadcrumb({ category: 'cohost', level: 'info', message: 'publishTrack audio' });
        await room.localParticipant.publishTrack(audioTrack);

        // ⚠️ BUG FIX (v1.15.3): Ohne diesen Sync-Call bleibt
        // `participant.isMicrophoneEnabled` auf false, obwohl der Audio-Track
        // publiziert ist. Das hat zwei Konsequenzen:
        //   1. LiveKit schaltet iOS AVAudioSession nicht in den Record-Modus
        //      → Mikrofon bleibt hardware-seitig deaktiviert.
        //   2. Remote-Listener (Host, andere Viewer) sehen die "muted"-Badge
        //      obwohl der Track existiert, weil der mute-flag nicht gesynct ist.
        // `setMicrophoneEnabled(true)` ist idempotent: der Track mit
        // source=Microphone ist bereits publiziert, also unmuted es ihn nur
        // und aktualisiert den Participant-State + AudioSession-Routing.
        await room.localParticipant.setMicrophoneEnabled(true).catch((e: unknown) => {
          __DEV__ && console.warn('[CoHost] setMicrophoneEnabled sync failed:', e);
        });

        markActive();
        sendSystemEvent('🎥 Duet aktiv!');
        Sentry.addBreadcrumb({
          category: 'cohost',
          level: 'info',
          message: 'Co-Host publish flow completed',
          data: { pubCount: room.localParticipant.trackPublications.size },
        });
      } catch (err) {
        __DEV__ && console.warn('[CoHost] Track-Publish fehlgeschlagen:', err);
        Sentry.captureException(err, {
          tags: { area: 'cohost', stage: 'publish-primary' },
          extra: {
            sessionId,
            message: (err as Error)?.message,
            name: (err as Error)?.name,
            pubCount: room.localParticipant?.trackPublications.size ?? 0,
          },
        });
        // Fallback: versuche setCameraEnabled (funktioniert wenn Token canPublish=true hat)
        try {
          Sentry.addBreadcrumb({ category: 'cohost', level: 'info', message: 'Fallback setCameraEnabled' });
          await room.localParticipant.setCameraEnabled(true);
          await room.localParticipant.setMicrophoneEnabled(true);
          markActive();
          sendSystemEvent('🎥 Duet aktiv!');
          Sentry.addBreadcrumb({
            category: 'cohost',
            level: 'info',
            message: 'Co-Host publish flow completed (fallback)',
            data: { pubCount: room.localParticipant.trackPublications.size },
          });
        } catch (err2) {
          __DEV__ && console.warn('[CoHost] Fallback fehlgeschlagen:', err2);
          Sentry.captureException(err2, {
            tags: { area: 'cohost', stage: 'publish-fallback' },
            extra: { sessionId, message: (err2 as Error)?.message },
          });
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coHostStatus]);

  // ── Viewer-Unmount Cleanup ─────────────────────────────────────────────────
  // Szenario 1: Viewer drückt X (router.back) während Duet aktiv
  // Szenario 2: App wird gekillt / Verbindung verloren
  // → Kamera+Mikro stoppen + co-host-left Broadcast senden
  // coHostStatusRef ist nötig weil der Cleanup-Closure keine State-Änderungen sieht
  const coHostStatusRef = useRef(coHostStatus);
  useEffect(() => { coHostStatusRef.current = coHostStatus; }, [coHostStatus]);

  useEffect(() => {
    return () => {
      // Unmount: wenn Duet aktiv war → sauber verlassen
      if (coHostStatusRef.current === 'active' || coHostStatusRef.current === 'accepted') {
        leaveCoHost(); // Broadcast co-host-left → Host resettet seinen State
        // Alle manuell gepublishten Tracks stoppen (auch via publishTrack() erstellte)
        try {
          const localP = room?.localParticipant;
          if (localP) {
            // Alle lokalen Track-Publications durchgehen und un-publishen
            for (const [, pub] of localP.trackPublications) {
              if (pub.track) {
                localP.unpublishTrack(pub.track).catch(() => {});
                pub.track.stop();
              }
            }
          }
        } catch {
          // ignorieren — Room könnte beim Unmount bereits getrennt sein
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Bewusst leer — nur einmal beim Unmount, liest Status via Ref

  // ── Phase 1.2: Host-enforced Mute ─────────────────────────────────────────
  // Wenn der Host den Co-Host mutet, toggelt der Co-Host seine eigenen Tracks
  // via `setMicrophoneEnabled`/`setCameraEnabled`. Der Host sendet den Wunsch
  // per Broadcast — wir reagieren client-seitig.
  useEffect(() => {
    if (!room) return;
    if (coHostStatus !== 'active' && coHostStatus !== 'accepted') return;
    if (forceMutedAudio === null && forceMutedVideo === null) return;
    (async () => {
      try {
        const localP = room.localParticipant;
        if (typeof forceMutedAudio === 'boolean') {
          await localP.setMicrophoneEnabled(!forceMutedAudio);
        }
        if (typeof forceMutedVideo === 'boolean') {
          await localP.setCameraEnabled(!forceMutedVideo);
        }
        Sentry.addBreadcrumb({
          category: 'cohost',
          level:    'info',
          message:  'Host-enforced mute applied',
          data:     { audio: forceMutedAudio, video: forceMutedVideo },
        });
      } catch (err) {
        __DEV__ && console.warn('[CoHost] Host-mute konnte nicht angewendet werden:', err);
      }
    })();
  }, [room, coHostStatus, forceMutedAudio, forceMutedVideo]);

  // Co-Host Track für lokale Kamera-Ansicht (stabil via Ref)
  const localCoHostTrackRef = useRef<{
    participant: Participant;
    publication: import('livekit-client').TrackPublication;
    source: import('livekit-client').Track.Source;
  } | null>(null);
  const [localCoHostTrackReady, setLocalCoHostTrackReady] = useState(false);

  // ⚠️ BUG 2 FIX: Listener wird jetzt bei 'accepted' (nicht erst 'active') registriert.
  // Das LocalTrackPublished-Event feuert während publishTrack() — also bevor
  // markActive() aufgerufen wird. Ohne diesen Fix geht das Event verloren.
  // ⚠️ BUG 7 FIX (Duet black screen): Initial-Sync hinzugefügt + Poll-Fallback.
  // Der Effect wird nach dem Token-Reconnect neu registriert, kann also ein
  // bereits publishiertes Track-Event verpassen. Initial-Sync prüft sofort,
  // ob die Kamera schon in den Publications ist. Poll-Fallback fängt den Fall
  // ab, in dem publishTrack() im publishTrack-Effect noch läuft während dieser
  // Effect schon gerendert hat (Race während Reconnect).
  useEffect(() => {
    if (!room || (coHostStatus !== 'accepted' && coHostStatus !== 'active')) return;

    const syncLocalCamera = () => {
      const localP = room.localParticipant;
      if (!localP) return false;
      const pub = localP.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        localCoHostTrackRef.current = { participant: localP as any, publication: pub, source: Track.Source.Camera };
        setLocalCoHostTrackReady(true);
        Sentry.addBreadcrumb({
          category: 'cohost',
          level: 'info',
          message: 'Co-Host local camera track synced',
          data: { source: pub.source, muted: pub.isMuted, trackSid: pub.trackSid },
        });
        return true;
      }
      return false;
    };

    // 1. Initial-Sync: Track evtl. schon publiziert
    if (syncLocalCamera()) {
      // schon da — kein Listener/Poll nötig für das erste Event
    }

    const onPublished = (pub: import('livekit-client').TrackPublication, participant: Participant) => {
      if (participant.isLocal && pub.source === Track.Source.Camera) {
        localCoHostTrackRef.current = { participant, publication: pub, source: Track.Source.Camera };
        setLocalCoHostTrackReady(true);
        Sentry.addBreadcrumb({
          category: 'cohost',
          level: 'info',
          message: 'Co-Host LocalTrackPublished fired',
          data: { source: pub.source, trackSid: pub.trackSid },
        });
      }
    };
    const onUnpublished = (pub: import('livekit-client').TrackPublication, _participant: Participant) => {
      if (_participant.isLocal && pub.source === Track.Source.Camera) {
        localCoHostTrackRef.current = null;
        setLocalCoHostTrackReady(false);
      }
    };
    room.on(RoomEvent.LocalTrackPublished, onPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);

    // 2. Poll-Fallback: max 10s lang alle 500ms checken bis Track da ist
    // Fängt Race-Conditions beim Reconnect ab, in denen Event-Listener fehlschlagen
    let polls = 0;
    const pollId = setInterval(() => {
      polls += 1;
      if (syncLocalCamera() || polls > 20) {
        clearInterval(pollId);
        if (polls > 20 && !localCoHostTrackRef.current) {
          Sentry.captureMessage('Co-Host camera never published after 10s', {
            level: 'error',
            tags: { area: 'cohost', stage: 'publish-timeout' },
            extra: {
              sessionId,
              coHostStatus,
              pubCount: room.localParticipant?.trackPublications.size ?? 0,
            },
          });
        }
      }
    }, 500);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, onPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onUnpublished);
      clearInterval(pollId);
    };
  }, [room, coHostStatus, sessionId]);

  // BUG FIX: localCoHostTrackReady als Dependency hinzugefügt damit die Komponente
  // neu erstellt wird wenn der Track verfügbar wird. Ohne das bleibt die
  // Komponente bei der stale closure (kein Track) und zeigt dauerhaft #111.
  const LocalCoHostCameraView = useCallback(() =>
    localCoHostTrackRef.current ? (
      <VideoTrack
        trackRef={localCoHostTrackRef.current as any}
        style={StyleSheet.absoluteFill as any}
        objectFit="cover"
        mirror
      />
    ) : (
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#111' }} />
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [localCoHostTrackReady]); // Track-Ready als Dep → Remount wenn Track verfügbar

  // ⚠️ BUG FIX: isDuetActive gilt auch für 'accepted' — damit CoHostSplitView
  // sofort angezeigt wird während die Kamera hochfährt (nicht erst nach markActive).
  const isDuetActive = coHostStatus === 'active' || coHostStatus === 'accepted';
  const isPip = isDuetActive && coHostLayout === 'pip';
  const isBattle = coHostStatus === 'active' && coHostLayout === 'battle'; // Battle erst wenn wirklich aktiv

  // Phase 3: Multi-Guest Grid-Mode Detection.
  // Grid aktiviert sich unabhängig vom eigenen Co-Host-Status — sobald der
  // Host ein grid-Layout gewählt hat UND mindestens ein Co-Host angenommen wurde.
  const isGridMode = (coHostLayout === 'grid-2x2' || coHostLayout === 'grid-3x3') && activeCoHosts.length > 0;
  const gridCols   = coHostLayout === 'grid-3x3' ? 3 : 2;
  const gridTilePct = `${100 / gridCols}%`;

  // Eigener User — um die eigene Tile im Grid durch die lokale Kamera zu
  // ersetzen (statt als Remote zu rendern, was nicht funktioniert).
  const selfUserId = profile?.id ?? null;

  // Battle-Hook (Viewer akkumuliert Scores via Broadcast)
  // autoStart=false: Viewer wartet auf 'battle-started' Broadcast vom Host (Neu-1 Fix)
  // → verhindert doppelten Timer (autoStart + battle-started Listener)
  const { state: battleState, sendBattleGift } = useBattle(
    isBattle ? sessionId : null,
    coHostBattleDuration,
    false,
  );




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

  // iOS/Android Audio-Session für Viewer konfigurieren
  //
  // ⚠️ v1.22.1 CRITICAL FIX — Race Condition beim Co-Host Audio:
  // Vorher hatte dieser Effect [coHostStatus] als Dep + Cleanup mit
  // `stopAudioSession()`. Beim Statuswechsel requested → accepted → active
  // feuerte das Cleanup MITTEN in der Accept-Publish-Kette (Zeile 862+)
  // und deaktivierte die AVAudioSession während createLocalAudioTrack()
  // gerade das Mic griff. Resultat: Co-Host's Audio-Track wurde publishiert,
  // aber in einer deaktivierten Session → leerer Stream → Viewer hörten nichts.
  //
  // Fix: Splitten in (a) Mount-Once Init + Unmount-Stop und (b) config-only
  // Re-Apply bei coHostStatus-Änderungen. Kein stopAudioSession() mehr im
  // Statuswechsel-Cleanup.
  //
  // (a) Mount-Once: Session initialisieren, beim Unmount stoppen.
  useEffect(() => {
    // ⚠️ Unhandled-Rejection-Fix: configureAudio() kann auf iOS rejecten wenn
    // eine alte Session noch hängt. Ohne .catch() wurde das als Hermes-Global-Error
    // an ErrorBoundary durchgereicht → Viewer sah nur Crash-Screen.
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
    }).catch(() => {});
    AudioSession.startAudioSession().catch(() => {});
    return () => {
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  // (b) Config-Re-Apply bei coHostStatus-Änderung — KEIN Cleanup hier.
  // Wechselt nur die Apple-Audio-Kategorie (playback ↔ playAndRecord), ohne
  // die Session zu stoppen/starten. Das verhindert die frühere Race.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const isCoHostActive = coHostStatus === 'active' || coHostStatus === 'accepted';
    AudioSession.setAppleAudioConfiguration({
      // Co-Host braucht 'playAndRecord' — Viewer nur 'playback'
      audioCategory: isCoHostActive ? 'playAndRecord' : 'playback',
      // ⚠️ AUDIO-ROUTING FIX (1.14.10): 'defaultToSpeaker' verhindert earpiece-Routing
      // bei playAndRecord+videoChat. Ohne diese Option hörte der Co-Host den Host
      // nur über die leise Hörmuschel.
      audioCategoryOptions: isCoHostActive
        ? ['allowBluetooth', 'allowBluetoothA2DP', 'allowAirPlay', 'defaultToSpeaker']
        : ['allowBluetooth', 'allowBluetoothA2DP', 'allowAirPlay'],
      audioMode: isCoHostActive ? 'videoChat' : 'spokenAudio',
    }).catch(() => {});
  }, [coHostStatus]);

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

  // Enforcement: Host-Einstellungen aus Session lesen (default true falls Session noch lädt)
  const commentsAllowed = session?.allow_comments !== false;
  const giftsAllowed    = session?.allow_gifts !== false;

  const submit = async () => {
    if (!input.trim()) return;
    if (!commentsAllowed) return; // doppelte Absicherung (UI ist bereits gesperrt)
    // BUG 4 Fix: Followers-Only-Chat enforzen
    if (session?.followers_only_chat && !isOwnProfile && isFollowingForChat === false) {
      Alert.alert(
        'Nur Follower',
        'Du musst diesem Host folgen um im Chat schreiben zu können.',
        [{ text: 'OK' }]
      );
      return;
    }
    // Phase 6: sendComment liefert ggf. { blocked, reason } zurück
    // (Slow-Mode aktiv / User ist gemutet). Input in dem Fall NICHT leeren,
    // damit der User seine Message nicht verliert.
    const result = await sendComment(input.trim());
    if (result && result.blocked) {
      Alert.alert('Moment ...', result.reason, [{ text: 'OK' }]);
      return;
    }
    setInput('');
    Keyboard.dismiss();
  };

  // ─── Live-Feed Swipe Navigation ──────────────────────────────────────
  const { data: allSessions = [] } = useActiveLiveSessions();
  const currentIndex = allSessions.findIndex((s) => s.id === sessionId);
  const hasNext = currentIndex >= 0 && currentIndex < allSessions.length - 1;
  const hasPrev = currentIndex > 0;

  // Swipe-Indicator Animations
  const swipeIndicatorY = useRef(new RNAnimated.Value(60)).current;
  const swipeIndicatorOpacity = useRef(new RNAnimated.Value(0)).current;
  const [swipeDir, setSwipeDir] = useState<'up' | 'down' | null>(null);

  const showSwipeIndicator = (dir: 'up' | 'down') => {
    setSwipeDir(dir);
    swipeIndicatorY.setValue(dir === 'up' ? 60 : -60);
    swipeIndicatorOpacity.setValue(0);
    RNAnimated.parallel([
      RNAnimated.timing(swipeIndicatorY, { toValue: 0, duration: 180, useNativeDriver: true }),
      RNAnimated.timing(swipeIndicatorOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const hideSwipeIndicator = () => {
    RNAnimated.parallel([
      RNAnimated.timing(swipeIndicatorOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSwipeDir(null));
  };

  const navigateToSession = (targetId: string) => {
    router.replace({ pathname: '/live/watch/[id]', params: { id: targetId } } as any);
  };

  const SWIPE_THRESHOLD = 80; // px bis Swipe gilt
  const swipeLockRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      // Nur vertikale Bewegungen abfangen; horizontale ignorieren (für ScrollViews)
      onMoveShouldSetPanResponder: (_, gs) =>
        !swipeLockRef.current &&
        Math.abs(gs.dy) > 12 &&
        Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderMove: (_, gs) => {
        // Indicator während Swipe anzeigen
        if (gs.dy < -30 && hasNext) showSwipeIndicator('up');
        else if (gs.dy > 30 && (hasPrev || true)) showSwipeIndicator('down');
        else hideSwipeIndicator();
      },
      onPanResponderRelease: (_, gs) => {
        hideSwipeIndicator();
        if (swipeLockRef.current) return;
        if (gs.dy < -SWIPE_THRESHOLD && hasNext) {
          // Swipe hoch → nächster Live
          swipeLockRef.current = true;
          navigateToSession(allSessions[currentIndex + 1].id);
        } else if (gs.dy > SWIPE_THRESHOLD) {
          if (hasPrev) {
            // Swipe runter → vorheriger Live
            swipeLockRef.current = true;
            navigateToSession(allSessions[currentIndex - 1].id);
          } else {
            // Erster Live → zurück
            router.back();
          }
        }
      },
      onPanResponderTerminate: () => hideSwipeIndicator(),
    })
  ).current;

  const handleScreenTap = (x: number, y: number) => {
    tapHeartIdRef.current++;
    const newHeart: TapHeart = { id: tapHeartIdRef.current, x, y };
    setTapHearts((prev) => [...prev, newHeart]);
    // Broadcast an andere Zuschauer, aber KEIN lokaler FloatingHeart —
    // der Sender sieht nur sein TapHeart am Finger-Punkt. Sonst erscheinen
    // Herzen gleichzeitig am Tap UND unten-rechts (unschön).
    sendReaction('\u2764\uFE0F', { skipLocal: true });
  };

  const host = session?.profiles;

  // ⚠️ BUG FIX: Stabile Referenz für RemoteVideoView in PiP (kein Inline-Arrow → kein Remount)
  const HostRemoteVideoAsPiP = useCallback(
    () => <RemoteVideoView hostAvatar={host?.avatar_url} hostId={session?.host_id} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [host?.avatar_url, session?.host_id]
  );

  // ── Chat-Row Handler: stabile Refs für memoized CommentRow ─────────────
  // useCallback → Referenz-Identität bleibt über Renders erhalten → React.memo
  // an CommentRow greift, damit nur die geänderte Row neu rendert.
  const topGifterIdSet = useMemo(
    () => new Set(topGifters.slice(0, 3).map((g) => g.userId)),
    [topGifters],
  );
  const hostUserIdForChat = session?.host_id ?? null;
  const handleUserSelect = useCallback((uid: string) => {
    setSelectedUserId(uid);
  }, []);
  const canModerate = isSessionModerator;
  const handleModerate = useCallback((item: LiveComment) => {
    if (item.user_id === session?.host_id) return; // niemals Host
    const username = item.profiles?.username ?? 'User';
    const userId = item.user_id;
    const openTimeoutMenu = () => {
      Alert.alert(
        `⏳ @${username} stumm schalten`,
        'Dauer auswählen:',
        [
          {
            text: '1 min',
            onPress: async () => {
              const ok = await modTimeoutUser(userId, 60, 'Mod-Timeout 1min');
              if (ok) sendSystemEvent(`⏳ @${username} für 1 Minute gemutet.`);
            },
          },
          {
            text: '5 min',
            onPress: async () => {
              const ok = await modTimeoutUser(userId, 5 * 60, 'Mod-Timeout 5min');
              if (ok) sendSystemEvent(`⏳ @${username} für 5 Minuten gemutet.`);
            },
          },
          {
            text: '30 min',
            onPress: async () => {
              const ok = await modTimeoutUser(userId, 30 * 60, 'Mod-Timeout 30min');
              if (ok) sendSystemEvent(`⏳ @${username} für 30 Minuten gemutet.`);
            },
          },
          { text: 'Zurück', style: 'cancel' },
        ],
      );
    };
    Alert.alert(
      'Moderation',
      `Von @${username}: "${item.text.slice(0, 60)}"`,
      [
        { text: '📌 Anpinnen', onPress: () => pinComment(item) },
        { text: '⏳ User stumm schalten', onPress: openTimeoutMenu },
        {
          text: '🚫 Löschen',
          style: 'destructive',
          onPress: () => deleteComment(item.id),
        },
        { text: 'Abbrechen', style: 'cancel' },
      ],
    );
  }, [modTimeoutUser, sendSystemEvent, pinComment, deleteComment, session?.host_id]);

  const renderChatItem = useCallback(
    ({ item }: { item: LiveComment }) => (
      <CommentRow
        comment={item}
        /* v1.23 Badges: Host-Author, Session-Mod, oder Top-3-Gifter */
        isHost={!!hostUserIdForChat && item.user_id === hostUserIdForChat}
        isModerator={sessionModIds.has(item.user_id)}
        isTopGifter={topGifterIdSet.has(item.user_id)}
        onUserSelect={handleUserSelect}
        /* v1.23: Mods bekommen Moderations-Menü; reguläre Viewer nicht. */
        onModerate={canModerate ? handleModerate : null}
      />
    ),
    [hostUserIdForChat, sessionModIds, topGifterIdSet, canModerate, handleUserSelect, handleModerate],
  );

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
      {/* ── Duet-Layouts (Fix #4: stabile Tree-Positionen) ──────────────
          WICHTIG: <RemoteVideoView/> (Host-Stream) ist IMMER an der gleichen
          Tree-Position. Nur der Container-Style wechselt zwischen Vollbild
          und Split-Hälfte. Dadurch behält der native iOS VideoTrack seinen
          Texture-Attach beim Duet-Start. Früher wurde zwischen <RemoteVideoView/>
          direkt und <CoHostSplitView topTrackRef={null}/> + separatem Overlay
          getauscht → Full-Remount → Black-Screen.
          Ausnahme: PiP-Swap-Modus unavoidable remounts die Host-Stream
          (user-triggered swap, akzeptierter Tradeoff). */}

      {/* Host Remote Video — stabile Tree-Position.
          Positionen:
          - Solo / PiP:       Vollbild
          - Grid-Mode:        erste Tile (Top-Left, 50%×50% bzw 33%×33%)
          - Side / Battle:    linke Hälfte
          - Top-Bottom:       obere Hälfte */}
      {!(isPip && pipSwapped) && (
        <View
          style={
            !isDuetActive || isPip
              ? StyleSheet.absoluteFill
              : isGridMode
                ? { position: 'absolute', top: 0, left: 0, width: gridTilePct as any, height: gridTilePct as any, overflow: 'hidden', backgroundColor: '#0d0d1a' }
                : (coHostLayout === 'side-by-side' || coHostLayout === 'battle')
                  // TikTok-Style: Videos kompakt in oberer Hälfte (13%..55%), Rest frei für Chat/UI
                  // v1.22.0 (UX): vorher 10%..70% wirkte zu hoch/lang — TikTok Battle sitzt kürzer.
                  ? { position: 'absolute', top: '13%', height: '42%', left: 0, width: '50%', overflow: 'hidden', backgroundColor: '#0d0d1a' }
                  : { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', overflow: 'hidden', backgroundColor: '#0d0d1a' }
          }
        >
          <RemoteVideoView hostAvatar={host?.avatar_url} hostId={session?.host_id} />
          {isDuetActive && !isPip && !isGridMode && (
            <>
              <View style={s.duetLabelBadge} pointerEvents="none">
                <Text style={s.duetLabelText}>{isBattle ? '🔴 HOST' : 'HOST'}</Text>
              </View>
              <View
                style={
                  (coHostLayout === 'side-by-side' || coHostLayout === 'battle')
                    ? s.duetDividerVertical
                    : s.duetDividerHorizontal
                }
                pointerEvents="none"
              />
            </>
          )}
          {isGridMode && (
            <View style={s.duetLabelBadge} pointerEvents="none">
              <Text style={s.duetLabelText}>👑 HOST</Text>
            </View>
          )}
        </View>
      )}

      {/* PiP-Swap: lokale Kamera füllt Vollbild (Host-Stream wandert in PiP) */}
      {isPip && pipSwapped && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LocalCoHostCameraView />
        </View>
      )}

      {/* Eigene Kamera (Co-Host) — Positionen:
          - Solo Split:   untere/rechte Hälfte
          - Grid-Mode:    eigener slot_index (aus DB), lokale Kamera statt Remote */}
      {isDuetActive && !isPip && (() => {
        // Im Grid-Modus: meine Tile-Position aus activeCoHosts.slot_index ableiten.
        if (isGridMode && selfUserId) {
          const myEntry = activeCoHosts.find((c) => c.userId === selfUserId);
          // +1 weil Slot 0 = Host. myEntry.slotIndex ist 0..7 unter den Co-Hosts.
          const slotPos = myEntry ? (myEntry.slotIndex + 1) : null;
          if (slotPos === null) return null;
          const row = Math.floor(slotPos / gridCols);
          const col = slotPos % gridCols;
          return (
            <View
              style={{
                position: 'absolute',
                top:    `${(100 / gridCols) * row}%`,
                left:   `${(100 / gridCols) * col}%`,
                width:  gridTilePct as any,
                height: gridTilePct as any,
                overflow: 'hidden',
                backgroundColor: '#000',
                borderWidth: 0.5,
                borderColor: '#000',
              }}
            >
              <LocalCoHostCameraView />
              <View style={s.duetLabelBadge} pointerEvents="none">
                <Text style={s.duetLabelText}>DU</Text>
              </View>
            </View>
          );
        }
        return (
          <View
            style={
              (coHostLayout === 'side-by-side' || coHostLayout === 'battle')
                // TikTok-Style: Videos kompakt in oberer Hälfte (13%..55%), Rest frei für Chat/UI
                // v1.22.0 (UX): vorher 10%..70% wirkte zu hoch/lang — TikTok Battle sitzt kürzer.
                ? { position: 'absolute', top: '13%', height: '42%', right: 0, width: '50%', overflow: 'hidden', backgroundColor: '#000' }
                : { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', overflow: 'hidden', backgroundColor: '#000' }
            }
          >
            <LocalCoHostCameraView />
            <View style={s.duetLabelBadge} pointerEvents="none">
              <Text style={s.duetLabelText}>{isBattle ? '🔵 DU' : 'DU'}</Text>
            </View>
          </View>
        );
      })()}

      {/* Phase 3: Grid-Mode — Remote-Tiles für alle anderen Co-Hosts.
          Jeder Viewer rendert die fremden Guests als Remote-Participants
          (eigene Tile kommt aus dem Block oben).
          ⚠️ Tile-Position kommt aus `ch.slotIndex + 1`, NICHT aus dem Array-
          Index — sonst landen Co-Hosts bei Lücken im Slot-Index in den
          falschen Tiles. */}
      {isGridMode && activeCoHosts
        .filter((ch) => ch.userId !== selfUserId && ch.slotIndex + 1 < gridCols * gridCols)
        .map((ch) => {
        const slotPos = ch.slotIndex + 1; // +1 für Host-Slot
        const row = Math.floor(slotPos / gridCols);
        const col = slotPos % gridCols;
        return (
          <View
            key={ch.userId}
            style={{
              position: 'absolute',
              top:    `${(100 / gridCols) * row}%`,
              left:   `${(100 / gridCols) * col}%`,
              width:  gridTilePct as any,
              height: gridTilePct as any,
              overflow: 'hidden',
              backgroundColor: '#0d0d1a',
              borderWidth: 0.5,
              borderColor: '#000',
            }}
          >
            <GridRemoteTile userId={ch.userId} username={ch.username} />
          </View>
        );
      })}

      {/* BattleBar — Viewer sieht denselben Score-Balken wie Host */}
      {isBattle && <BattleBar state={battleState} />}

      {/* PiP: kleines Fenster für die jeweils andere Kamera */}
      {isPip && (
        pipSwapped ? (
          // Host-Video als PiP (wenn Viewer Swap gedrückt hat)
          // ⚠️ BUG FIX: kein Inline-Arrow als LocalView, wird durch stabile Komponente ersetzt
          <PiPWindow
            LocalView={HostRemoteVideoAsPiP}
            label="HOST"
            onSwap={() => setPipSwapped(false)}
          />
        ) : (
          // Eigene Kamera als PiP (default)
          <PiPWindow
            LocalView={LocalCoHostCameraView}
            label="DU"
            onSwap={() => setPipSwapped(true)}
            mirror
          />
        )
      )}

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

      {/* Gesamter Screen: Tap → Herz | Swipe ↑ nächster Live | Swipe ↓ vorheriger */}
      <View
        style={StyleSheet.absoluteFill}
        {...panResponder.panHandlers}
        onStartShouldSetResponder={() => false} // Taps nicht stehlen — Pressable darunter
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPressIn={(evt) => handleScreenTap(evt.nativeEvent.locationX, evt.nativeEvent.locationY)}
        />
      </View>

      {/* Swipe-Indicator */}
      {swipeDir !== null && (
        <RNAnimated.View
          style={[
            s.swipeIndicator,
            swipeDir === 'up'
              ? { bottom: 120 }
              : { top: 120 },
            { opacity: swipeIndicatorOpacity, transform: [{ translateY: swipeIndicatorY }] },
          ]}
          pointerEvents="none"
        >
          <Text style={s.swipeIndicatorText}>
            {swipeDir === 'up'
              ? (hasNext ? '⬆️ Nächster Live' : '⬆️ Kein weiterer Live')
              : (hasPrev ? '⬇️ Vorheriger Live' : '⬇️ Zurück')}
          </Text>
        </RNAnimated.View>
      )}

      {/* Floating Reaktionen (von anderen Usern) */}
      <View style={s.reactionsLayer} pointerEvents="none">
        {reactions.map((r) => <ReactionBubble key={r.id} reaction={r} />)}
      </View>

      {/* Tap-Herzen — erscheinen genau am Tipp-Punkt */}
      {tapHearts.map((th) => (
        <TapHeartBurst
          key={th.id}
          tapHeart={th}
          onDone={(id) => setTapHearts((prev) => prev.filter((h) => h.id !== id))}
        />
      ))}


      {/* ─── TopBar — v1.22.0 TikTok-Style Kompakt-Layout ─────────────── */}
      {/* Links: Avatar + (@name / ❤️ likes stacked) + Follow
          Rechts: Guest-Avatars + Viewer-Count + X */}
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>

        {/* ─ Host-Info Block (Avatar + Name + Likes) ─ */}
        <View style={s.hostInfoLeft}>
          <View style={s.avatarRing}>
            {host?.avatar_url ? (
              <Image source={{ uri: host.avatar_url }} style={s.hostAvatarLg} contentFit="cover" />
            ) : (
              <View style={[s.hostAvatarLg, s.hostAvatarLgFallback]}>
                <Text style={s.hostInitialLg}>{(host?.username ?? 'U')[0]?.toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={s.hostMeta}>
            <Text style={s.hostUsernameLg} numberOfLines={1}>
              @{host?.username ?? '...'}
            </Text>
            <View style={s.viewerPillSmall}>
              <Text style={s.viewerPillText}>❤️ {fmtNum(session?.like_count ?? 0)}</Text>
            </View>
          </View>
        </View>

        {/* ─ Follow-Pille direkt neben Name (TikTok-Style) ─ */}
        {!isOwnProfile && (
          <Pressable
            onPress={toggleFollow}
            style={[s.followBtnLg, isFollowing && s.followBtnLgActive]}
            hitSlop={6}
          >
            <Text style={[s.followBtnLgText, isFollowing && s.followBtnLgTextActive]}>
              {isFollowing ? 'Gefolgt' : 'Folgen'}
            </Text>
          </Pressable>
        )}

        {/* ─ Rechte Seite: Guest-Avatars + Viewer-Count + X ─ */}
        <View style={s.topBarRight}>
          {/* Guest-Avatar-Stack (überlappende Kreise) */}
          {activeCoHosts.length > 0 && (
            <View style={s.guestAvatarStack} pointerEvents="none">
              {activeCoHosts.slice(0, 3).map((ch, idx) => (
                <View
                  key={ch.userId}
                  style={[
                    s.guestAvatarMini,
                    idx > 0 && { marginLeft: -8 },
                  ]}
                >
                  {ch.avatarUrl ? (
                    <Image source={{ uri: ch.avatarUrl }} style={s.guestAvatarMiniImg} contentFit="cover" />
                  ) : (
                    <View style={[s.guestAvatarMiniImg, s.hostAvatarLgFallback]}>
                      <Text style={s.guestAvatarMiniInitial}>
                        {(ch.username ?? 'U')[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* v1.22.1 — Top-Gifter kompakt oben rechts (TikTok-Style) */}
          {topGifters.length > 0 && (
            <TopGifterBadge compact topGifters={topGifters} />
          )}

          {/* Viewer-Count (kompakt) — v1.22.2: tappbar, öffnet Top-Zuschauer Sheet */}
          <Pressable
            style={s.viewerBadge}
            onPress={() => setViewersVisible(true)}
            hitSlop={6}
          >
            <Users size={11} stroke="#fff" strokeWidth={2} />
            <Text style={s.viewerCount}>{fmtNum(session?.viewer_count ?? 0)}</Text>
          </Pressable>

          {/* Close X */}
          <Pressable onPress={() => router.back()} style={s.closeTopBtn} hitSlop={8}>
            <X size={18} stroke="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

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

      {/* v1.18.0 — Clip-Saved Toast */}
      {clipToastVisible && (
        <View pointerEvents="none" style={[s.clipToastWrap, { top: insets.top + 58 }]}>
          <View style={s.clipToastPill}>
            <Scissors size={14} color="#fff" strokeWidth={2.2} />
            <Text style={s.clipToastText}>Clip gespeichert</Text>
          </View>
        </View>
      )}

      {/* Kommentare */}
      {/* 🎯 LIVE Goal Bar — auch im Viewer sichtbar */}
      {goal && (
        <LiveGoalBar goal={goal} justReached={justReached} />
      )}
      {/* 📊 Live-Poll Overlay (v1.18.0)
          v1.22.0: Viewer folgt der Position, die Host per Broadcast sendet */}
      {activePoll && (
        <LivePollOverlay
          poll={activePoll}
          myVote={pollMyVote}
          onVote={pollVote}
          isVoting={pollIsVoting}
          remotePosition={pollRemotePosition}
        />
      )}

      {/* 😀 Live-Sticker Layer (v1.22.0) — Viewer sieht Host-Platzierungen */}
      <LiveStickerLayer
        sessionId={sessionId}
        stickers={activeStickers}
      />

      {/* 🏷 Live-Placed-Products Layer (v1.22.0) — Viewer sieht Produkt-Karten,
          tippt drauf → /shop/{productId} öffnet sich */}
      <LivePlacedProductLayer
        sessionId={sessionId}
        products={placedProducts}
      />

      {/* 🏆 Top Gifter Badge — v1.22.1: verschoben nach oben rechts in die
          TopBar (TikTok-parity). Alter bottom-left Block entfernt. */}

      {/* v1.16.0: +125 statt +55 — macht Platz für die neue horizontale
          Action-Row (Heart/Volume/Share/CoHost), die jetzt unten sitzt. */}
      <View style={[s.commentsArea, { bottom: insets.bottom + 125 }]}>
        <FlatList
          ref={flatRef}
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
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

      {/* v1.24 — Welcome-Toast: sitzt direkt über der Kommentar-Leiste. Zeigt
          Follower/Top-Fan Joins als Slide-In-Pill. pointerEvents=none damit
          die Chat-Row-Touches nicht geblockt werden. */}
      <WelcomeToast welcomes={welcomes} bottomOffset={insets.bottom + 125} />

      {/* Kommentar-Leiste — bottom folgt Tastatur via RNAnimated */}
      <RNAnimated.View style={[s.commentBar, { bottom: keyboardBottom, paddingBottom: keyboardBottom.interpolate({ inputRange: [0, 1], outputRange: [insets.bottom + 10, 10], extrapolate: 'clamp' }) }]}>
        {/* Shop-Tüte — nur sichtbar wenn Host Shop-Modus aktiviert hat */}
        {shopEnabled && (
          <Pressable
            onPress={() => setShopSheetVisible(true)}
            hitSlop={8}
            style={s.shopBagBtn}
            accessibilityLabel="Shop öffnen"
          >
            <ShoppingBag size={22} color="#fff" strokeWidth={2.2} />
            {shopCount > 0 && (
              <View style={s.shopBagBadge}>
                <Text style={s.shopBagBadgeText}>
                  {shopCount > 99 ? '99+' : shopCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}
        <View style={s.inputWrap}>
          <Pressable
            onPress={() => { Keyboard.dismiss(); setEmojiPickerVisible(true); }}
            hitSlop={6}
            style={s.smileBtn}
          >
            <Smile size={19} stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
          </Pressable>
          {(() => {
            // Phase 6: Placeholder dynamisch an Moderations-Status anpassen.
            // Reihenfolge: Deaktiviert > Timeout > Slow-Mode > Default
            const isTimedOut = !!selfTimeoutUntil && selfTimeoutUntil > Date.now();
            const timeoutRemainSec = isTimedOut
              ? Math.max(0, Math.ceil((selfTimeoutUntil! - Date.now()) / 1000))
              : 0;
            const canType = commentsAllowed && !isTimedOut;
            let placeholder = 'Kommentieren …';
            if (!commentsAllowed)      placeholder = '💬 Kommentare deaktiviert';
            else if (isTimedOut)       placeholder = `⏳ Gemutet — ${timeoutRemainSec}s`;
            else if ((session?.slow_mode_seconds ?? 0) > 0)
              placeholder = `⏱️ Slow-Mode (${session?.slow_mode_seconds}s) · Kommentieren …`;
            return (
              <TextInput
                style={[s.input, !canType && { opacity: 0.35 }]}
                placeholder={placeholder}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={input}
                onChangeText={canType ? setInput : undefined}
                onSubmitEditing={canType ? submit : undefined}
                editable={canType}
                returnKeyType="send"
                selectionColor="#FFFFFF"
                maxLength={300}
              />
            );
          })()}
        </View>
        {input.trim().length > 0 ? (
          <Pressable onPress={submit} hitSlop={8} style={s.sendBtn}>
            <Send size={20} stroke="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        ) : giftsAllowed ? (
          // Geschenk-Button (sichtbar wenn kein Text und Geschenke erlaubt)
          <Pressable
            hitSlop={8}
            style={s.giftBtn}
            onPress={() => setGiftPickerVisible(true)}
          >
            <Text style={s.giftBtnEmoji}>🎁</Text>
          </Pressable>
        ) : null}
      </RNAnimated.View>

      {/* ─── Rechte Aktions-Spalte ────────────────────────────────────── */}
      <View style={[s.rightActions, { bottom: insets.bottom + 70 }]} pointerEvents="box-none">
        {/* Herz */}
        <Pressable
          style={s.rightActionBtn}
          onPress={() => {
            tapHeartIdRef.current++;
            sendReaction('❤️');
          }}
        >
          <Heart size={30} color="#fff" fill="transparent" strokeWidth={1.8} />
          <Text style={s.rightActionCount}>{fmtNum(session?.like_count ?? 0)}</Text>
        </Pressable>
        {/* Lautstärke */}
        <Pressable style={s.rightActionBtn} onPress={() => setMuted((v) => !v)}>
          {muted
            ? <VolumeX size={26} color="rgba(255,255,255,0.55)" strokeWidth={1.8} />
            : <Volume2 size={26} color="rgba(255,255,255,0.85)" strokeWidth={1.8} />}
        </Pressable>
        {/* Teilen / Optionen */}
        <Pressable style={s.rightActionBtn} onPress={() => setShareSheetVisible(true)}>
          <Share2 size={26} color="rgba(255,255,255,0.85)" strokeWidth={1.8} />
        </Pressable>
        {/* 📎 Clip-Marker (v1.18.0) — markiert einen Moment für späteres Replay-Browsing */}
        <Pressable
          style={s.rightActionBtn}
          onPress={handleClip}
          disabled={isClipping}
          hitSlop={6}
        >
          <Scissors size={24} color="rgba(255,255,255,0.85)" strokeWidth={1.9} />
        </Pressable>
        {/* v1.27.4 — Poll-Start nur für aktive CoHosts. Haupthost hat eigene UI in host.tsx.
             activePoll wirkt als Accent (lila) + blockiert Doppelstart nicht clientseitig
             (useCreateLivePoll schließt vorher automatisch). */}
        {isActiveCoHostMe && (
          <Pressable
            style={s.rightActionBtn}
            onPress={() => setPollSheetVisible(true)}
            hitSlop={6}
          >
            <BarChart3
              size={24}
              color={activePoll ? '#a78bfa' : 'rgba(255,255,255,0.85)'}
              strokeWidth={1.9}
            />
          </Pressable>
        )}
        {/* Co-Host Beitreten — nur Zuschauer, verschiedene Status */}
        {!isOwnProfile && (
          <Pressable
            style={[
              s.coHostJoinBtn,
              coHostStatus === 'requesting' && { opacity: 0.7 },
              // ⚠️ BUG FIX: 'accepted' muss auch rot sein (Kamera fährt bereits hoch)
              (coHostStatus === 'active' || coHostStatus === 'accepted') && { backgroundColor: 'rgba(239,68,68,0.7)', borderColor: '#f87171' },
            ]}
            onPress={() => {
              if (coHostStatus === 'active' || coHostStatus === 'accepted') {
                // Duet verlassen + Tracks stoppen
                leaveCoHost();
                // ⚠️ BUG FIX: Tracks inline stoppen (nicht nur beim Unmount)
                try {
                  const localP = room?.localParticipant;
                  if (localP) {
                    for (const [, pub] of localP.trackPublications) {
                      if (pub.track) {
                        localP.unpublishTrack(pub.track).catch(() => {});
                        pub.track.stop();
                      }
                    }
                  }
                } catch { /* ignorieren */ }
                sendSystemEvent(`📹 @${profile?.username ?? 'User'} hat das Duet verlassen`);
              } else if (coHostStatus === 'idle') {
                requestJoin();
              }
              // 'requesting' → nichts tun (warten)
            }}
            disabled={coHostStatus === 'requesting'}
          >
            {coHostStatus === 'requesting' ? (
              <ActivityIndicator size={12} color="#fff" />
            ) : (
              <Video size={14} color="#fff" strokeWidth={2.2} />
            )}
            <Text style={s.coHostJoinText}>
              {/* ⚠️ BUG FIX: 'accepted' zeigt auch 'Duet ✕' statt 'Beitreten' */}
              {(coHostStatus === 'active' || coHostStatus === 'accepted') ? 'Duet ✕' :
               coHostStatus === 'requesting' ? 'Warten…' :
               coHostStatus === 'rejected' ? 'Abgelehnt' :
               'Beitreten'}
            </Text>
          </Pressable>
        )}
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
                  <LiveReactionIcon emoji={emoji} size={40} />
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Gift Animation Overlay ───────────────────────────────── */}
      {/* pillsBottomOffset = insets.bottom + 55 (inputBar) + 240 (commentsArea) */}
      {/* = Oberkante des Kommentar-Bereichs — Pills erscheinen genau darüber  */}
      <GiftAnimation
        gifts={incomingGifts}
        pillsBottomOffset={insets.bottom + 55 + 240}
      />

      {/* 🛍 Gepinntes Produkt — Viewer kann direkt kaufen.
          zIndex 5 (unter commentsArea=10) damit Kommentare nie vom Banner
          überdeckt werden. User-Request v1.26.2. */}
      {shopPinnedProduct && (
        <View style={{ position: 'absolute', bottom: insets.bottom + 55 + 248, left: 0, right: 0, zIndex: 5 }}>
          <PinnedProductPill
            product={shopPinnedProduct}
            viewerUsername={profile?.username ?? 'Viewer'}
            onBought={broadcastSold}
          />
        </View>
      )}

      {/* 🛍 Sold-Banner — wenn jemand während Live kauft.
          zIndex 8 (unter commentsArea=10) aus gleichem Grund wie oben. */}
      {soldEvents.length > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 55 + 290, zIndex: 8 }} pointerEvents="none">
          <ProductSoldBanner events={soldEvents} />
        </View>
      )}

      {/* ─── Gift Picker Modal ─────────────────────────────────────────── */}
      <GiftPicker
        visible={giftPickerVisible}
        onClose={() => setGiftPickerVisible(false)}
        recipientId={session?.host_id ?? ''}
        recipientName={session?.profiles?.username ?? ''}
        liveSessionId={sessionId}
        channelRef={giftChannelRef}
        // Battle-Modus: User wählt vor Senden welches Team die Coins bekommt.
        // Der Battle-Score-Balken bewegt sich dann tatsächlich in Echtzeit.
        battleMode={
          isBattle && activeCoHosts[0] && session?.host_id
            ? {
                hostId:     session.host_id,
                hostName:   session.profiles?.username ?? 'HOST',
                coHostId:   activeCoHosts[0].userId,
                coHostName: activeCoHosts[0].username,
                onBattleGift: sendBattleGift,
              }
            : undefined
        }
        // v1.27.1 — Regulärer Duet (nicht Battle): Viewer kann zwischen Host
        // und CoHost als Empfänger wählen. Kein Score-Split, reines Gifting.
        // Bedingung: CoHost ist aktiv im Frame UND kein Battle läuft
        // (mutually exclusive — battleMode hätte bereits den Dual-Picker).
        duetMode={
          !isBattle && activeCoHosts[0] && session?.host_id
            ? {
                hostId:     session.host_id,
                hostName:   session.profiles?.username ?? 'HOST',
                coHostId:   activeCoHosts[0].userId,
                coHostName: activeCoHosts[0].username,
              }
            : undefined
        }
      />

      {/* v1.22.2 — TikTok-Style Top-Zuschauer*innen Sheet (Viewer-Seite).
          Self-CTA "Geschenk senden" öffnet GiftPicker nach Close-Animation.
          v1.22.3 — hostId/hostName für Follower-Badge "❤️ {hostName}". */}
      <ViewerListSheet
        visible={viewersVisible}
        onClose={() => setViewersVisible(false)}
        sessionId={sessionId}
        onOpenGiftPicker={() => setGiftPickerVisible(true)}
        hostId={session?.host_id ?? null}
        hostName={session?.profiles?.username ?? null}
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

      {/* v1.22.x: Host-Shop-Katalog (TikTok-Style Tüte im Chat-Bar) */}
      <HostShopSheet
        visible={shopSheetVisible}
        onClose={() => setShopSheetVisible(false)}
        hostId={session?.host_id ?? null}
        hostUsername={host?.username ?? null}
      />

      {/* v1.27.4 — Poll-Start-Sheet für aktive CoHosts.
           Render-Gate via sessionId, Öffnen-Gate via isActiveCoHostMe-Pressable oben.
           RLS-Policies erlauben ab v1.27.4 sowohl Host als auch CoHost. */}
      {sessionId && isActiveCoHostMe && (
        <LivePollStartSheet
          visible={pollSheetVisible}
          onClose={() => setPollSheetVisible(false)}
          sessionId={sessionId}
        />
      )}

      {/* v1.19: Eingehende host-to-viewer Duett-Einladung */}
      <DuettInviteModal
        invite={duetInbox.topInvite}
        onAccept={duetInbox.acceptInvite}
        onDecline={duetInbox.declineInvite}
        onDismiss={() => { /* Auto-Dismiss via useDuettInbox */ }}
        isResponding={duetInbox.isResponding}
        onAccepted={({ invite, layout }) => {
          if (invite.direction === 'host-to-viewer') {
            // Viewer hat Host-Invite angenommen → in den Co-Host-Flow springen.
            // Der bestehende Effect (useEffect auf coHostStatus === 'accepted')
            // übernimmt AudioSession + Track-Publish.
            acceptFromInvite(layout, invite.battleDuration ?? undefined);
          }
        }}
      />

      {/* ─── Share / Optionen Sheet (weißes Fenster) ─────────────────── */}
      <Modal
        visible={shareSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareSheetVisible(false)}
      >
        <Pressable style={ss.backdrop} onPress={() => setShareSheetVisible(false)}>
          <Pressable style={[ss.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={ss.handle} />
            {/* Header */}
            <View style={ss.header}>
              <Search size={20} color="#1C1C1E" strokeWidth={2} />
              <Text style={ss.title}>Teilen</Text>
              <Pressable onPress={() => setShareSheetVisible(false)} hitSlop={12}>
                <X size={18} color="#1C1C1E" strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Freunde-Zeile (horizontal scroll) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={ss.friendsRow}
            >
              {['wa', 'ig', 'tg', 'sms', 'fb'].map((k) => (
                <Pressable key={k} style={ss.friendItem} onPress={handleShare}>
                  <View style={[ss.friendAvatar, { backgroundColor: '#E5E7EB' }]}>
                    <Text style={{ fontSize: 22 }}>
                      {k === 'wa' ? '💬' : k === 'ig' ? '📸' : k === 'tg' ? '✈️' : k === 'sms' ? '📱' : '👤'}
                    </Text>
                  </View>
                  <Text style={ss.friendName}>
                    {k === 'wa' ? 'WhatsApp' : k === 'ig' ? 'Instagram' : k === 'tg' ? 'Telegram' : k === 'sms' ? 'SMS' : 'Facebook'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Optionen-Grid */}
            <View style={ss.grid}>
              {[
                { id: 'link',    icon: '🔗', label: 'Link kopieren',       onPress: handleShare },
                { id: 'whats',   icon: '💬', label: 'WhatsApp',            onPress: handleShare },
                { id: 'igdm',    icon: '📸', label: 'Instagram Direct',    onPress: handleShare },
                { id: 'tg',      icon: '✈️', label: 'Telegram',            onPress: handleShare },
                { id: 'cohost',  icon: '🤝', label: 'Co-Host',             onPress: () => { setShareSheetVisible(false); } },
                { id: 'story',   icon: '◎',  label: 'Zu Story',            onPress: () => setShareSheetVisible(false) },
                { id: 'report',  icon: '🚩', label: 'Melden',              onPress: () => { setShareSheetVisible(false); setReportModalVisible(true); } },
                { id: 'feedback',icon: '💬', label: 'Feedback',            onPress: () => setShareSheetVisible(false) },
              ].map((opt) => (
                <Pressable key={opt.id} style={ss.gridItem} onPress={opt.onPress}>
                  <View style={ss.gridIcon}>
                    <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
                  </View>
                  <Text style={ss.gridLabel}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Screen (lädt LiveKit Token dann verbindet) ───────────────────────────────
export default function LiveWatchScreen() {
  const { id, isReplay } = useLocalSearchParams<{ id: string; isReplay?: string }>();
  const isReplayMode = isReplay === '1';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useLiveSession(id);

  // Hooks MÜSSEN vor allen bedingten Returns stehen (Rules of Hooks)
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  // Guard: verhindert dass onError mehrfach feuert
  const isHandlingError = useRef(false);

  // Wenn tokenError auftritt: sofort Session neu laden.
  // Falls Host das Live beendet hat → session.status wird 'ended' →
  // wir zeigen LiveEndedOverlay statt Fehlerschirm.
  useEffect(() => {
    if (!tokenError) return;
    // Sofort invalidieren (lässt Supabase Realtime die Daten pushen)
    queryClient.invalidateQueries({ queryKey: ['live-session', id] });
    // Zusätzlich nach 1.5s nochmals nachladen (Fallback falls Realtime langsam)
    const t = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['live-session', id] });
    }, 1500);
    return () => clearTimeout(t);
  }, [tokenError, id, queryClient]);




  useEffect(() => {
    if (isReplayMode) return; // Replay-Modus: kein LiveKit-Token nötig
    if (!session?.room_name) return;
    // ⚠️ SECURITY FIX (Finding 3.4b):
    // Initial als VIEWER holen (isCoHost=false). Der alte Code holte spekulativ
    // einen Publisher-Token — das war genau die Lücke, die wir gerade geschlossen
    // haben (Edge-Function verlangt jetzt Whitelist-Eintrag in live_cohosts).
    // Wenn der Host per `approve_cohost` den User freigibt, lädt WatchUI via
    // `requestPublisherUpgrade` einen frischen Token mit canPublish=true nach.
    __DEV__ && console.log('[LiveWatch] fetching viewer token for room', session.room_name);
    Sentry.addBreadcrumb({
      category: 'livewatch',
      level: 'info',
      message: 'Viewer token fetch started',
      data: { roomName: session.room_name, sessionId: id },
    });
    fetchLiveKitToken(session.room_name, false, false)
      .then((res) => {
        if (!res) {
          __DEV__ && console.log('[LiveWatch] token fetch returned null → tokenError=true');
          Sentry.captureMessage('Viewer token fetch returned null', {
            level: 'error',
            tags: { area: 'livewatch' },
            extra: { roomName: session?.room_name, sessionId: id },
          });
          setTokenError(true);
          return;
        }
        __DEV__ && console.log('[LiveWatch] token OK, setting lkToken/lkUrl');
        setLkToken(res.token);
        setLkUrl(res.url);
      })
      .catch((err) => {
        __DEV__ && console.log('[LiveWatch] Token fetch failed:', err?.message ?? String(err));
        Sentry.captureException(err, {
          tags: { area: 'livewatch', stage: 'token-fetch' },
          extra: { roomName: session?.room_name, sessionId: id },
        });
        setTokenError(true);
      });
  }, [session?.room_name, isReplayMode]);

  // ─── Publisher-Upgrade Callback ───────────────────────────────────────────
  // Wird von WatchUI aufgerufen, wenn `coHostStatus === 'accepted'` greift.
  // Holt einen frischen Token MIT canPublish=true — der dazugehörige
  // Whitelist-Eintrag wurde vorher durch den Host via `approve_cohost` gesetzt.
  // Die `<LiveKitRoom>`-Komponente reagiert auf Token-Änderung und reconnectet
  // den bestehenden Room intern — RoomContext bleibt stabil, WatchUI wird NICHT
  // remountet, coHostStatus bleibt erhalten.
  const requestPublisherUpgrade = useCallback(async (): Promise<boolean> => {
    if (!session?.room_name) return false;
    try {
      const res = await fetchLiveKitToken(session.room_name, false, true);
      if (!res) return false;
      setLkToken(res.token);
      setLkUrl(res.url);
      return true;
    } catch (err) {
      __DEV__ && console.error('[LiveWatch] Publisher-Upgrade failed:', err);
      return false;
    }
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
      if (!lkToken && !tokenError) {
        __DEV__ && console.log('[LiveWatch] 25s safety-timeout FIRED — no token yet');
        Sentry.captureMessage('Viewer 25s safety-timeout fired (no lkToken)', {
          level: 'warning',
          tags: { area: 'livewatch', stage: 'safety-timeout' },
          extra: { sessionId: id, roomName: session?.room_name ?? null, hasSession: !!session },
        });
        setTokenError(true);
      }
    }, 25_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lkToken]);


  // Expo Go Placeholder (nach den Hooks — Rules of Hooks einhalten!)
  if (Constants.appOwnership === 'expo') {
    return <ExpoGoPlaceholder onBack={() => router.replace('/(tabs)')} icon="📺" />;
  }

  // Replay-Modus: Session ist beendet aber hat replay_url → zeige LiveEndedOverlay mit Replay-Kontext
  if (isReplayMode && session) {
    return (
      <View style={s.root}>
        <LiveEndedOverlay
          session={session}
          isFollowing={false}
          isOwnProfile={false}
          onFollow={() => {}}
          onBack={() => router.replace('/live/replays' as any)}
          isReplay
        />
      </View>
    );
  }

  // tokenError: ZUERST prüfen ob Session beendet wurde
  if (tokenError && session?.status === 'ended') {
    return (
      <View style={s.root}>
        <LiveEndedOverlay
          session={session}
          isFollowing={false}
          isOwnProfile={false}
          onFollow={() => {}}
          onBack={() => router.replace('/(tabs)')}
        />
      </View>
    );
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
            isHandlingError.current = false; // BUG 5 Fix: Reset damit weitere Fehler erkannt werden
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
          style={[s.backBtnCenter, { backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 8 }]}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>🔄 Erneut versuchen</Text>
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
        <ActivityIndicator color="#FFFFFF" size="large" />
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
          // DIAG: Raw error dump (läuft IMMER, auch in Production)
          const msg = err?.message ?? '';
          const rawDump = {
            message: msg,
            name: (err as any)?.name ?? null,
            code: (err as any)?.code ?? null,
            reason: (err as any)?.reason ?? null,
          };
          __DEV__ && console.log('[LK ERROR RAW]', JSON.stringify(rawDump));
          Sentry.addBreadcrumb({
            category: 'livekit.room',
            level: 'error',
            message: 'LiveKitRoom.onError',
            data: rawDump,
          });

          // LiveKit feuert onError auch bei transienten Fehlern (ICE reconnect, kurze Netz-Unterbrechung).
          // Das SDK versucht automatisch neu zu verbinden — wir zeigen NUR den Fehlerscreen,
          // navigieren aber NICHT sofort weg. User kann "Erneut versuchen" drücken.
          // Bekannte harmlose Fehler filtern:
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
          __DEV__ && console.log('[LiveWatch] LiveKit FATAL error:', msg);
          // DIAG: Fatal error IMMER nach Sentry (auch ohne __DEV__)
          Sentry.captureException(err instanceof Error ? err : new Error(msg || 'LiveKit onError (unknown)'), {
            tags: { area: 'livewatch', stage: 'livekit-onerror' },
            extra: { ...rawDump, sessionId: id, roomName: session?.room_name ?? null, hasToken: !!lkToken, hasUrl: !!lkUrl },
          });
          // Session sofort neu laden — falls Host das Live beendet hat,
          // wird session.status zu 'ended' → LiveEndedOverlay erscheint statt Fehlerschirm
          queryClient.invalidateQueries({ queryKey: ['live-session', id] });
          setTokenError(true);
        }}
      >
        <WatchUI sessionId={id} onRequestPublisherUpgrade={requestPublisherUpgrade} />
      </LiveKitRoom>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // ── Duet / Co-Host Split-Screen (Fix #4) ──────────────────
  duetLabelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 2,
  },
  duetLabelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  duetDividerHorizontal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  duetDividerVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  videoPlaceholder: {
    position: 'absolute', top: '25%', left: 0, right: 0,
    alignItems: 'center', gap: 12, zIndex: 2,
  },
  hostAvatar: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: '#EF4444',
  },
  hostAvatarFallback: { backgroundColor: '#CCCCCC', alignItems: 'center', justifyContent: 'center' },
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

  swipeIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  swipeIndicatorText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    zIndex: 20,
  },
  // ── Header-Elemente — identisch mit Host ──
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // backgroundColor entfernt — wird durch LinearGradient-Wrapper gesetzt.
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    shadowColor: '#FF2E63',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
  liveLabel: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  titleTextHeader: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  viewerCount: { color: '#fff', fontSize: 13, fontWeight: '700' },
  endBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239,68,68,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followRowBelowHeader: {
    position: 'absolute',
    left: 14,
    zIndex: 20,
  },
  // ── Host Info Left ──
  hostInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  // v1.22.1 — TikTok-Parity: Avatar + Meta kompakter (42→32)
  avatarRing: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    padding: 1,
  },
  hostAvatarLg: {
    width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
  },
  hostAvatarLgFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  hostInitialLg: { color: '#fff', fontWeight: '800', fontSize: 13 },
  hostMeta: { gap: 1 },
  hostUsernameLg: {
    color: '#fff', fontWeight: '700', fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  viewerPillSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  viewerPillText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600',
  },
  followBtnLg: {
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  followBtnLgActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  followBtnLgText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  followBtnLgTextActive: { color: 'rgba(255,255,255,0.5)' },
  // ── TopBar Right ──
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  guestAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestAvatarMini: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.6)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  guestAvatarMiniImg: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
  },
  guestAvatarMiniInitial: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  liveBadgeNew: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  liveGreenDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22C55E' },
  liveLabelNew: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.8 },
  closeTopBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  endLiveBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: 'rgba(239,68,68,0.75)',
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  endLiveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  // ── Compat ──
  backBtnCenter: {
    paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
  },

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
    // v1.16.0: Rechte 80px Reservierung entfällt — rightActions sitzt jetzt
    // unten horizontal, nicht mehr rechts vertikal. Chat darf volle Breite nutzen.
    position: 'absolute', left: 0, right: 0,
    maxHeight: 240, paddingHorizontal: 14, zIndex: 10,
  },
  // v1.16.0 UI-Polish: von vertikalem Rechts-Rail → horizontal über dem Input.
  // TikTok/IG Live-Pattern: rechts bleibt frei für Grid-Tiles bei Multi-Guest.
  rightActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 22,
    zIndex: 20,
  },
  rightActionBtn: { alignItems: 'center', gap: 4 },
  rightActionCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Co-Host Join Button
  coHostJoinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  coHostJoinText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  commentRow: {
    marginBottom: 10,
    alignSelf: 'flex-start',
    maxWidth: '82%',
  },
  commentInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  commentAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: { color: '#fff', fontSize: 15, fontWeight: '800' },
  commentStack: {
    flexShrink: 1,
    flexDirection: 'column',
    gap: 1,
  },
  commentPill: {},
  commentTextWrap: {},
  commentUser: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  /* v1.23 — Chat-Row Badges (Host/Mod/Top-Gifter) */
  commentUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  commentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  commentBadgeHost:   { backgroundColor: 'rgba(244,63,94,0.9)' },
  commentBadgeMod:    { backgroundColor: 'rgba(59,130,246,0.9)' },
  commentBadgeGifter: { backgroundColor: 'rgba(250,204,21,0.9)' },
  commentBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  commentText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
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
  myAvatarFallback: { backgroundColor: '#CCCCCC', alignItems: 'center', justifyContent: 'center' },
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
  shopBagBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  shopBagBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  shopBagBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  followBtn: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  followBtnActive: { borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.2)' },
  followBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 17 },

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
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    zIndex: 20,
  },
  pinnedLabel: { color: '#FFFFFF', fontSize: 14 },
  pinnedUser: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  pinnedText: { color: '#fff', fontSize: 12 },

  // v1.18.0 Clip-Toast
  clipToastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  clipToastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(17,17,17,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  clipToastText: { color: '#fff', fontSize: 13, fontWeight: '600' },

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
    backgroundColor: '#FFFFFF',
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

// ── Share Sheet Styles (weißes Fenster) ──────────────────────────────────────
const ss = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    gap: 0,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  title: { color: '#1C1C1E', fontWeight: '700', fontSize: 17 },
  friendsRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  friendItem: { alignItems: 'center', gap: 6, width: 62 },
  friendAvatar: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  friendName: {
    color: '#374151', fontSize: 11, fontWeight: '500',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 7,
  },
  gridIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  gridLabel: {
    color: '#374151', fontSize: 11, fontWeight: '500',
    textAlign: 'center', lineHeight: 14,
  },
});


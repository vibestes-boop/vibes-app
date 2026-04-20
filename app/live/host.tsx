/**
 * live/host.tsx
 * Host-Ansicht während eines Live-Streams.
 * - LiveKit: echtes Video-Streaming (braucht Dev-Build: npx expo run:ios)
 * - Supabase Realtime: Kommentare & Reaktionen
 */
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  Keyboard,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  AppState,
  ActivityIndicator,
  ScrollView,
  Animated as RNAnimated,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  X,
  Users,
  Send,
  MicOff,
  Mic,
  CameraOff,
  Camera,
  Share2,
  RotateCcw,
  Gift,
  Shield,
  ShieldCheck,
  Plus,
  Target,
  Video,
  ShoppingBag,
  LayoutGrid,
  Inbox,
  Zap,
  Timer,
  BarChart3,
  Circle,
  Smile,
  Tag,
} from "lucide-react-native";
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
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
  FadeOutUp,
} from "react-native-reanimated";

import {
  AudioSession,
  useLocalParticipant,
  VideoTrack,
} from "@livekit/react-native";
import { supabase } from "@/lib/supabase";
import { RoomContext } from "@livekit/components-react";
import { Room, RoomEvent, Track, VideoPreset } from "livekit-client";

import type { TrackPublication, Participant } from "livekit-client";
import {
  useLiveSession,
  useLiveHost,
  useLiveComments,
  useChatModeration,
  useLiveReactions,
  usePinComment,
  type LiveComment,
  type LiveReaction,
} from "@/lib/useLiveSession";
import { useLiveGoal, setLiveGoal, incrementGoalProgress } from "@/lib/useLiveGoal";
import { LiveGoalBar } from "@/components/live/LiveGoalBar";
import { useActiveLivePoll, useCloseLivePoll } from "@/lib/useLivePolls";
import { LivePollOverlay } from "@/components/live/LivePollOverlay";
import { LivePollStartSheet } from "@/components/live/LivePollStartSheet";
import { useLiveOverlayPosition } from "@/lib/useLiveOverlayPosition";
import { useActiveStickers, useStickerActions } from "@/lib/useLiveStickers";
import { StickerPicker } from "@/components/live/StickerPicker";
import { LiveStickerLayer } from "@/components/live/LiveStickerLayer";
import {
  useActivePlacedProducts,
  usePlacedProductActions,
} from "@/lib/useLivePlacedProducts";
import { ProductPlaceSheet } from "@/components/live/ProductPlaceSheet";
import { LivePlacedProductLayer } from "@/components/live/LivePlacedProductLayer";
import { CreatorToolsSheet, type CreatorToolItem } from "@/components/live/CreatorToolsSheet";
import { useRecordingStatus, useToggleRecording } from "@/lib/useLiveRecording";
import LiveShareSheet from "@/components/ui/LiveShareSheet";
import ViewerListSheet from "@/components/ui/ViewerListSheet";
import { LiveUserSheet } from "@/components/live/LiveUserSheet";
import { DuettInviteModal } from "@/components/live/DuettInviteModal";
import { useDuettInbox } from "@/lib/useDuett";
import ExpoGoPlaceholder from "@/components/live/ExpoGoPlaceholder";
import { GiftPicker } from "@/components/live/GiftPicker";
import { GiftAnimation } from "@/components/live/GiftAnimation";
import { useGiftStream, useTopGifters } from "@/lib/useGifts";
import { TopGifterBadge } from "@/components/live/TopGifterBadge";
import { useFollowerShoutout, useFollowersOnlyChat } from "@/lib/useLiveSession";
import { useCoHostHost, useLiveCoHosts } from "@/lib/useCoHost";
import type { DuetLayout } from "@/lib/useCoHost";
import { PiPWindow } from "@/components/live/PiPWindow";
import { BattleBar } from "@/components/live/BattleBar";
import { useBattle } from "@/lib/useBattle";
import { useLiveShoppingHost } from "@/lib/useLiveShopping";
import { LiveShopHostPanel, ProductSoldBanner } from "@/components/live/LiveShoppingUI";
import { useLiveShopMode, useLiveShopModeActions } from "@/lib/useLiveShopMode";
import { LiveReactionIcon, LIVE_REACTION_EMOJIS } from "@/components/live/LiveReactionIcon";
import { CoHostRequestSheet } from "@/components/live/CoHostRequestSheet";
import { useLiveModerators } from "@/lib/useLiveModerators";
// v1.24 — Welcome-Toast beim Live-Join für Follower + Top-Fans
import { useLiveWelcome } from "@/lib/useLiveWelcome";
import { WelcomeToast } from "@/components/live/WelcomeToast";
// expo-constants: default import causes _interopRequireDefault TypeError in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _cMod = require("expo-constants") as any;
const Constants = _cMod?.default ?? _cMod;

// TikTok-Style Reactions — unsere eigenen SVG-Icons (keine Apple-Smileys!)
const EMOJIS = LIVE_REACTION_EMOJIS;

// Zahlen formatieren: 1200 → "1.2K"
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const { width: SCREEN_W } = Dimensions.get('window');

// ─── TikTok-Style Floating Heart (von anderen Zuschauern) ───────────────────
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
 * TapHeartBurst — EIN Herz pro Tap am Finger-Punkt. Jede Instanz hat
 * komplett eigene randomisierte Parameter → mehrere Herzen floaten unabhängig.
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
  const rotate    = useSharedValue((Math.random() - 0.5) * 0.6);

  // Randomisierte Params EINMAL je Partikel → jedes Herz animiert unabhängig
  const params = useRef({
    driftY:     180 + Math.random() * 140,
    driftX:     (Math.random() - 0.5) * 80,
    swayMag:    12 + Math.random() * 16,
    swayPeriod: 600 + Math.random() * 500,
    duration:   1100 + Math.random() * 500,
    peakScale:  1.1 + Math.random() * 0.3,
    rotateEnd:  (Math.random() - 0.5) * 1.0,
  }).current;

  useEffect(() => {
    const doneTimer = setTimeout(onDone, params.duration + 200);

    scale.value = withSequence(
      withSpring(params.peakScale, { damping: 5, stiffness: 260 }),
      withTiming(0.85, { duration: 200 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 80 }),
      withDelay(params.duration * 0.55, withTiming(0, { duration: params.duration * 0.45 })),
    );
    translateY.value = withTiming(-params.driftY, { duration: params.duration });
    rotate.value     = withTiming(params.rotateEnd, { duration: params.duration });
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
// Deshalb zwei separate Komponenten: FloatingHeart (oben) + OtherReactionBubble.
function OtherReactionBubble({ reaction }: { reaction: LiveReaction }) {
  const left = 20 + Math.random() * 80;
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withTiming(-220, { duration: 2800 });
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 2700 }),
    );
  }, [opacity, translateY]);

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

/**
 * CommentRow (host.tsx)
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
  /** null → keine Moderations-Optionen (Viewer-Kontext); stabil via useCallback */
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
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(150)}
      style={s.commentRow}
    >
      {isSystem ? (
        <Text style={s.systemText}>{comment.text}</Text>
      ) : (
        <Pressable
          onPress={handlePress}
          onLongPress={onModerate ? handleLongPress : undefined}
          delayLongPress={500}
          style={s.commentInner}
        >
          {/* Avatar — so hoch wie 2 Zeilen */}
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


// ─── Echtzeit Viewer Count (LiveKit-basiert) ──────────────────────────────────
function useViewerCount(sessionId: string) {
  const room = useContext(RoomContext);
  const [viewerCount, setViewerCount] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);

  useEffect(() => {
    if (!room) return;

    const update = () => {
      // WARN 1 Fix: Co-Hosts (Publisher mit Kamera) nicht als Zuschauer zählen
      // Ein echter Viewer publisht keine Kamera → hat kein Camera-TrackPublication
      let count = 0;
      for (const [, participant] of room.remoteParticipants) {
        const hasCameraTrack = participant.getTrackPublication(Track.Source.Camera);
        if (!hasCameraTrack) count++;
      }
      setViewerCount(count);
      setPeakViewers((prev) => Math.max(prev, count));
    };

    // Initial count
    update();

    room.on(RoomEvent.ParticipantConnected, update);
    room.on(RoomEvent.ParticipantDisconnected, update);
    return () => {
      room.off(RoomEvent.ParticipantConnected, update);
      room.off(RoomEvent.ParticipantDisconnected, update);
    };
  }, [room]);

  // Sync count back to DB every 5s + Heartbeat alle 60s damit Cleanup-Function weiß dass Session aktiv ist
  const lastSyncedRef = useRef<{ count: number; peak: number; lastHeartbeat: number }>({ count: -1, peak: -1, lastHeartbeat: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const needsHeartbeat = now - lastSyncedRef.current.lastHeartbeat > 60_000;
      // Kein Write wenn sich nichts geändert hat UND kein Heartbeat fällig → spart DB-Writes
      if (
        lastSyncedRef.current.count === viewerCount &&
        lastSyncedRef.current.peak  === peakViewers &&
        !needsHeartbeat
      ) return;
      lastSyncedRef.current = { count: viewerCount, peak: peakViewers, lastHeartbeat: needsHeartbeat ? now : lastSyncedRef.current.lastHeartbeat };
      supabase
        .from("live_sessions")
        .update({ viewer_count: viewerCount, peak_viewers: peakViewers, updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .then();
    }, 5000);
    return () => clearInterval(interval);
  }, [viewerCount, peakViewers, sessionId]);

  return { viewerCount, peakViewers };
}

// ─── LiveKit Host-Steuerung (Mikrofon / Kamera toggle) ────────────────────────
function HostControls({ onCameraSwitch }: { onCameraSwitch?: (isFront: boolean) => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch { /* ignore */ }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch { /* ignore */ }
  };

  const switchCamera = async () => {
    try {
      const devices = await Room.getLocalDevices("videoinput");
      if (devices.length < 2) return;
      const currentTrack = localParticipant.getTrackPublication(Track.Source.Camera);
      if (!currentTrack?.track) return;
      const currentDeviceId = currentTrack.track.mediaStreamTrack?.getSettings()?.deviceId;
      const nextDevice = devices.find((d) => d.deviceId !== currentDeviceId) ?? devices[0];
      await currentTrack.track.setDeviceId(nextDevice.deviceId);
      // Nach dem Wechsel: facingMode des neuen Tracks lesen
      // (kein neue LocalTrackPublished-Event bei setDeviceId)
      await new Promise<void>((r) => setTimeout(r, 150)); // kurz warten bis Track bereit
      const facingMode = currentTrack.track.mediaStreamTrack?.getSettings()?.facingMode;
      onCameraSwitch?.(!facingMode || facingMode === 'user');
    } catch { /* Fallback: einfach Camera neu starten */ }
  };

  return (
    <View style={s.controls}>
      <Pressable
        style={[s.controlBtn, !isMicrophoneEnabled && s.controlBtnOff]}
        onPress={toggleMic}
        hitSlop={8}
      >
        {isMicrophoneEnabled ? (
          <Mic size={18} stroke="#fff" strokeWidth={2} />
        ) : (
          <MicOff size={18} stroke="#EF4444" strokeWidth={2} />
        )}
      </Pressable>
      <Pressable
        style={[s.controlBtn, !isCameraEnabled && s.controlBtnOff]}
        onPress={toggleCamera}
        hitSlop={8}
      >
        {isCameraEnabled ? (
          <Camera size={18} stroke="#fff" strokeWidth={2} />
        ) : (
          <CameraOff size={18} stroke="#EF4444" strokeWidth={2} />
        )}
      </Pressable>
      <Pressable style={s.controlBtn} onPress={switchCamera} hitSlop={8}>
        <RotateCcw size={18} stroke="#fff" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

// ─── LocalCameraView ─────────────────────────────────────────────────
// Hört direkt auf RoomEvent - kein useTracks-Timing-Bug in React Native.
// mirror=true nur bei Frontkamera (facingMode="user"), nicht bei Rückkamera.
// isFrontCamera wird von HostUI kontrolliert (nach switchCamera-Callback).
// ⚠️ BUG 4 FIX: Initialsynchronisation beim Mount — falls Track bereits pubiziert
//    (z.B. wenn CoHostSplitView bei Duet-Start remountet).
function LocalCameraView({ isFrontCamera }: { isFrontCamera: boolean }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<{
    participant: Participant;
    publication: TrackPublication;
    source: Track.Source;
  } | null>(null);

  useEffect(() => {
    if (!room) return;

    // Initiale Sync: prüfe ob Track schon publiziert ist (verhindert schwarzes Bild beim Remount)
    const syncInitial = () => {
      const pub = room.localParticipant?.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        setTrackRef({ participant: room.localParticipant as any, publication: pub, source: Track.Source.Camera });
      }
    };
    syncInitial();

    const onPublished = (pub: TrackPublication, participant: Participant) => {
      if (pub.source === Track.Source.Camera) {
        setTrackRef({
          participant,
          publication: pub,
          source: Track.Source.Camera,
        });
      }
    };
    const onUnpublished = (pub: TrackPublication) => {
      if (pub.source === Track.Source.Camera) setTrackRef(null);
    };

    room.on(RoomEvent.LocalTrackPublished, onPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);
    return () => {
      room.off(RoomEvent.LocalTrackPublished, onPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onUnpublished);
    };
  }, [room]);

  if (!trackRef) return null;
  return (
    <VideoTrack
      trackRef={trackRef as any}
      style={StyleSheet.absoluteFill as any}
      objectFit="cover"
      mirror={isFrontCamera}
    />
  );
}


// ─── RemoteCoHostVideoView ────────────────────────────────────────────
// Hört auf Remote-Tracks des aktiven Co-Hosts (Participant Identity = userId)
function RemoteCoHostVideoView({ coHostUserId }: { coHostUserId: string }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<{
    participant: Participant;
    publication: TrackPublication;
    source: Track.Source;
  } | null>(null);

  useEffect(() => {
    if (!room || !coHostUserId) return;

    const syncTrack = () => {
      // Remote Participant mit Co-Host-UserId suchen
      for (const [, participant] of room.remoteParticipants) {
        if (participant.identity === coHostUserId) {
          const pub = participant.getTrackPublication(Track.Source.Camera);
          if (pub && pub.track) {
            setTrackRef({ participant, publication: pub, source: Track.Source.Camera });
            return;
          }
        }
      }
      setTrackRef(null);
    };

    syncTrack();
    room.on(RoomEvent.TrackSubscribed, syncTrack);
    room.on(RoomEvent.TrackUnsubscribed, syncTrack);
    room.on(RoomEvent.ParticipantConnected, syncTrack);
    room.on(RoomEvent.ParticipantDisconnected, syncTrack);
    return () => {
      room.off(RoomEvent.TrackSubscribed, syncTrack);
      room.off(RoomEvent.TrackUnsubscribed, syncTrack);
      room.off(RoomEvent.ParticipantConnected, syncTrack);
      room.off(RoomEvent.ParticipantDisconnected, syncTrack);
    };
  }, [room, coHostUserId]);

  if (!trackRef) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0d0d1a' }]} />;
  }
  return (
    <VideoTrack
      trackRef={trackRef as any}
      style={StyleSheet.absoluteFill as any}
      objectFit="cover"
    />
  );
}

// ─── Summary Stat Helper ──────────────────────────────────────────────────────
function SummaryStatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

// ─── Inner Host UI (innerhalb LiveKitRoom) ────────────────────────────────────
function HostUI({
  sessionId,
  title,
  onEnd,
}: {
  sessionId: string;
  title?: string;
  onEnd: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: session } = useLiveSession(sessionId);

  // Bildschirm an lassen während Live-Übertragung
  useKeepAwake();

  // ── Moderations-State ───────────────────────────────────────────────────────────
  const [moderationEnabled, setModerationEnabled] = useState(
    session?.moderation_enabled ?? false
  );
  const [hostWords, setHostWords] = useState<string[]>(
    session?.moderation_words ?? []
  );

  // ── Nur-Follower-Chat ────────────────────────────────────────────────────────────
  const [followersOnlyChat, setFollowersOnlyChat] = useState(
    session?.followers_only_chat ?? false
  );
  const { toggle: toggleFollowersOnly } = useFollowersOnlyChat(sessionId);

  const handleFollowersOnlyToggle = async () => {
    const next = !followersOnlyChat;
    setFollowersOnlyChat(next); // optimistisch
    await toggleFollowersOnly(next);
  };

  // Sync wenn Session geladen wird
  useEffect(() => {
    if (session) {
      setModerationEnabled(session.moderation_enabled);
      setHostWords(session.moderation_words ?? []);
      setFollowersOnlyChat(session.followers_only_chat ?? false);
    }
  }, [session?.moderation_enabled, session?.moderation_words, session?.followers_only_chat]);

  const { saveReplayUrl, updateModeration } = useLiveHost();

  /** Moderation an-/ausschalten und in DB speichern */
  const toggleModeration = async () => {
    const next = !moderationEnabled;
    setModerationEnabled(next);
    await updateModeration(sessionId, next, hostWords);
  };

  /** Host fügt eigene Wörter hinzu (Alert-Prompt) */
  const addHostWords = () => {
    Alert.prompt(
      'Eigene Wörter sperren',
      'Wörter kommagetrennt eingeben (z.B. Schimpfwort1, Schimpfwort2)',
      async (input) => {
        if (!input?.trim()) return;
        const newWords = input
          .split(',')
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean);
        const merged = [...new Set([...hostWords, ...newWords])];
        setHostWords(merged);
        await updateModeration(sessionId, moderationEnabled, merged);
      },
      'plain-text'
    );
  };

  // ─── Co-Host ────────────────────────────────────────────────────────────────
  const {
    pendingRequest,
    pendingRequests,
    queueDepth,
    activeCoHostId,
    activeLayout,
    activeBattleDuration,
    coHostMutedAudio,
    coHostMutedVideo,
    acceptCoHost,
    rejectCoHost,
    endCoHost,
    changeLayout,
    muteCoHost,
    kickCoHost,
    setPendingRequest,
  } = useCoHostHost(sessionId);

  // Phase 3: alle aktuell aktiven Co-Hosts (DB-gestützt, Realtime-synced).
  // Im Single-Guest-Modus gibt es max. 1 Eintrag; im Grid-Modus bis zu 8.
  const { cohosts: activeCoHosts } = useLiveCoHosts(sessionId);

  // v1.19: Duett-Invite-Inbox (eingehende viewer-to-host Anfragen).
  // Der Host sieht hier Realtime alle Invites, in denen ER der host_id ist.
  const duetInbox = useDuettInbox(sessionId);

  // Grid-Mode Detection + Dimensionen.
  const isGridMode = activeLayout === 'grid-2x2' || activeLayout === 'grid-3x3';
  const gridCols   = activeLayout === 'grid-3x3' ? 3 : 2;
  const gridTilePct = `${100 / gridCols}%`;

  // (StableLocalCameraView entfernt: war deklariert aber nie referenziert.
  // Die lokale Kamera wird direkt inline als <LocalCameraView/> gerendert.)

  // Stabile Referenz für RemoteCoHostVideoView in PiP
  // activeCoHostId als Dep — remount nur wenn sich Co-Host-ID ändert
  const StableRemoteCoHostView = useCallback(
    () => <RemoteCoHostVideoView coHostUserId={activeCoHostId ?? ''} />,
    [activeCoHostId]
  );

  // Phase 6: Slow-Mode aus Session-Daten lesen + live synced halten.
  // Wenn Host ihn ändert, kommt das via useLiveSession-Query-Invalidation zurück.
  const slowModeSeconds = session?.slow_mode_seconds ?? 0;
  const { comments, sendComment, sendSystemEvent, deleteComment } =
    useLiveComments(sessionId, moderationEnabled, hostWords, slowModeSeconds);
  const { timeoutUser, setSlowMode: rpcSetSlowMode } = useChatModeration(sessionId);

  // Phase 6: Slow-Mode Picker — Host wählt Cool-Down-Dauer.
  // Muss NACH useLiveComments (sendSystemEvent) + useChatModeration (rpcSetSlowMode)
  // deklariert werden, da wir diese im Callback referenzieren.
  const showSlowModeMenu = useCallback(() => {
    const apply = async (seconds: number, label: string) => {
      const ok = await rpcSetSlowMode(seconds);
      if (ok) {
        if (seconds === 0) {
          sendSystemEvent('⏱️ Slow-Mode deaktiviert.');
        } else {
          sendSystemEvent(`⏱️ Slow-Mode an: ${label} zwischen Messages.`);
        }
      } else {
        Alert.alert('Fehler', 'Slow-Mode konnte nicht gesetzt werden. Bitte erneut versuchen.');
      }
    };
    Alert.alert(
      '⏱️ Slow-Mode',
      slowModeSeconds > 0
        ? `Aktuell: ${slowModeSeconds}s zwischen Messages pro User.`
        : 'User müssen zwischen Messages warten.',
      [
        { text: 'Aus',   onPress: () => apply(0,  'Aus') },
        { text: '3 s',   onPress: () => apply(3,  '3 s') },
        { text: '10 s',  onPress: () => apply(10, '10 s') },
        { text: '30 s',  onPress: () => apply(30, '30 s') },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  }, [slowModeSeconds, rpcSetSlowMode, sendSystemEvent]);
  const { reactions, sendReaction } = useLiveReactions(sessionId);
  const { pinnedComment, pinComment } = usePinComment(sessionId);
  const { viewerCount, peakViewers } = useViewerCount(sessionId);

  // ── LIVE Goals ─────────────────────────────────────────────────────────────
  const { goal, justReached } = useLiveGoal(sessionId);

  // ── Live-Polls (v1.18.0) ───────────────────────────────────────────────────
  const { poll: activePoll, myVote: pollMyVote, vote: pollVote, isVoting: pollIsVoting } =
    useActiveLivePoll(sessionId);
  const { closePoll: pollClose } = useCloseLivePoll();
  const [pollSheetVisible, setPollSheetVisible] = useState(false);

  // ── Poll-Position Broadcast (v1.22.0) ──────────────────────────────────────
  // Host zieht Poll-Overlay per Finger → Position wird an Viewer gebroadcastet.
  const { broadcastPosition: broadcastPollPosition } =
    useLiveOverlayPosition(sessionId, 'poll');

  // ── Live-Stickers (v1.22.0) ────────────────────────────────────────────────
  // Emoji-Sticker frei platzierbar + verschiebbar + entfernbar via Long-Press.
  const { stickers: activeStickers } = useActiveStickers(sessionId);
  const { addSticker, moveSticker, removeSticker } = useStickerActions(sessionId);
  const [stickerPickerVisible, setStickerPickerVisible] = useState(false);
  // v1.22.0 — TikTok-Style Creator-Tools-Grid (ersetzt 14-Button-Scroll-Leiste)
  const [creatorToolsVisible, setCreatorToolsVisible] = useState(false);

  const handlePickSticker = useCallback((emoji: string) => {
    addSticker({ emoji }).catch((e) => {
      __DEV__ && console.warn('[addSticker]', e);
    });
  }, [addSticker]);

  const handleMoveSticker = useCallback((id: string, pos: { x: number; y: number }) => {
    moveSticker({ id, positionX: pos.x, positionY: pos.y }).catch(() => {});
  }, [moveSticker]);

  const handleRemoveSticker = useCallback((id: string) => {
    removeSticker(id).catch(() => {});
  }, [removeSticker]);

  // ── Live-Placed-Products (v1.22.0) ─────────────────────────────────────────
  // Host platziert Shop-Produkte als frei verschiebbare Karten im Stream.
  const { products: placedProducts } = useActivePlacedProducts(sessionId);
  const {
    placeProduct,
    moveProduct:  movePlacedProduct,
    unpinProduct: unpinPlacedProduct,
  } = usePlacedProductActions(sessionId);
  const [productPlaceSheetVisible, setProductPlaceSheetVisible] = useState(false);

  const alreadyPlacedProductIds = useMemo(
    () => new Set(placedProducts.map((p) => p.productId)),
    [placedProducts],
  );

  const handlePlaceProduct = useCallback((productId: string) => {
    placeProduct({ productId }).catch((e) => {
      __DEV__ && console.warn('[placeProduct]', e);
    });
  }, [placeProduct]);

  const handleMovePlacedProduct = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      movePlacedProduct({ id, positionX: pos.x, positionY: pos.y }).catch(() => {});
    },
    [movePlacedProduct],
  );

  const handleUnpinPlacedProduct = useCallback((id: string) => {
    unpinPlacedProduct(id).catch(() => {});
  }, [unpinPlacedProduct]);

  // ── Live-Recording (v1.18.0) ───────────────────────────────────────────────
  const { recording: activeRecording } = useRecordingStatus(sessionId);
  const { startRecording, stopRecording, isStarting: recStarting, isStopping: recStopping } =
    useToggleRecording();
  const recActive = activeRecording?.status === 'recording';
  const handleToggleRecording = useCallback(async () => {
    if (!sessionId) return;
    try {
      if (recActive) {
        Alert.alert(
          'Aufnahme beenden?',
          'Das Replay wird erstellt und in den nächsten Minuten verfügbar.',
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Beenden', style: 'destructive', onPress: async () => {
                try { await stopRecording({ sessionId }); } catch (e: any) {
                  Alert.alert('Fehler', e?.message ?? 'Konnte Aufnahme nicht stoppen');
                }
              } },
          ],
        );
      } else {
        const roomName = session?.room_name;
        if (!roomName) {
          Alert.alert('Fehler', 'Raum-Name nicht verfügbar');
          return;
        }
        impactAsync(ImpactFeedbackStyle.Medium);
        await startRecording({ sessionId, roomName });
      }
    } catch (err: any) {
      Alert.alert('Aufnahme fehlgeschlagen', err?.message ?? 'Unbekannter Fehler');
    }
  }, [sessionId, recActive, session?.room_name, startRecording, stopRecording]);
  const handleClosePoll = useCallback(() => {
    if (!activePoll || !sessionId) return;
    Alert.alert(
      'Umfrage beenden?',
      'Die Ergebnisse bleiben für Zuschauer sichtbar, aber es können keine neuen Stimmen mehr abgegeben werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Beenden',
          style: 'destructive',
          onPress: () => { pollClose({ pollId: activePoll.id, sessionId }).catch(() => {}); },
        },
      ],
    );
  }, [activePoll, sessionId, pollClose]);

  // ── Top Gifter Leaderboard ──────────────────────────────────────────────────
  // Limit 10 → zeigt Live Top-3-Badge (TopGifterBadge sliced intern auf 3),
  // liefert aber genug Daten für die End-of-Stream-Summary (v1.16.0).
  const { topGifters } = useTopGifters(sessionId, 10);
  const totalGiftCoins = topGifters.reduce((sum, g) => sum + g.totalCoins, 0);

  // ── v1.23: Chat-Row Badges (Host/Mod/Top-Gifter) ─────────────────────────
  // topGifterIds → schneller O(1)-Lookup in der Chat-Row für den "TOP"-Chip.
  //   Grenze: nur die echte Top-3 (nicht Top-10) bekommt das Badge, sonst wird
  //   der Chat zum Sticker-Panel.
  // modIds → Session-Moderatoren für den "🛡 MOD"-Chip.
  // Perf: useMemo verhindert dass jeder Render eine neue Set-Referenz erzeugt
  // (würde renderItem-memo in der Chat-FlatList invalidieren).
  const topGifterIdSet = useMemo(
    () => new Set(topGifters.slice(0, 3).map((g) => g.userId)),
    [topGifters],
  );
  const { modIds: chatModIds } = useLiveModerators(sessionId);

  // v1.24 — Host lauscht nur auf Welcomes anderer, meldet sich selbst nicht an
  // (wäre sein eigener Stream). Zeigt aber denselben Toast, damit Host sieht
  // "aha, @X ist gerade reingekommen".
  const { welcomes: joinWelcomes } = useLiveWelcome(sessionId, { announceSelf: false });

  // ── Follower Shoutout ───────────────────────────────────────────────────────
  const hostUserId = session?.host_id ?? null;
  useFollowerShoutout(hostUserId, sessionId, sendSystemEvent);


  // Co-Host Request-Sheet Sichtbarkeit: Sheet erscheint nur wenn kein Duet aktiv ist.
  // Battle-Dauer + Layout werden jetzt im CoHostRequestSheet gewählt (TikTok-Style).
  // Ersetzt den alten iOS-Alert.alert()-Flow mit grauen Default-Buttons.
  const showCoHostRequestSheet = Boolean(pendingRequest) && !activeCoHostId;

  const handleRequestAccept = useCallback(
    (layout: DuetLayout, battleDurationSecs?: number) => {
      if (!pendingRequest) return;
      doAccept(pendingRequest, layout, battleDurationSecs ?? 60);
    },
    // doAccept ist stabil über die Laufzeit der Session (nutzt sessionId/room)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingRequest?.userId],
  );

  const handleRequestDecline = useCallback(() => {
    if (!pendingRequest) return;
    rejectCoHost(pendingRequest.userId);
    setPendingRequest(null);
  }, [pendingRequest, rejectCoHost, setPendingRequest]);

  const handleRequestDismiss = useCallback(() => {
    setPendingRequest(null);
  }, [setPendingRequest]);

  const doAccept = async (
    req: NonNullable<typeof pendingRequest>,
    layout: DuetLayout,
    battleDuration = 60
  ) => {
    // ⚠️ SECURITY FIX (Finding 3.4b Follow-up):
    // Die Edge-Function `livekit-token` gibt seit dem Phase-1-Hotfix nur noch
    // Publisher-Tokens heraus, wenn der User in `live_cohosts` eingetragen ist.
    // Deshalb MUSS der Host zuerst die RPC `approve_cohost` aufrufen — erst
    // DANACH darf der Broadcast raus, damit der Viewer beim Token-Refresh
    // keinen 403 bekommt.
    try {
      const { error } = await supabase.rpc('approve_cohost', {
        p_session_id: sessionId,
        p_user_id:    req.userId,
      });
      if (error) throw error;
    } catch (err: any) {
      __DEV__ && console.error('[CoHost] approve_cohost failed:', err);
      // Phase 5: Der DB-Blocklist-Trigger wirft mit HINT='blocked' wenn der User
      // auf unserer persistenten Blocklist steht (überlebt App-Restart). Hier
      // zeigen wir dem Host einen klaren Fehlertext mit Unblock-Hinweis.
      const isBlocked = err?.hint === 'blocked' || /blockiert/i.test(err?.message ?? '');
      Alert.alert(
        isBlocked ? '🚫 User blockiert' : 'Fehler',
        isBlocked
          ? `@${req.username} ist auf deiner Blocklist. Entblocken in den Einstellungen → Co-Host Blocks.`
          : 'Co-Host konnte nicht autorisiert werden. Bitte erneut versuchen.'
      );
      // Viewer zurück auf idle schicken + Grund mitgeben damit er es sieht
      await rejectCoHost(
        req.userId,
        isBlocked ? 'Du bist vom Host blockiert.' : undefined,
      );
      return;
    }

    // Fix #3: acceptCoHost liefert jetzt bool zurück. Wenn der Broadcast
    // fehlschlägt, räumen wir die DB-Whitelist wieder auf, sonst hätte der
    // User einen gültigen Co-Host-Eintrag ohne aktive Duet-Session.
    const ok = await acceptCoHost(req.userId, layout, battleDuration);
    if (!ok) {
      Alert.alert(
        'Signal verloren',
        'Die Bestätigung konnte nicht an den Co-Host zugestellt werden. Bitte erneut versuchen.'
      );
      try {
        await supabase.rpc('revoke_cohost', {
          p_session_id: sessionId,
          p_user_id:    req.userId,
        });
      } catch (err) {
        __DEV__ && console.warn('[CoHost] revoke_cohost rollback failed:', err);
      }
      return;
    }
    const emoji = layout === 'battle' ? '⚔️' : '🎥';
    sendSystemEvent(`${emoji} @${req.username} ist als Co-Host beigetreten!`);
  };

  // Wrapper: Duet-Ende räumt AUCH den DB-Whitelist-Eintrag auf.
  // Ohne Revoke behielte der Ex-Co-Host seinen Publisher-Token-Anspruch bis zum
  // Ablauf (8h). Mit Revoke schlägt ein Token-Refresh sofort fehl.
  const endCoHostWithRevoke = useCallback(async () => {
    const exId = activeCoHostId;
    endCoHost(); // erst Broadcast + lokaler State-Reset (sofortige UX)
    if (exId && sessionId) {
      try {
        await supabase.rpc('revoke_cohost', {
          p_session_id: sessionId,
          p_user_id:    exId,
        });
      } catch (err) {
        __DEV__ && console.warn('[CoHost] revoke_cohost failed:', err);
        // Nicht fatal — Host-State ist bereits resettet, User sieht UI-Ende.
      }
    }
  }, [activeCoHostId, sessionId, endCoHost]);

  // Battle-State (nur aktiv wenn activeLayout === 'battle')
  const isBattleActive = activeLayout === 'battle' && !!activeCoHostId;
  const { state: battleState, startTimer: startBattle, endBattle } = useBattle(
    isBattleActive ? sessionId : null,
    activeBattleDuration,
    false,                 // autoStart
    activeCoHostId,        // guestId für DB-Persistenz (v1.16.0)
  );

  // Phase 2: Queue-Picker. Host sieht alle wartenden Requests in einem Alert.
  // Per Tap auf einen User → gleiche Accept-Flow wie bei Auto-Alert.
  const showQueuePicker = useCallback(() => {
    if (pendingRequests.length === 0) {
      Alert.alert('📭 Keine Anfragen', 'Aktuell will niemand als Co-Host beitreten.');
      return;
    }

    const openAcceptFor = (req: typeof pendingRequests[number]) => {
      // Re-use die gleiche 2-Stufen-Logik wie der Auto-Alert
      const chooseBattleDuration = () => {
        Alert.alert(
          '⚔️ Battle-Dauer',
          'Wie lange soll die Battle-Runde laufen?',
          [
            { text: '3 min',  onPress: () => doAccept(req, 'battle', 3 * 60) },
            { text: '5 min',  onPress: () => doAccept(req, 'battle', 5 * 60) },
            { text: '10 min', onPress: () => doAccept(req, 'battle', 10 * 60) },
            { text: 'Abbrechen', style: 'cancel' },
          ],
        );
      };
      Alert.alert(
        `🎥 @${req.username} annehmen`,
        'Layout wählen:',
        [
          { text: '📱 Top / Bottom',   onPress: () => doAccept(req, 'top-bottom') },
          { text: '↔️ Side-by-Side',   onPress: () => doAccept(req, 'side-by-side') },
          { text: '📌 PiP (Vollbild)', onPress: () => doAccept(req, 'pip') },
          { text: '⚔️ Battle…',        onPress: chooseBattleDuration },
          {
            text: '❌ Ablehnen',
            style: 'destructive',
            onPress: () => rejectCoHost(req.userId),
          },
          { text: 'Zurück', style: 'cancel' },
        ],
      );
    };

    // Alert-Liste: maximal 4 Einträge sind auf iOS noch gut lesbar,
    // bei mehr zeigen wir "Top 4 + N mehr" Zusatzinfo.
    const top = pendingRequests.slice(0, 4);
    const extraCount = pendingRequests.length - top.length;
    const buttons = top.map((r, idx) => ({
      text: `${idx + 1}. @${r.username}`,
      onPress: () => openAcceptFor(r),
    }));
    if (extraCount > 0) {
      buttons.push({
        text: `+${extraCount} weitere (warten)`,
        onPress: () => {},
      });
    }
    buttons.push({ text: 'Schließen', onPress: () => {} });

    Alert.alert(
      `📥 Warteschlange (${pendingRequests.length})`,
      activeCoHostId
        ? 'Ein Duet läuft gerade. Beende es um den nächsten Request anzunehmen.'
        : 'Tippe auf einen Request zum Annehmen:',
      buttons,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequests, activeCoHostId, rejectCoHost]);

  // Phase 1.3: Kick mit Grund + Block. Long-Press auf "Duet beenden" öffnet
  // eine Auswahl aus Standard-Gründen. Bei Bestätigung wird der User geblockt
  // und kann während der laufenden Session nicht mehr requesten.
  const showKickDialog = useCallback(() => {
    if (!activeCoHostId) return;

    const doKick = async (reason: string, block: boolean, durationHours: number | null = null) => {
      const uid = activeCoHostId;
      // Erst Token-Whitelist entziehen (Server-Side) ...
      if (uid && sessionId) {
        try {
          await supabase.rpc('revoke_cohost', {
            p_session_id: sessionId,
            p_user_id:    uid,
          });
        } catch (err) {
          __DEV__ && console.warn('[CoHost] revoke_cohost bei Kick failed:', err);
          // Nicht fatal — Broadcast geht trotzdem raus.
        }
      }
      // Phase 5: Persistenter Block auf DB-Ebene. Bleibt über App-Restarts und
      // zukünftige Lives hinweg bestehen. `p_duration_hours = null` = permanent.
      // Beim nächsten `approve_cohost`-Versuch würfelt Postgres den HINT='blocked'
      // Error (siehe `doAccept`-Error-Handling oben).
      if (block && uid) {
        try {
          const { error } = await supabase.rpc('block_cohost', {
            p_user_id:         uid,
            p_reason:          reason,
            p_duration_hours:  durationHours,
          });
          if (error) throw error;
        } catch (err) {
          __DEV__ && console.warn('[CoHost] block_cohost failed:', err);
          // Nicht fatal — In-Memory-Block aus kickCoHost() greift weiterhin.
          // Beim nächsten App-Start wäre der Block aber weg; Host kann
          // manuell nachziehen.
        }
      }
      // ... dann Broadcast mit Grund + Block-Flag.
      const ok = await kickCoHost(reason, block);
      if (ok) {
        sendSystemEvent(
          block
            ? `🚫 Co-Host entfernt & blockiert: ${reason}`
            : `⚠️ Co-Host entfernt: ${reason}`
        );
      } else {
        Alert.alert(
          'Signal verloren',
          'Kick konnte nicht an alle zugestellt werden. Der lokale State ist bereits resettet.'
        );
      }
    };

    Alert.alert(
      '🚫 Co-Host entfernen',
      'Grund auswählen — der Co-Host sieht den Grund in einem Alert.',
      [
        { text: 'Unangemessenes Verhalten',  onPress: () => doKick('Unangemessenes Verhalten', true) },
        { text: 'Spam / Werbung',            onPress: () => doKick('Spam / Werbung', true) },
        { text: 'Beleidigung',               onPress: () => doKick('Beleidigung', true) },
        { text: 'Technisches Problem',       onPress: () => doKick('Technisches Problem', false) },
        { text: 'Abbrechen', style: 'cancel' },
      ],
    );
  }, [activeCoHostId, sessionId, kickCoHost, sendSystemEvent]);

  // v1.22.0: Per-Tile Actions — Host-only X-Button + Long-Press Menu auf Co-Host-Kacheln.
  //
  // Hintergrund: `endCoHost`/`kickCoHost` aus `useCoHostHost` operieren nur auf dem
  // globalen `activeCoHostId` (klassisches Duet). Im Grid-Mode mit mehreren Guests
  // brauchen wir per-userId Removal. Diese Helfer wrappen `revoke_cohost` RPC +
  // optional `block_cohost` + broadcast 'co-host-kicked'/'co-host-ended'.
  const revokeCoHostById = useCallback(async (
    targetUserId: string,
    reason: string,
    blocked: boolean = true,
    durationHours: number | null = null,
  ) => {
    if (!sessionId) return;

    // 1. Server-Side: Token-Whitelist entziehen.
    try {
      await supabase.rpc('revoke_cohost', {
        p_session_id: sessionId,
        p_user_id:    targetUserId,
      });
    } catch (err) {
      __DEV__ && console.warn('[CoHost] revoke_cohost (tile) failed:', err);
    }

    // 2. Optional: persistenter Block.
    if (blocked) {
      try {
        const { error } = await supabase.rpc('block_cohost', {
          p_user_id:         targetUserId,
          p_reason:          reason,
          p_duration_hours:  durationHours,
        });
        if (error) throw error;
      } catch (err) {
        __DEV__ && console.warn('[CoHost] block_cohost (tile) failed:', err);
      }
    }

    // 3. Wenn das der gerade aktive Duet-Partner ist → lokal auch kickCoHost
    //    aufrufen (setzt Layout/State zurück, Broadcast inkl.).
    if (targetUserId === activeCoHostId) {
      await kickCoHost(reason, blocked);
    } else {
      // Sonst nur manueller Broadcast — Grid-Guest wird vom Server entfernt,
      // der `useLiveCoHosts`-Realtime-Listener aktualisiert die Kachel.
      // (kein extra Broadcast nötig, da revoke_cohost → DB-Update → Realtime)
    }

    sendSystemEvent(
      blocked
        ? `🚫 Co-Host entfernt & blockiert: ${reason}`
        : `⚠️ Co-Host entfernt: ${reason}`
    );
  }, [sessionId, activeCoHostId, kickCoHost, sendSystemEvent]);

  // Kleines Confirm-Alert beim Tippen auf das X am Kachel-Rand.
  // Schneller Default-Path (ohne Grund-Auswahl).
  const confirmKickTile = useCallback((userId: string, username: string) => {
    Alert.alert(
      '🚫 Gast entfernen',
      `@${username} aus dem Duet entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: () => revokeCoHostById(userId, 'Vom Host entfernt', false),
        },
        {
          text: 'Entfernen & Blockieren',
          style: 'destructive',
          onPress: () => revokeCoHostById(userId, 'Vom Host blockiert', true),
        },
      ],
    );
  }, [revokeCoHostById]);

  // Long-Press ActionSheet auf Kachel: feinere Optionen für aktiven Duet-Partner.
  // Für Grid-Guests nur Kick (Mute über Broadcast ist nur für activeCoHostId).
  const showTileActionSheet = useCallback((userId: string, username: string) => {
    impactAsync(ImpactFeedbackStyle.Medium).catch(() => {});
    const isActiveDuet = userId === activeCoHostId;

    const buttons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [];

    if (isActiveDuet) {
      buttons.push({
        text: coHostMutedAudio ? '🔊 Mic freigeben' : '🔇 Mic muten',
        onPress: () => muteCoHost({ audio: !coHostMutedAudio }),
      });
      buttons.push({
        text: coHostMutedVideo ? '📷 Video freigeben' : '🚫 Video muten',
        onPress: () => muteCoHost({ video: !coHostMutedVideo }),
      });
    }

    buttons.push({
      text: '🚫 Entfernen (mit Grund)',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          '🚫 Grund wählen',
          `@${username} entfernen — der Gast sieht den Grund.`,
          [
            { text: 'Unangemessenes Verhalten', onPress: () => revokeCoHostById(userId, 'Unangemessenes Verhalten', true) },
            { text: 'Spam / Werbung',           onPress: () => revokeCoHostById(userId, 'Spam / Werbung', true) },
            { text: 'Beleidigung',              onPress: () => revokeCoHostById(userId, 'Beleidigung', true) },
            { text: 'Technisches Problem',      onPress: () => revokeCoHostById(userId, 'Technisches Problem', false) },
            { text: 'Abbrechen', style: 'cancel' },
          ],
        );
      },
    });

    buttons.push({
      text: '🚩 Melden',
      onPress: () => {
        // TODO: Echten Report-Flow wenn Report-RPC verfügbar; bis dahin nur Toast.
        Alert.alert('Danke', 'Meldung wurde an Moderation übermittelt.');
      },
    });

    buttons.push({ text: 'Abbrechen', style: 'cancel' });

    Alert.alert(`@${username}`, 'Aktionen für diesen Gast:', buttons);
  }, [activeCoHostId, coHostMutedAudio, coHostMutedVideo, muteCoHost, revokeCoHostById]);

  // Phase 1.1: Runtime Layout-Switcher — Host kann Layout live wechseln,
  // während ein Duet aktiv ist. Beim Wechsel nach "battle" wird eine neue
  // Battle-Runde mit gewählter Dauer gestartet (3/5/10 min).
  const showLayoutSwitcher = useCallback(() => {
    if (!activeCoHostId) return;

    const switchTo = async (layout: DuetLayout, battleDuration?: number) => {
      if (layout === activeLayout && layout !== 'battle') return; // nichts zu tun
      const ok = await changeLayout(layout, battleDuration);
      if (!ok) {
        Alert.alert(
          'Signal verloren',
          'Layout-Wechsel konnte nicht an alle zugestellt werden. Bitte erneut versuchen.'
        );
        return;
      }
      const labels: Record<DuetLayout, string> = {
        'top-bottom':   '📱 Top / Bottom',
        'side-by-side': '↔️ Side-by-Side',
        'pip':          '📌 PiP',
        'battle':       `⚔️ Battle (${Math.round((battleDuration ?? 60) / 60)} min)`,
        'grid-2x2':     '🔲 Grid 2×2 (bis 4 Guests)',
        'grid-3x3':     '🔳 Grid 3×3 (bis 8 Guests)',
      };
      sendSystemEvent(`🎥 Layout: ${labels[layout]}`);
    };

    // Stufe 1: Layout wählen
    Alert.alert(
      '🎥 Duet-Layout wechseln',
      'Wähle wie der/die Co-Hosts angezeigt werden sollen:',
      [
        { text: '📱 Top / Bottom',  onPress: () => switchTo('top-bottom') },
        { text: '↔️ Side-by-Side',  onPress: () => switchTo('side-by-side') },
        { text: '📌 PiP (Vollbild)', onPress: () => switchTo('pip') },
        { text: '🔲 Grid 2×2',       onPress: () => switchTo('grid-2x2') },
        { text: '🔳 Grid 3×3',       onPress: () => switchTo('grid-3x3') },
        {
          text: '⚔️ Battle…',
          onPress: () => {
            // Stufe 2: Battle-Dauer wählen (3/5/10 min)
            Alert.alert(
              '⚔️ Battle-Dauer',
              'Wie lange soll die Battle-Runde laufen?',
              [
                { text: '3 min',  onPress: () => switchTo('battle', 3 * 60) },
                { text: '5 min',  onPress: () => switchTo('battle', 5 * 60) },
                { text: '10 min', onPress: () => switchTo('battle', 10 * 60) },
                { text: 'Abbrechen', style: 'cancel' },
              ],
            );
          },
        },
        { text: 'Abbrechen', style: 'cancel' },
      ],
    );
  }, [activeCoHostId, activeLayout, changeLayout, sendSystemEvent]);

  // Battle-Timer starten sobald Co-Host aktiv ist
  useEffect(() => {
    if (isBattleActive) startBattle();
  }, [isBattleActive, startBattle]); // Bug 5 Fix: startBattle als Dependency

  /** Host öffnet Goal-Setup Dialog */
  const setupGoal = () => {
    Alert.alert(
      '🎯 LIVE Ziel setzen',
      'Für welche Art gilt das Ziel?',
      [
        {
          text: '💎 Geschenke (Coins)',
          onPress: () => promptGoalDetails('gift_value'),
        },
        {
          text: '❤️ Likes',
          onPress: () => promptGoalDetails('likes'),
        },
        goal
          ? { text: '🗑️ Ziel entfernen', style: 'destructive', onPress: () => setLiveGoal(sessionId, null) }
          : { text: 'Abbrechen', style: 'cancel' },
        ...(!goal ? [{ text: 'Abbrechen', style: 'cancel' as const }] : []),
      ]
    );
  };

  const promptGoalDetails = (type: 'gift_value' | 'likes') => {
    const typeLabel = type === 'gift_value' ? 'Coin-Ziel' : 'Like-Ziel';
    Alert.prompt(
      `${typeLabel} — Zielwert`,
      `Wie viele ${type === 'gift_value' ? 'Coins' : 'Likes'} sollen erreicht werden?`,
      (targetStr) => {
        const target = parseInt(targetStr?.trim() ?? '', 10);
        if (!target || target <= 0) return;
        Alert.prompt(
          '🎁 Was machst du als Belohnung?',
          'Kurze Beschreibung (z.B. "Ich tanze 30 Sek")',
          async (title) => {
            if (!title?.trim()) return;
            await setLiveGoal(sessionId, { type, target, title: title.trim() });
            sendSystemEvent(`🎯 Neues Ziel: ${title.trim()} — ${target} ${type === 'gift_value' ? '💎 Coins' : '❤️ Likes'}!`);
          },
          'plain-text'
        );
      },
      'plain-text'
    );
  };

  const flatRef = useRef<FlatList>(null);
  const [input, setInput] = useState("");
  const [shareVisible, setShareVisible] = useState(false);
  const [viewersVisible, setViewersVisible] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [replaySaving, setReplaySaving] = useState(false);
  const [replaySaved, setReplaySaved] = useState(false);
  const [startTime] = useState(Date.now());
  const [userScrolling, setUserScrolling] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // Frontkamera = mirror, Rückkamera = kein mirror
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const tapHeartIdRef = useRef(0);
  const [tapHearts, setTapHearts] = useState<TapHeart[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ─── Gift System ──────────────────────────────────────────────────────────
  // Host empfängt Geschenke — kein GiftPicker (nur Viewer senden)
  // channelRef nicht benötigt (Host sendet keine Geschenke)
  const { gifts: incomingGifts } = useGiftStream(sessionId);

  // ─── Live-Shopping ────────────────────────────────────────────────────────
  const { pinnedProduct: shopPinnedProduct, pinProduct, unpinProduct } = useLiveShoppingHost(sessionId);
  const soldEvents: import('@/lib/useLiveShopping').ProductSoldEvent[] = []; // Host hat kein soldEvents (nur Viewer)
  const [shopPanelVisible, setShopPanelVisible] = useState(false);

  // ─── Live-Shop-Mode (TikTok-Style Katalog-Button) ─────────────────────────
  const { shopEnabled } = useLiveShopMode(sessionId);
  const { toggleShopMode, isToggling: isTogglingShopMode } = useLiveShopModeActions(sessionId);

  // Goal-Fortschritt nach eingehendem Geschenk aktualisieren
  const lastGiftIdRef = useRef<string>('');
  useEffect(() => {
    if (!incomingGifts.length || !goal || goal.type !== 'gift_value' || goal.reached) return;
    const latest = incomingGifts[incomingGifts.length - 1];
    if (latest.id === lastGiftIdRef.current) return; // Doppelt verhindern
    lastGiftIdRef.current = latest.id;
    incrementGoalProgress(sessionId, 'gift_value', latest.gift.coinCost);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingGifts.length]);

  // Feier-Nachricht im Chat wenn Ziel erreicht
  useEffect(() => {
    if (justReached && goal) {
      sendSystemEvent(`🎉 Ziel erreicht! "${goal.title}" — Danke an alle! 🎯`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justReached]);


  const dotOpacity = useSharedValue(1);
  useEffect(() => {
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  useEffect(() => {
    if (comments.length > 0 && !userScrolling) {
      flatRef.current?.scrollToEnd({ animated: true });
    }
  }, [comments.length, userScrolling]);

  // ── RoomContext ─────────────────────────────────────────────────────────────
  const room = useContext(RoomContext);

  // ── LiveKit: Gast verlässt Room (App-Kill / Netzwerkausfall) ─────────────────
  // Wenn der Gast die App killt, geht keine Supabase-Broadcast "co-host-left".
  // LiveKit erkennt den Disconnect (ICE-Timeout ~10s) und feuert ParticipantDisconnected.
  //
  // ⚠️ BUG FIX (v1.22.0): Beim Co-Host-Accept macht der Viewer einen INTENTIONAL
  // disconnect() (watch/[id].tsx ~L916), um mit einem Publisher-Token (canPublish=true)
  // frisch zu reconnecten. Während dieser 1–2s Lücke würde der alte Code hier sofort
  // `endCoHostWithRevoke()` feuern → Flapping ("Verbindung verloren" → "beigetreten" loop).
  //
  // Fix: Grace-Period von GRACE_MS. Bei participantDisconnected: Timer starten.
  // Bei participantConnected mit derselben identity: Timer canceln — das war nur
  // ein Token-Swap-Reconnect. Timer läuft ab ohne Cancel → echter Disconnect,
  // dann erst revoken.
  useEffect(() => {
    if (!room || !activeCoHostId) return;

    const GRACE_MS = 4500; // ausreichend für Token-Swap-Reconnect (~1-2s) + ICE
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const clearGrace = () => {
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
    };

    const onParticipantDisconnected = (participant: import('livekit-client').RemoteParticipant) => {
      if (participant.identity !== activeCoHostId) return;
      // Prüfen: ist der Participant evtl. schon wieder im Room? (Race bei schnellem Reconnect)
      const stillPresent = Array.from(room.remoteParticipants.values())
        .some((p) => p.identity === activeCoHostId && p.sid !== participant.sid);
      if (stillPresent) return;

      clearGrace();
      graceTimer = setTimeout(() => {
        // Finale Prüfung: ist der Co-Host in der Zwischenzeit zurückgekommen?
        const nowPresent = Array.from(room.remoteParticipants.values())
          .some((p) => p.identity === activeCoHostId);
        if (nowPresent) return;
        endCoHostWithRevoke();
        sendSystemEvent('📹 Co-Host hat die Verbindung verloren');
      }, GRACE_MS);
    };

    const onParticipantConnected = (participant: import('livekit-client').RemoteParticipant) => {
      // Co-Host ist innerhalb der Grace zurückgekommen → Timer abbrechen
      if (participant.identity === activeCoHostId) clearGrace();
    };

    room.on('participantDisconnected', onParticipantDisconnected);
    room.on('participantConnected', onParticipantConnected);
    return () => {
      clearGrace();
      room.off('participantDisconnected', onParticipantDisconnected);
      room.off('participantConnected', onParticipantConnected);
    };
  }, [room, activeCoHostId, endCoHostWithRevoke, sendSystemEvent]);

  // ── Host-Mic resync bei Duett/Layout-Switch ─────────────────────────────────
  // ⚠️ BUG FIX (v1.15.3): Wenn ein Co-Host beitritt oder das Layout wechselt,
  // kann die iOS-AudioSession-Renegotiation den Host-Mic-State auf false
  // zurücksetzen (sichtbar: "mikrofon funktioniert nur wenn Host Kamera an
  // hat, nicht bei Duett"). Defensiv: bei jeder Duett-Aktivierung und
  // Layout-Wechsel das Mic explizit re-enablen. Idempotent — wenn der
  // Track noch publiziert ist, unmuted setMicrophoneEnabled(true) ihn nur.
  useEffect(() => {
    if (!room?.localParticipant) return;
    // Kurze Verzögerung damit LiveKit den Renegotiation-Sturm durchläuft
    const t = setTimeout(() => {
      room.localParticipant
        ?.setMicrophoneEnabled(true)
        ?.catch((e: unknown) => {
          __DEV__ && console.warn('[LiveHost] Mic-Resync (Duett) fehlgeschlagen:', e);
        });
    }, 800);
    return () => clearTimeout(t);
  }, [room, activeCoHostId, activeLayout]);

  // ── Kamera/Mikrofon muten wenn App in Hintergrund geht ──────────────────────
  // iOS stoppt automatisch die Kamera → Zuschauer sehen weißes Bild.
  // Lösung: Kamera + Mikrofon beim Hintergrundwechsel explizit muten.
  // Beim Zurückkehren: wieder unmuten. Zuschauer sehen "Live pausiert"-Overlay.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (!room) return;
      const localParticipant = room.localParticipant;
      if (!localParticipant) return;
      try {
        if (nextState === 'background' || nextState === 'inactive') {
          // App geht in Hintergrund → Kamera + Mikrofon muten
          await localParticipant.setCameraEnabled(false);
          await localParticipant.setMicrophoneEnabled(false);
        } else if (nextState === 'active') {
          // App kommt zurück → Kamera + Mikrofon unmuten
          await localParticipant.setCameraEnabled(true);
          await localParticipant.setMicrophoneEnabled(true);
        }
      } catch {
        // Ignore — kann fehlschlagen wenn Room schon getrennt
      }
    });
    return () => sub.remove();
  }, [room]);



  const submit = () => {
    if (!input.trim()) return;
    sendComment(input.trim());
    setInput("");
    Keyboard.dismiss();
  };

  const handleShare = () => setShareVisible(true);

  const handleEnd = () => setShowSummary(true);

  const handleScreenTap = (x: number, y: number) => {
    tapHeartIdRef.current++;
    const newHeart: TapHeart = { id: tapHeartIdRef.current, x, y };
    setTapHearts((prev) => [...prev, newHeart]);
    // Broadcast, aber KEIN lokaler FloatingHeart — der Host sieht nur sein
    // TapHeart am Finger-Punkt. Verhindert Doppel-Herz (Tap + bottom-right).
    sendReaction('\u2764\uFE0F', { skipLocal: true });
  };

  const confirmEnd = async () => {
    setShowSummary(false);
    // v1.18.0: Wenn Aufnahme läuft → erst stoppen (Egress finalisieren)
    if (recActive && sessionId) {
      try { await stopRecording({ sessionId }); } catch { /* nicht blockend */ }
    }
    onEnd();
  };

  const handleSaveReplay = () => {
    Alert.alert(
      '📱 Live aufzeichnen',
      'So zeichnest du dein Live auf:\n\n1. Wisch von oben rechts nach unten\n2. Tippe auf „Bildschirmaufnahme“ ⏺\n3. Starte dein Live — es wird automatisch aufgezeichnet\n4. Nach dem Live: Aufnahme stoppen\n\nDie Aufnahme findest du in der Fotos-App.',
      [{ text: 'Verstanden', style: 'default' }]
    );
  };

  const handlePostAsVideo = () => {
    Alert.alert(
      '📤 Live als Video posten',
      'Hast du deinen Live-Stream mit der iOS Bildschirmaufnahme aufgezeichnet?\n\nSo geht’s:\n1. Vor dem nächsten Live: Bildschirmaufnahme starten\n2. Nach dem Live: Aufnahme stoppen\n3. Video aus der Galerie auswählen\n\nDie Aufnahme findest du in der Fotos-App.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: '📁 Galerie öffnen',
          style: 'default',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['videos'],
              allowsEditing: false,
              quality: 1,
              videoMaxDuration: 0,
            });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            setShowSummary(false);
            router.replace({
              pathname: '/create' as any,
              params: {
                mediaUri: asset.uri,
                mediaType: 'video',
                caption: title ? `Live Replay: ${title}` : 'Live Replay 🔴',
              },
            });
          },
        },
      ]
    );
  };

  const formatDuration = () => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Creator-Tools Grid (v1.22.0) ──────────────────────────────────────────
  // Baut alle Tools als Kacheln zusammen. Sichtbarkeit ist kontext-sensitiv
  // (Co-Host-Controls nur wenn Duet aktiv, Battle-End nur im Battle usw.).
  const creatorTools = useMemo<CreatorToolItem[]>(() => {
    const list: CreatorToolItem[] = [];

    // —— Creator-Tools: Produktion (Poll/Sticker/Produkt/Goal/Shop/Record)
    list.push({
      key:         'poll',
      label:       'Umfrage',
      icon:        <BarChart3 size={26} stroke={activePoll ? '#a78bfa' : '#fff'} strokeWidth={2.2} />,
      active:      !!activePoll,
      accentColor: '#8b5cf6',
      onPress:     () => setPollSheetVisible(true),
    });

    list.push({
      key:         'sticker',
      label:       'Sticker',
      icon:        <Smile size={26} stroke={activeStickers.length > 0 ? '#fbbf24' : '#fff'} strokeWidth={2.2} />,
      active:      activeStickers.length > 0,
      accentColor: '#fbbf24',
      badge:       activeStickers.length > 0 ? activeStickers.length : undefined,
      onPress:     () => setStickerPickerVisible(true),
    });

    list.push({
      key:         'product-pin',
      label:       'Produkt',
      icon:        <Tag size={26} stroke={placedProducts.length > 0 ? '#34d399' : '#fff'} strokeWidth={2.2} />,
      active:      placedProducts.length > 0,
      accentColor: '#22c55e',
      badge:       placedProducts.length > 0 ? placedProducts.length : undefined,
      onPress:     () => setProductPlaceSheetVisible(true),
    });

    list.push({
      key:         'goal',
      label:       'Ziel',
      icon:        <Target
                     size={26}
                     stroke={goal?.reached ? '#4ade80' : goal ? '#fbbf24' : '#fff'}
                     strokeWidth={2.2}
                   />,
      active:      !!goal,
      accentColor: goal?.reached ? '#22c55e' : '#f59e0b',
      onPress:     setupGoal,
    });

    // ── Shop-Modus Toggle (TikTok-Style Katalog-Button für Viewer) ────
    // Schaltet die Tüte in der Viewer-Bottom-Bar an/aus. Orthogonal zu
    // Featured-Product-Pill (shop-pin) und platzierten Karten (product-pin).
    list.push({
      key:         'shop-mode',
      label:       shopEnabled ? 'Shop an' : 'Shop aus',
      icon:        <ShoppingBag
                     size={26}
                     stroke={shopEnabled ? '#34d399' : '#fff'}
                     strokeWidth={2.2}
                   />,
      active:      shopEnabled,
      accentColor: '#22c55e',
      disabled:    isTogglingShopMode,
      keepOpen:    true,
      onPress:     () => { toggleShopMode(!shopEnabled).catch(() => {}); },
    });

    list.push({
      key:         'shop-pin',
      label:       'Featured',
      icon:        <ShoppingBag size={26} stroke={shopPinnedProduct ? '#34d399' : '#fff'} strokeWidth={2.2} />,
      active:      !!shopPinnedProduct,
      accentColor: '#22c55e',
      onPress:     () => setShopPanelVisible(true),
    });

    list.push({
      key:         'record',
      label:       recActive ? 'Stop-REC' : 'Aufnahme',
      icon:        <Circle
                     size={26}
                     stroke={recActive ? '#ef4444' : '#fff'}
                     fill={recActive ? '#ef4444' : 'transparent'}
                     strokeWidth={2.2}
                   />,
      active:      recActive,
      accentColor: '#ef4444',
      disabled:    recStarting || recStopping,
      onPress:     handleToggleRecording,
    });

    // —— Chat-Moderation-Feinschliff
    list.push({
      key:         'slow-mode',
      label:       slowModeSeconds > 0 ? `Slow ${slowModeSeconds}s` : 'Slow-Mode',
      icon:        <Timer size={26} stroke={slowModeSeconds > 0 ? '#fdba74' : '#fff'} strokeWidth={2.2} />,
      active:      slowModeSeconds > 0,
      accentColor: '#f97316',
      onPress:     showSlowModeMenu,
    });

    list.push({
      key:         'followers-only',
      label:       'Nur Follower',
      icon:        <Users
                     size={26}
                     stroke={followersOnlyChat ? '#4ade80' : '#fff'}
                     strokeWidth={2.2}
                   />,
      active:      followersOnlyChat,
      accentColor: '#22c55e',
      onPress:     handleFollowersOnlyToggle,
    });

    // —— Kontext: Co-Host Anfragen (nur wenn Warteschlange nicht leer)
    if (queueDepth > 0) {
      list.push({
        key:         'queue',
        label:       'Anfragen',
        icon:        <Inbox size={26} stroke="#60a5fa" strokeWidth={2.2} />,
        accentColor: '#3b82f6',
        badge:       queueDepth,
        onPress:     showQueuePicker,
      });
    }

    // —— Kontext: Duet aktiv → Layout / Mute / End
    if (activeCoHostId) {
      list.push({
        key:         'duet-layout',
        label:       'Layout',
        icon:        <LayoutGrid size={26} stroke="#a5b4fc" strokeWidth={2.2} />,
        accentColor: '#6366f1',
        onPress:     showLayoutSwitcher,
      });

      list.push({
        key:         'cohost-mic',
        label:       coHostMutedAudio ? 'Mic frei' : 'Co-Mic',
        icon:        coHostMutedAudio
                       ? <MicOff size={26} stroke="#fca5a5" strokeWidth={2.2} />
                       : <Mic size={26} stroke="#fff" strokeWidth={2.2} />,
        active:      coHostMutedAudio,
        accentColor: '#ef4444',
        onPress:     async () => {
          const ok = await muteCoHost({ audio: !coHostMutedAudio });
          if (ok) {
            sendSystemEvent(
              coHostMutedAudio
                ? '🎤 Co-Host Mikrofon entmutet'
                : '🎤 Co-Host Mikrofon gemutet'
            );
          }
        },
      });

      list.push({
        key:         'cohost-cam',
        label:       coHostMutedVideo ? 'Cam frei' : 'Co-Cam',
        icon:        coHostMutedVideo
                       ? <CameraOff size={26} stroke="#fca5a5" strokeWidth={2.2} />
                       : <Camera size={26} stroke="#fff" strokeWidth={2.2} />,
        active:      coHostMutedVideo,
        accentColor: '#ef4444',
        onPress:     async () => {
          const ok = await muteCoHost({ video: !coHostMutedVideo });
          if (ok) {
            sendSystemEvent(
              coHostMutedVideo
                ? '📷 Co-Host Kamera entmutet'
                : '📷 Co-Host Kamera gemutet'
            );
          }
        },
      });

      list.push({
        key:          'duet-end',
        label:        'Duet beenden',
        icon:         <Video size={26} stroke="#fca5a5" strokeWidth={2.2} />,
        destructive:  true,
        onPress:      () => {
          endCoHostWithRevoke();
          sendSystemEvent('🎥 Duet beendet');
        },
        onLongPress:  showKickDialog,
      });
    }

    // —— Kontext: Battle aktiv → Battle-End
    if (isBattleActive && !battleState.ended) {
      list.push({
        key:         'battle-end',
        label:       'Battle-Stop',
        icon:        <Zap size={26} stroke="#fde047" strokeWidth={2.2} />,
        accentColor: '#eab308',
        keepOpen:    true, // Alert öffnet sich ohnehin → Sheet bleibt für Confirm offen
        onPress:     () => {
          Alert.alert(
            '⚡ Battle beenden?',
            'Der Gewinner wird sofort ermittelt. Der Countdown wird übersprungen.',
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text:    'Battle beenden',
                style:   'destructive',
                onPress: () => {
                  endBattle();
                  sendSystemEvent('⚡ Battle vorzeitig beendet');
                  setCreatorToolsVisible(false);
                },
              },
            ],
          );
        },
      });
    }

    return list;
  }, [
    activePoll, activeStickers.length, placedProducts.length,
    goal, shopPinnedProduct, recActive, recStarting, recStopping,
    shopEnabled, isTogglingShopMode, toggleShopMode,
    slowModeSeconds, followersOnlyChat,
    queueDepth, activeCoHostId, coHostMutedAudio, coHostMutedVideo,
    isBattleActive, battleState.ended,
    setupGoal, handleToggleRecording, showSlowModeMenu,
    handleFollowersOnlyToggle, showQueuePicker, showLayoutSwitcher,
    muteCoHost, endCoHostWithRevoke, showKickDialog, endBattle,
    sendSystemEvent,
  ]);

  // ── Chat-Row Handler: stabile Refs für memoized CommentRow ─────────────
  // Wenn diese in useCallback gewrappt sind, bleibt ihr Referenz-Identität
  // über Renders erhalten → React.memo an CommentRow greift und re-renderet
  // nur die geänderte Row, nicht die gesamte sichtbare Chat-Liste.
  const handleUserSelect = useCallback((uid: string) => {
    setSelectedUserId(uid);
  }, []);

  const handleModerate = useCallback((item: LiveComment) => {
    const username = item.profiles?.username ?? 'User';
    const userId = item.user_id;
    // Phase 6: Timeout-Submenu öffnet sich aus dem Haupt-Alert.
    const openTimeoutMenu = () => {
      Alert.alert(
        `⏳ @${username} stumm schalten`,
        'Dauer auswählen:',
        [
          { text: '1 min',  onPress: async () => {
            const ok = await timeoutUser(userId, 60, 'Chat-Timeout 1min');
            if (ok) sendSystemEvent(`⏳ @${username} für 1 Minute gemutet.`);
          } },
          { text: '5 min',  onPress: async () => {
            const ok = await timeoutUser(userId, 5 * 60, 'Chat-Timeout 5min');
            if (ok) sendSystemEvent(`⏳ @${username} für 5 Minuten gemutet.`);
          } },
          { text: '30 min', onPress: async () => {
            const ok = await timeoutUser(userId, 30 * 60, 'Chat-Timeout 30min');
            if (ok) sendSystemEvent(`⏳ @${username} für 30 Minuten gemutet.`);
          } },
          { text: 'Zurück', style: 'cancel' },
        ]
      );
    };
    Alert.alert(
      'Kommentar',
      `Von @${username}: "${item.text.slice(0, 60)}"`,
      [
        { text: '📌 Anpinnen',           onPress: () => pinComment(item) },
        { text: '⏳ User stumm schalten', onPress: openTimeoutMenu },
        { text: '🚫 Löschen', style: 'destructive', onPress: () => deleteComment(item.id) },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  }, [timeoutUser, sendSystemEvent, pinComment, deleteComment]);

  const renderChatItem = useCallback(
    ({ item }: { item: LiveComment }) => (
      <CommentRow
        comment={item}
        /* v1.23 Badges: Host-Author, Session-Mod, oder Top-3-Gifter */
        isHost={!!hostUserId && item.user_id === hostUserId}
        isModerator={chatModIds.has(item.user_id)}
        isTopGifter={topGifterIdSet.has(item.user_id)}
        onUserSelect={handleUserSelect}
        onModerate={handleModerate}
      />
    ),
    [hostUserId, chatModIds, topGifterIdSet, handleUserSelect, handleModerate],
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Duet-Layouts (Fix #4: stabile Tree-Positionen) ──────────────
          WICHTIG: Der Container um <LocalCameraView/> ist IMMER an der gleichen
          Tree-Position. Nur der Container-Style wechselt. Dadurch behält das
          native iOS VideoTrack-Surface seinen Texture-Attach und es gibt keinen
          Black-Screen beim Duet-Start. Früher wurde zwischen <LocalCameraView/>
          als direkter Child und <CoHostSplitView LocalView={...}/> getauscht,
          was ein vollständiges Remount des Video-Views ausgelöst hat. */}

      {/* Lokale Host-Kamera
          - Solo / PiP:       Vollbild
          - Grid-Mode:        erste Tile (Top-Left, 50%×50% bzw 33%×33%)
          - Side / Battle:    rechte Hälfte
          - Top-Bottom:       untere Hälfte */}
      <View
        style={
          !activeCoHostId || activeLayout === 'pip'
            ? StyleSheet.absoluteFill
            : isGridMode
              ? { position: 'absolute', top: 0, left: 0, width: gridTilePct as any, height: gridTilePct as any, overflow: 'hidden', backgroundColor: '#000' }
              : (activeLayout === 'side-by-side' || activeLayout === 'battle')
                // TikTok-Style: Videos kompakt in oberer Hälfte (13%..55%), Rest frei für Chat/UI
                // v1.22.0 (UX): vorher 10%..70% wirkte zu hoch/lang — TikTok Battle sitzt kürzer.
                ? { position: 'absolute', top: '13%', height: '42%', right: 0, width: '50%', overflow: 'hidden', backgroundColor: '#000' }
                : { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', overflow: 'hidden', backgroundColor: '#000' }
        }
      >
        <LocalCameraView isFrontCamera={isFrontCamera} />
        {/* Host-Label nur im Duet-Split einblenden */}
        {activeCoHostId && activeLayout !== 'pip' && (
          <View style={s.duetLabelBadge} pointerEvents="none">
            <Text style={s.duetLabelText}>
              {activeLayout === 'battle' ? '🔴 DU'
                : isGridMode ? '👑 DU'
                : 'HOST'}
            </Text>
          </View>
        )}
      </View>

      {/* Remote Co-Host (obere/linke Hälfte) — nur im klassischen Duet-Split */}
      {activeCoHostId && activeLayout !== 'pip' && !isGridMode && (() => {
        const activeGuest = activeCoHosts.find((c) => c.userId === activeCoHostId);
        const guestUsername = activeGuest?.username ?? 'Gast';
        return (
        <Pressable
          onLongPress={() => showTileActionSheet(activeCoHostId, guestUsername)}
          delayLongPress={350}
          style={
            (activeLayout === 'side-by-side' || activeLayout === 'battle')
              // TikTok-Style: Videos kompakt in oberer Hälfte (13%..55%), Rest frei für Chat/UI
              // v1.22.0 (UX): vorher 10%..70% wirkte zu hoch/lang — TikTok Battle sitzt kürzer.
              ? { position: 'absolute', top: '13%', height: '42%', left: 0, width: '50%', overflow: 'hidden', backgroundColor: '#0d0d1a' }
              : { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', overflow: 'hidden', backgroundColor: '#0d0d1a' }
          }
        >
          <RemoteCoHostVideoView coHostUserId={activeCoHostId} />
          {/* Co-Host-Label */}
          <View style={s.duetLabelBadge} pointerEvents="none">
            <Text style={s.duetLabelText}>{activeLayout === 'battle' ? '🔵 GAST' : 'GAST'}</Text>
          </View>
          {/* v1.22.0: Kleines X oben rechts — Host kickt Gast direkt */}
          <Pressable
            onPress={() => confirmKickTile(activeCoHostId, guestUsername)}
            hitSlop={10}
            style={s.tileKickBtn}
          >
            <X size={13} stroke="#fff" strokeWidth={2.8} />
          </Pressable>
          {/* Trennlinie am Ende der Hälfte */}
          <View
            style={
              (activeLayout === 'side-by-side' || activeLayout === 'battle')
                ? s.duetDividerVertical
                : s.duetDividerHorizontal
            }
            pointerEvents="none"
          />
        </Pressable>
        );
      })()}

      {/* Phase 3: Multi-Guest Grid — rendert alle aktiven Co-Hosts in Kacheln.
          Host-Kamera bleibt an stabiler Tree-Position (s.o., Slot 0 = Top-Left).
          Hier nur die Remote-Tiles; sie positionieren sich selbst absolut.
          ⚠️ Wichtig: `ch.slotIndex` kommt aus der DB und ist 0..6 (Co-Hosts,
          ohne Host). Der visuelle Tile-Index ist `ch.slotIndex + 1` (Slot 0
          = Host). Array-Position `i` darf NICHT verwendet werden — bei
          gelöschten Co-Hosts ergäben sich falsche Tile-Positionen. */}
      {isGridMode && activeCoHosts
        .filter((ch) => ch.slotIndex + 1 < gridCols * gridCols)
        .map((ch) => {
          const tileIndex = ch.slotIndex + 1; // +1 weil Slot 0 = Host
          const row = Math.floor(tileIndex / gridCols);
          const col = tileIndex % gridCols;
          return (
            <Pressable
              key={ch.userId}
              onLongPress={() => showTileActionSheet(ch.userId, ch.username ?? 'Gast')}
              delayLongPress={350}
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
              <RemoteCoHostVideoView coHostUserId={ch.userId} />
              <View style={s.duetLabelBadge} pointerEvents="none">
                <Text style={s.duetLabelText} numberOfLines={1}>@{ch.username}</Text>
              </View>
              {/* v1.22.0: X-Button oben rechts pro Grid-Kachel */}
              <Pressable
                onPress={() => confirmKickTile(ch.userId, ch.username ?? 'Gast')}
                hitSlop={10}
                style={s.tileKickBtn}
              >
                <X size={12} stroke="#fff" strokeWidth={2.8} />
              </Pressable>
            </Pressable>
          );
        })}

      {/* BattleBar — liegt über dem Split-Screen in der Mitte */}
      {isBattleActive && <BattleBar state={battleState} />}

      {/* PiP-Modus: kleines Co-Host-Fenster über dem Vollbild */}
      {activeCoHostId && activeLayout === 'pip' && (
        <PiPWindow
          trackRef={null}
          LocalView={StableRemoteCoHostView}
          label="GAST"
        />
      )}

      {/* HD-Badge — subtil oben links */}
      <View style={s.hdBadge} pointerEvents="none">
        <Text style={s.hdBadgeText}>HD</Text>
      </View>

      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.85)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Floating Reaktionen (von Zuschauern) */}
      <View style={s.reactionsLayer} pointerEvents="none">
        {reactions.map((r) => (
          <ReactionBubble key={r.id} reaction={r} />
        ))}
      </View>

      {/* Tap-Herzen — erscheinen genau am Tipp-Punkt */}
      {tapHearts.map((th) => (
        <TapHeartBurst
          key={th.id}
          tapHeart={th}
          onDone={(id) => setTapHearts((prev) => prev.filter((h) => h.id !== id))}
        />
      ))}

      {/* Geschenk-Animationen — erscheinen DIREKT ÜBER den Kommentaren */}
      {/* pillsBottomOffset = insets.bottom + 56 (inputBar) + 280 (commentsArea) */}
      <GiftAnimation
        gifts={incomingGifts}
        pillsBottomOffset={insets.bottom + 56 + 280}
      />

      {/* 🛍 Sold-Banner — wenn jemand Live-Produkt kauft */}
      {soldEvents.length > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 56 + 285, zIndex: 30 }}>
          <ProductSoldBanner events={soldEvents} />
        </View>
      )}

      {/* 🛍 Live-Shop Host Panel */}
      <LiveShopHostPanel
        visible={shopPanelVisible}
        onClose={() => setShopPanelVisible(false)}
        pinnedProductId={shopPinnedProduct?.productId ?? null}
        onPin={pinProduct}
        onUnpin={unpinProduct}
      />

      {/* Gesamter Screen: Tap → Herz am Tap-Ort.
          v1.22.1 Fix: KEIN zIndex mehr — sonst swallowt dieser Pressable alle
          Pan-/Long-Press-Gesten der darüber liegenden Draggable-Overlays
          (Poll, Sticker, Produkt-Pin). Natürliche DOM-Reihenfolge reicht aus:
          alles danach (topBar/action-row/overlays) ist automatisch darüber. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPressIn={(evt) => handleScreenTap(evt.nativeEvent.locationX, evt.nativeEvent.locationY)}
      />


      {/* Flex-Container: füllt den Rest, drückt Input nach oben wenn Tastatur offen.
          v1.22.1: zIndex: 2, damit diese ganze UI-Ebene über dem Tap-Herzen-
          Pressable-Sibling liegt — sonst blockt dieser alle Gesten der
          Draggable-Overlays in diesem Container.
          pointerEvents="box-none": der Container selbst fängt keine Taps,
          aber seine Kinder (topBar, Overlays, Input …) bleiben interaktiv.
          Empty-Area-Taps fallen durch zum Tap-Herzen-Pressable darunter. */}
      <View style={{ flex: 1, zIndex: 2 }} pointerEvents="box-none">
        {/* Oben — TikTok-Style (v1.22.0): Avatar + @Nick + ❤️ | LIVE-Pill | Gäste + Viewer + X */}
        <View style={[s.topBar, { paddingTop: insets.top + 2 }]}>
          <View style={s.hostInfoLeft}>
            <View style={s.avatarRing}>
              {session?.profiles?.avatar_url ? (
                <Image
                  source={{ uri: session.profiles.avatar_url }}
                  style={s.hostAvatarLg}
                  contentFit="cover"
                />
              ) : (
                <View style={[s.hostAvatarLg, s.hostAvatarLgFallback]}>
                  <Text style={s.hostInitialLg}>
                    {(session?.profiles?.username ?? 'U')[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={s.hostMeta}>
              <Text style={s.hostUsernameLg} numberOfLines={1}>
                @{session?.profiles?.username ?? '...'}
              </Text>
              <View style={s.viewerPillSmall}>
                <Text style={s.viewerPillText}>
                  ❤️ {fmtNum(session?.like_count ?? 0)}
                </Text>
              </View>
            </View>
          </View>

          {/* v1.22.1 — LIVE-Pill entfernt (redundant zur Stream-Kontextualisierung,
              Host weiß dass er live ist; spart TopBar-Platz). */}

          <View style={s.topBarRight}>
            {activeCoHosts.length > 0 && (
              <View style={s.guestAvatarStack} pointerEvents="none">
                {activeCoHosts.slice(0, 3).map((ch, idx) => (
                  <View
                    key={ch.userId}
                    style={[s.guestAvatarMini, idx > 0 && { marginLeft: -8 }]}
                  >
                    {ch.avatarUrl ? (
                      <Image
                        source={{ uri: ch.avatarUrl }}
                        style={s.guestAvatarMiniImg}
                        contentFit="cover"
                      />
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
              <TopGifterBadge compact topGifters={topGifters} allGifters={topGifters} />
            )}
            <Pressable
              onPress={() => setViewersVisible(true)}
              style={s.viewerBadge}
            >
              <Users size={11} stroke="#fff" strokeWidth={2} />
              <Text style={s.viewerCount}>{viewerCount}</Text>
            </Pressable>
            <Pressable onPress={handleEnd} style={s.closeTopBtn} hitSlop={8}>
              <X size={18} stroke="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {/* ── Mic/Cam/Flip Pills — oben LINKS (v1.16.0 UI-Polish)
              Vorher: rechter vertikaler Stack mit 13+ Buttons, verdeckt Grid.
              Jetzt: nur die 3 meistgenutzten Controls hier, Rest unten im
              Action-Row über dem Input. Matcht TikTok/IG Live-UX. */}
        <View style={[s.topLeftControls, { top: insets.top + 60 }]}>
          <HostControls onCameraSwitch={setIsFrontCamera} />
        </View>

        {/* ── Action-Row (v1.22.0 TikTok-Style) — nur 3 Buttons sichtbar ──
              Share, Moderation-Toggle und ein einzelner "+"-Button, der das
              Creator-Tools-Grid-Sheet öffnet. Alle früher sichtbaren 14+
              Buttons wurden ins Sheet verschoben (kontext-sensitiv). Das
              hält den Stream ruhig und ist TikTok-parity.
              Gift-Indicator bleibt sichtbar (Display-Only, kein Button). */}
        <View
          style={[s.bottomActionPos, { bottom: insets.bottom + 56 }]}
          pointerEvents="box-none"
        >
          <View style={s.bottomActionInner}>
          <Pressable onPress={handleShare} style={s.controlBtn} hitSlop={8} accessibilityLabel="Stream teilen">
            <Share2 size={22} stroke="#fff" strokeWidth={2.2} />
          </Pressable>
          {/* Geschenk-Indikator — zeigt Anzahl empfangener Geschenke */}
          {incomingGifts.length > 0 && (
            <View style={[s.controlBtn, { backgroundColor: 'rgba(244,63,94,0.35)' }]}>
              <Gift size={20} stroke="#f43f5e" strokeWidth={2.2} />
            </View>
          )}

          {/* 🛡️ Moderation Toggle — bleibt sichtbar als "An/Aus"-Indikator für Viewer */}
          <Pressable
            style={[
              s.controlBtn,
              moderationEnabled && { backgroundColor: 'rgba(99,102,241,0.45)' },
            ]}
            onPress={toggleModeration}
            onLongPress={addHostWords}
            hitSlop={8}
            accessibilityLabel="Chat-Moderation"
            accessibilityHint="Tippen zum An-/Ausschalten, Gedrückthalten zum Verwalten der gesperrten Wörter"
          >
            {moderationEnabled ? (
              <ShieldCheck size={20} stroke="#a5b4fc" strokeWidth={2.2} />
            ) : (
              <Shield size={20} stroke="#fff" strokeWidth={2.2} />
            )}
            {moderationEnabled && hostWords.length > 0 && (
              <View style={s.moderationBadge}>
                <Text style={s.moderationBadgeText}>{hostWords.length}</Text>
              </View>
            )}
          </Pressable>

          {/* ➕ Creator-Tools-Sheet Opener (TikTok-Style, v1.22.0) — öffnet
              Grid mit Poll, Sticker, Produkt, Goal, Shop, Record, Slow-Mode,
              Followers-only, Co-Host-Controls, Battle-End, Queue-Inbox. */}
          <Pressable
            style={[
              s.controlBtn,
              // Dezenter Akzent-Rand, wenn irgendein aktives Tool läuft
              (activePoll ||
                activeStickers.length > 0 ||
                placedProducts.length > 0 ||
                goal ||
                recActive ||
                shopPinnedProduct ||
                slowModeSeconds > 0 ||
                followersOnlyChat ||
                queueDepth > 0) && {
                backgroundColor: 'rgba(251,191,36,0.25)',
                borderWidth: 1.5,
                borderColor: 'rgba(251,191,36,0.55)',
              },
            ]}
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Light);
              setCreatorToolsVisible(true);
            }}
            hitSlop={8}
            accessibilityLabel="Creator Tools öffnen"
            accessibilityHint="Öffnet das Grid mit allen Live-Werkzeugen"
          >
            <Plus size={22} stroke="#fff" strokeWidth={2.4} />
            {queueDepth > 0 && (
              <View style={s.moderationBadge}>
                <Text style={s.moderationBadgeText}>{queueDepth}</Text>
              </View>
            )}
          </Pressable>
          </View>
        </View>

        {/* ── Entfernt (v1.22.0): Alle früheren einzelnen Tool-Buttons sind
              jetzt im CreatorToolsSheet. Der alte Code-Block bleibt vorerst
              kommentiert — siehe Git-History wenn Rollback nötig. */}
        {false && (<>
          {/* 📥 Queue-Badge — zeigt Anzahl wartender Co-Host-Requests (Phase 2) */}
          {queueDepth > 0 && (
            <Pressable
              style={[s.controlBtn, { backgroundColor: 'rgba(59,130,246,0.45)' }]}
              onPress={showQueuePicker}
              hitSlop={8}
              accessibilityLabel={`Co-Host Warteschlange: ${queueDepth} Anfragen`}
            >
              <Inbox size={20} stroke="#fff" strokeWidth={2.2} />
              <View style={s.moderationBadge}>
                <Text style={s.moderationBadgeText}>{queueDepth}</Text>
              </View>
            </Pressable>
          )}

          {/* 🎛️ Layout wechseln — nur wenn Co-Host aktiv (Phase 1.1) */}
          {activeCoHostId && (
            <Pressable
              style={[s.controlBtn, { backgroundColor: 'rgba(99,102,241,0.45)' }]}
              onPress={showLayoutSwitcher}
              hitSlop={8}
              accessibilityLabel="Duet-Layout wechseln"
              accessibilityHint="Öffnet die Auswahl zwischen Top/Bottom, Side-by-Side, PiP und Battle"
            >
              <LayoutGrid size={20} stroke="#a5b4fc" strokeWidth={2.2} />
            </Pressable>
          )}

          {/* 🔇 Co-Host Mikro muten/unmuten — nur wenn Co-Host aktiv (Phase 1.2) */}
          {activeCoHostId && (
            <Pressable
              style={[
                s.controlBtn,
                coHostMutedAudio && { backgroundColor: 'rgba(239,68,68,0.45)' },
              ]}
              onPress={async () => {
                const ok = await muteCoHost({ audio: !coHostMutedAudio });
                if (ok) {
                  sendSystemEvent(
                    coHostMutedAudio
                      ? '🎤 Co-Host Mikrofon entmutet'
                      : '🎤 Co-Host Mikrofon gemutet'
                  );
                }
              }}
              hitSlop={8}
              accessibilityLabel={coHostMutedAudio ? 'Co-Host Mikrofon entmuten' : 'Co-Host Mikrofon muten'}
            >
              {coHostMutedAudio ? (
                <MicOff size={20} stroke="#fca5a5" strokeWidth={2.2} />
              ) : (
                <Mic size={20} stroke="#fff" strokeWidth={2.2} />
              )}
            </Pressable>
          )}

          {/* 📷 Co-Host Kamera muten/unmuten — nur wenn Co-Host aktiv (Phase 1.2) */}
          {activeCoHostId && (
            <Pressable
              style={[
                s.controlBtn,
                coHostMutedVideo && { backgroundColor: 'rgba(239,68,68,0.45)' },
              ]}
              onPress={async () => {
                const ok = await muteCoHost({ video: !coHostMutedVideo });
                if (ok) {
                  sendSystemEvent(
                    coHostMutedVideo
                      ? '📷 Co-Host Kamera entmutet'
                      : '📷 Co-Host Kamera gemutet'
                  );
                }
              }}
              hitSlop={8}
              accessibilityLabel={coHostMutedVideo ? 'Co-Host Kamera entmuten' : 'Co-Host Kamera muten'}
            >
              {coHostMutedVideo ? (
                <CameraOff size={20} stroke="#fca5a5" strokeWidth={2.2} />
              ) : (
                <Camera size={20} stroke="#fff" strokeWidth={2.2} />
              )}
            </Pressable>
          )}

          {/* ⚡ Battle vorzeitig beenden — nur während aktivem Battle (Phase 4) */}
          {isBattleActive && !battleState.ended && (
            <Pressable
              style={[s.controlBtn, { backgroundColor: 'rgba(250,204,21,0.45)' }]}
              onPress={() => {
                Alert.alert(
                  '⚡ Battle beenden?',
                  'Der Gewinner wird sofort ermittelt. Der Countdown wird übersprungen.',
                  [
                    { text: 'Abbrechen', style: 'cancel' },
                    {
                      text: 'Battle beenden',
                      style: 'destructive',
                      onPress: () => {
                        endBattle();
                        sendSystemEvent('⚡ Battle vorzeitig beendet');
                      },
                    },
                  ],
                );
              }}
              hitSlop={8}
              accessibilityLabel="Battle vorzeitig beenden"
            >
              <Zap size={20} stroke="#fde047" strokeWidth={2.2} />
            </Pressable>
          )}

          {/* 🎥 Duet beenden (Tap) / 🚫 Kicken mit Grund (Long-Press, Phase 1.3) */}
          {activeCoHostId && (
            <Pressable
              style={[s.controlBtn, { backgroundColor: 'rgba(239,68,68,0.45)' }]}
              onPress={() => {
                endCoHostWithRevoke();
                sendSystemEvent('🎥 Duet beendet');
              }}
              onLongPress={showKickDialog}
              hitSlop={8}
              accessibilityLabel="Duet beenden"
              accessibilityHint="Tippen zum Beenden, Gedrückthalten zum Entfernen mit Grund"
            >
              <Video size={20} stroke="#fca5a5" strokeWidth={2.2} />
              <View style={s.moderationBadge}>
                <Text style={s.moderationBadgeText}>✕</Text>
              </View>
            </Pressable>
          )}

          {/* 🛡️ Moderation Toggle */}
          <Pressable
            style={[
              s.controlBtn,
              moderationEnabled && { backgroundColor: 'rgba(99,102,241,0.45)' },
            ]}
            onPress={toggleModeration}
            onLongPress={addHostWords}
            hitSlop={8}
            accessibilityLabel="Chat-Moderation"
            accessibilityHint="Tippen zum An-/Ausschalten, Gedrückthalten zum Verwalten der gesperrten Wörter"
          >
            {moderationEnabled ? (
              <ShieldCheck size={20} stroke="#a5b4fc" strokeWidth={2.2} />
            ) : (
              <Shield size={20} stroke="#fff" strokeWidth={2.2} />
            )}
            {moderationEnabled && hostWords.length > 0 && (
              <View style={s.moderationBadge}>
                <Text style={s.moderationBadgeText}>{hostWords.length}</Text>
              </View>
            )}
          </Pressable>

          {/* ⏱️ Slow-Mode Toggle (Phase 6) */}
          <Pressable
            style={[
              s.controlBtn,
              slowModeSeconds > 0 && { backgroundColor: 'rgba(249,115,22,0.45)' },
            ]}
            onPress={showSlowModeMenu}
            hitSlop={8}
            accessibilityLabel="Slow-Mode"
            accessibilityHint="Tippen zum Einstellen des Cool-Downs zwischen Messages"
          >
            <Timer size={20} stroke={slowModeSeconds > 0 ? '#fdba74' : '#fff'} strokeWidth={2.2} />
            {slowModeSeconds > 0 && (
              <View style={s.moderationBadge}>
                <Text style={s.moderationBadgeText}>{slowModeSeconds}s</Text>
              </View>
            )}
          </Pressable>

          {/* 👥 Nur-Follower-Chat Toggle */}
          <Pressable
            style={[
              s.controlBtn,
              followersOnlyChat && { backgroundColor: 'rgba(34,197,94,0.35)' },
            ]}
            onPress={handleFollowersOnlyToggle}
            hitSlop={8}
            accessibilityLabel="Nur-Follower-Chat"
            accessibilityHint="Schaltet ein ob nur Follower kommentieren dürfen"
          >
            <Users
              size={20}
              stroke={followersOnlyChat ? '#4ade80' : '#fff'}
              strokeWidth={2.2}
            />
          </Pressable>

          {/* 🎯 Goal Button */}
          <Pressable
            style={[
              s.controlBtn,
              goal?.reached === false && { backgroundColor: 'rgba(245,158,11,0.35)' },
              goal?.reached === true && { backgroundColor: 'rgba(34,197,94,0.35)' },
            ]}
            onPress={setupGoal}
            hitSlop={8}
            accessibilityLabel="LIVE Ziel setzen"
          >
            <Target
              size={20}
              stroke={goal?.reached ? '#4ade80' : goal ? '#fbbf24' : '#fff'}
              strokeWidth={2.2}
            />
          </Pressable>

          {/* 📊 Poll Button (v1.18.0) */}
          <Pressable
            style={[
              s.controlBtn,
              activePoll && { backgroundColor: 'rgba(139,92,246,0.35)' },
            ]}
            onPress={() => { impactAsync(ImpactFeedbackStyle.Light); setPollSheetVisible(true); }}
            hitSlop={8}
            accessibilityLabel="Umfrage starten"
          >
            <BarChart3
              size={20}
              stroke={activePoll ? '#a78bfa' : '#fff'}
              strokeWidth={2.2}
            />
          </Pressable>

          {/* 😀 Sticker Button (v1.22.0) */}
          <Pressable
            style={[
              s.controlBtn,
              activeStickers.length > 0 && { backgroundColor: 'rgba(251,191,36,0.35)' },
            ]}
            onPress={() => { impactAsync(ImpactFeedbackStyle.Light); setStickerPickerVisible(true); }}
            hitSlop={8}
            accessibilityLabel="Sticker platzieren"
            accessibilityHint="Öffnet Sticker-Auswahl — Emoji frei im Stream platzieren"
          >
            <Smile
              size={20}
              stroke={activeStickers.length > 0 ? '#fbbf24' : '#fff'}
              strokeWidth={2.2}
            />
          </Pressable>

          {/* 🏷 Produkt-Pin Button (v1.22.0) */}
          <Pressable
            style={[
              s.controlBtn,
              placedProducts.length > 0 && { backgroundColor: 'rgba(34,197,94,0.35)' },
            ]}
            onPress={() => { impactAsync(ImpactFeedbackStyle.Light); setProductPlaceSheetVisible(true); }}
            hitSlop={8}
            accessibilityLabel="Produkt platzieren"
            accessibilityHint="Platziert Shop-Produkte frei als Karten im Stream"
          >
            <Tag
              size={20}
              stroke={placedProducts.length > 0 ? '#34d399' : '#fff'}
              strokeWidth={2.2}
            />
          </Pressable>

          {/* ⏺ Record Button (v1.18.0) — Live-Replay Egress */}
          <Pressable
            style={[
              s.controlBtn,
              recActive && { backgroundColor: 'rgba(239,68,68,0.35)' },
            ]}
            onPress={handleToggleRecording}
            hitSlop={8}
            disabled={recStarting || recStopping}
            accessibilityLabel={recActive ? 'Aufnahme stoppen' : 'Aufnahme starten'}
          >
            <Circle
              size={20}
              stroke={recActive ? '#ef4444' : '#fff'}
              fill={recActive ? '#ef4444' : 'transparent'}
              strokeWidth={2.2}
            />
          </Pressable>

          {/* 🛍 Shop-Pin Button */}
          <Pressable
            style={[
              s.controlBtn,
              shopPinnedProduct && { backgroundColor: 'rgba(34,197,94,0.35)' },
            ]}
            onPress={() => { impactAsync(ImpactFeedbackStyle.Light); setShopPanelVisible(true); }}
            hitSlop={8}
            accessibilityLabel="Produkt pinnen"
          >
            <ShoppingBag
              size={20}
              stroke={shopPinnedProduct ? '#4ade80' : '#fff'}
              strokeWidth={2.2}
            />
          </Pressable>
        </>)}

        {/* Spacer: drückt Kommentare + Input nach unten */}
        <View style={{ flex: 1 }} />

        {/* 🏆 Top Gifter Badge — v1.22.1: verschoben nach oben rechts in
            die TopBar (TikTok-parity). Alter bottom-left Block entfernt. */}

        {/* Gepinnter Kommentar — sichtbar für alle über dem Feed */}
        {pinnedComment && !(pinnedComment as any).isSystem && (
          <Pressable
            style={s.pinnedBanner}
            onPress={() => pinComment(null)}
          >
            <Text style={s.pinnedLabel}>📌 Angepinnt</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.pinnedUser}>@{pinnedComment.profiles?.username ?? 'User'}</Text>
              <Text style={s.pinnedText} numberOfLines={2}>{pinnedComment.text}</Text>
            </View>
            <Text style={s.pinnedUnpin}>✕</Text>
          </Pressable>
        )}

        {/* 🎯 LIVE Goal Bar */}
        {goal && (
          <LiveGoalBar goal={goal} justReached={justReached} />
        )}

        {/* ── Draggable Overlay-Layer (v1.22.1 Fix) ──────────────────────────
            WICHTIG: Dieser Container muss einen höheren zIndex als der
            Tap-Herzen-Pressable (zIndex: 1, absoluteFill) haben, sonst
            swallowt dieser alle Pan-/Long-Press-Gestures von Poll, Sticker
            und Produkt-Pins. `pointerEvents="box-none"` sorgt dafür, dass
            leere Bereiche weiterhin den Tap-Herz-Handler erreichen. */}
        <View
          style={[StyleSheet.absoluteFillObject, { zIndex: 15 }]}
          pointerEvents="box-none"
        >
          {/* 📊 Live-Poll Overlay (v1.18.0) — Host sieht direkt die Ergebnisse
              v1.22.0: frei verschiebbar, Position wird zu allen Viewern broadcastet */}
          {activePoll && sessionId && (
            <LivePollOverlay
              poll={activePoll}
              myVote={pollMyVote}
              onVote={pollVote}
              isVoting={pollIsVoting}
              isHost
              onClose={handleClosePoll}
              draggable
              onPositionChange={broadcastPollPosition}
              storageKey={`poll-${hostUserId ?? 'host'}`}
            />
          )}

          {/* 😀 Live-Sticker Layer (v1.22.0) — Host platziert Emojis frei */}
          <LiveStickerLayer
            sessionId={sessionId}
            stickers={activeStickers}
            isHost
            onMove={handleMoveSticker}
            onRemove={handleRemoveSticker}
          />

          {/* 🏷 Live-Placed-Products Layer (v1.22.0) — Host platziert Shop-Produkte frei */}
          <LivePlacedProductLayer
            sessionId={sessionId}
            products={placedProducts}
            isHost
            onMove={handleMovePlacedProduct}
            onUnpin={handleUnpinPlacedProduct}
          />
        </View>

        {/* Poll-Start-Sheet */}
        {sessionId && (
          <LivePollStartSheet
            visible={pollSheetVisible}
            onClose={() => setPollSheetVisible(false)}
            sessionId={sessionId}
          />
        )}

        {/* Sticker-Picker Modal */}
        <StickerPicker
          visible={stickerPickerVisible}
          onClose={() => setStickerPickerVisible(false)}
          onPick={handlePickSticker}
        />

        {/* Produkt-Place-Sheet */}
        <ProductPlaceSheet
          visible={productPlaceSheetVisible}
          onClose={() => setProductPlaceSheetVisible(false)}
          onPick={handlePlaceProduct}
          alreadyPlacedIds={alreadyPlacedProductIds}
        />

        {/* ➕ Creator-Tools-Sheet (v1.22.0) — TikTok-Style Grid mit allen
            Host-Werkzeugen. Ersetzt die frühere 14-Button-Scroll-Leiste. */}
        <CreatorToolsSheet
          visible={creatorToolsVisible}
          onClose={() => setCreatorToolsVisible(false)}
          tools={creatorTools}
        />

        {/* Kommentare */}
        <View style={[s.commentsArea]}>
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
              const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;
              if (isAtBottom) setUserScrolling(false);
            }}
            onMomentumScrollEnd={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 20;
              if (isAtBottom) setUserScrolling(false);
            }}
          />
        </View>

        {/* v1.24 — Welcome-Toast: schwebt über dem Chat, zeigt Follower/Top-Fan
            Joins. Host sieht damit ohne Chat-Scroll, wer gerade reinkommt. */}
        <WelcomeToast welcomes={joinWelcomes} bottomOffset={insets.bottom + 85} />

        {/* Kommentar-Eingabe */}
        <View style={[s.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={s.input}
            placeholder="Als Host kommentieren …"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={input}
            onChangeText={(t) => { setInput(t); if (t.length > 0) setShowEmojiPicker(false); }}
            onSubmitEditing={submit}
            returnKeyType="send"
            selectionColor="#FFFFFF"
            maxLength={300}
          />
          {input.trim().length > 0 ? (
            <Pressable onPress={submit} hitSlop={8} style={s.sendBtn}>
              <Send size={18} stroke="#FFFFFF" strokeWidth={2.2} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowEmojiPicker((v) => !v)}
              hitSlop={8}
              style={s.sendBtn}
            >
              <Text style={{ fontSize: 20 }}>{showEmojiPicker ? '🚫' : '😊'}</Text>
            </Pressable>
          )}
        </View>

        {/* Emoji-Picker Zeile — erscheint über dem Input wenn geöffnet */}
        {showEmojiPicker && input.trim().length === 0 && (
          <View style={[s.emojiPickerRow, { bottom: insets.bottom + 64 }]}>
            {EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  sendReaction(emoji);
                  setShowEmojiPicker(false);
                }}
                style={s.bottomEmojiBtn}
              >
                <LiveReactionIcon emoji={emoji} size={28} />
              </Pressable>
            ))}
          </View>
        )}

      </View>

      {/* Share Sheet */}
      <LiveShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        sessionId={sessionId}
        title={title}
      />
      {/* Viewer List Sheet — Host-Variante: keine Self-CTA (kann sich nicht
          selbst beschenken), aber volle ranked Top-Gifter Liste + Follower-
          Badges (welche Zuschauer dem Host folgen). */}
      <ViewerListSheet
        visible={viewersVisible}
        onClose={() => setViewersVisible(false)}
        sessionId={sessionId}
        isHost
        hostId={hostUserId}
        hostName={session?.profiles?.username ?? null}
        onMention={(username) => {
          setViewersVisible(false);
          setInput((prev) => `${prev}@${username} `);
        }}
      />

      {/* TikTok-Style Summary — Full Screen */}
      <Modal visible={showSummary} animationType="slide" statusBarTranslucent>
        <View style={s.summaryScreen}>
          <LinearGradient
            colors={['#0D0D18', '#0f0020', '#0D0D18']}
            style={StyleSheet.absoluteFill}
          />

          {/* Scrollbarer Inhalt */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[s.summaryTopBar, { paddingTop: insets.top + 12 }]}>
              <Text style={s.summaryDate}>
                {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {formatDuration()}
              </Text>
              <Text style={s.summaryHeadline}>LIVE wurde beendet</Text>
            </View>

            <View style={s.summarySeparator} />

            {/* Stats-Karte */}
            <View style={s.summaryStatsCard}>
              <View style={s.summaryStatRow}>
                <View style={s.summaryStatItem}>
                  <Text style={s.summaryStatNum}>{fmtNum(viewerCount + peakViewers > 0 ? peakViewers : 0)}</Text>
                  <Text style={s.summaryStatLabel}>Peak Zuschauer</Text>
                </View>
                <View style={s.summaryStatDivider} />
                <View style={s.summaryStatItem}>
                  <Text style={s.summaryStatNum}>{fmtNum(session?.like_count ?? 0)}</Text>
                  <Text style={s.summaryStatLabel}>Likes ❤️</Text>
                </View>
                <View style={s.summaryStatDivider} />
                <View style={s.summaryStatItem}>
                  <Text style={s.summaryStatNum}>{fmtNum(comments.filter(c => !(c as any).isSystem).length)}</Text>
                  <Text style={s.summaryStatLabel}>Kommentare</Text>
                </View>
                {totalGiftCoins > 0 && (
                  <>
                    <View style={s.summaryStatDivider} />
                    <View style={s.summaryStatItem}>
                      <Text style={s.summaryStatNum}>{fmtNum(totalGiftCoins)}</Text>
                      <Text style={s.summaryStatLabel}>Coins 🪙</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Top-Spender (v1.16.0) ─── zuerst, weil hier der meiste Value liegt */}
            {topGifters.length > 0 && (
              <View style={s.summaryLeaderCard}>
                <Text style={s.summaryLeaderTitle}>💎 Top Spender</Text>
                {topGifters.map((g, idx) => (
                  <View key={g.userId} style={s.summaryLeaderRow}>
                    <Text style={s.summaryLeaderRank}>#{idx + 1}</Text>
                    {g.avatarUrl ? (
                      <Image source={{ uri: g.avatarUrl }} style={s.summaryLeaderAvatar} contentFit="cover" />
                    ) : (
                      <View style={[s.summaryLeaderAvatar, s.summaryLeaderAvatarFallback]}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                          {g.username[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                    )}
                    <Text style={s.summaryLeaderName}>@{g.username}</Text>
                    <Text style={s.summaryLeaderCount}>{fmtNum(g.totalCoins)} 🪙</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Top-Kommentatoren Rangliste — ALLE angezeigt (scrollbar) */}
            {comments.filter(c => !(c as any).isSystem && c.profiles).length > 0 && (
              <View style={s.summaryLeaderCard}>
                <Text style={s.summaryLeaderTitle}>🏆 Top Kommentatoren</Text>
                {Object.entries(
                  comments
                    .filter(c => !(c as any).isSystem && c.profiles?.username)
                    .reduce((acc: Record<string, { username: string; avatar?: string | null; count: number }>, c) => {
                      const uid = c.user_id;
                      if (!acc[uid]) acc[uid] = { username: c.profiles!.username, avatar: c.profiles!.avatar_url, count: 0 };
                      acc[uid].count++;
                      return acc;
                    }, {})
                )
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([uid, info], idx) => (
                  <View key={uid} style={s.summaryLeaderRow}>
                    <Text style={s.summaryLeaderRank}>#{idx + 1}</Text>
                    {info.avatar ? (
                      <Image source={{ uri: info.avatar }} style={s.summaryLeaderAvatar} contentFit="cover" />
                    ) : (
                      <View style={[s.summaryLeaderAvatar, s.summaryLeaderAvatarFallback]}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                          {info.username[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={s.summaryLeaderName}>@{info.username}</Text>
                    <Text style={s.summaryLeaderCount}>{info.count} 💬</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Aktionen — immer unten sichtbar */}
          <View style={[s.summaryActionsWrap, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable style={s.summaryActionPrimary} onPress={handlePostAsVideo}>
              <Text style={s.summaryActionPrimaryText}>📤 Als Video posten</Text>
            </Pressable>
            <Pressable style={s.summaryActionSecondary} onPress={handleSaveReplay}>
              <Text style={s.summaryActionSecondaryText}>💾 Replay Info</Text>
            </Pressable>
            <Pressable onPress={confirmEnd} style={s.summaryDoneBtn}>
              <Text style={s.summaryDoneBtnText}>Fertig</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {/* TikTok-Style User Info Sheet — mit Duett-Invite-Button (Host-Modus) */}
      <LiveUserSheet
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onMention={(username) => {
          setInput((prev) => `${prev}@${username} `);
          setSelectedUserId(null);
        }}
        duetInviteSessionId={sessionId}
        /* v1.22.3 — Host kann aus dem Chat-Tap-Sheet direkt Moderatoren ernennen */
        moderatorSessionId={sessionId}
      />

      {/* v1.19: Eingehende viewer-to-host Duett-Anfragen */}
      <DuettInviteModal
        invite={duetInbox.topInvite}
        onAccept={duetInbox.acceptInvite}
        onDecline={duetInbox.declineInvite}
        onDismiss={() => { /* Auto-Dismiss via useDuettInbox */ }}
        isResponding={duetInbox.isResponding}
        onAccepted={({ invite, guestId, layout }) => {
          // Viewer-to-host Accept: Co-Host Broadcast + Host-UI State öffnen,
          // damit der anfragende User als aktiver Co-Host erscheint.
          if (invite.direction === 'viewer-to-host') {
            void acceptCoHost(
              guestId,
              layout,
              invite.battleDuration ?? 60,
            );
          }
        }}
      />

      {/* v1.22.2: TikTok-Style Co-Host Request-Sheet (ersetzt altes iOS Alert.alert) */}
      <CoHostRequestSheet
        visible={showCoHostRequestSheet}
        username={pendingRequest?.username ?? null}
        avatarUrl={pendingRequest?.avatarUrl ?? null}
        onAccept={handleRequestAccept}
        onDecline={handleRequestDecline}
        onDismiss={handleRequestDismiss}
      />
    </KeyboardAvoidingView>
  );
}


export default function LiveHostScreen() {
  const { sessionId, title, lkToken, lkUrl } = useLocalSearchParams<{
    sessionId: string;
    title?: string;
    lkToken: string;
    lkUrl: string;
  }>();
  const router = useRouter();
  const { endSession } = useLiveHost();
  const [lkError, setLkError] = useState<string | null>(null);

  // Room einmalig erstellen — stabile Referenz über gesamten Lebenszyklus.
  // KEIN useLiveKitRoom-Wrapper, der bei Re-Renders disconnectet.
  const [room] = useState(
    () => new Room({
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,          // Deaktiviert Tracks wenn kein Zuschauer → spart CPU/Bandwidth
      publishDefaults: {
        // ── Simulcast: 3 Qualitätsstufen, SFU wählt je nach Viewer-Bandbreite ──
        videoSimulcastLayers: [
          new VideoPreset(360,  640,   300_000, 15),  // 360p / 300kbps / 15fps
          new VideoPreset(540,  960,   800_000, 25),  // 540p / 800kbps / 25fps
          new VideoPreset(720, 1280, 2_000_000, 30),  // 720p / 2Mbps   / 30fps
        ],
        // ── Maximale Encoding-Qualität für den Host-Track ──
        videoEncoding: {
          maxBitrate:   2_000_000,   // 2 Mbps → klares 720p auf starkem Netz
          maxFramerate: 30,
        },
        // ── Audio: klangliche Qualität für Sprache ──
        audioPreset: {
          maxBitrate: 32_000,   // 32 kbps, gut für Sprache
        },
      },
    })
  );

  // Portrait-Lock für den gesamten Live-Screen
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
    return () => { ScreenOrientation.unlockAsync().catch(() => { }); };
  }, []);

  // EINMALIGER useEffect (leere Deps) — verbindet, aktiviert Tracks, räumt auf.
  useEffect(() => {
    if (!lkUrl || !lkToken) return;

    let canceled = false;
    // ⚠️ Unhandled-Rejection-Fix: startAudioSession() kann auf iOS rejecten
    // (z.B. wenn eine andere App gerade die Audio-Session hält). Ohne .catch()
    // wurde das als globaler Error hochgereicht → App-Crash beim Navigieren.
    //
    // ⚠️ v1.22.1 FIX (Audio bricht ab wenn Co-Host joint):
    // Vorher rief der Host nur startAudioSession() ohne setAppleAudioConfiguration.
    // iOS nimmt dann Default-Kategorie ohne 'defaultToSpeaker' — Output routet
    // zur Hörmuschel. Sobald ein zweiter Publisher (Co-Host) dem Room joined,
    // verhandelt iOS die AVAudioSession neu, und ohne explizites defaultToSpeaker
    // fällt die Route weiter aufs earpiece → Host hört den Co-Host kaum, Co-Host
    // hört Host kaum, Viewer-Seite hört Co-Host nicht. Fix: Kategorie + Route
    // explizit auf playAndRecord + defaultToSpeaker + videoChat festnageln.
    const applyHostAudioConfig = () => {
      if (Platform.OS !== 'ios') return;
      try {
        AudioSession?.setAppleAudioConfiguration?.({
          audioCategory: 'playAndRecord',
          audioCategoryOptions: ['allowBluetooth', 'allowBluetoothA2DP', 'allowAirPlay', 'defaultToSpeaker'],
          audioMode: 'videoChat',
        })?.catch?.(() => {});
      } catch { /* native-Modul fehlt (Expo Go) → ignorieren */ }
    };
    try {
      AudioSession?.startAudioSession?.()?.catch?.(() => {});
    } catch { /* native-Modul fehlt (Expo Go) → ignorieren */ }
    applyHostAudioConfig();

    // ⚠️ v1.22.1 FIX: Bei jedem neuen Publisher-Joint (Co-Host) die iOS-
    // AudioSession-Kategorie erneut festnageln. iOS verhandelt AVAudioSession
    // neu sobald ein zweiter Publisher im Room aktiv ist — ohne re-apply
    // fällt defaultToSpeaker weg und Audio routet zum earpiece.
    const onParticipantConnected = (_p: Participant) => {
      __DEV__ && console.log('[LiveHost] Participant joined → re-apply audio config');
      applyHostAudioConfig();
      // Safety: Mic-State nochmal sicherstellen (idempotent).
      if (room.localParticipant) {
        room.localParticipant.setMicrophoneEnabled(true).catch(() => {});
      }
    };
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);

    (async () => {
      try {
        await room.connect(lkUrl, lkToken);
        if (canceled) {
          room.disconnect();
          return;
        }

        // expo-camera freisetzen: 2500 ms nach connect warten
        await new Promise<void>((r) => setTimeout(r, 2500));
        if (canceled) return;

        // Mikro/Kamera aktivieren — Fehler nur loggen, kein Error-Screen
        // (Benutzer kann über Buttons retriggen)
        if (room.localParticipant) {
          await room.localParticipant
            .setMicrophoneEnabled(true)
            .catch((e: unknown) => {
              __DEV__ && console.warn(
                "[LiveHost] Mikrofonaktivierung fehlgeschlagen:",
                String(e),
              );
            });
        }

        // Kamera mit explizitem facingMode um Device-Enumeration-Bug zu umgehen
        const enableCamera = async () => {
          if (!room.localParticipant) return;
        await room.localParticipant.setCameraEnabled(true, {
            facingMode: "user",
            resolution: {
              width: 720,
              height: 1280,
              frameRate: 30,         // ← 30fps (vorher: 25fps)
              aspectRatio: 1280 / 720,
            },
          });
        };

        await enableCamera().catch(async (e: unknown) => {
          __DEV__ && console.warn(
            "[LiveHost] Kamera fehlgeschlagen (1. Versuch):",
            String(e),
          );
          // Retry nach 3s — gibt iOS mehr Zeit die Kamera freizugeben
          await new Promise<void>((r) => setTimeout(r, 3000));
          if (canceled) return;
          await enableCamera().catch((e2: unknown) => {
            __DEV__ && console.warn(
              "[LiveHost] Kamera fehlgeschlagen (2. Versuch):",
              String(e2),
            );
          });
        });
      } catch (e: unknown) {
        // Nur Room.connect()-Fehler zeigen Fehlerscreen
        if (!canceled) {
          const msg = e instanceof Error ? e.message : String(e);
          setLkError(`${msg} | URL: ${lkUrl.slice(0, 30)}`);
        }
      }
    })();

    return () => {
      canceled = true;
      // v1.22.1: Listener explizit deregistrieren.
      try { room.off(RoomEvent.ParticipantConnected, onParticipantConnected); } catch {}
      // ⚠️ Unhandled-Rejection-Fix: stopAudioSession() rejected auf iOS 16 regelmäßig
      // mit "Error deactivating audio session: Session deactivation failed" —
      // das passiert wenn RTCAudioSession.setActive(false) feuert während noch
      // LiveKit-Tracks angehängt sind. Ohne .catch() crashte der nächste Screen
      // (Viewer-Watch) mit dem "Ups, etwas ist schiefgelaufen"-Error-Boundary.
      try {
        AudioSession?.stopAudioSession?.()?.catch?.(() => {});
      } catch { /* native-Modul fehlt (Expo Go) → ignorieren */ }
      room.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← ABSICHTLICH LEER: läuft nur einmal!

  const handleEnd = () => {
    Alert.alert("Live beenden", "Dein Live wird für alle Zuschauer beendet.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Beenden",
        style: "destructive",
        onPress: async () => {
          await endSession(sessionId);
          router.replace("/(tabs)");
        },
      },
    ]);
  };

  if (Constants.appOwnership === "expo") {
    return <ExpoGoPlaceholder onBack={() => router.replace("/(tabs)")} icon="🎥" />;
  }

  if (!lkToken || !lkUrl || !sessionId) {
    return (
      <View
        style={[s.root, { alignItems: "center", justifyContent: "center" }]}
      >
        <Text style={{ color: "#fff" }}>Verbindungsdaten fehlen</Text>
      </View>
    );
  }

  if (lkError) {
    return (
      <View
        style={[
          s.root,
          {
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
          },
        ]}
      >
        <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "700" }}>
          Verbindungsfehler
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {lkError}
        </Text>
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={{
            backgroundColor: "#CCCCCC",
            borderRadius: 14,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  return (
    // RoomContext.Provider direkt — alle @livekit/react-native Hooks (useLocalParticipant etc.) lesen hieraus.
    <RoomContext.Provider value={room}>
      <View style={s.root}>
        <HostUI sessionId={sessionId} title={title} onEnd={handleEnd} />
      </View>
    </RoomContext.Provider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // ── Duet / Co-Host Split-Screen (Fix #4) ──────────────────
  // Label-Badge für "HOST" / "GAST" im Duet-Modus
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
  // v1.22.0: X-Button oben rechts pro Co-Host-Kachel (Host-only).
  // Klein aber gut tappable (hitSlop 10). Zurückhaltender Look: schwarz-
  // transparent mit rotem Tint — TikTok-parity.
  tileKickBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  // Trennlinien am Rand der Remote-Hälfte
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

  reactionsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingBottom: 120,
    zIndex: 5,
    pointerEvents: "none",
  } as any,
  reactionBubble: {
    position: "absolute",
    bottom: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: { fontSize: 26 },
  floatingHeartWrap: {
    position: 'absolute',
    bottom: 80,
    zIndex: 6,
  },

  topBar: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 20,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    // backgroundColor entfernt — wird durch LinearGradient-Wrapper gesetzt.
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    // dezenter Glow (matcht dem Pink-Gradient)
    shadowColor: "#FF2E63",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#fff" },
  liveLabel: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  titleText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "600" },
  viewerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  viewerCount: { color: "#fff", fontSize: 13, fontWeight: "700" },
  endBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(239,68,68,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Host TopBar (v1.22.0 TikTok-Style) ──
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
  closeTopBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // LEGACY: früher rechter vertikaler Stack. Bleibt als leere Referenz
  // falls noch irgendwo referenziert — jetzt durch topLeftControls + bottomActionPos ersetzt.
  controlsPos: { position: "absolute", right: 14, zIndex: 20 },
  // v1.16.0: flexDirection 'row' damit Mic/Cam/Flip horizontal nebeneinander liegen (oben links).
  controls: { flexDirection: 'row', gap: 8 },
  // Oben links — nur Mic/Cam/Flip-Pills (v1.16.0 UI-Polish)
  topLeftControls: { position: "absolute", left: 14, zIndex: 20, flexDirection: 'row', gap: 8 },
  // Horizontal scrollbare Action-Row direkt über dem Chat-Input
  // Absolut positioniert mit `bottom` inline gesetzt (abhängig von safe-area insets).
  bottomActionPos: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bottomActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 10,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnOff: { backgroundColor: "rgba(239,68,68,0.25)" },

  /** Kleines Badge auf dem Shield-Button zeigt Anzahl der Host-eigenen Wörter */
  moderationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moderationBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },

  /**  Leaderboard Badge — links, über dem Chat-Bereich  */
  topGifterPos: {
    position: 'absolute',
    left: 12,
    bottom: 120,     // über dem Input-Bereich
    zIndex: 18,
  },

  emojiRow: {
    position: "absolute",
    right: 14,
    gap: 8,
    zIndex: 15,
  },
  emojiBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: { fontSize: 22 },

  commentsArea: {
    left: 0,
    right: 0,
    maxHeight: 280,
    // v1.16.0 UI-Polish: marginBottom reserviert die Höhe der absolut
    // positionierten Action-Row (bottomActionPos) — so überdeckt der Button-
    // Overlay nicht die letzten Chat-Messages.
    marginBottom: 52,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  // ── TikTok Comment Style: Avatar links, Name oben, Text darunter ──
  commentRow: {
    marginBottom: 10,
    alignSelf: 'flex-start',
    maxWidth: '82%',
  },
  commentInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',   // Avatar oben ausrichten
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
  // Vertikaler Stack: Name + Kommentar
  commentStack: {
    flexShrink: 1,
    flexDirection: 'column',
    gap: 1,
  },
  commentPill: {}, // leer, nur für Rückwärtskompatibilität
  commentTextWrap: {},
  commentUser: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  /* v1.23 — Chat-Row Badges */
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
  commentBadgeHost:   { backgroundColor: 'rgba(244,63,94,0.9)' },   // Pink/Red — Host
  commentBadgeMod:    { backgroundColor: 'rgba(59,130,246,0.9)' },  // Blue    — Mod
  commentBadgeGifter: { backgroundColor: 'rgba(250,204,21,0.9)' },  // Gold    — Top Gifter
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

  emojiPickerRow: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(20,20,30,0.92)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 10,
    zIndex: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 20,
  },

  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: '#fff',
    fontSize: 14,
  },
  sendBtn: { padding: 4, flexShrink: 0 },
  bottomEmojiBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bottomEmojiText: { fontSize: 18 },

  // ── Live-End Summary ──
  summaryScreen: {
    flex: 1,
    backgroundColor: '#0D0D18',
  },
  summaryTopBar: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  summaryDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  summaryHeadline: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  summarySeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  summaryStatsCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 14,
  },
  summaryStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryStatItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  summaryStatNum: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  summaryStatLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  summaryLeaderCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
    marginBottom: 14,
  },
  summaryLeaderTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryLeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryLeaderRank: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '700',
    width: 22,
  },
  summaryLeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  summaryLeaderAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLeaderName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryLeaderCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  summaryActionsWrap: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 32,
  },
  summaryActionPrimary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  summaryActionPrimaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  summaryActionSecondary: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryActionSecondaryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  summaryDoneBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  summaryDoneBtnText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    fontWeight: '600',
  },
  // Legacy styles (unused but kept for type safety)
  summaryBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  summaryCard: { backgroundColor: '#0f0f1a', borderRadius: 24, padding: 24, width: '100%', gap: 16 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  summaryDuration: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', width: '100%' },
  summaryActions: { gap: 10, width: '100%' },
  summaryActionBtn: { paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', minHeight: 48 },
  summaryActionBtnDone: { backgroundColor: 'rgba(255,255,255,0.08)' },
  summaryActionText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600' },
  summaryActionTextDone: { color: '#FFFFFF' },
  summaryBtnEnd: { paddingVertical: 14, alignItems: 'center' },
  summaryBtnEndText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: '600' },
  // Legacy (wird noch genutzt):
  summaryBtn: {
    backgroundColor: "#CCCCCC",
    borderRadius: 14,
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  summaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Pinned Comment Banner
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFFFFF',
    borderRadius: 10,
    marginHorizontal: 8,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  pinnedLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginRight: 4 },
  pinnedUser: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  pinnedText: { color: '#fff', fontSize: 12 },
  pinnedUnpin: { color: 'rgba(255,255,255,0.5)', fontSize: 16, paddingLeft: 4 },

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
    top: 0,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 5,
  },
  hdBadgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});

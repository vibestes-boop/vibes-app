/**
 * live/host.tsx
 * Host-Ansicht während eines Live-Streams.
 * - LiveKit: echtes Video-Streaming (braucht Dev-Build: npx expo run:ios)
 * - Supabase Realtime: Kommentare & Reaktionen
 */
import { useContext, useEffect, useRef, useState } from "react";
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
  Heart,
} from "lucide-react-native";
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
import { Room, RoomEvent, Track } from "livekit-client";
import type { TrackPublication, Participant } from "livekit-client";
import {
  useLiveSession,
  useLiveHost,
  useLiveComments,
  useLiveReactions,
  usePinComment,
  type LiveComment,
  type LiveReaction,
} from "@/lib/useLiveSession";
import LiveShareSheet from "@/components/ui/LiveShareSheet";
import ViewerListSheet from "@/components/ui/ViewerListSheet";
import { LiveUserSheet } from "@/components/live/LiveUserSheet";
import ExpoGoPlaceholder from "@/components/live/ExpoGoPlaceholder";
// expo-constants: default import causes _interopRequireDefault TypeError in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _cMod = require("expo-constants") as any;
const Constants = _cMod?.default ?? _cMod;

const EMOJIS = ["❤️", "🔥", "👏", "😱", "💜"];

// Zahlen formatieren: 1200 → "1.2K"
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const { width: SCREEN_W } = Dimensions.get('window');

// ─── TikTok-Style Floating Heart ─────────────────────────────────────────────
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

// ─── Floating Reaktions-Bubble ────────────────────────────────────────────────
function ReactionBubble({ reaction }: { reaction: LiveReaction }) {
  if (reaction.emoji === '❤️') return <FloatingHeart reaction={reaction} />;

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
      <Text style={s.reactionEmoji}>{reaction.emoji}</Text>
    </Animated.View>
  );
}

// ─── Tap-to-Like Herz (am Tap-Ort, fliegt hoch) ─────────────────────────────
type TapHeartItem = { id: number; x: number; y: number };

function TapHeart({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const scale = useSharedValue(0);
  const floatY = useSharedValue(0);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.5, { damping: 7, stiffness: 220 }),
      withTiming(1.15, { duration: 150 })
    );
    floatY.value = withTiming(-110, { duration: 1700 });
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

function CommentRow({
  comment,
  onLongPress,
  onUserPress,
}: {
  comment: LiveComment;
  onLongPress?: () => void;
  onUserPress?: (userId: string) => void;
}) {
  const isSystem = (comment as any).isSystem;
  const avatar = comment.profiles?.avatar_url;
  const initials = comment.profiles?.username?.[0]?.toUpperCase() ?? '?';
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
          onPress={() => onUserPress?.(comment.user_id)}
          onLongPress={onLongPress}
          delayLongPress={500}
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <Text style={s.commentUser}>@{comment.profiles?.username ?? 'User'} </Text>
          <Text style={s.commentText}>{comment.text}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// ─── Echtzeit Viewer Count (LiveKit-basiert) ──────────────────────────────────
function useViewerCount(sessionId: string) {
  const room = useContext(RoomContext);
  const [viewerCount, setViewerCount] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);

  useEffect(() => {
    if (!room) return;

    const update = () => {
      const count = room.remoteParticipants.size;
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

  // Sync count back to DB every 5s so watchers can see it too
  useEffect(() => {
    const interval = setInterval(() => {
      supabase
        .from("live_sessions")
        .update({ viewer_count: viewerCount, peak_viewers: peakViewers })
        .eq("id", sessionId)
        .then();
    }, 5000);
    return () => clearInterval(interval);
  }, [viewerCount, peakViewers, sessionId]);

  return { viewerCount, peakViewers };
}

// ─── LiveKit Host-Steuerung (Mikrofon / Kamera toggle) ────────────────────────
function HostControls() {
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
function LocalCameraView() {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<{
    participant: Participant;
    publication: TrackPublication;
    source: Track.Source;
  } | null>(null);

  useEffect(() => {
    if (!room) return;

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
      mirror
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
  const { comments, sendComment, sendSystemEvent, deleteComment } = useLiveComments(sessionId);
  const { reactions, sendReaction } = useLiveReactions(sessionId);
  const { pinnedComment, pinComment } = usePinComment(sessionId);
  const { viewerCount, peakViewers } = useViewerCount(sessionId);
  const { saveReplayUrl } = useLiveHost();
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
  const [tapHearts, setTapHearts] = useState<TapHeartItem[]>([]);
  const tapHeartIdRef = useRef(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);


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

  // ── Kamera/Mikrofon muten wenn App in Hintergrund geht ──────────────────────
  // iOS stoppt automatisch die Kamera → Zuschauer sehen weißes Bild.
  // Lösung: Kamera + Mikrofon beim Hintergrundwechsel explizit muten.
  // Beim Zurückkehren: wieder unmuten. Zuschauer sehen "Live pausiert"-Overlay.
  const room = useContext(RoomContext);
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
    const newId = tapHeartIdRef.current++;
    setTapHearts((prev) => [...prev, { id: newId, x, y }]);
    sendReaction('❤️');
  };

  const confirmEnd = () => {
    setShowSummary(false);
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Kamerabild + Overlays: absolut positioniert hinter allem */}
      <LocalCameraView />

      {/* HD-Badge — subtil oben links */}
      <View style={s.hdBadge} pointerEvents="none">
        <Text style={s.hdBadgeText}>HD</Text>
      </View>

      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.85)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Floating Reaktionen */}
      <View style={s.reactionsLayer} pointerEvents="none">
        {reactions.map((r) => (
          <ReactionBubble key={r.id} reaction={r} />
        ))}
      </View>

      {/* Gesamter Screen: Tap → Herz am Tap-Ort */}
      <Pressable
        style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        onPressIn={(evt) => handleScreenTap(evt.nativeEvent.locationX, evt.nativeEvent.locationY)}
      />

      {/* Tap-Herzen — je eins pro Tap, fliegen am Tap-Ort hoch */}
      {tapHearts.map((h) => (
        <TapHeart
          key={h.id}
          x={h.x}
          y={h.y}
          onDone={() => setTapHearts((prev) => prev.filter((hh) => hh.id !== h.id))}
        />
      ))}

      {/* Flex-Container: füllt den Rest, drückt Input nach oben wenn Tastatur offen */}
      <View style={{ flex: 1 }}>
        {/* Oben */}
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={s.livePill}>
            <Animated.View style={[s.liveDot, dotStyle]} />
            <Text style={s.liveLabel}>LIVE</Text>
          </View>
          {title ? (
            <Text style={s.titleText} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <Pressable
            onPress={() => setViewersVisible(true)}
            style={s.viewerBadge}
          >
            <Users size={13} stroke="#fff" strokeWidth={2} />
            <Text style={s.viewerCount}>{viewerCount}</Text>
          </Pressable>

          {/* Like-Counter: akkumuliert via like_count aus DB */}
          <View style={s.likeBadge}>
            <Text style={s.likeBadgeText}>❤️ {fmtNum(session?.like_count ?? 0)}</Text>
          </View>

          <Pressable onPress={handleEnd} style={s.endBtn} hitSlop={8}>
            <X size={18} stroke="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Mikrofon / Kamera + Share Controls */}
        <View style={[s.controlsPos, { top: insets.top + 60 }]}>
          <HostControls />
          <Pressable onPress={handleShare} style={s.controlBtn}>
            <Share2 size={22} stroke="#fff" strokeWidth={2.2} />
          </Pressable>
        </View>


        {/* Spacer: drückt Kommentare + Input nach unten */}
        <View style={{ flex: 1 }} />

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

        {/* Kommentare */}
        <View style={[s.commentsArea]}>
          <FlatList
            ref={flatRef}
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                onLongPress={!(item as any).isSystem ? () => {
                  Alert.alert(
                    'Kommentar',
                    `Von @${item.profiles?.username ?? 'User'}: "${item.text.slice(0, 60)}"`,
                    [
                      { text: '📌 Anpinnen', onPress: () => pinComment(item) },
                      { text: '🚫 Löschen', style: 'destructive', onPress: () => deleteComment(item.id) },
                      { text: 'Abbrechen', style: 'cancel' },
                    ]
                  );
                } : undefined}
                onUserPress={(uid) => !(item as any).isSystem ? setSelectedUserId(uid) : undefined}
              />
            )}
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
            selectionColor="#22D3EE"
            maxLength={300}
          />
          {input.trim().length > 0 ? (
            <Pressable onPress={submit} hitSlop={8} style={s.sendBtn}>
              <Send size={18} stroke="#22D3EE" strokeWidth={2.2} />
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
                <Text style={s.bottomEmojiText}>{emoji}</Text>
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
      {/* Viewer List Sheet */}
      <ViewerListSheet
        visible={viewersVisible}
        onClose={() => setViewersVisible(false)}
        sessionId={sessionId}
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
              </View>
            </View>

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
                        <Text style={{ color: '#22D3EE', fontWeight: '700', fontSize: 13 }}>
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
      {/* TikTok-Style User Info Sheet */}
      <LiveUserSheet
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onMention={(username) => {
          setInput((prev) => `${prev}@${username} `);
          setSelectedUserId(null);
        }}
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
    () => new Room({ adaptiveStream: { pixelDensity: "screen" } }),
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
    AudioSession.startAudioSession();

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
        await room.localParticipant
          .setMicrophoneEnabled(true)
          .catch((e: unknown) => {
            __DEV__ && console.warn(
              "[LiveHost] Mikrofonaktivierung fehlgeschlagen:",
              String(e),
            );
          });

        // Kamera mit explizitem facingMode um Device-Enumeration-Bug zu umgehen
        const enableCamera = async () => {
          await room.localParticipant.setCameraEnabled(true, {
            facingMode: "user", // verhindert toLowerCase-Fehler bei undefined deviceId
            resolution: {
              width: 720,
              height: 1280,
              frameRate: 25,
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
      AudioSession.stopAudioSession();
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
            backgroundColor: "#0891B2",
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
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
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

  controlsPos: { position: "absolute", right: 14, zIndex: 20 },
  controls: { gap: 8 },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnOff: { backgroundColor: "rgba(239,68,68,0.25)" },

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
    maxHeight: 240,
    paddingHorizontal: 14,
    zIndex: 10,
  },
  commentRow: {
    paddingVertical: 2,
    marginBottom: 3,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  commentAvatar: { width: 0, height: 0 },
  commentAvatarFallback: {},
  commentAvatarInitial: { fontSize: 0 },
  commentTextWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  commentUser: { color: '#FFFC00', fontWeight: '800', fontSize: 13 },
  commentText: { color: '#fff', fontSize: 13, flexShrink: 1 },
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
    borderColor: 'rgba(34,211,238,0.15)',
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
    color: '#22D3EE',
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
    backgroundColor: 'rgba(34,211,238,0.12)',
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
    backgroundColor: '#22D3EE',
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
  summaryDuration: { color: '#22D3EE', fontSize: 15, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryValue: { color: '#22D3EE', fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', width: '100%' },
  summaryActions: { gap: 10, width: '100%' },
  summaryActionBtn: { paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', minHeight: 48 },
  summaryActionBtnDone: { backgroundColor: 'rgba(34,211,238,0.1)' },
  summaryActionText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600' },
  summaryActionTextDone: { color: '#22D3EE' },
  summaryBtnEnd: { paddingVertical: 14, alignItems: 'center' },
  summaryBtnEndText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: '600' },
  // Legacy (wird noch genutzt):
  summaryBtn: {
    backgroundColor: "#0891B2",
    borderRadius: 14,
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  summaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Pinned Comment Banner
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#22D3EE',
    borderRadius: 10,
    marginHorizontal: 8,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  pinnedLabel: { color: '#22D3EE', fontSize: 10, fontWeight: '700', marginRight: 4 },
  pinnedUser: { color: '#22D3EE', fontWeight: '700', fontSize: 12 },
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

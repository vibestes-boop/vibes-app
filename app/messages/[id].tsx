import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  PanResponder, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Play, Reply, Trash2, X, ImagePlus, Smile, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import {
  useMessages, useSendMessage, useMarkMessagesRead, useTypingPresence,
  useDeleteMessage, useToggleReaction, useMessageReactions,
  type Message, type PostPreview,
} from '@/lib/useMessages';
import { useAuthStore } from '@/lib/authStore';
import GifPicker from '@/components/ui/GifPicker';
import { uploadPostMedia } from '@/lib/uploadMedia';
import { useTheme } from '@/lib/useTheme';

// ── Konstanten ───────────────────────────────────────────────────────────────
const REACTION_EMOJIS = ['❤️', '😂', '🔥', '👏', '😱', '🥲'];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

// ── Post-Preview-Karte ───────────────────────────────────────────────────────
function PostPreviewCard({ post, onPress }: { post: PostPreview; onPress: () => void }) {
  const isVideo = post.media_type === 'video';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.previewCard, pressed && { opacity: 0.86 }]}
    >
      <View style={styles.previewThumbWrap}>
        {post.media_url ? (
          <Image source={{ uri: post.media_url }} style={styles.previewThumb} contentFit="cover" />
        ) : (
          <View style={[styles.previewThumb, styles.previewThumbFallback]}>
            <Text style={styles.previewFallbackEmoji}>🖼️</Text>
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.78)']}
          style={styles.previewGradient}
        >
          <View style={styles.previewMeta}>
            {post.caption ? (
              <Text style={styles.previewCaption} numberOfLines={2}>{post.caption}</Text>
            ) : null}
            {post.author_username ? (
              <Text style={styles.previewAuthor}>@{post.author_username}</Text>
            ) : null}
          </View>
          <View style={styles.vibesBadge}>
            <Text style={styles.vibesBadgeText}>Serlo</Text>
          </View>
        </LinearGradient>
        {isVideo && (
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Play size={20} color="#fff" fill="#fff" />
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Emoji-Picker Popover ─────────────────────────────────────────────────────
function EmojiPicker({
  messageId,
  isOwn,
  onSelect,
  onClose,
  onDelete,
}: {
  messageId: string;
  isOwn: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={[styles.picker, isOwn ? styles.pickerOwn : styles.pickerOther]}>
      <View style={styles.pickerEmojis}>
        {REACTION_EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => { onSelect(e); onClose(); }}
            style={({ pressed }) => [styles.pickerEmoji, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.pickerEmojiText}>{e}</Text>
          </Pressable>
        ))}
      </View>
      {isOwn && onDelete && (
        <Pressable
          onPress={() => { onDelete(); onClose(); }}
          style={styles.deleteBtn}
        >
          <Trash2 size={14} color="#EF4444" strokeWidth={2} />
          <Text style={styles.deleteBtnText}>Löschen</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Reaction-Badges unterhalb der Bubble ─────────────────────────────────────
function ReactionBadges({
  reactions,
  onPress,
}: {
  reactions: { emoji: string; count: number; byMe: boolean }[];
  onPress: (emoji: string) => void;
}) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <View style={styles.reactionRow}>
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          onPress={() => onPress(r.emoji)}
          style={[styles.reactionBadge, r.byMe && styles.reactionBadgeActive]}
        >
          <Text style={styles.reactionEmoji}>{r.emoji}</Text>
          {r.count > 1 && (
            <Text style={[styles.reactionCount, r.byMe && styles.reactionCountActive]}>
              {r.count}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ── MessageBubble mit Swipe-to-Reply + LongPress-Actions ─────────────────────
function MessageBubble({
  msg,
  isOwn,
  reactions,
  onPostPress,
  onLongPress,
  onSwipeReply,
  onReactionPress,
  onImagePress,
  onStoryReplyPress,

}: {
  msg: Message;
  isOwn: boolean;
  reactions: { emoji: string; count: number; byMe: boolean }[];
  onPostPress: (postId: string) => void;
  onLongPress: () => void;
  onSwipeReply: () => void;
  onReactionPress: (emoji: string) => void;
  onImagePress: () => void;
  onStoryReplyPress: () => void;

}) {
  const hasPost = !!msg.post;
  const hasImage = !!msg.image_url;
  const hasStoryReply = !!msg.story_media_url;
  const showText = msg.content && msg.content.trim().length > 0;
  const isSending = msg.id.startsWith('temp-');
  const { colors, isDark } = useTheme();

  const translateX = useSharedValue(0);
  const replyOpacity = useSharedValue(0);
  const SWIPE_THRESHOLD = isOwn ? -60 : 60;
  const swipeTriggeredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_e, gs) => {
        const dx = isOwn
          ? Math.max(gs.dx, -80)
          : Math.min(gs.dx, 80);
        // Only allow swipe in the correct direction
        if (isOwn && dx >= 0) return;
        if (!isOwn && dx <= 0) return;
        translateX.value = dx;
        replyOpacity.value = Math.min(Math.abs(dx) / 60, 1);
      },
      onPanResponderRelease: (_e, gs) => {
        const triggered = isOwn
          ? gs.dx <= SWIPE_THRESHOLD
          : gs.dx >= SWIPE_THRESHOLD;
        if (triggered && !swipeTriggeredRef.current) {
          swipeTriggeredRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSwipeReply();
        }
        swipeTriggeredRef.current = false;
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        replyOpacity.value = withTiming(0, { duration: 200 });
      },
      onPanResponderTerminate: () => {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        replyOpacity.value = withTiming(0, { duration: 200 });
      },
    })
  ).current;

  const bubbleAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconAnim = useAnimatedStyle(() => ({
    opacity: replyOpacity.value,
    transform: [{ scale: 0.7 + replyOpacity.value * 0.3 }],
  }));

  return (
    <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
      {!isOwn && (
        <Animated.View style={[styles.replyIcon, replyIconAnim]}>
          <Reply size={16} color="#FFFFFF" strokeWidth={2} />
        </Animated.View>
      )}

      <View style={{ flex: 1, alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
        {msg.reply_to && (
          <View style={[styles.replyPreview, isOwn && styles.replyPreviewOwn]}>
            <View style={[styles.replyBar, isOwn && styles.replyBarOwn]} />
            <Text style={styles.replyPreviewText} numberOfLines={1}>
              {msg.reply_to.content}
            </Text>
          </View>
        )}

        <Animated.View style={bubbleAnim} {...panResponder.panHandlers}>
          <Pressable
            onLongPress={onLongPress}
            delayLongPress={350}
            style={({ pressed }) => [
              styles.bubble,
              isOwn
                ? [styles.bubbleOwn, { backgroundColor: isDark ? '#2C2C2E' : '#007AFF' }]
                : [styles.bubbleOther, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#E9E9EB' }],
              hasPost && styles.bubbleWithPost,
              hasPost && styles.bubbleNoFrame,

              hasImage && !showText && styles.bubbleWithImage,
              isSending && { opacity: 0.6 },
              pressed && { opacity: 0.88 },
            ]}
          >
            {hasPost && (
              <PostPreviewCard
                post={msg.post!}
                onPress={() => onPostPress(msg.post!.id)}
              />
            )}
            {/* ── TikTok-Style Story-Antwort: Label + Thumbnail + Text ── */}
            {hasStoryReply && (
              <Pressable
                style={({ pressed }) => [styles.storyReplyWrap, pressed && { opacity: 0.82 }]}
                onPress={onStoryReplyPress}
              >
                <Text style={[styles.storyReplyLabel, isOwn && styles.storyReplyLabelOwn]}>
                  {isOwn
                    ? `Du hast auf die Story von @${msg.story_author ?? '?'} geantwortet`
                    : `Hat auf deine Story geantwortet`}
                </Text>
                <Image
                  source={{ uri: msg.story_media_url! }}
                  style={styles.storyReplyThumb}
                  contentFit="cover"
                />
              </Pressable>
            )}

            {hasImage && (
              <Pressable
                onPress={onImagePress}
                style={[styles.imageBubble, isOwn && styles.imageBubbleOwn]}
              >
                <Image
                  source={{ uri: msg.image_url! }}
                  style={styles.imageBubbleImg}
                  contentFit="cover"
                />
              </Pressable>
            )}
            {showText && (
              <Text style={[
                styles.bubbleText,
                { color: isDark ? 'rgba(255,255,255,0.88)' : '#1C1C1E' },
                isOwn && { color: '#FFFFFF' },
              ]}>
                {msg.content}
              </Text>
            )}
            <Text style={[
              styles.bubbleTime,
              { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)' },
              isOwn && { color: 'rgba(255,255,255,0.65)' },
            ]}>
              {isSending ? (
                <Text style={{ color: 'rgba(255,255,255,0.4)' }}>Senden…</Text>
              ) : (
                <>
                  {formatTime(msg.created_at)}
            {isOwn && (
                <Text style={[styles.readTick, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)' }]}>{msg.read ? ' ✓✓' : ' ✓'}</Text>
              )}
                </>
              )}
            </Text>
          </Pressable>
        </Animated.View>

        <ReactionBadges reactions={reactions} onPress={onReactionPress} />
      </View>

      {isOwn && (
        <Animated.View style={[styles.replyIcon, replyIconAnim]}>

          <Reply size={16} color="#FFFFFF" strokeWidth={2} style={{ transform: [{ scaleX: -1 }] }} />
        </Animated.View>
      )}
    </View>
  );
}

// ── Haupt-Screen ─────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { id: conversationId, username, avatarUrl, otherUserId } = useLocalSearchParams<{
    id: string;
    username: string;
    avatarUrl: string;
    otherUserId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.profile?.id);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const isAtBottomRef = useRef(true); // BUG-F: Guard gegen ungewolltes Auto-Scroll
  const [text, setText] = useState('');
  const [activePickerId, setActivePickerId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // ── Left-Edge-Swipe → zurück (wie iOS native Geste) ───────────────────
  const backSwipeRef = useRef(false);
  const backSwipePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.locationX < 30,
      onMoveShouldSetPanResponder: (_, g) => g.dx > 8 && Math.abs(g.dy) < 60,
      onPanResponderMove: (_, g) => {
        if (g.dx > 80 && Math.abs(g.dy) < 100 && !backSwipeRef.current) {
          backSwipeRef.current = true;
        }
      },
      onPanResponderRelease: (_, g) => {
        if (backSwipeRef.current) {
          backSwipeRef.current = false;
          router.back();
        } else {
          backSwipeRef.current = false;
        }
      },
      onPanResponderTerminate: () => { backSwipeRef.current = false; },
    })
  ).current;

  const { data: messagesRaw = [], isLoading } = useMessages(conversationId ?? null);
  const messages = useMemo(() => {
    const seen = new Set<string>();
    return messagesRaw.filter((m) => {
      if (!m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messagesRaw]);

  const { mutateAsync: sendMessage, isPending: sending } = useSendMessage();
  const { mutate: deleteMessage } = useDeleteMessage(conversationId ?? null);
  const { mutate: toggleReaction } = useToggleReaction(conversationId ?? null);
  const { data: reactionsMap = {} } = useMessageReactions(conversationId ?? null);

  useMarkMessagesRead(conversationId ?? null);
  const { otherIsTyping, onTypingStart, onTypingStop } = useTypingPresence(conversationId ?? null);

  // Zuverlässig zum Ende scrollen beim Öffnen des Chats
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (messages.length === 0) return;

    if (isFirstLoadRef.current) {
      // Erster Load: 2 Versuche (Layout + Bild-Layout)
      isFirstLoadRef.current = false;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 600);
    } else {
      // Neue Nachricht: nur scrollen wenn User am Ende ist
      if (isAtBottomRef.current) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      }
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !conversationId || sending) return;
    const content = text.trim();
    const replyId = replyTo?.id ?? null;
    setText('');
    setReplyTo(null);
    onTypingStop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendMessage({ conversationId, content, postId: null, replyToId: replyId });
  }, [text, conversationId, sending, sendMessage, onTypingStop, replyTo]);

  // B: Bild aus Galerie senden
  const handleSendImage = useCallback(async () => {
    if (!conversationId || !userId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Zugriff auf deine Fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.82,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setImageUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const { url } = await uploadPostMedia(userId, asset.uri, mimeType);
      await sendMessage({ conversationId, content: '', postId: null, imageUrl: url });
    } catch (e: any) {
      Alert.alert('Fehler', e?.message ?? 'Bild konnte nicht gesendet werden.');
    } finally {
      setImageUploading(false);
    }
  }, [conversationId, userId, sendMessage]);

  // C: GIF senden (via Tenor URL direkt als image_url)
  const handleSendGif = useCallback(async (gifUrl: string) => {
    if (!conversationId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await sendMessage({ conversationId, content: '', postId: null, imageUrl: gifUrl });
    } catch (e: any) {
      Alert.alert('Fehler', e?.message ?? 'GIF konnte nicht gesendet werden.');
    }
  }, [conversationId, sendMessage]);

  const handlePostPress = useCallback((postId: string) => {
    router.push(`/post/${postId}` as any);
  }, [router]);

  const handleLongPress = useCallback((msg: Message, isOwn: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActivePickerId(msg.id);
  }, []);

  const handleDelete = useCallback((messageId: string) => {
    Alert.alert('Nachricht löschen?', 'Für alle Teilnehmer entfernt.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => deleteMessage(messageId),
      },
    ]);
  }, [deleteMessage]);

  const handleSwipeReply = useCallback((msg: Message) => {
    setReplyTo({ id: msg.id, content: msg.content });
    inputRef.current?.focus();
  }, []);

  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.sender_id === userId;
    const prev = messages[index - 1];
    const showDay = !prev || formatDay(prev.created_at) !== formatDay(item.created_at);
    const reactions = reactionsMap[item.id] ?? [];
    // colors comes from outer ChatScreen scope via closure

    return (
      <>
        {showDay && (
          <View style={styles.dayRow}>
            <Text style={[styles.dayText, { color: colors.text.muted, backgroundColor: colors.bg.elevated }]}>{formatDay(item.created_at)}</Text>
          </View>
        )}
        {/* Emoji-Picker Popover */}
        {activePickerId === item.id && (
          <EmojiPicker
            messageId={item.id}
            isOwn={isOwn}
            onSelect={(emoji) => toggleReaction({ messageId: item.id, emoji })}
            onClose={() => setActivePickerId(null)}
            onDelete={isOwn ? () => handleDelete(item.id) : undefined}
          />
        )}
        <MessageBubble
          msg={item}
          isOwn={isOwn}
          reactions={reactions}
          onPostPress={handlePostPress}
          onLongPress={() => handleLongPress(item, isOwn)}
          onSwipeReply={() => handleSwipeReply(item)}
          onReactionPress={(emoji) => toggleReaction({ messageId: item.id, emoji })}
          onImagePress={() => setLightboxUri(item.image_url)}
          onStoryReplyPress={() => item.story_media_url && setLightboxUri(item.story_media_url)}
        />

      </>
    );
  }, [messages, userId, reactionsMap, activePickerId, handlePostPress, handleLongPress, handleSwipeReply, handleDelete, toggleReaction, colors]);

  const initial = (username ?? '?')[0].toUpperCase();

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Tap anywhere to close picker */}
        <Pressable style={{ flex: 1 }} onPress={() => setActivePickerId(null)}>
          <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.bg.secondary }]}>
            {/* Unsichtbarer linker Rand — nimmt Swipe-zurück-Geste auf */}
            <View
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 30, zIndex: 200 }}
              {...backSwipePan.panHandlers}
            />
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border.subtle, backgroundColor: colors.bg.secondary }]}>
              <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
                <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
              </Pressable>
              <Pressable
                style={styles.headerUserRow}
                onPress={() => {
                  if (otherUserId) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/user/[id]', params: { id: otherUserId } });
                  }
                }}
                disabled={!otherUserId}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                    <User size={18} color={colors.text.muted} strokeWidth={1.5} />
                  </View>
                )}
                <Text style={[styles.headerUsername, { color: colors.text.primary }]}>@{username ?? '?'}</Text>
              </Pressable>
            </View>

            {/* Messages */}
            {isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={5}
                onScroll={(e) => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                  const dist = contentSize.height - layoutMeasurement.height - contentOffset.y;
                  isAtBottomRef.current = dist < 60;
                }}
                onContentSizeChange={() => {
                  // Beim ersten Load IMMER ans Ende scrollen
                  if (isFirstLoadRef.current || isAtBottomRef.current) {
                    listRef.current?.scrollToEnd({ animated: false });
                  }
                }}
                onLayout={() => {
                  // Nach erstem Layout-Pass zum Ende scrollen
                  listRef.current?.scrollToEnd({ animated: false });
                }}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text style={[styles.emptyText, { color: colors.text.muted }]}>Schreib die erste Nachricht 👋</Text>
                  </View>
                }
              />
            )}

            {/* Typing-Indikator */}
            {otherIsTyping && (
              <View style={styles.typingRow}>
                <View style={[styles.typingBubble, { backgroundColor: colors.bg.elevated }]}>
                  <Text style={styles.typingDots}>●●●</Text>
                  <Text style={[styles.typingLabel, { color: colors.text.muted }]}>{username ?? 'Jemand'} schreibt…</Text>
                </View>
              </View>
            )}

            {/* Reply-Vorschau */}
            {replyTo && (
              <View style={styles.replyBar2}>
                <Reply size={14} color="#FFFFFF" strokeWidth={2} />
                <Text style={[styles.replyBarText, { color: colors.text.secondary }]} numberOfLines={1}>{replyTo.content}</Text>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                  <X size={14} color={colors.icon.muted} strokeWidth={2} />
                </Pressable>
              </View>
            )}

                <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8, backgroundColor: colors.bg.secondary, borderTopColor: colors.border.subtle }]}>
              <Pressable
                onPress={handleSendImage}
                disabled={imageUploading || sending}
                style={styles.imagePickerBtn}
                hitSlop={8}
              >
                {imageUploading
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <ImagePlus size={22} color={colors.icon.muted} strokeWidth={1.8} />}
              </Pressable>
              {/* GIF Button */}
              <Pressable
                onPress={() => setShowGifPicker(true)}
                disabled={sending}
                style={styles.imagePickerBtn}
                hitSlop={8}
              >
                <Text style={styles.gifLabel}>GIF</Text>
              </Pressable>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.text.primary, backgroundColor: colors.bg.input, borderColor: colors.border.default }]}
                value={text}
                onChangeText={(v) => { setText(v); if (v.length > 0) onTypingStart(); else onTypingStop(); }}
                onBlur={onTypingStop}
                placeholder={replyTo ? 'Antworten…' : 'Nachricht…'}
                placeholderTextColor={colors.text.muted}
                multiline
                maxLength={500}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <Pressable
                onPress={handleSend}
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                disabled={!text.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Send size={18} color="#FFFFFF" strokeWidth={2} />
                }
              </Pressable>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>

      {/* GIF Picker */}
      <GifPicker
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleSendGif}
      />

      {/* Bild-Lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxUri(null)}>
          {!!lightboxUri && (
            <Image source={{ uri: lightboxUri as string }} style={styles.lightboxImage} contentFit="contain" />
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(128,128,128,0.2)' },
  headerAvatarFallback: { backgroundColor: '#E8E8ED', alignItems: 'center', justifyContent: 'center' },
  headerAvatarInitial: { color: '#6B7280', fontSize: 15, fontWeight: '700' },
  headerUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerUsername: { fontSize: 16, fontWeight: '700', flex: 1, letterSpacing: -0.2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15 },
  listContent: { paddingHorizontal: 14, paddingVertical: 20, gap: 2, flexGrow: 1 },

  dayRow: { alignItems: 'center', marginVertical: 16 },
  dayText: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.3,
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12,
  },

  // ── Bubble ──
  bubbleRow: { flexDirection: 'row', marginVertical: 1, alignItems: 'flex-end', gap: 6 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%', borderRadius: 20, gap: 0, overflow: 'hidden',
  },
  bubbleWithPost: { paddingHorizontal: 0, paddingVertical: 0, gap: 0 },
  bubbleNoFrame: { backgroundColor: 'transparent' },

  // Note: actual bg/radius set inline with isDark — these are base shapes
  bubbleOther: { borderBottomLeftRadius: 5 },
  bubbleOwn: { borderBottomRightRadius: 5 },
  bubbleWithImage: { backgroundColor: 'transparent', padding: 0, borderRadius: 16, overflow: 'hidden' },
  // Text/time set inline for theme-awareness
  bubbleText: { fontSize: 15.5, lineHeight: 22, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2, fontWeight: '400' },
  bubbleTextOwn: {},
  bubbleTime: { fontSize: 10.5, alignSelf: 'flex-end', paddingHorizontal: 12, paddingBottom: 7, paddingTop: 1, fontWeight: '400' },
  bubbleTimeOwn: {},
  readTick: {},

  // ── Reply Icon ──
  replyIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(120,120,128,0.14)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },

  // ── Reply Preview ──
  replyPreview: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 4, maxWidth: '78%', gap: 8,
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
  replyPreviewOwn: { alignSelf: 'flex-end' },
  replyBar: { width: 3, height: '100%', minHeight: 16, backgroundColor: '#007AFF', borderRadius: 2 },
  replyBarOwn: { backgroundColor: 'rgba(255,255,255,0.7)' },
  replyPreviewText: { fontSize: 12.5, flex: 1, color: '#8E8E93' },

  // ── Reaction Badges ──
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, marginHorizontal: 2 },
  reactionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(120,120,128,0.14)',
    borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  reactionBadgeActive: {
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderColor: 'rgba(0,122,255,0.3)',
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11.5, color: '#8E8E93', fontWeight: '600' },
  reactionCountActive: { color: '#007AFF' },

  // ── Emoji Picker ──
  picker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20, paddingHorizontal: 6, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
    alignSelf: 'flex-start', marginBottom: 6, marginLeft: 12,
  },
  pickerOwn: { alignSelf: 'flex-end', marginRight: 12, marginLeft: 0 },
  pickerOther: { alignSelf: 'flex-start', marginLeft: 12 },
  pickerEmojis: { flexDirection: 'row', gap: 2 },
  pickerEmoji: { padding: 7, borderRadius: 12 },
  pickerEmojiText: { fontSize: 24 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 8, marginTop: 6, paddingHorizontal: 4,
  },
  deleteBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },

  // ── Reply Bar ──
  replyBar2: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(0,122,255,0.05)',
  },
  replyBarText: { flex: 1, fontSize: 13 },

  // ── Input Bar ──
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 10, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9,
    fontSize: 15.5, lineHeight: 21,
    borderWidth: 1,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#007AFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#007AFF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  sendBtnDisabled: { backgroundColor: 'rgba(0,122,255,0.25)', shadowOpacity: 0 },

  // ── Typing ──
  typingRow: { paddingHorizontal: 16, paddingBottom: 6 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    borderBottomLeftRadius: 5,
  },
  typingDots: { fontSize: 9, letterSpacing: 3, color: '#8E8E93' },
  typingLabel: { fontSize: 12, fontStyle: 'italic', color: '#8E8E93' },

  // ── PostPreviewCard ──
  previewCard: { borderRadius: 18, overflow: 'hidden', width: 230 },
  previewThumbWrap: { width: '100%', height: 160, position: 'relative' },
  previewThumb: { width: '100%', height: '100%' },
  previewThumbFallback: { backgroundColor: 'rgba(0,122,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  previewFallbackEmoji: { fontSize: 40 },
  previewGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingBottom: 10, gap: 6,
  },
  previewMeta: { flex: 1, gap: 2 },
  previewCaption: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  previewAuthor: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '500' },
  vibesBadge: { backgroundColor: 'rgba(0,122,255,0.8)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  vibesBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  playOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Image Bubble ──
  imageBubble: {
    overflow: 'hidden', borderRadius: 18,
    width: Math.round(require('react-native').Dimensions.get('window').width * 0.62),
    aspectRatio: 9 / 14,
  },
  imageBubbleOwn: { borderBottomRightRadius: 5 },
  imageBubbleImg: { width: '100%', height: '100%' },

  imagePickerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  gifLabel: { color: '#007AFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '85%' },

  storyReplyWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 6, width: 200 },
  storyReplyLabel: { fontSize: 11, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4, opacity: 0.7 },
  storyReplyLabelOwn: { textAlign: 'right' },
  storyReplyThumb: { width: '100%', height: 140 },
});

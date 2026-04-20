import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  Dimensions,
  Alert,
  Modal,
  Keyboard,
  type KeyboardEvent,
} from 'react-native';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  TouchableOpacity,
} from 'react-native-gesture-handler';
import { X, Send, Trash2, Copy, Video, AtSign, MessageSquare, Heart, Volume2, VolumeX } from 'lucide-react-native';
import { setStringAsync as clipboardSetString } from 'expo-clipboard';
import { useVoiceReader } from '@/lib/useVoiceReader';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useCreatorVoiceSample } from '@/lib/useCreatorVoiceSample';


import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useComments, useAddComment, useDeleteComment, useCommentReplies, type Comment } from '@/lib/useComments';
import { useCommentLike, useCommentLikesBatch, type CommentLikesMap } from '@/lib/useCommentLike';
import { useAuthStore } from '@/lib/authStore';
import { VideoGridThumb } from './VideoGridThumb';
import { RichText } from '@/components/ui/RichText';
import { useExploreUserSearch } from '@/lib/useExplore';
import { useTheme } from '@/lib/useTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// TikTok: Post-Preview oben (~22%), Sheet darunter
const SHEET_TOP = SCREEN_HEIGHT * 0.22;

function useKeyboardOffset() {
  const keyboardHeight = useSharedValue(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 60 });
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e: KeyboardEvent) => {
        keyboardHeight.value = withTiming(0, { duration: 50 });
      }
    );
    return () => { show.remove(); hide.remove(); };
  }, [keyboardHeight]);

  return keyboardHeight;
}

type Props = {
  postId: string;
  visible: boolean;
  onClose: () => void;
  mediaUrl?: string | null;
  mediaType?: string;
  thumbnailUrl?: string | null;
  onUserPress?: (userId: string) => void;
  /** Creator-UserId → Chatterbox klingt wie der Creator */
  creatorUserId?: string | null;
  /** Von FeedItem übergeben: steuert Post-Höhe synchron zum Sheet-Drag */
  sheetProgress?: SharedValue<number>;
};

const CLOSE_DURATION = 300;
const OPEN_DURATION = 250;
const CLOSE_EASING = Easing.out(Easing.cubic);

export default function CommentsSheet({ postId, visible, onClose, mediaUrl, mediaType, thumbnailUrl, onUserPress, creatorUserId, sheetProgress }: Props) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const overlayOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const keyboardOffset = useKeyboardOffset();
  const scrollAtTop = useSharedValue(1);
  const lastTouchY = useSharedValue(0);
  const isClosingRef = useRef(false);
  const { colors } = useTheme();

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    overlayOpacity.value = withTiming(0, { duration: CLOSE_DURATION });
    contentOpacity.value = withTiming(0, { duration: CLOSE_DURATION });
    // sheetProgress synchron auf 0 animieren (Post wächst zurück)
    if (sheetProgress) {
      sheetProgress.value = withTiming(0, { duration: CLOSE_DURATION, easing: CLOSE_EASING });
    }
    translateY.value = withTiming(
      SCREEN_HEIGHT,
      { duration: CLOSE_DURATION, easing: CLOSE_EASING },
      (finished) => {
        if (finished) runOnJS(onClose)();
      }
    );
  }, [onClose, overlayOpacity, contentOpacity, translateY, sheetProgress]);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      overlayOpacity.value = withTiming(1, { duration: OPEN_DURATION * 0.5 });
      contentOpacity.value = withTiming(1, { duration: OPEN_DURATION, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: OPEN_DURATION, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = SCREEN_HEIGHT;
      overlayOpacity.value = 0;
      contentOpacity.value = 0;
    }
  }, [visible, overlayOpacity, contentOpacity, translateY]);

  // panForList MUSS vor panGesture deklariert sein,
  // da panGesture via .requireExternalGestureToFail(panForList) darauf referenziert
  const panForList = Gesture.Pan()
    .minDistance(8)
    .manualActivation(true)
    .onTouchesDown((e) => {
      if (e.allTouches.length > 0) lastTouchY.value = e.allTouches[0].y;
    })
    .onTouchesMove((e, stateManager) => {
      if (e.allTouches.length === 0) return;
      const deltaY = e.allTouches[0].y - lastTouchY.value;
      lastTouchY.value = e.allTouches[0].y;
      if (scrollAtTop.value === 1 && deltaY > 5) {
        stateManager.activate();
      } else {
        stateManager.fail();
      }
    })
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        // Post-Höhe synchron mit Finger-Drag updaten (1 = offen, 0 = zu)
        if (sheetProgress) {
          sheetProgress.value = interpolate(
            e.translationY,
            [0, SCREEN_HEIGHT],
            [1, 0],
            Extrapolation.CLAMP
          );
        }
      }
    })
    .onEnd((e) => {
      const threshold = 70;
      const velocityThreshold = 350;
      const shouldClose =
        e.translationY > threshold ||
        e.velocityY > velocityThreshold ||
        (e.translationY > 40 && e.velocityY > 120);
      if (shouldClose) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withTiming(0, { duration: 80 });
        if (sheetProgress) sheetProgress.value = withTiming(1, { duration: 80 });
      }
    });

  // panGesture: Handle/Header-Bereich — wartet bis panForList fail() meldet
  // (d.h. FlatList ist nicht mehr am scrolling) bevor er übernimmt
  const panGesture = Gesture.Pan()
    .minDistance(8)
    .activeOffsetY([-999, 10])
    .requireExternalGestureToFail(panForList)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        // Post-Höhe synchron mit Finger-Drag updaten
        if (sheetProgress) {
          sheetProgress.value = interpolate(
            e.translationY,
            [0, SCREEN_HEIGHT],
            [1, 0],
            Extrapolation.CLAMP
          );
        }
      }
    })
    .onEnd((e) => {
      const threshold = 70;
      const velocityThreshold = 350;
      const shouldClose =
        e.translationY > threshold ||
        e.velocityY > velocityThreshold ||
        (e.translationY > 40 && e.velocityY > 120);
      if (shouldClose) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withTiming(0, { duration: 80 });
        if (sheetProgress) sheetProgress.value = withTiming(1, { duration: 80 });
      }
    });


  const sheetStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: SHEET_TOP,
    bottom: keyboardOffset.value,
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    opacity: overlayOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: contentOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Hintergrund – sanftes Ein-/Ausblenden */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <Animated.View style={overlayStyle} pointerEvents="none" />
        </Pressable>

        {/* Post + Sheet – gemeinsam ein-/ausblenden für weichen Übergang */}
        <Animated.View style={contentStyle} pointerEvents="box-none">
          {mediaUrl && (
            <View style={styles.postPreviewFrame} pointerEvents="none">
              {mediaType === 'video' ? (
                <VideoGridThumb uri={mediaUrl} thumbnailUrl={thumbnailUrl} style={StyleSheet.absoluteFill} />
              ) : (
                <Image source={{ uri: mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
            </View>
          )}

          {/* Sheet mit Pull-down-to-close am Handle, FlatList managt sich intern */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.sheet, sheetStyle, { backgroundColor: colors.bg.secondary }]}>
              <SheetInner
                postId={postId}
                onClose={handleClose}
                enabled={visible}
                onUserPress={onUserPress}
                scrollAtTop={scrollAtTop}
                panForList={panForList}
                creatorUserId={creatorUserId}
              />
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}




// ── S1: Kommentare vorlesen ─────────────────────────────────────────────────

function CommentVoiceBtn({
  postId,
  comments,
  voiceRefUrl,
}: {
  postId: string;
  comments: import('@/lib/useComments').Comment[];
  voiceRefUrl?: string | null;
}) {
  // Cache-Key: postId + Anzahl Kommentare (bei neuen Kommentaren neu generieren)
  const cacheKey = `comments-${postId}-${comments.length}`;

  // Kommentar-Text zusammenbauen — liest die Top-5 Kommentare vor
  const script = comments
    .slice(0, 5)
    .map((c) => {
      const name = c.profiles?.username ?? 'Jemand';
      return `${name} schrieb: ${c.text}`;
    })
    .join('. ');

  const { isLoading, isPlaying, toggle } = useVoiceReader(cacheKey, script, 0.45, voiceRefUrl);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        toggle();
      }}
      hitSlop={10}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: isPlaying
          ? 'rgba(255,255,255,0.10)'
          : 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: isPlaying
          ? 'rgba(255,255,255,0.28)'
          : 'rgba(255,255,255,0.08)',
      }}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Vorlesen stoppen' : 'Kommentare vorlesen'}
    >
      {isLoading ? (
        <ActivityIndicator size={13} color="rgba(255,255,255,0.6)" />
      ) : isPlaying ? (
        <VolumeX size={13} color="#FFFFFF" strokeWidth={2} />
      ) : (
        <Volume2 size={13} color="rgba(255,255,255,0.5)" strokeWidth={2} />
      )}
      <Text style={{
        color: isPlaying ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '600',
      }}>
        {isLoading ? 'Laden...' : isPlaying ? 'Stoppen' : 'Vorlesen'}
      </Text>
    </Pressable>
  );
}

function SheetInner({
  postId,
  onClose,
  enabled,
  onUserPress,
  scrollAtTop,
  panForList,
  creatorUserId,
}: {
  postId: string;
  onClose: () => void;
  enabled: boolean;
  onUserPress?: (userId: string) => void;
  scrollAtTop: SharedValue<number>;
  panForList: ReturnType<typeof Gesture.Pan>;
  creatorUserId?: string | null;
}) {
  const creatorVoiceUrl = useCreatorVoiceSample(creatorUserId);
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: comments, isLoading } = useComments(postId, enabled);
  const addComment = useAddComment(postId);
  const deleteComment = useDeleteComment(postId);

  // ── N+1-Fix: Alle Comment-Likes in 2 Queries statt 2×N ──────────────────
  // useMemo verhindert neue Array-Referenz bei jedem Render (würde Batch-Query neu triggern)
  const { useMemo } = require('react') as typeof import('react');
  const commentIds = useMemo(
    () => (comments ?? []).map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(comments ?? []).map((c) => c.id).join(',')]
  );
  const likeMap = useCommentLikesBatch(commentIds);

  const [text, setText] = useState('');
  const [lastSentId, setLastSentId] = useState<string | null>(null);
  const [actionSheetComment, setActionSheetComment] = useState<Comment | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  // ── @Mention Autocomplete ──────────────────────────────────
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const mentionDebounced = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedMention, setDebouncedMention] = useState<string | null>(null);
  const { data: mentionUsers = [] } = useExploreUserSearch(debouncedMention ?? '');
  const showMentions = debouncedMention && debouncedMention.length >= 1 && mentionUsers.length > 0;

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<any>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || addComment.isPending) return;
    setText('');
    setReplyTo(null);
    setMentionQuery(null);
    setDebouncedMention(null);
    Keyboard.dismiss();
    const tempId = `temp-${Date.now()}`;
    addComment.mutate(
      { text: trimmed, tempId, parentId: replyTo?.id },
      {
        onSuccess: (newComment) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setLastSentId(newComment.id);
          timersRef.current.push(setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50));
          timersRef.current.push(setTimeout(() => setLastSentId(null), 1200));
        },
        onError: () => setText(trimmed),
      }
    );
  }, [text, addComment]);

  const handleDelete = useCallback((commentId: string) => {
    Alert.alert('Kommentar löschen', 'Möchtest du diesen Kommentar wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteComment.mutate(commentId) },
    ]);
  }, [deleteComment]);

  const handleReplyWithVideo = useCallback((username: string) => {
    setText(`@${username} `);
    inputRef.current?.focus();
  }, []);

  const handleReplyTo = useCallback((commentId: string, username: string) => {
    setReplyTo({ id: commentId, username });
    setText(`@${username} `);
    inputRef.current?.focus();
    setActionSheetComment(null);
  }, []);

  const clearReply = useCallback(() => {
    setReplyTo(null);
    setText((t) => t.replace(/^@\S+\s?/, ''));
  }, []);

  // Erkennt @mention beim Tippen und sucht passende User
  const handleTextChange = useCallback((val: string) => {
    setText(val);
    // Suche nach @word am Ende des Textes (Cursor-Position nicht trackbar, letzter @ gewinnt)
    const match = val.match(/@([\w]*)$/);
    if (match) {
      const partial = match[1];
      setMentionQuery(partial);
      if (mentionDebounced.current) clearTimeout(mentionDebounced.current);
      mentionDebounced.current = setTimeout(() => setDebouncedMention(partial || null), 300);
    } else {
      setMentionQuery(null);
      setDebouncedMention(null);
    }
  }, []);

  const handleSelectMention = useCallback((username: string) => {
    // Ersetzt den teilweise getippten @mention durch den vollen Namen
    setText((t) => t.replace(/@[\w]*$/, `@${username} `));
    setMentionQuery(null);
    setDebouncedMention(null);
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'gerade eben';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  // Stabile Handler für memoized CommentRow.
  const handleLongPressComment = useCallback((c: Comment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionSheetComment(c);
  }, []);

  const renderCommentItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentRow
        comment={item}
        postId={postId}
        isOwn={item.user_id === profile?.id}
        timeAgo={timeAgo(item.created_at)}
        onDelete={handleDelete}
        onReply={handleReplyTo}
        onLongPress={handleLongPressComment}
        isHighlighted={item.id === lastSentId}
        onUserPress={onUserPress}
        likeMap={likeMap}
      />
    ),
    [postId, profile?.id, handleDelete, handleReplyTo, handleLongPressComment, lastSentId, onUserPress, likeMap],
  );

  return (
    <View style={[{ flex: 1 }, { backgroundColor: colors.bg.secondary }]}>
      {/* Handle + Header */}
      <View>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kommentare</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* 🔊 Vorlesen: deaktiviert — für spätere AI-Narration */}
            {/* (comments?.length ?? 0) > 0 && <CommentVoiceBtn postId={postId} comments={comments ?? []} voiceRefUrl={creatorVoiceUrl} /> */}

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} stroke="#6B7280" strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Kommentarliste */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text.primary} />
        </View>
      ) : comments?.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.text.muted }]}>Noch keine Kommentare.</Text>
          <Text style={[styles.emptySubText, { color: colors.text.muted }]}>Sei der Erste! 💬</Text>
        </View>
      ) : (
        <GestureDetector gesture={panForList}>
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.commentsList}
            showsVerticalScrollIndicator={false}
            bounces={true}
            overScrollMode="never"
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={(e) => {
              // scrollAtTop = 1 wenn ganz oben, sonst 0
              scrollAtTop.value = e.nativeEvent.contentOffset.y <= 2 ? 1 : 0;
            }}
            renderItem={renderCommentItem}
          />
        </GestureDetector>
      )}

      {/* @Mention Autocomplete Dropdown */}
      {showMentions && (
        <View style={styles.mentionList}>
          {mentionUsers.slice(0, 5).map((user) => (
            <Pressable
              key={user.id}
              style={styles.mentionItem}
              onPress={() => handleSelectMention(user.username ?? '')}
            >
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.mentionAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.mentionAvatar, styles.mentionAvatarFallback]}>
                  <Text style={styles.mentionAvatarText}>{(user.username ?? '?')[0].toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.mentionUsername}>@{user.username}</Text>
              {user.bio ? <Text style={styles.mentionBio} numberOfLines={1}>{user.bio}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}

      {/* Reply-Banner */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>
            Antwort an <Text style={styles.replyBannerUsername}>@{replyTo.username}</Text>
          </Text>
          <Pressable onPress={clearReply} hitSlop={10}>
            <X size={14} stroke="#9CA3AF" strokeWidth={2.5} />
          </Pressable>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: colors.border.subtle, backgroundColor: colors.bg.secondary }]}>
        <View style={styles.inputRowInner}>
          <View style={styles.avatarTiny}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarTinyImage} />
            ) : (
              <Text style={styles.avatarTinyText}>
                {profile?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            )}
          </View>
          <TextInput
            ref={inputRef}
            style={[styles.input, {
              color: colors.text.primary,
              backgroundColor: colors.bg.input,
              borderColor: colors.border.default,
            }]}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Kommentar schreiben..."
            placeholderTextColor="#4B5563"
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
          />
        </View>
        {/* @ Mention Schnell-Button */}
        <TouchableOpacity
          onPress={() => {
            setText((prev) => prev + '@');
            inputRef.current?.focus();
          }}
          style={[styles.sendBtn, { backgroundColor: colors.bg.elevated }]}
          activeOpacity={0.7}
        >
          <AtSign size={16} stroke="#6B7280" strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || addComment.isPending}
          style={[styles.sendBtn, (!text.trim() || addComment.isPending) && styles.sendBtnDisabled]}
          activeOpacity={0.7}
        >
          {addComment.isPending
            ? <ActivityIndicator color={colors.text.primary} size="small" />
            : <Send size={18} stroke={text.trim() ? colors.text.primary : colors.icon.muted} strokeWidth={2} />
          }
        </TouchableOpacity>
      </View>

      <CommentActionSheet
        visible={!!actionSheetComment}
        onClose={() => setActionSheetComment(null)}
        comment={actionSheetComment}
        isOwn={actionSheetComment?.user_id === profile?.id}
        onDelete={() => actionSheetComment && handleDelete(actionSheetComment.id)}
        onCopy={() => { }}
        onReplyWithVideo={handleReplyWithVideo}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

function CommentActionSheet({
  visible,
  onClose,
  comment,
  isOwn,
  onDelete,
  onCopy,
  onReplyWithVideo,
  bottomInset = 24,
}: {
  visible: boolean;
  onClose: () => void;
  comment: Comment | null;
  isOwn: boolean;
  onDelete: () => void;
  onCopy: (text: string) => void;
  onReplyWithVideo: (username: string) => void;
  bottomInset?: number;
}) {
  if (!visible) return null;

  const handleCopy = () => {
    if (comment?.text) {
      clipboardSetString(comment.text);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCopy(comment.text);
    }
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const handleReplyWithVideo = () => {
    onReplyWithVideo(comment?.profiles?.username ?? 'unknown');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={[styles.actionSheetOverlay, { paddingBottom: Math.max(bottomInset, 24) }]} onPress={onClose}>
        <Pressable style={styles.actionSheetContent} onPress={(e) => e.stopPropagation()}>
          {isOwn && (
            <View style={styles.actionSheetGroup}>
              <Pressable style={styles.actionSheetItem} onPress={handleDelete}>
                <Trash2 size={20} stroke="#EF4444" strokeWidth={2} />
                <Text style={styles.actionSheetItemTextDestructive}>Löschen</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.actionSheetGroup}>
            <Pressable style={[styles.actionSheetItem, styles.actionSheetItemBorder]} onPress={handleCopy}>
              <Copy size={20} stroke="#9CA3AF" strokeWidth={2} />
              <Text style={styles.actionSheetItemText}>Kopieren</Text>
            </Pressable>
            <Pressable style={styles.actionSheetItem} onPress={handleReplyWithVideo}>
              <Video size={20} stroke="#9CA3AF" strokeWidth={2} />
              <Text style={styles.actionSheetItemText}>Mit Video antworten</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * CommentRow
 *
 * Perf: `memo` + stabile Handler-Refs mit (id) / (comment) Signaturen statt
 * per-Item-Closures. Parent übergibt `onDelete` / `onReply` / `onLongPress`
 * über useCallback; CommentRow baut seine zero-arg Handler intern via
 * useCallback aus `comment`. So bleiben CommentRow-Props bei gleichem
 * `comment` referentiell identisch → `memo` überspringt Re-Renders
 * existierender Zeilen beim Tippen, Scrollen oder Time-Tick.
 */
function CommentRowComponent({
  comment,
  postId,
  isOwn,
  timeAgo,
  onDelete,
  onReply,
  onLongPress,
  isHighlighted,
  onUserPress,
  likeMap,
}: {
  comment: Comment;
  postId: string;
  isOwn: boolean;
  timeAgo: string;
  /** STABILE Handler (useCallback im Parent) — Row bindet sich selbst */
  onDelete: (commentId: string) => void;
  onReply: (commentId: string, username: string) => void;
  onLongPress: (comment: Comment) => void;
  isHighlighted?: boolean;
  onUserPress?: (userId: string) => void;
  likeMap?: CommentLikesMap;  // Batch-Daten aus SheetInner (Top-Level)
}) {
  const [showReplies, setShowReplies] = useState(false);
  const { data: replies = [] } = useCommentReplies(comment.id, showReplies);
  const { colors, isDark } = useTheme();

  // Batch-Daten priorisieren (Top-Level Kommentare), Fallback auf Einzelquery (Replies)
  const batchState = likeMap?.get(comment.id);
  const { liked: likedSingle, count: countSingle, toggle } = useCommentLike(comment.id);
  const liked = batchState?.liked ?? likedSingle;
  const count = batchState?.count ?? countSingle;

  const highlightOpacity = useSharedValue(0);
  useEffect(() => {
    if (isHighlighted) {
      highlightOpacity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 400 })
      );
    }
  }, [isHighlighted, highlightOpacity]);
  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(29,185,84,${highlightOpacity.value * 0.15})`,
    borderRadius: 12,
    marginHorizontal: -4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginVertical: -2,
  }));

  const handleUserPress = useCallback(() => {
    if (comment.user_id && onUserPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUserPress(comment.user_id);
    }
  }, [comment.user_id, onUserPress]);

  // Row-gebundene Binder: nehmen die stabilen Parent-Handler und bind'en
  // sie an die eigene `comment`-Identität. Per Item konstant, solange
  // sich das Comment-Objekt nicht ändert.
  const handleReply = useCallback(() => {
    onReply(comment.id, comment.profiles?.username ?? 'unknown');
  }, [onReply, comment.id, comment.profiles?.username]);

  const handleLongPress = useCallback(() => {
    onLongPress(comment);
  }, [onLongPress, comment]);

  return (
    <Pressable onLongPress={handleLongPress} delayLongPress={400}>
      <Animated.View style={[styles.commentRow, highlightStyle]}>
        {/* Avatar — klickbar → Profil */}
        <Pressable onPress={handleUserPress} disabled={!onUserPress}>
          <View style={styles.commentAvatar}>
            {comment.profiles?.avatar_url ? (
              <Image source={{ uri: comment.profiles.avatar_url }} style={styles.commentAvatarImage} />
            ) : (
              <Text style={styles.commentAvatarText}>
                {comment.profiles?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            )}
          </View>
        </Pressable>
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            {/* Username — klickbar → Profil */}
            <Pressable onPress={handleUserPress} disabled={!onUserPress}>
          <Text style={[styles.commentUsername, { color: colors.text.primary }]}>@{comment.profiles?.username ?? 'unknown'}</Text>
            </Pressable>
            <Text style={[styles.commentTime, { color: colors.text.muted }]}>{timeAgo}</Text>
          </View>
          <RichText text={comment.text} style={[styles.commentText, { color: colors.text.secondary }]} />
          {/* Aktionen: Antworten + Liken */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <Pressable onPress={handleReply} style={styles.commentReplyBtn} hitSlop={8}>
              <Text style={styles.commentReplyText}>Antworten</Text>
            </Pressable>
            {/* Like-Button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggle();
              }}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Kommentar nicht mehr liken' : 'Kommentar liken'}
            >
              <Heart
                size={13}
                color={liked ? '#F472B6' : colors.icon.muted}
                fill={liked ? '#F472B6' : 'transparent'}
                strokeWidth={2}
              />
              {count > 0 && (
                <Text style={{ color: liked ? '#F472B6' : colors.text.muted, fontSize: 11, fontWeight: '600' }}>
                  {count}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Antworten Toggle */}
        {replies.length > 0 && showReplies && (
          <Pressable onPress={() => setShowReplies(false)} hitSlop={8} style={{ marginLeft: 4, marginTop: 2 }}>
            <Text style={{ color: colors.text.secondary, fontSize: 12, fontWeight: '600' }}>Antworten ausblenden</Text>
          </Pressable>
        )}
        {!showReplies && (
          <Pressable onPress={() => setShowReplies(true)} hitSlop={8} style={{ marginLeft: 4, marginTop: 2 }}>
            <Text style={{ color: colors.text.muted, fontSize: 12 }}>── Antworten anzeigen</Text>
          </Pressable>
        )}
      </Animated.View>

      {/* eingerückte Antworten */}
      {showReplies && replies.map((reply) => (
        <View key={reply.id} style={{ paddingLeft: 48, marginTop: -4 }}>
          <CommentRow
            comment={reply}
            postId={postId}
            isOwn={reply.user_id === comment.user_id}
            timeAgo={(() => {
              const diff = (Date.now() - new Date(reply.created_at).getTime()) / 1000;
              if (diff < 60) return 'gerade eben';
              if (diff < 3600) return `${Math.floor(diff / 60)}m`;
              if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
              return `${Math.floor(diff / 86400)}d`;
            })()}
            onDelete={onDelete}
            onReply={onReply}
            onLongPress={onLongPress}
            onUserPress={onUserPress}
          />
        </View>
      ))}
    </Pressable>
  );
}

const CommentRow = memo(CommentRowComponent);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    // top + bottom werden durch animatedStyle gesetzt
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,10,0.97)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  postPreviewOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  postPreviewFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: SHEET_TOP,
    overflow: 'hidden',
    zIndex: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptySubText: { fontSize: 13 },
  commentsList: { padding: 16, gap: 20 },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#E8E8ED',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  commentAvatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  commentAvatarText: { color: '#555', fontSize: 13, fontWeight: '800' },
  commentBody: { flex: 1, gap: 4 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentUsername: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 20 },
  deleteBtn: { padding: 4, marginTop: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  avatarTiny: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E8E8ED',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  avatarTinyImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarTinyText: { color: '#555', fontSize: 12, fontWeight: '800' },
  input: {
    flex: 1, fontSize: 14,
    maxHeight: 100, paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  actionSheetContent: {
    gap: 8,
  },
  actionSheetGroup: {
    backgroundColor: 'rgba(30,30,30,0.98)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionSheetItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  actionSheetItemText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  actionSheetItemTextDestructive: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Reply Banner ──────────────────────────────────
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(29,185,84,0.07)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  replyBannerText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  replyBannerUsername: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ── Comment Reply Button ──────────────────────────
  commentReplyBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  commentReplyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── @Mention Autocomplete ─────────────────────────
  mentionList: {
    backgroundColor: 'rgba(15,15,20,0.98)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    maxHeight: 220,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  mentionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  mentionAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mentionUsername: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  mentionBio: {
    color: '#6B7280',
    fontSize: 12,
    flex: 2,
  },
});

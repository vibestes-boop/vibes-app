import { setStringAsync as clipboardSetString } from 'expo-clipboard';
import { AtSign,ChevronDown,Copy,Flag,Heart,ListFilter,Send,Trash2,Video,X } from 'lucide-react-native';
import { memo,useCallback,useEffect,useMemo,useRef,useState } from 'react';
import {
ActivityIndicator,
Alert,
Dimensions,
FlatList,
Keyboard,
Modal,
Platform,
Pressable,
StyleSheet,
Text,
TextInput,
View,
type KeyboardEvent,
} from 'react-native';
import {
Gesture,
GestureDetector,
GestureHandlerRootView,
TouchableOpacity,
} from 'react-native-gesture-handler';
import {
Easing,
Extrapolation,
interpolate,
runOnJS,
useAnimatedStyle,
useSharedValue,
withSequence,
withTiming,
type SharedValue,
} from 'react-native-reanimated';


import { RichText } from '@/components/ui/RichText';
import { useAuthStore } from '@/lib/authStore';
import { useCommentLike } from '@/lib/useCommentLike';
import { useAddComment,useCommentReplies,useComments,useDeleteComment,useToggleCommentLike,type Comment } from '@/lib/useComments';
import { useReportComment } from '@/lib/useReport';
import { useExploreUserSearch } from '@/lib/useExplore';
import { useTheme } from '@/lib/useTheme';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoGridThumb } from './VideoGridThumb';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Klassisch (post/[id], Story, user-posts …): Standbild-Preview oben ~22%.
const SHEET_TOP = SCREEN_HEIGHT * 0.22;
// Feed seamlessPeek: größerer Video-Peek ~40% (muss mit FeedItem
// COMMENTS_PEEK_FRAC übereinstimmen) → mehr Video, kleineres Kommentarfeld.
const SHEET_TOP_SEAMLESS = SCREEN_HEIGHT * 0.40;

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
  /** Feed-Vollbild: Oberkante durchsichtig lassen, damit das DARUNTERLIEGENDE,
      weiterlaufende (in-place geschrumpfte) Video durchscheint — kein zweiter
      Player, kein Neustart. Ohne diese Flag: klassisches Overlay + Standbild. */
  seamlessPeek?: boolean;
};

const CLOSE_DURATION = 300;
const OPEN_DURATION = 250;
const CLOSE_EASING = Easing.out(Easing.cubic);

export default function CommentsSheet({ postId, visible, onClose, mediaUrl, mediaType, thumbnailUrl, onUserPress, creatorUserId, sheetProgress, seamlessPeek }: Props) {
  // Feed-Peek (40%) vs. klassisch (22%) — bestimmt, wo das Sheet oben andockt.
  const sheetTop = seamlessPeek ? SHEET_TOP_SEAMLESS : SHEET_TOP;
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
    top: sheetTop,
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
        {/* Hintergrund – Tap schließt. Im seamlessPeek-Modus KEIN Dim-Overlay,
            damit das darunterliegende, weiterlaufende Video oben durchscheint. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          {!seamlessPeek && <Animated.View style={overlayStyle} pointerEvents="none" />}
        </Pressable>

        {/* Post + Sheet – gemeinsam ein-/ausblenden für weichen Übergang */}
        <Animated.View style={contentStyle} pointerEvents="box-none">
          {/* Standbild-Preview oben nur im klassischen Modus. Bei seamlessPeek
              zeigt der Feed sein eigenes, weiterlaufendes Video im Peek-Bereich. */}
          {!seamlessPeek && mediaUrl && (
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
                sheetTop={sheetTop}
              />
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
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
  sheetTop,
}: {
  postId: string;
  onClose: () => void;
  enabled: boolean;
  onUserPress?: (userId: string) => void;
  scrollAtTop: SharedValue<number>;
  panForList: ReturnType<typeof Gesture.Pan>;
  creatorUserId?: string | null;
  sheetTop: number;
}) {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: comments, isLoading } = useComments(postId, enabled);
  const addComment = useAddComment(postId);
  const deleteComment = useDeleteComment(postId);

  // ── N+1-Fix: Like-Daten kommen jetzt direkt aus useComments (RPC) ────────
  // Top-Level-Likes werden über diese Mutation im ['comments', postId]-Cache
  // optimistisch getoggelt → kein Per-Row-Like-Query mehr.
  const toggleCommentLike = useToggleCommentLike(postId);
  const handleTopLevelLike = useCallback(
    (commentId: string, liked: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleCommentLike.mutate({ commentId, liked });
    },
    [toggleCommentLike],
  );

  const [text, setText] = useState('');
  const [lastSentId, setLastSentId] = useState<string | null>(null);
  const [actionSheetComment, setActionSheetComment] = useState<Comment | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  // Replies-Expand zentral hier halten (statt lokal pro Row) → eine frische Antwort
  // klappt den Strang sofort auf, ohne Reload.
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(() => new Set());
  const toggleReplies = useCallback((commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }, []);

  // ── Sortierung/Filter (TikTok-Stil) ──────────────────────────────────────
  const [sortMode, setSortMode] = useState<'neueste' | 'top' | 'creator'>('neueste');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // ── @Mention Autocomplete ──────────────────────────────────
  const [, setMentionQuery] = useState<string | null>(null);
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
    const parentId = replyTo?.id;
    const wasReply = !!parentId;
    setText('');
    setReplyTo(null);
    setMentionQuery(null);
    setDebouncedMention(null);
    Keyboard.dismiss();
    const tempId = `temp-${Date.now()}`;
    // Bei einer Antwort den Strang sofort aufklappen → die neue Antwort ist direkt sichtbar.
    if (parentId) setExpandedReplies((prev) => new Set(prev).add(parentId));
    addComment.mutate(
      { text: trimmed, tempId, parentId },
      {
        onSuccess: (newComment) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setLastSentId(newComment.id);
          // Top-Level-Kommentare landen oben (neueste zuerst) → nach oben scrollen.
          // Replies bleiben verschachtelt → Position nicht wegspringen lassen.
          if (!wasReply) {
            timersRef.current.push(setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 50));
          }
          timersRef.current.push(setTimeout(() => setLastSentId(null), 1200));
        },
        onError: () => setText(trimmed),
      }
    );
  }, [text, addComment, replyTo]);

  const handleDelete = useCallback((comment: Comment) => {
    Alert.alert('Kommentar löschen', 'Möchtest du diesen Kommentar wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => deleteComment.mutate({ commentId: comment.id, parentId: comment.parent_id }) },
    ]);
  }, [deleteComment]);

  const { mutate: reportComment } = useReportComment();
  const handleReportComment = useCallback((comment: Comment) => {
    Alert.alert('Kommentar melden', 'Warum meldest du diesen Kommentar?', [
      { text: 'Spam', onPress: () => { reportComment({ commentId: comment.id, reason: 'spam' }); Alert.alert('Danke', 'Meldung eingegangen — wir prüfen das.'); } },
      { text: 'Belästigung', onPress: () => { reportComment({ commentId: comment.id, reason: 'harassment' }); Alert.alert('Danke', 'Meldung eingegangen — wir prüfen das.'); } },
      { text: 'Unangemessen', onPress: () => { reportComment({ commentId: comment.id, reason: 'inappropriate' }); Alert.alert('Danke', 'Meldung eingegangen — wir prüfen das.'); } },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }, [reportComment]);

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
        currentUserId={profile?.id}
        timeAgo={timeAgo(item.created_at)}
        onDelete={handleDelete}
        onReply={handleReplyTo}
        onLongPress={handleLongPressComment}
        isHighlighted={item.id === lastSentId}
        onUserPress={onUserPress}
        onTopLevelLike={handleTopLevelLike}
        isRepliesExpanded={expandedReplies.has(item.id)}
        onToggleReplies={toggleReplies}
      />
    ),
    [postId, profile?.id, handleDelete, handleReplyTo, handleLongPressComment, lastSentId, onUserPress, handleTopLevelLike, expandedReplies, toggleReplies],
  );

  // Gesamtzahl inkl. Antworten (aus geladenen Daten) — für den Header.
  const commentTotal = (comments ?? []).reduce((sum, c) => sum + 1 + (c.reply_count ?? 0), 0);

  // Sortierte/gefilterte Top-Level-Liste je nach gewähltem Modus.
  const sortedComments = useMemo(() => {
    const list = comments ?? [];
    if (sortMode === 'top') {
      return [...list].sort(
        (a, b) => (b.like_count ?? 0) - (a.like_count ?? 0) || b.created_at.localeCompare(a.created_at)
      );
    }
    if (sortMode === 'creator' && creatorUserId) {
      return list.filter((c) => c.user_id === creatorUserId);
    }
    return list; // 'neueste' — kommt bereits neueste-zuerst aus useComments
  }, [comments, sortMode, creatorUserId]);

  const sortOptions = useMemo(
    () => [
      { key: 'neueste' as const, label: 'Neueste' },
      { key: 'top' as const, label: 'Top' },
      ...(creatorUserId ? [{ key: 'creator' as const, label: 'Von Creator' }] : []),
    ],
    [creatorUserId]
  );
  const activeSortLabel = sortOptions.find((o) => o.key === sortMode)?.label ?? 'Neueste';

  return (
    <View style={[{ flex: 1 }, { backgroundColor: colors.bg.secondary }]}>
      {/* Handle + Header */}
      <View>
        <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
        <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            {commentTotal > 0 ? `${commentTotal} ${commentTotal === 1 ? 'Kommentar' : 'Kommentare'}` : 'Kommentare'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Sortier-Pille (TikTok-Stil) */}
            <Pressable
              onPress={() => setSortMenuOpen(true)}
              style={[styles.sortPill, { backgroundColor: colors.bg.elevated }]}
              hitSlop={6}
            >
              <ListFilter size={14} color={colors.text.secondary} strokeWidth={2} />
              <Text style={[styles.sortPillText, { color: colors.text.secondary }]}>{activeSortLabel}</Text>
              <ChevronDown size={13} color={colors.text.muted} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} stroke="#6B7280" strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Sort-Menü (Dropdown) */}
      {sortMenuOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSortMenuOpen(false)}>
          <Pressable style={styles.sortMenuOverlay} onPress={() => setSortMenuOpen(false)}>
            <Pressable
              style={[styles.sortMenu, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle, marginTop: sheetTop + 52 }]}
              onPress={(e) => e.stopPropagation()}
            >
              {sortOptions.map((opt, i) => {
                const active = opt.key === sortMode;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSortMode(opt.key);
                      setSortMenuOpen(false);
                    }}
                    style={[styles.sortMenuItem, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle }]}
                  >
                    <Text style={[styles.sortMenuItemText, { color: active ? colors.text.primary : colors.text.secondary, fontWeight: active ? '700' : '500' }]}>
                      {opt.label}
                    </Text>
                    {active && <Text style={{ color: colors.text.primary, fontSize: 15 }}>✓</Text>}
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Kommentarliste */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text.primary} />
        </View>
      ) : sortedComments.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.text.muted }]}>
            {sortMode === 'creator' ? 'Noch keine Kommentare vom Creator.' : 'Noch keine Kommentare.'}
          </Text>
          {sortMode !== 'creator' && (
            <Text style={[styles.emptySubText, { color: colors.text.muted }]}>Sei der Erste! 💬</Text>
          )}
        </View>
      ) : (
        <GestureDetector gesture={panForList}>
          <FlatList
            ref={listRef}
            data={sortedComments}
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
        <View style={[styles.mentionList, { backgroundColor: colors.bg.elevated, borderTopColor: colors.border.subtle }]}>
          {mentionUsers.slice(0, 5).map((user) => (
            <Pressable
              key={user.id}
              style={styles.mentionItem}
              onPress={() => handleSelectMention(user.username ?? '')}
            >
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.mentionAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.mentionAvatar, styles.mentionAvatarFallback, { backgroundColor: colors.bg.subtle }]}>
                  <Text style={[styles.mentionAvatarText, { color: colors.text.secondary }]}>{(user.username ?? '?')[0].toUpperCase()}</Text>
                </View>
              )}
              <Text style={[styles.mentionUsername, { color: colors.text.primary }]}>@{user.username}</Text>
              {user.bio ? <Text style={styles.mentionBio} numberOfLines={1}>{user.bio}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}

      {/* Reply-Banner */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <Text style={[styles.replyBannerText, { color: colors.text.muted }]}>
            Antwort an <Text style={[styles.replyBannerUsername, { color: colors.text.primary }]}>@{replyTo.username}</Text>
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
        onDelete={() => actionSheetComment && handleDelete(actionSheetComment)}
        onReport={() => actionSheetComment && handleReportComment(actionSheetComment)}
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
  onReport,
  onCopy,
  onReplyWithVideo,
  bottomInset = 24,
}: {
  visible: boolean;
  onClose: () => void;
  comment: Comment | null;
  isOwn: boolean;
  onDelete: () => void;
  onReport: () => void;
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
          {!isOwn && (
            <View style={styles.actionSheetGroup}>
              <Pressable style={styles.actionSheetItem} onPress={() => { onReport(); onClose(); }}>
                <Flag size={20} stroke="#EF4444" strokeWidth={2} />
                <Text style={styles.actionSheetItemTextDestructive}>Melden</Text>
              </Pressable>
            </View>
          )}
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
  currentUserId,
  timeAgo,
  onDelete,
  onReply,
  onLongPress,
  isHighlighted,
  onUserPress,
  onTopLevelLike,
  isReply,
  isRepliesExpanded,
  onToggleReplies,
}: {
  comment: Comment;
  postId: string;
  isOwn: boolean;
  /** Eingeloggter User — für korrektes isOwn bei verschachtelten Replies */
  currentUserId?: string;
  timeAgo: string;
  /** STABILE Handler (useCallback im Parent) — Row bindet sich selbst */
  onDelete: (comment: Comment) => void;
  onReply: (commentId: string, username: string) => void;
  onLongPress: (comment: Comment) => void;
  isHighlighted?: boolean;
  onUserPress?: (userId: string) => void;
  /** Nur für Top-Level gesetzt: Like-Toggle über den ['comments']-Cache.
   *  Bei Replies undefined → Fallback auf useCommentLike-Einzelquery. */
  onTopLevelLike?: (commentId: string, liked: boolean) => void;
  /** true für eingerückte Antwort-Zeilen → kleineres Avatar, dezenter */
  isReply?: boolean;
  /** Replies-Expand wird vom Parent (SheetInner) gehalten → sofortiges Auto-Aufklappen nach Antworten */
  isRepliesExpanded?: boolean;
  onToggleReplies?: (commentId: string) => void;
}) {
  const showReplies = isRepliesExpanded ?? false;
  const { data: replies = [] } = useCommentReplies(comment.id, showReplies);
  const { colors } = useTheme();

  // Top-Level (RPC liefert like_count) → Daten direkt aus dem Comment,
  // Toggle via onTopLevelLike. Reply (kein like_count) → Einzelquery-Fallback.
  const hasRpcLike = comment.like_count !== undefined;
  const { liked: likedSingle, count: countSingle, toggle: toggleSingle } = useCommentLike(comment.id, { enabled: !hasRpcLike });
  const liked = hasRpcLike ? !!comment.liked_by_me : likedSingle;
  const count = hasRpcLike ? (comment.like_count ?? 0) : countSingle;
  const handleToggleLike = useCallback(() => {
    if (hasRpcLike) {
      onTopLevelLike?.(comment.id, !!comment.liked_by_me);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSingle();
    }
  }, [hasRpcLike, onTopLevelLike, comment.id, comment.liked_by_me, toggleSingle]);
  const replyCount = comment.reply_count ?? 0;

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
    // Antwort immer an den Top-Level-Strang hängen (1-Level wie TikTok): bei einer
    // Reply-Zeile auf deren parent_id zielen, sonst auf die eigene id. So bleiben
    // Antworten-auf-Antworten im selben sichtbaren Thread.
    const targetId = comment.parent_id ?? comment.id;
    onReply(targetId, comment.profiles?.username ?? 'unknown');
  }, [onReply, comment.parent_id, comment.id, comment.profiles?.username]);

  const handleLongPress = useCallback(() => {
    onLongPress(comment);
  }, [onLongPress, comment]);

  return (
    <Pressable onLongPress={handleLongPress} delayLongPress={400}>
      <Animated.View style={[styles.commentRow, highlightStyle]}>
        {/* Avatar — klickbar → Profil */}
        <Pressable onPress={handleUserPress} disabled={!onUserPress}>
          <View style={[styles.commentAvatar, isReply && styles.commentAvatarReply]}>
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
          {/* Antworten-Link (Like sitzt rechts als eigene Spalte) */}
          <Pressable onPress={handleReply} style={styles.commentReplyBtn} hitSlop={8}>
            <Text style={[styles.commentReplyText, { color: colors.text.muted }]}>Antworten</Text>
          </Pressable>

          {/* Antworten-Toggle — NUR wenn es tatsächlich Antworten gibt, mit Anzahl (TikTok-Stil) */}
          {replyCount > 0 && (
            <Pressable
              onPress={() => onToggleReplies?.(comment.id)}
              hitSlop={8}
              style={styles.repliesToggle}
            >
              <View style={[styles.repliesToggleLine, { backgroundColor: colors.border.default }]} />
              <Text style={[styles.repliesToggleText, { color: colors.text.muted }]}>
                {showReplies
                  ? 'Antworten ausblenden'
                  : `${replyCount} ${replyCount === 1 ? 'Antwort' : 'Antworten'} anzeigen`}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Like-Spalte rechts (TikTok-Stil): Herz + Anzahl vertikal */}
        <Pressable
          onPress={handleToggleLike}
          hitSlop={8}
          style={styles.likeColumn}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Kommentar nicht mehr liken' : 'Kommentar liken'}
        >
          <Heart
            size={18}
            color={liked ? '#F472B6' : colors.icon.muted}
            fill={liked ? '#F472B6' : 'transparent'}
            strokeWidth={2}
          />
          {count > 0 && (
            <Text style={[styles.likeColumnCount, { color: liked ? '#F472B6' : colors.text.muted }]}>
              {count}
            </Text>
          )}
        </Pressable>
      </Animated.View>

      {/* eingerückte Antworten */}
      {showReplies && replies.map((reply) => (
        <View key={reply.id} style={styles.replyRowWrap}>
          <CommentRow
            comment={reply}
            postId={postId}
            isReply
            isOwn={reply.user_id === currentUserId}
            currentUserId={currentUserId}
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
  // ── Sortier-Pille + Menü ──────────────────────────────────────────
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sortPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  sortMenu: {
    minWidth: 190,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  sortMenuItemText: {
    fontSize: 15,
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
  commentAvatarReply: {
    width: 26, height: 26, borderRadius: 13,
  },
  replyRowWrap: {
    paddingLeft: 44,
    marginTop: 14,
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

  // ── Like-Spalte rechts (TikTok-Stil) ──────────────────────────────
  likeColumn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    paddingTop: 2,
    minWidth: 30,
    flexShrink: 0,
  },
  likeColumnCount: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Antworten-Toggle (nur wenn Antworten existieren) ──────────────
  repliesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  repliesToggleLine: {
    width: 24,
    height: StyleSheet.hairlineWidth,
  },
  repliesToggleText: {
    fontSize: 13,
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

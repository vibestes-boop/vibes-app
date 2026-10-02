import { StudioBackdrop } from '@/components/ui/StudioBackdrop';
import { InboxToolbar } from '@/components/messages/InboxToolbar';
import { NewMessageModal } from '@/components/messages/NewMessageModal';
import { Image as ExpoImage } from 'expo-image';
import { MessagesSkeleton } from '@/components/messages/MessagesSkeleton';
import { FONT_SIZE,FONT_WEIGHT,RADII,SPACE } from '@/lib/tokens';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import {
Alert,
Pressable,
RefreshControl,
StyleSheet,
Text,
View,
} from 'react-native';


import { FlashList } from '@shopify/flash-list';
import { router,useFocusEffect,useLocalSearchParams } from 'expo-router';
import { AlertCircle,Bookmark,CheckCheck,MessageCircle,PenSquare,SearchX,X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoriesRow } from '@/components/ui/StoriesRow';
import { useAuthStore } from '@/lib/authStore';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import { supabase } from '@/lib/supabase';
import { useActiveLiveSessions } from '@/lib/useLiveSession';
import { useConversations,useOrCreateConversation,type Conversation } from '@/lib/useMessages';
import { useGuildStories,type StoryGroup } from '@/lib/useStories';
import { timeAgo } from '@/lib/timeAgo';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

function ConvItem({
  item,
  onDelete,
  storyGroup,
  isLive,
  onAvatarPress,
  currentUserId,
  ownAvatarUrl,
  ownUsername,
}: {
  item: Conversation;
  onDelete: () => void;
  storyGroup?: { hasUnviewed: boolean } | null;
  isLive?: boolean;
  onAvatarPress?: () => void;
  currentUserId?: string;
  ownAvatarUrl?: string | null;
  ownUsername?: string | null;
}) {
  const isSelfChat = item.other_user.id === currentUserId;
  const displayAvatarUrl = isSelfChat ? (ownAvatarUrl ?? item.other_user.avatar_url) : item.other_user.avatar_url;
  const displayUsername = isSelfChat ? (ownUsername ?? item.other_user.username) : item.other_user.username;
  const initial = (displayUsername ?? '?')[0].toUpperCase();
  const hasUnread = item.unread_count > 0;
  const hasStory = !!storyGroup && !isSelfChat;
  const hasUnviewed = storyGroup?.hasUnviewed ?? false;
  const { colors, isDark } = useTheme();
  const { t } = useI18n();

  // Generiere eine konsistente Farbe pro Username-Initial
  const fallbackBg = isDark ? 'rgba(255,255,255,0.14)' : '#E8E8ED';

  return (
    <Pressable
      style={[styles.item, hasUnread && { backgroundColor: colors.bg.elevated }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/messages/[id]', params: { id: item.id, username: displayUsername ?? '', avatarUrl: displayAvatarUrl ?? '', otherUserId: item.other_user.id ?? '' } });
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
          t(isSelfChat ? 'inbox.deleteNotes' : 'inbox.deleteChat'),
          t('inbox.deleteWarning'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('inbox.deleteAction'), style: 'destructive', onPress: onDelete },
          ]
        );
      }}
      delayLongPress={500}
      accessibilityRole="button"
      accessibilityLabel={t(isSelfChat ? 'inbox.myNotes' : 'inbox.openChat', { name: displayUsername ?? '?' })}
    >
      {hasUnread && <View style={[styles.unreadDot, { backgroundColor: colors.accent.primary }]} />}

      {/* Avatar mit Story-Ring + Live-Badge */}
      <Pressable
        style={styles.avatarWrap}
        onPress={(e) => {
          e.stopPropagation();
          if (isSelfChat) { router.push({ pathname: '/messages/[id]', params: { id: item.id, otherUserId: item.other_user.id } }); return; }
          if (onAvatarPress) { onAvatarPress(); return; }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (item.other_user.id) {
            router.push({ pathname: '/user/[id]', params: { id: item.other_user.id } });
          }
        }}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t(isSelfChat ? 'inbox.myNotes' : hasStory ? 'inbox.openStory' : 'inbox.openProfile', { name: displayUsername ?? '?' })}
      >
        {/* Story-Ring */}
        {hasStory && !isLive && (
          <View style={[
            styles.storyRing,
            hasUnviewed ? { borderColor: colors.accent.primary } : [styles.storyRingSeen, { borderColor: colors.border.strong }],
          ]} />
        )}
        {/* Live-Ring */}
        {isLive && !isSelfChat && (
          <View style={styles.liveRing} />
        )}

        {displayAvatarUrl ? (
          <ExpoImage
            source={{ uri: displayAvatarUrl }}
            style={[
              styles.avatar,
              { borderColor: colors.border.strong },
              (hasStory || isLive) && styles.avatarWithRing,
            ]}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            accessibilityLabel={isSelfChat ? 'Mein Profilbild' : `@${displayUsername ?? 'Nutzer'} Profilbild`}
          />
        ) : (
        <View style={[
            styles.avatar,
            styles.avatarFallback,
            { backgroundColor: fallbackBg },
            (hasStory || isLive) && styles.avatarWithRing,
          ]}>
            {isSelfChat
              ? <Bookmark size={24} color={colors.text.primary} strokeWidth={2} />
              : <Text style={[styles.avatarInitial, { color: colors.text.primary }]}>{initial}</Text>
            }
          </View>
        )}

        {/* LIVE-Badge */}
        {isLive && !isSelfChat && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
      </Pressable>

      {/* Text */}
      <View style={styles.textWrap}>
        <View style={styles.nameRow}>
          <View style={styles.selfChatLabel}>
            {isSelfChat && <Bookmark size={13} color={colors.accent.primary} strokeWidth={2} style={{ marginRight: 4 }} />}
          <Text numberOfLines={1} style={[styles.username, hasUnread && styles.usernameUnread, isSelfChat && styles.selfChatUsername, { color: hasUnread ? colors.text.primary : colors.text.secondary }]}>
              {isSelfChat ? t('inbox.myNotes') : `@${displayUsername ?? '?'}`}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: colors.text.muted }]}>{timeAgo(item.last_message_at)}</Text>
        </View>
        <Text
          style={[styles.preview, hasUnread && styles.previewUnread, { color: hasUnread ? colors.text.secondary : colors.text.muted }]}
          numberOfLines={1}
        >
          {item.last_message ?? t(isSelfChat ? 'inbox.notesHint' : 'inbox.startConversation')}
        </Text>
      </View>

      {/* Ungelesen-Badge */}
      {hasUnread && (
        <View style={[styles.badge, { backgroundColor: colors.accent.solid }]}>
          <Text style={[styles.badgeText, { color: colors.text.onAccent }]}>
            {item.unread_count > 9 ? '9+' : String(item.unread_count)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Stabiler Separator — kein inline-Closure damit FlashList nicht re-mounted */
function ConvSeparator() {
  const { colors } = useTheme();
  return <View style={[styles.separator, { backgroundColor: colors.border.subtle }]} />;
}

export default function MessagesScreen() {
  const { t } = useI18n();
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { preSelectUserId } = useLocalSearchParams<{ preSelectUserId?: string }>();
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [openError, setOpenError] = useState(false);
  const [openRetry, setOpenRetry] = useState(0);
  const deleting = useRef(false);
  const { data: convs = [], isLoading, isError, refetch, isRefetching } = useConversations();
  const queryClient = useQueryClient();
  const { mutateAsync: openConv } = useOrCreateConversation();
  // Eigene Profildaten für Selbst-Chat-Anzeige
  // Fallback: direkt aus Supabase laden falls authStore avatar_url fehlt
  const { profile } = useAuthStore();
  const ownUserId = profile?.id;
  const ownUsername = profile?.username ?? null;
  const ownAvatarUrl = profile?.avatar_url ?? null;
  const filtered = useMemo(() => convs.filter(item => (!unreadOnly || item.unread_count > 0) && (!query.trim() || `${item.other_user.id === ownUserId ? t('inbox.myNotes') : item.other_user.username ?? ''} ${item.last_message ?? ''}`.toLocaleLowerCase().includes(query.trim().replace(/^@/, '').toLocaleLowerCase()))), [convs, unreadOnly, query, ownUserId, t]);
  const unreadCount = convs.filter(item => item.unread_count > 0).length;
  const recent = useMemo(() => Array.from(new Map(convs.filter(item => item.other_user.id !== ownUserId).map(item => [item.other_user.id, item.other_user])).values()).slice(0, 8), [convs, ownUserId]);

  // ── Stories & Live Sessions ──────────────────────────────────────────────
  const { data: storyGroups = [], refetch: refetchStories, isRefetching: isRefetchingStories } = useGuildStories();
  const { data: liveSessions = [] } = useActiveLiveSessions();
  const openStory = useStoryViewerStore((s) => s.open);
  const storyGroupMap = useMemo(() => new Map(storyGroups.map((g) => [g.userId, g])), [storyGroups]);



  const handleOpenStory = useCallback(
    (group: StoryGroup) => {
      openStory(group, storyGroups);
      router.push('/story-viewer' as any);
    },
    [openStory, storyGroups],
  );

  // Beim Tab-Wechsel Stories frisch laden
  useFocusEffect(
    useCallback(() => {
      refetchStories();
    }, [refetchStories]),
  );

  // DM-Button aus Live Watch: sofort Konversation mit Host öffnen
  useEffect(() => {
    if (!preSelectUserId || !ownUserId) return;
    setOpenError(false);
    let mounted = true; // Memory-Leak Guard: verhindert State-Update nach Unmount
    openConv(preSelectUserId)
      .then((convId) => {
        if (!mounted || useAuthStore.getState().profile?.id !== ownUserId) return;
        router.setParams({ preSelectUserId: undefined });
        router.push({ pathname: '/messages/[id]', params: { id: convId } });
      })
      .catch(() => { if (mounted) setOpenError(true); });
    return () => { mounted = false; };
    // openConv ist stabil (useMutation ref), router ist stabil (expo-router)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectUserId, ownUserId, openRetry]);

  // Only remove confirmed deletions, from this account's actual query cache.
  const handleDeleteConv = useCallback(async (convId: string) => {
    if (deleting.current || !ownUserId) return;
    deleting.current = true; setActionError(false);
    try {
      const { data, error } = await supabase.from('conversations').delete().eq('id', convId).select('id');
      if (error || !data?.some(item => item.id === convId)) throw error ?? new Error('Deletion was not confirmed');
      queryClient.setQueryData<Conversation[]>(['conversations', ownUserId], (old = []) => old.filter(item => item.id !== convId));
      void queryClient.invalidateQueries({ queryKey: ['conversations', ownUserId] });
    } catch { if (useAuthStore.getState().profile?.id === ownUserId) setActionError(true); }
    finally { deleting.current = false; }
  }, [queryClient, ownUserId]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const otherId = item.other_user.id;
      const storyGroup = storyGroupMap.get(otherId) ?? null;
      const isLive = liveSessions.some((s: any) => s.host_id === otherId || s.user_id === otherId);
      return (
        <ConvItem
          item={item}
          onDelete={() => void handleDeleteConv(item.id)}
          storyGroup={storyGroup}
          isLive={isLive}
          onAvatarPress={storyGroup ? () => handleOpenStory(storyGroup) : undefined}
          currentUserId={ownUserId}
          ownAvatarUrl={ownAvatarUrl}
          ownUsername={ownUsername}
        />
      );
    },
    [handleDeleteConv, storyGroupMap, liveSessions, handleOpenStory, ownUserId, ownAvatarUrl, ownUsername],
  );

  // Pull-to-Refresh: Conversations UND Stories gleichzeitig
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), refetchStories()]);
  }, [refetch, refetchStories]);

  const isRefreshingAny = isRefetching || isRefetchingStories;

  // Stories+Live Row als ListHeader — immer sichtbar (zeigt mindestens eigenen Add-Story-Button)
  const ListHeader = useMemo(() => !query.trim() && !unreadOnly && (storyGroups.length > 0 || liveSessions.length > 0) ? (
    <StoriesRow
      groups={storyGroups}
      liveSessions={liveSessions}
      onSelectGroup={handleOpenStory}
      onAddStory={() => router.push('/create-story' as any)}
    />
  ) : null, [storyGroups, liveSessions, handleOpenStory, query, unreadOnly]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.bg.primary }]}>
      <StudioBackdrop />
      {showNew && <NewMessageModal onClose={() => setShowNew(false)} recent={recent} />}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('tabs.messages')}</Text>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowNew(true); }}
          style={[styles.composeBtn, { backgroundColor: colors.text.primary }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('nativeUi.newMessage')}
        >
          <PenSquare size={20} color={colors.bg.primary} strokeWidth={2} />
        </Pressable>
      </View>


      <InboxToolbar query={query} onQueryChange={setQuery} unreadOnly={unreadOnly} onFilterChange={setUnreadOnly} unreadCount={unreadCount} />
      {(actionError || openError || (isError && convs.length > 0)) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, padding: 12, borderRadius: 14, backgroundColor: colors.bg.elevated }}>
        <Text accessibilityRole="alert" style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.text.secondary }}>{t(actionError ? 'inbox.deleteError' : openError ? 'inbox.openError' : 'inbox.refreshError')}</Text>
        {actionError ? <Pressable onPress={() => setActionError(false)} accessibilityRole="button" accessibilityLabel={t('mobileDesign.close')} style={{ padding: 12 }}><X size={18} color={colors.text.primary} /></Pressable> : <Pressable onPress={() => openError ? setOpenRetry(n => n + 1) : void refetch()} accessibilityRole="button" style={{ padding: 10 }}><Text style={{ color: colors.accent.primary, fontWeight: '600' }}>{t('nativeUi.retry')}</Text></Pressable>}
      </View>}
      {/* Alles in einer FlashList: Stories als Header + Conversations als Body.
          So deckt Pull-to-Refresh sowohl Stories als auch Nachrichten ab. */}
      {isLoading && convs.length === 0 ? (
        <>
          {ListHeader}
          <MessagesSkeleton count={8} />
        </>
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={80}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.center}>
              {isError ? <AlertCircle size={42} color={colors.icon.muted} /> : query.trim() ? <SearchX size={42} color={colors.icon.muted} /> : unreadOnly ? <CheckCheck size={42} color={colors.accent.primary} /> : <MessageCircle size={42} color={colors.icon.muted} />}
              <Text accessibilityRole={isError ? 'alert' : undefined} style={[styles.emptyTitle, { color: colors.text.primary }]}>{t(isError ? 'inbox.loadError' : query.trim() ? 'inbox.noChats' : unreadOnly ? 'inbox.allRead' : 'messages.emptyTitle')}</Text>
              <Text style={[styles.emptyDesc, { color: colors.text.secondary }]}>{t(isError ? 'inbox.loadErrorBody' : query.trim() ? 'inbox.noChatsBody' : unreadOnly ? 'inbox.allReadBody' : 'messages.emptyDesc')}</Text>
              <Pressable onPress={() => { if (isError) void refetch(); else if (query.trim() || unreadOnly) { setQuery(''); setUnreadOnly(false); } else setShowNew(true); }} accessibilityRole="button" style={[styles.emptyBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}>
                <Text style={[styles.emptyBtnText, { color: colors.accent.primary }]}>{t(isError ? 'nativeUi.retry' : query.trim() || unreadOnly ? 'inbox.showAll' : 'messages.newMessage')}</Text>
              </Pressable>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={ConvSeparator}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingAny}
              onRefresh={handleRefresh}
              tintColor={colors.accent.primary}
            />
          }
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },  // backgroundColor via inline
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor via inline
  },
  title: { fontSize: 25, fontFamily: 'Inter_700Bold', fontWeight: FONT_WEIGHT.bold, letterSpacing: -0.5, flex: 1 }, // color via inline
  composeBtn: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.md, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 60 },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginTop: SPACE.sm }, // color via inline
  emptyDesc: { fontSize: FONT_SIZE.sm, textAlign: 'center', maxWidth: 240, lineHeight: 20 }, // color via inline
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.base,
    paddingVertical: 11,
    gap: 14,
    position: 'relative',
  },
  itemUnread: { backgroundColor: 'rgba(0,122,255,0.04)' },
  unreadDot: {
    position: 'absolute', left: 6, top: '50%',
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#007AFF', marginTop: -3,
  },
  // v1.26.9: Avatare größer (52→60) für bessere Erkennbarkeit (WhatsApp/iMessage-Niveau)
  avatarWrap: { position: 'relative', width: 60, height: 60 },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 0 },
  avatarWithRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 0, position: 'absolute', top: 4, left: 4 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
  // Story-Ring: Foto-Feed-Style Gradient-Rand
  storyRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 32, borderWidth: 2.5,
  },
  storyRingActive: { borderColor: '#E1306C' }, // Foto-Feed Gradient-Farbe (vereinfacht)
  storyRingSeen: { borderColor: 'rgba(255,255,255,0.25)' },
  // Live-Ring: roter leuchtender Rand
  liveRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 28, borderWidth: 2.5, borderColor: '#EF4444',
  },
  // LIVE-Badge
  liveBadge: {
    position: 'absolute', bottom: -1, left: '50%',
    transform: [{ translateX: -16 }],
    backgroundColor: '#EF4444',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1.5, borderColor: '#050508',
  },
  liveBadgeText: { color: '#fff', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  // Selbst-Chat "Meine Notizen"
  avatarSelf: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  selfChatLabel: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 10 },
  selfChatUsername: { color: '#FFFFFF', fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#34D399', borderWidth: 2, borderColor: '#050508',
  },
  textWrap: { flex: 1, minWidth: 0, gap: 5 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  username: { flexShrink: 1, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, letterSpacing: -0.1 },
  usernameUnread: { fontWeight: FONT_WEIGHT.bold },
  preview: { fontSize: 13.5, lineHeight: 18 },
  previewUnread: { fontWeight: FONT_WEIGHT.medium },
  timeText: { fontSize: FONT_SIZE.xs },
  badge: {
    minWidth: 20, height: 20, borderRadius: RADII.full,
    backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACE.xs,
  },
  badgeText: { color: '#FFFFFF', fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 84 },
  emptyBtn: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

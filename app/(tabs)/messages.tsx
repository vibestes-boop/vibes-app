import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl,
  Modal, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';


import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MessageCircle, PenSquare, Search, X, Bookmark } from 'lucide-react-native';

import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useConversations, useOrCreateConversation, type Conversation } from '@/lib/useMessages';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StoriesRow } from '@/components/ui/StoriesRow';
import { useGuildStories, type StoryGroup } from '@/lib/useStories';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import { useActiveLiveSessions } from '@/lib/useLiveSession';
import { useTheme } from '@/lib/useTheme';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return `${d}d`;
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}min`;
  return 'Jetzt';
}

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

  // Generiere eine konsistente Farbe pro Username-Initial
  const fallbackBg = isDark ? 'rgba(255,255,255,0.14)' : '#E8E8ED';

  return (
    <Pressable
      style={[styles.item, hasUnread && styles.itemUnread]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/messages/[id]', params: { id: item.id, username: displayUsername ?? '', avatarUrl: displayAvatarUrl ?? '', otherUserId: item.other_user.id ?? '' } });
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
          isSelfChat ? 'Notizen löschen' : 'Konversation löschen',
          isSelfChat ? 'Meine Notizen löschen?' : `Chat mit @${displayUsername ?? '?'} löschen?`,
          [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Löschen', style: 'destructive', onPress: onDelete },
          ]
        );
      }}
      delayLongPress={500}
      accessibilityRole="button"
      accessibilityLabel={isSelfChat ? 'Meine Notizen' : `Chat mit @${displayUsername ?? 'Nutzer'} öffnen`}
    >
      {hasUnread && <View style={styles.unreadDot} />}

      {/* Avatar mit Story-Ring + Live-Badge */}
      <Pressable
        style={styles.avatarWrap}
        onPress={(e) => {
          e.stopPropagation();
          if (isSelfChat) return; // Selbst-Chat: kein Profil-Push
          if (onAvatarPress) { onAvatarPress(); return; }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (item.other_user.id) {
            router.push({ pathname: '/user/[id]', params: { id: item.other_user.id } });
          }
        }}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={isSelfChat ? 'Meine Notizen' : `@${displayUsername ?? 'Nutzer'} Profil anzeigen`}
      >
        {/* Story-Ring */}
        {hasStory && !isLive && (
          <View style={[
            styles.storyRing,
            hasUnviewed ? styles.storyRingActive : styles.storyRingSeen,
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
            {isSelfChat && <Bookmark size={13} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 4 }} />}
          <Text style={[styles.username, hasUnread && styles.usernameUnread, isSelfChat && styles.selfChatUsername, { color: hasUnread ? colors.text.primary : colors.text.secondary }]}>
              {isSelfChat ? 'Meine Notizen' : `@${displayUsername ?? '?'}`}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: colors.text.muted }]}>{timeAgo(item.last_message_at)}</Text>
        </View>
        <Text
          style={[styles.preview, hasUnread && styles.previewUnread, { color: hasUnread ? colors.text.secondary : colors.text.muted }]}
          numberOfLines={1}
        >
          {item.last_message ?? (isSelfChat ? 'Speichere Notizen, Links & Posts…' : 'Konversation starten…')}
        </Text>
      </View>

      {/* Ungelesen-Badge */}
      {hasUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {item.unread_count > 9 ? '9+' : String(item.unread_count)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

type UserResult = { id: string; username: string | null; avatar_url: string | null };

function NewMessageModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const { mutateAsync: openConv, isPending } = useOrCreateConversation();
  const { colors } = useTheme();

  const { data: results = [], isFetching } = useQuery<UserResult[]>({
    queryKey: ['user-search-dm', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query.trim()}%`)
        .neq('id', currentUserId ?? '')
        .limit(20);
      return (data ?? []) as UserResult[];
    },
    enabled: query.trim().length > 0,
    staleTime: 0,
  });

  const handleSelect = async (user: UserResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const convId = await openConv(user.id);
    onClose();
    router.push({ pathname: '/messages/[id]', params: { id: convId, username: user.username ?? '', avatarUrl: user.avatar_url ?? '', otherUserId: user.id } });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[modal.sheet, { backgroundColor: colors.bg.primary }]}>
        <View style={modal.handle} />
        <View style={[modal.header, { borderBottomColor: colors.border.subtle }]}>
          <Text style={[modal.title, { color: colors.text.primary }]}>Neue Nachricht</Text>
          <Pressable onPress={onClose} style={modal.closeBtn} hitSlop={10}>
            <X size={20} color={colors.icon.muted} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Suchfeld */}
        <View style={[modal.searchBar, { backgroundColor: colors.bg.input, borderColor: colors.border.default }]}>
          <Search size={16} color={colors.icon.muted} strokeWidth={2} />
          <TextInput
            style={[modal.searchInput, { color: colors.text.primary }]}
            placeholder="Username suchen…"
            placeholderTextColor={colors.text.muted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={14} color={colors.icon.muted} />
            </Pressable>
          )}
        </View>

        {/* Ergebnisse */}
        {isFetching || isPending ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 32 }} />
        ) : query.trim().length === 0 ? (
          <View style={modal.hint}>
            <Text style={[modal.hintText, { color: colors.text.muted }]}>Tippe einen Username ein um zu suchen</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={modal.hint}>
            <Text style={[modal.hintText, { color: colors.text.muted }]}>Kein User gefunden</Text>
          </View>
        ) : (
          <FlashList
            data={results}
            keyExtractor={(u) => u.id}
            estimatedItemSize={56}
            renderItem={({ item }) => {
              const initial = (item.username ?? '?')[0].toUpperCase();
              return (
                <TouchableOpacity style={modal.userRow} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                  {item.avatar_url ? (
                    <ExpoImage source={{ uri: item.avatar_url }} style={modal.avatar} contentFit="cover" cachePolicy="memory-disk" />

                  ) : (
                    <View style={[modal.avatar, modal.avatarFallback]}>
                      <Text style={modal.avatarInitial}>{initial}</Text>
                    </View>
                  )}
                  <Text style={[modal.userName, { color: colors.text.primary }]}>@{item.username ?? '?'}</Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </Modal>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { preSelectUserId } = useLocalSearchParams<{ preSelectUserId?: string }>();
  const [showNew, setShowNew] = useState(false);
  const { data: convs = [], isLoading, refetch, isRefetching } = useConversations();
  const queryClient = useQueryClient();
  const { mutateAsync: openConv } = useOrCreateConversation();
  // Eigene Profildaten für Selbst-Chat-Anzeige
  // Fallback: direkt aus Supabase laden falls authStore avatar_url fehlt
  const { profile } = useAuthStore();
  const ownUserId = profile?.id;
  const ownUsername = profile?.username ?? null;
  const [freshAvatarUrl, setFreshAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);

  useEffect(() => {
    if (freshAvatarUrl || !ownUserId) return;
    // Einmaliger direkter Fetch falls Cache-Profil keine avatar_url hat
    supabase.from('profiles').select('avatar_url').eq('id', ownUserId).single()
      .then(({ data }) => { if (data?.avatar_url) setFreshAvatarUrl(data.avatar_url); });
  }, [ownUserId, freshAvatarUrl]);

  const ownAvatarUrl = freshAvatarUrl;


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
    if (!preSelectUserId) return;
    let mounted = true; // Memory-Leak Guard: verhindert State-Update nach Unmount
    openConv(preSelectUserId)
      .then((convId) => {
        if (!mounted) return;
        router.push({ pathname: '/messages/[id]', params: { id: convId } });
      })
      .catch(() => { });
    return () => { mounted = false; };
    // openConv ist stabil (useMutation ref), router ist stabil (expo-router)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectUserId]);

  // Konversation lokal aus Cache löschen
  const handleDeleteConv = useCallback((convId: string) => {
    queryClient.setQueryData<Conversation[]>(['conversations'], (old = []) =>
      old.filter((c) => c.id !== convId)
    );
    // Auch DB-seitig löschen (Cascade-Delete via FK)
    supabase.from('conversations').delete().eq('id', convId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [queryClient]);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const otherId = item.other_user.id;
      const storyGroup = storyGroupMap.get(otherId) ?? null;
      const isLive = liveSessions.some((s: any) => s.host_id === otherId || s.user_id === otherId);
      return (
        <ConvItem
          item={item}
          onDelete={() => handleDeleteConv(item.id)}
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
  const ListHeader = useMemo(() => (
    <StoriesRow
      groups={storyGroups}
      liveSessions={liveSessions}
      onSelectGroup={handleOpenStory}
      onAddStory={() => router.push('/live/start' as any)}
    />
  ), [storyGroups, liveSessions, handleOpenStory, router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.bg.secondary }]}>
      <NewMessageModal visible={showNew} onClose={() => setShowNew(false)} />
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Nachrichten</Text>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowNew(true); }}
          style={styles.composeBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Neue Nachricht erstellen"
        >
          <PenSquare size={20} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
      </View>


      {/* Alles in einer FlashList: Stories als Header + Conversations als Body.
          So deckt Pull-to-Refresh sowohl Stories als auch Nachrichten ab. */}
      {isLoading && convs.length === 0 ? (
        <>
          {ListHeader}
          <View style={styles.center}>
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        </>
      ) : (
        <FlashList
          data={convs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={80}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.center}>
              <MessageCircle size={52} color={colors.icon.muted} strokeWidth={1.2} />
              <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Noch keine Nachrichten</Text>
              <Text style={[styles.emptyDesc, { color: colors.text.muted }]}>
                Starte eine Konversation mit jemandem aus der Community.
              </Text>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowNew(true); }}
                style={styles.emptyBtn}
                accessibilityRole="button"
                accessibilityLabel="Nutzer suchen und Nachricht senden"
              >
                <Text style={styles.emptyBtnText}>Nutzer suchen</Text>
              </Pressable>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border.subtle }]} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingAny}
              onRefresh={handleRefresh}
              tintColor="#FFFFFF"
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor via inline
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, flex: 1 }, // color via inline
  composeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 }, // color via inline
  emptyDesc: { fontSize: 14, textAlign: 'center', maxWidth: 240, lineHeight: 20 }, // color via inline
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
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
  avatarInitial: { fontSize: 22, fontWeight: '700' },
  // Story-Ring: Instagram-Style Gradient-Rand
  storyRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 32, borderWidth: 2.5,
  },
  storyRingActive: { borderColor: '#E1306C' }, // Instagram Gradient-Farbe (vereinfacht)
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
  liveBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  // Selbst-Chat "Meine Notizen"
  avatarSelf: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  selfChatLabel: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selfChatUsername: { color: '#FFFFFF', fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#34D399', borderWidth: 2, borderColor: '#050508',
  },
  textWrap: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  username: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  usernameUnread: { fontWeight: '700' },
  preview: { fontSize: 13.5, lineHeight: 18 },
  previewUnread: { fontWeight: '500' },
  timeText: { fontSize: 12 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
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

const modal = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: '#0A0A0F', paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  hintText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 13,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  userName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});

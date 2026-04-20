import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl,
  Modal, TextInput, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MessageCircle, PenSquare, Search, X, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useConversations, useOrCreateConversation, type Conversation } from '@/lib/useMessages';
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

function ConvItem({ item }: { item: Conversation }) {
  const initial = (item.other_user.username ?? '?')[0].toUpperCase();
  const hasUnread = item.unread_count > 0;
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.item, hasUnread && styles.itemUnread]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/messages/[id]', params: { id: item.id, username: item.other_user.username ?? '', avatarUrl: item.other_user.avatar_url ?? '' } });
      }}
    >
      {hasUnread && <View style={styles.unreadDot} />}

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {item.other_user.avatar_url ? (
          <Image
            source={{ uri: item.other_user.avatar_url }}
            style={[styles.avatar, { borderColor: colors.border.strong }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { borderColor: colors.border.default }]}>
            <User size={24} color={colors.text.muted} strokeWidth={1.5} />
          </View>
        )}
        {hasUnread && <View style={styles.onlineDot} />}
      </View>

      {/* Text */}
      <View style={styles.textWrap}>
        <View style={styles.nameRow}>
          <Text style={[styles.username, { color: hasUnread ? colors.text.primary : colors.text.secondary }]}>
            @{item.other_user.username ?? '?'}
          </Text>
          <Text style={[styles.timeText, { color: colors.text.muted }]}>{timeAgo(item.last_message_at)}</Text>
        </View>
        <Text
          style={[styles.preview, { color: hasUnread ? colors.text.secondary : colors.text.muted }]}
          numberOfLines={1}
        >
          {item.last_message ?? 'Konversation starten…'}
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
    router.push({ pathname: '/messages/[id]', params: { id: convId, username: user.username ?? '', avatarUrl: user.avatar_url ?? '' } });
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
                    <Image
                      source={{ uri: item.avatar_url }}
                      style={modal.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[modal.avatar, modal.avatarFallback]}>
                      <User size={20} color={colors.text.muted} strokeWidth={1.5} />
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
  const [showNew, setShowNew] = useState(false);
  const { data: convs = [], isLoading, refetch, isRefetching } = useConversations();

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => <ConvItem item={item} />,
    [],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: colors.bg.secondary }]}>
      <NewMessageModal visible={showNew} onClose={() => setShowNew(false)} />
      <View style={[styles.header, { borderBottomColor: colors.border.subtle }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Nachrichten</Text>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowNew(true); }}
          style={styles.composeBtn}
          hitSlop={8}
        >
          <PenSquare size={20} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      ) : convs.length === 0 ? (
        <View style={styles.center}>
          <MessageCircle size={52} color={colors.icon.muted} strokeWidth={1.2} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Noch keine Nachrichten</Text>
          <Text style={[styles.emptyDesc, { color: colors.text.muted }]}>
            Öffne ein Profil und tippe auf „Nachricht" um zu starten.
          </Text>
        </View>
      ) : (
        <FlashList
          data={convs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={80}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border.subtle }]} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FFFFFF" />
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
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 12,
    position: 'relative',
  },
  itemUnread: { backgroundColor: 'rgba(29,185,84,0.04)' },
  unreadDot: {
    position: 'absolute', left: 4, top: '50%',
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: '#FFFFFF', marginTop: -2.5,
  },
  avatarWrap: { position: 'relative', width: 52, height: 52 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1 },
  avatarFallback: { backgroundColor: 'rgba(128,128,128,0.1)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#9CA3AF', fontSize: 20, fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#34D399', borderWidth: 2, borderColor: '#050508',
  },
  textWrap: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  username: { fontSize: 15, fontWeight: '600' }, // color via inline
  usernameUnread: { fontWeight: '700' },
  preview: { fontSize: 13 }, // color via inline
  previewUnread: { fontWeight: '500' },
  timeText: { fontSize: 12 }, // color via inline
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 80 }, // backgroundColor via inline
});

const modal = StyleSheet.create({
  sheet: { flex: 1, paddingTop: 12 }, // backgroundColor via inline
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor via inline
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800' }, // color via inline
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,
    // backgroundColor + borderColor via inline
  },
  searchInput: { flex: 1, fontSize: 15 }, // color via inline
  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  hintText: { fontSize: 14 }, // color via inline
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 13,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: 'rgba(128,128,128,0.1)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#9CA3AF', fontSize: 17, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '600' }, // color via inline
});

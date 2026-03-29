import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image,
  ActivityIndicator, FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, UserCheck, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFollowerList, useFollowingList, useFollow, type FollowUser } from '@/lib/useFollow';
import { useAuthStore } from '@/lib/authStore';

type Mode = 'followers' | 'following';

function UserRow({ user, onPress }: { user: FollowUser; onPress: () => void }) {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const isOwn = currentUserId === user.id;
  const { isFollowing, toggle, isLoading } = useFollow(isOwn ? null : user.id);
  const initial = (user.username ?? '?')[0].toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.avatarInitial}>{initial}</Text>
        </View>
      )}

      <View style={s.info}>
        <Text style={s.username}>@{user.username}</Text>
        {user.bio ? (
          <Text style={s.bio} numberOfLines={1}>{user.bio}</Text>
        ) : null}
      </View>

      {!isOwn && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggle();
          }}
          disabled={isLoading}
          style={[s.followBtn, isFollowing && s.followBtnActive]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? '#22D3EE' : '#fff'} />
          ) : isFollowing ? (
            <>
              <UserCheck size={13} color="#22D3EE" strokeWidth={2.5} />
              <Text style={[s.followBtnText, { color: '#22D3EE' }]}>Folgst</Text>
            </>
          ) : (
            <>
              <UserPlus size={13} color="#fff" strokeWidth={2.5} />
              <Text style={s.followBtnText}>Folgen</Text>
            </>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

export default function FollowListScreen() {
  const { userId, mode: initialMode, username } = useLocalSearchParams<{
    userId: string;
    mode: Mode;
    username: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>(initialMode ?? 'followers');

  const { data: followers = [], isLoading: loadingFollowers } = useFollowerList(userId);
  const { data: following = [], isLoading: loadingFollowing } = useFollowingList(userId);

  const list = mode === 'followers' ? followers : following;
  const isLoading = mode === 'followers' ? loadingFollowers : loadingFollowing;

  const renderItem = useCallback(({ item }: { item: FollowUser }) => (
    <UserRow
      user={item}
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}
    />
  ), [router]);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2} />
        </Pressable>
        <Text style={s.headerTitle}>@{username ?? '...'}</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['followers', 'following'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[s.tab, mode === m && s.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMode(m);
            }}
          >
            <Text style={[s.tabText, mode === m && s.tabTextActive]}>
              {m === 'followers' ? 'Follower' : 'Following'}
            </Text>
            <Text style={[s.tabCount, mode === m && s.tabCountActive]}>
              {m === 'followers' ? followers.length : following.length}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color="#22D3EE" size="large" />
        </View>
      ) : list.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>{mode === 'followers' ? '👥' : '🔍'}</Text>
          <Text style={s.emptyText}>
            {mode === 'followers' ? 'Noch keine Follower' : 'Folgt noch niemandem'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050508' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1 },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#22D3EE' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  tabCount: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  tabCountActive: { color: '#22D3EE', backgroundColor: 'rgba(34,211,238,0.12)' },

  list: { paddingBottom: 80 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 76,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  avatarFallback: { backgroundColor: 'rgba(34,211,238,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#22D3EE', fontSize: 18, fontWeight: '700' },
  info: { flex: 1, gap: 3 },
  username: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bio: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#0891B2', minWidth: 80, justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)',
  },
  followBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 15 },
});

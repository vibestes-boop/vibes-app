import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, UserCheck, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFollowerList, useFollowingList, useFollow, type FollowUser } from '@/lib/useFollow';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/lib/useTheme';

type Mode = 'followers' | 'following';

function UserRow({ user, onPress }: { user: FollowUser; onPress: () => void }) {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const isOwn = currentUserId === user.id;
  const { isFollowing, toggle, isLoading } = useFollow(isOwn ? null : user.id);
  const initial = (user.username ?? '?')[0].toUpperCase();
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={s.avatar} contentFit="cover" />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.avatarInitial}>{initial}</Text>
        </View>
      )}

      <View style={[s.username && s.info]}>
        <Text style={[s.username, { color: colors.text.primary }]}>@{user.username}</Text>
        {user.bio ? (
          <Text style={[s.bio, { color: colors.text.secondary }]} numberOfLines={1}>{user.bio}</Text>
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
            <ActivityIndicator size="small" color={isFollowing ? '#FFFFFF' : '#fff'} />
          ) : isFollowing ? (
            <>
              <UserCheck size={13} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={[s.followBtnText, { color: '#FFFFFF' }]}>Folgst</Text>
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
  const { colors } = useTheme();

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
    <View style={[s.screen, { paddingTop: insets.top, backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <ArrowLeft size={22} color={colors.icon.default} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>@{username ?? '...'}</Text>
      </View>

      {/* Tabs */}
      <View style={[s.tabs, { borderBottomColor: colors.border.subtle }]}>
        {(['followers', 'following'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[s.tab, mode === m && s.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMode(m);
            }}
          >
            <Text style={[s.tabText, mode === m && s.tabTextActive, { color: mode === m ? colors.text.primary : colors.text.muted }]}>
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
        <ActivityIndicator color={colors.text.primary} size="large" />
        </View>
      ) : list.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyEmoji}>{mode === 'followers' ? '👥' : '🔍'}</Text>
          <Text style={[s.emptyText, { color: colors.text.muted }]}>
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
          ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: colors.border.subtle }]} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },  // backgroundColor via inline
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1 },  // color via inline

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
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabTextActive: {},
  tabCount: {
    fontSize: 11, fontWeight: '700',
    backgroundColor: 'rgba(120,120,128,0.1)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  tabCountActive: { backgroundColor: 'rgba(0,122,255,0.12)' },

  list: { paddingBottom: 80 },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: '#E8E8ED', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#555', fontSize: 18, fontWeight: '700' },
  info: { flex: 1, gap: 3 },
  username: { fontSize: 15, fontWeight: '700' },  // color via inline
  bio: { fontSize: 13 },   // color via inline

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#007AFF', minWidth: 80, justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: 'rgba(120,120,128,0.1)',
    borderWidth: 1, borderColor: 'rgba(120,120,128,0.25)',
  },
  followBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 15 },
});

/**
 * UserProfileContent
 * Identische Logik wie app/user/[id].tsx, aber als wiederverwendbare Komponente.
 * Nimmt userId + onBack als Props statt useLocalSearchParams + router.back().
 * Wird verwendet in:
 *   - app/user/[id].tsx (Route-Wrapper)
 *   - app/(tabs)/index.tsx (Swipe-Panel, folgt dem Finger)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  Alert,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
// reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  UserCheck,
  UserPlus,
  MessageCircle,
  Timer,
  Zap,
  Users,
  Grid3X3,
  User,
  Heart,
  Repeat2,
  MoreHorizontal,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useFollow, useFollowCounts } from '@/lib/useFollow';
import { useAuthStore } from '@/lib/authStore';
import { useOrCreateConversation } from '@/lib/useMessages';
import { useIsBlocked, useBlockUser } from '@/lib/useBlock';
import { useReportUser } from '@/lib/useReport';
import { useHasPendingRequest, useSendFollowRequest, useWithdrawFollowRequest } from '@/lib/useFollowRequest';
import { VideoGridThumb } from '@/components/ui/VideoGridThumb';
import { VibeScoreRing } from '@/components/profile/VibeScoreRing';
import { ProfileHighlightsRow } from '@/components/profile/ProfileHighlightsRow';
import { shareUser } from '@/lib/useShare';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_SIZE = 88;  // Kompakter Avatar für die neue Instagram-Style Row
const GRID_COLS = 3;
const GRID_GAP = 2;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const GRID_ITEM_HEIGHT = GRID_ITEM_WIDTH * 5 / 4; // 4:5 Portrait-Format wie Instagram

type PublicProfile = {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  guild_id: string | null;
  guild_name?: string | null;
};

type PostThumb = {
  id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  dwell_time_score?: number;
  thumbnail_url?: string | null; // Statisches Thumbnail für Videos
};

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  /** Aufgerufen wenn Zurück-Button oder Block → zurück gedrückt wird */
  onBack: () => void;
}

export function UserProfileContent({ userId, onBack }: Props) {
  const id = userId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.profile?.id);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostThumb[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<PostThumb[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [repostLoading, setRepostLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'liked' | 'reposts'>('posts');
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Left-Edge-Swipe → zurück ──
  const backSwipePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.locationX < 30,
      onMoveShouldSetPanResponder: (_, g) => g.dx > 8 && Math.abs(g.dy) < 60,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 80 && Math.abs(g.dy) < 100) onBack();
      },
    })
  ).current;

  const { isFollowing, toggle, isLoading: followLoading } = useFollow(id ?? null);
  const { data: counts } = useFollowCounts(id ?? null);
  const { mutateAsync: openConversation, isPending: dmLoading } = useOrCreateConversation();
  const { data: isBlocked = false } = useIsBlocked(id ?? null);
  const { block, unblock } = useBlockUser(id ?? null);
  const { mutate: reportUser } = useReportUser();
  const { data: hasPendingRequest = false } = useHasPendingRequest(id ?? null);
  const { mutate: sendRequest, isPending: sendingRequest } = useSendFollowRequest();
  const { mutate: withdrawRequest, isPending: withdrawing } = useWithdrawFollowRequest();

  const avatarScale = useSharedValue(0.6);
  const avatarOpacity = useSharedValue(0);
  const followScale = useSharedValue(1);
  const listRef = useRef<FlatList>(null);

  // ── Follow ⇔ DM Button-Swap Animation ────────────────────────────────
  const BTN_ROW_W = SCREEN_WIDTH - 32 - 8; // 16px padding beidseitig + 8px gap
  const ICON_W = 52;                    // Kleiner Icon-Button
  const FULL_W = BTN_ROW_W - ICON_W;   // Großer Button
  const COMPACT_W = 120;                   // Kompaktes 'Folgst du'-Pill
  const DM_FULL_W = BTN_ROW_W - COMPACT_W;

  const followBtnW = useSharedValue(FULL_W);
  const dmBtnW = useSharedValue(ICON_W);
  const followBtnWidthStyle = useAnimatedStyle(() => ({ width: followBtnW.value, overflow: 'hidden' }));
  const dmBtnWidthStyle = useAnimatedStyle(() => ({ width: dmBtnW.value, overflow: 'hidden' }));

  // Beim Laden den korrekten Startzustand setzen (kein Animate)
  useEffect(() => {
    if (followLoading) return; // Warten bis Status geladen
    const spring = { damping: 20, stiffness: 220 };
    if (isFollowing) {
      followBtnW.value = withSpring(COMPACT_W, spring);
      dmBtnW.value = withSpring(DM_FULL_W, spring);
    } else {
      followBtnW.value = withSpring(FULL_W, spring);
      dmBtnW.value = withSpring(ICON_W, spring);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFollowing, followLoading]);

  // Load liked posts lazily
  useEffect(() => {
    if (activeTab !== 'liked' || !id) return;
    if (likedPosts.length > 0) return;
    setLikedLoading(true);
    supabase
      .from('likes')
      .select('post_id, posts(id, media_url, media_type, caption, thumbnail_url)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => {
        const mapped: PostThumb[] = (data ?? [])
          .map((r: any) => r.posts)
          .filter(Boolean)
          .map((p: any) => ({ id: p.id, media_url: p.media_url, media_type: p.media_type, caption: p.caption, thumbnail_url: p.thumbnail_url ?? null }));
        setLikedPosts(mapped);
        setLikedLoading(false);
      });
  }, [activeTab, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initialer Load der Reposts (einmal wenn Tab geöffnet wird) ──────────
  const loadReposts = useCallback(async () => {
    if (!id) return;
    setRepostLoading(true);
    const { data: repostRows, error } = await supabase
      .from('reposts')
      .select('post_id')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error || !repostRows || repostRows.length === 0) {
      setRepostedPosts([]);
      setRepostLoading(false);
      return;
    }
    const postIds = repostRows.map((r: any) => r.post_id).filter(Boolean);
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, media_url, media_type, caption, dwell_time_score, thumbnail_url')
      .in('id', postIds);

    const postsById = Object.fromEntries((postsData ?? []).map((p: any) => [p.id, p]));
    const ordered: PostThumb[] = postIds.map((pid: string) => postsById[pid]).filter(Boolean);
    setRepostedPosts(ordered);
    setRepostLoading(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === 'reposts') loadReposts();
  }, [activeTab, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase Realtime: INSERT + DELETE auf reposts ────────────────────────
  // Läuft immer (nicht nur wenn Tab aktiv) → State ist sofort aktuell
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`reposts_live_${id}`)
      // ── REPOST hinzugefügt ──────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reposts', filter: `user_id=eq.${id}` },
        async (payload) => {
          const newPostId = (payload.new as any).post_id;
          if (!newPostId) return;
          const { data } = await supabase
            .from('posts')
            .select('id, media_url, media_type, caption, dwell_time_score, thumbnail_url')
            .eq('id', newPostId)
            .single();
          if (data) {
            setRepostedPosts((prev) => {
              // Kein Duplikat falls bereits vorhanden
              if (prev.some((p) => p.id === (data as any).id)) return prev;
              return [data as PostThumb, ...prev];
            });
          }
        }
      )
      // ── REPOST entfernt ─────────────────────────────────────────────────
      // REPLICA IDENTITY FULL → payload.old enthält post_id
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reposts', filter: `user_id=eq.${id}` },
        (payload) => {
          const deletedPostId = (payload.old as any).post_id;
          if (deletedPostId) {
            // Direkt aus State entfernen — kein DB-Call nötig
            setRepostedPosts((prev) => prev.filter((p) => p.id !== deletedPostId));
          } else {
            // Fallback: vollen Reload triggern
            loadReposts();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps


  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
    opacity: avatarOpacity.value,
  }));
  const followBtnAnim = useAnimatedStyle(() => ({
    transform: [{ scale: followScale.value }],
  }));

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setProfile(null);
    setPosts([]);
    setPostCount(0);
    avatarScale.value = 0.6;
    avatarOpacity.value = 0;
    let canceled = false;

    Promise.all([
      supabase.from('profiles')
        .select('id, username, bio, avatar_url, guild_id, is_private, guilds(name)')
        .eq('id', id).single(),
      supabase.from('posts')
        .select('id, media_url, media_type, caption, dwell_time_score, thumbnail_url')
        .eq('author_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('posts')
        .select('id', { count: 'exact', head: true }).eq('author_id', id),
    ]).then(([{ data: p, error: pErr }, { data: ps }, { count }]) => {
      if (canceled) return;
      if (pErr || !p) { setLoading(false); return; }
      const raw = p as any;
      setProfile({ ...(raw as PublicProfile), guild_name: raw?.guilds?.name ?? null });
      setPosts((ps ?? []) as PostThumb[]);
      setPostCount(count ?? (ps ?? []).length);
      setLoading(false);
      avatarScale.value = withSpring(1, { damping: 13, stiffness: 160 });
      avatarOpacity.value = withTiming(1, { duration: 280 });
    });

    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const avgResonanz = useMemo(() => {
    if (posts.length === 0) return 0;
    const sum = posts.reduce((acc, p) => acc + (p.dwell_time_score ?? 0), 0);
    return Math.round((sum / posts.length) * 100);
  }, [posts]);

  const handleDM = async () => {
    if (!profile) return;
    const convId = await openConversation(profile.id);
    router.push({ pathname: '/messages/[id]', params: { id: convId, username: profile.username, avatarUrl: profile.avatar_url ?? '' } });
  };

  const handleBlock = () => {
    if (isBlocked) {
      Alert.alert('Blockierung aufheben', `Möchtest du @${profile?.username ?? ''} entblocken?`, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Entblocken', onPress: () => unblock.mutate() },
      ]);
    } else {
      Alert.alert('User blockieren', `Möchtest du @${profile?.username ?? ''} blockieren?\nDieser User kann dir nicht mehr folgen oder schreiben.`, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Blockieren', style: 'destructive', onPress: () => { block.mutate(); onBack(); } },
      ]);
    }
  };

  const handleFollow = () => {
    const isPrivate = (profile as any)?.is_private;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    followScale.value = withSpring(0.91, { damping: 8 }, () => {
      followScale.value = withSpring(1, { damping: 12 });
    });
    if (isFollowing) { toggle(); return; }
    if (isPrivate) {
      if (hasPendingRequest) {
        Alert.alert('Anfrage zurückziehen?', 'Deine Follow-Anfrage wird zurückgezogen.', [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Zurückziehen', style: 'destructive', onPress: () => id && withdrawRequest(id) },
        ]);
      } else { id && sendRequest(id); }
    } else { toggle(); }
  };

  const handleReportUser = () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(`@${profile.username} melden`, 'Wähle den Grund für die Meldung:', [
      { text: '🚫  Spam', onPress: () => { reportUser({ reportedId: id, reason: 'spam' }); Alert.alert('Danke für deine Meldung', 'Wir prüfen das Profil zeitnah.'); } },
      { text: '⚠️  Belästigung / Hassrede', onPress: () => { reportUser({ reportedId: id, reason: 'harassment' }); Alert.alert('Danke für deine Meldung', 'Wir prüfen das Profil zeitnah.'); } },
      { text: '🔞  Unangemessener Inhalt', onPress: () => { reportUser({ reportedId: id, reason: 'inappropriate' }); Alert.alert('Danke für deine Meldung', 'Wir prüfen das Profil zeitnah.'); } },
      { text: '🤖  Fake-Account', onPress: () => { reportUser({ reportedId: id, reason: 'fake_account' }); Alert.alert('Danke für deine Meldung', 'Wir prüfen das Profil zeitnah.'); } },
      { text: 'Abbrechen', style: 'cancel' },
    ], { cancelable: true });
  };

  // — Instagram-Style ⋯ Menü (oben rechts im Hero)
  const handleMore = () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      `@${profile.username}`,
      undefined,
      [
        {
          text: '🔗  Profil teilen',
          onPress: () => { shareUser(id, profile.username); },
        },
        {
          text: isBlocked ? '🛡️  Entblocken' : '🚫  Blockieren',
          style: isBlocked ? 'default' : 'destructive',
          onPress: handleBlock,
        },
        {
          text: '🚩  Melden',
          style: 'destructive',
          onPress: handleReportUser,
        },
        { text: 'Abbrechen', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <LinearGradient colors={['#050508', '#0d0020', '#050508']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color="#22D3EE" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.loadingWrap}>
        <Text style={{ color: '#6B7280', fontSize: 16 }}>Profil nicht gefunden.</Text>
        <Pressable onPress={onBack} style={s.backPill}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  const initials = profile.username.slice(0, 2).toUpperCase();
  const isOwn = currentUserId === id;

  const Header = (
    <View>
      {/* ── Compact Nav Bar — nur Buttons, kein doppelter Username ── */}
      <View style={[s.navBar, { paddingTop: insets.top }]}>
        <Pressable onPress={onBack} hitSlop={12} style={s.navIconBtn}>
          <ArrowLeft size={20} color="#fff" strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {!isOwn ? (
          <Pressable onPress={handleMore} hitSlop={12} style={s.navIconBtn}>
            <MoreHorizontal size={20} color={isBlocked ? '#EF4444' : 'rgba(255,255,255,0.7)'} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <View style={s.navIconBtn} />
        )}
      </View>

      {/* ── Profile Row: Avatar links + Inline Stats rechts (Instagram) ── */}
      <View style={s.profileRow}>
        <Animated.View style={avatarStyle}>
          <LinearGradient
            colors={['#22D3EE', '#0891B2', '#164E63']}
            style={s.avatarRingGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <View style={s.avatarGap}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} contentFit="cover" />
              ) : (
                <LinearGradient colors={['#0E7490', '#22D3EE']} style={s.avatarImg}>
                  <Text style={s.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={s.inlineStatsWrap}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{postCount}</Text>
            <Text style={s.statLabel}>Vibes</Text>
          </View>
          <Pressable style={s.statItem} onPress={() => router.push({ pathname: '/follow-list', params: { userId: id, mode: 'followers', username: profile.username } })}>
            <Text style={s.statValue}>{counts?.followers ?? 0}</Text>
            <Text style={s.statLabel}>Follower</Text>
          </Pressable>
          <Pressable style={s.statItem} onPress={() => router.push({ pathname: '/follow-list', params: { userId: id, mode: 'following', username: profile.username } })}>
            <Text style={s.statValue}>{counts?.following ?? 0}</Text>
            <Text style={s.statLabel}>Following</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Username + Guild + VibeScore + Bio ── */}
      <View style={s.userInfoSection}>
        <View style={s.userNameRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.username}>@{profile.username}</Text>
            {profile.guild_name && (
              <View style={s.guildPill}>
                <Zap size={10} color="#22D3EE" fill="#22D3EE" />
                <Text style={s.guildPillText}>{profile.guild_name}</Text>
              </View>
            )}
          </View>
          {!loading && <VibeScoreRing score={avgResonanz} size={52} />}
        </View>
        {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
      </View>

      {/* ── Action Buttons: Follow ⇄ DM Swap ── */}
      {!isOwn && (
        <View style={s.actionRow}>

          {/* Follow‑Button: groß wenn nicht gefolgt, kompakt wenn gefolgt */}
          <Animated.View style={[followBtnWidthStyle, followBtnAnim]}>
            <Pressable
              onPress={handleFollow}
              disabled={followLoading || sendingRequest || withdrawing}
              style={s.followBtnWrap}
            >
              {isFollowing ? (
                // ✕ Kompakt 'Folgst du' — Entfolgen soll mühsam sein
                <View style={s.followBtnOutline}>
                  {followLoading
                    ? <ActivityIndicator size="small" color="#22D3EE" />
                    : <><UserCheck size={14} color="#22D3EE" strokeWidth={2.2} /><Text style={[s.followBtnText, { color: '#22D3EE', fontSize: 13 }]}>Folgst du</Text></>
                  }
                </View>
              ) : hasPendingRequest ? (
                <View style={[s.followBtnOutline, { borderColor: 'rgba(251,191,36,0.5)', backgroundColor: 'rgba(251,191,36,0.08)' }]}>
                  {withdrawing
                    ? <ActivityIndicator size="small" color="#FBBF24" />
                    : <><Timer size={14} color="#FBBF24" strokeWidth={2.2} /><Text style={[s.followBtnText, { color: '#FBBF24', fontSize: 13 }]}>Angefragt</Text></>
                  }
                </View>
              ) : (
                // ✔ Groß + prominent — Folgen soll einfach sein
                <LinearGradient colors={['#0891B2', '#22D3EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.followBtnFill}>
                  {(followLoading || sendingRequest)
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><UserPlus size={16} color="#fff" strokeWidth={2.2} /><Text style={s.followBtnText}>{(profile as any)?.is_private ? 'Anfrage senden' : 'Folgen'}</Text></>
                  }
                </LinearGradient>
              )}
            </Pressable>
          </Animated.View>

          {/* DM‑Button: klein wenn nicht gefolgt, groß wenn gefolgt */}
          <Animated.View style={dmBtnWidthStyle}>
            <Pressable
              onPress={handleDM}
              disabled={dmLoading}
              style={[s.followBtnWrap, { flex: 1 }]}
            >
              {isFollowing ? (
                // ✔ Groß + prominent nach dem Folgen
                <LinearGradient
                  colors={['#0E7490', '#22D3EE']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.followBtnFill}
                >
                  {dmLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><MessageCircle size={16} color="#fff" strokeWidth={2} /><Text style={s.followBtnText}>Nachricht</Text></>
                  }
                </LinearGradient>
              ) : (
                // ✕ Kleiner Icon-Button wenn noch nicht gefolgt
                <View style={[s.iconBtn, { width: '100%', borderRadius: 28 }]}>
                  {dmLoading
                    ? <ActivityIndicator size="small" color="#22D3EE" />
                    : <MessageCircle size={20} color="#22D3EE" strokeWidth={2} />}
                </View>
              )}
            </Pressable>
          </Animated.View>

        </View>
      )}
      {isOwn && (
        <Pressable onPress={() => router.push('/settings')} style={s.editBtn}>
          <Text style={s.editBtnText}>Profil bearbeiten</Text>
        </Pressable>
      )}
      <ProfileHighlightsRow userId={id ?? null} isOwn={isOwn} />

      {/* ── TABS ── */}
      <View style={s.tabBar}>
        <Pressable style={[s.tab, activeTab === 'posts' && s.tabActive]} onPress={() => { setActiveTab('posts'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Grid3X3 size={24} color={activeTab === 'posts' ? '#22D3EE' : 'rgba(255,255,255,0.65)'} strokeWidth={2} />
          <Text style={[s.tabLabel, activeTab === 'posts' && s.tabLabelActive]}>Vibes</Text>
          {postCount > 0 && activeTab === 'posts' && (
            <View style={s.gridCountPill}><Text style={s.gridCountText}>{postCount}</Text></View>
          )}
        </Pressable>
        <Pressable style={[s.tab, activeTab === 'liked' && s.tabActive]} onPress={() => { setActiveTab('liked'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Heart size={24} color={activeTab === 'liked' ? '#F472B6' : 'rgba(255,255,255,0.65)'} fill={activeTab === 'liked' ? '#F472B6' : 'transparent'} strokeWidth={2} />
          <Text style={[s.tabLabel, activeTab === 'liked' && { color: '#F472B6' }]}>Gefällt mir</Text>
        </Pressable>
        <Pressable
          style={[s.tab, activeTab === 'reposts' && s.tabActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('reposts');
          }}
        >
          <Repeat2 size={24} color={activeTab === 'reposts' ? '#22D3EE' : 'rgba(255,255,255,0.65)'} strokeWidth={2} />
          <Text style={[s.tabLabel, activeTab === 'reposts' && s.tabLabelActive]}>Geteilt</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <FlatList
        ref={listRef}
        refreshControl={
          <RefreshControl
            refreshing={repostLoading && activeTab === 'reposts'}
            onRefresh={() => { if (activeTab === 'reposts') loadReposts(); }}
            tintColor="#22D3EE"
            colors={['#22D3EE']}
          />
        }
        data={
          activeTab === 'posts' ? posts
            : activeTab === 'liked' ? likedPosts
              : repostedPosts
        }
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={Header}
        columnWrapperStyle={s.gridRow}
        ListEmptyComponent={
          (activeTab === 'liked' && likedLoading) || (activeTab === 'reposts' && repostLoading) ? (
            <View style={s.emptyGrid}><ActivityIndicator color="#22D3EE" /></View>
          ) : (
            <View style={s.emptyGrid}>
              <Users size={36} stroke="#1F2937" strokeWidth={1.2} />
              <Text style={s.emptyTitle}>
                {activeTab === 'liked' ? 'Keine gelikten Posts'
                  : activeTab === 'reposts' ? 'Keine geteilten Posts'
                    : 'Noch keine Vibes'}
              </Text>
              <Text style={s.emptySub}>
                {activeTab === 'liked'
                  ? `${profile?.username ?? 'Dieser User'} hat noch nichts geliket.`
                  : activeTab === 'reposts'
                    ? `${profile?.username ?? 'Dieser User'} hat noch nichts geteilt.`
                    : `${profile?.username ?? ''} hat noch nichts geteilt.`
                }
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={s.gridItem}
            onPress={() => router.push({ pathname: '/user-posts', params: { userId: id, startIndex: String(index), username: profile.username } })}
          >
            {item.media_url ? (
              item.media_type === 'video' ? (
                <VideoGridThumb
                  uri={item.media_url}
                  thumbnailUrl={item.thumbnail_url}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )
            ) : (
              <LinearGradient colors={['#1a0533', '#0d1040']} style={[StyleSheet.absoluteFill, s.textThumb]}>
                <Text style={s.textThumbCaption} numberOfLines={4}>{item.caption}</Text>
              </LinearGradient>
            )}
            {/* Konsistent mit ProfileGridCell: subtle Gradient-Overlay unten */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.18)']}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%' }}
              pointerEvents="none"
            />
          </Pressable>
        )}
      />


      {/* ── Bottom Nav — konsistent mit App Tab-Bar ── */}
      <View style={[s.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable style={s.navItem} onPress={() => router.push('/(tabs)')}>
          <Zap size={22} color="rgba(255,255,255,0.65)" strokeWidth={2} />
          <Text style={s.navLabel}>Vibes</Text>
        </Pressable>
        <Pressable style={s.navItem} onPress={() => router.push('/(tabs)/guild')}>
          <Users size={22} color="rgba(255,255,255,0.65)" strokeWidth={2} />
          <Text style={s.navLabel}>Guild</Text>
        </Pressable>
        <Pressable style={s.navItem} onPress={() => router.push('/(tabs)/messages')}>
          <MessageCircle size={22} color="rgba(255,255,255,0.65)" strokeWidth={2} />
          <Text style={s.navLabel}>Nachrichten</Text>
        </Pressable>
        <Pressable style={s.navItem} onPress={() => router.push('/(tabs)/profile')}>
          <User size={22} color="rgba(255,255,255,0.65)" strokeWidth={2} />
          <Text style={s.navLabel}>Studio</Text>
        </Pressable>
      </View>

      {/* ── Left-Edge-Swipe → zurück ── */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 30, zIndex: 200 }} {...backSwipePan.panHandlers} />
    </View>
  );
}

// ─── Styles (identisch mit user/[id].tsx) ────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050508' },
  loadingWrap: { flex: 1, backgroundColor: '#050508', alignItems: 'center', justifyContent: 'center', gap: 20 },
  backPill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },

  // ── Compact Nav Bar ───────────────────────────────────────────
  navBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingBottom: 8,
    backgroundColor: '#050508',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  navIconBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22,
  },
  navTitle: {
    flex: 1, color: '#fff', fontSize: 16, fontWeight: '700',
    textAlign: 'center', letterSpacing: -0.3,
  },

  // ── Profile Row ─────────────────────────────────────────────
  profileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 20,
  },
  inlineStatsWrap: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: '#6B7280', fontSize: 12, fontWeight: '500' },

  // ── User Info Section ───────────────────────────────────────
  userInfoSection: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  avatarRingGradient: {
    width: AVATAR_SIZE + 6, height: AVATAR_SIZE + 6, borderRadius: (AVATAR_SIZE + 6) / 2, padding: 3,
    shadowColor: '#22D3EE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 12,
  },
  avatarGap: { flex: 1, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden', backgroundColor: '#0a0a0a' },
  avatarImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  infoSection: { backgroundColor: '#050508', paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  username: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.7 },
  guildPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(8,145,178,0.15)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(34,211,238,0.3)',
  },
  guildPillText: { color: '#22D3EE', fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
  bio: { color: '#9CA3AF', fontSize: 14, lineHeight: 21, maxWidth: 280 },
  metricsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)', paddingVertical: 4, overflow: 'hidden',
  },
  metricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  followBtnWrap: { borderRadius: 28, overflow: 'hidden' },
  followBtnFill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 28 },
  followBtnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 28, backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.35)',
  },
  followBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  editBtn: { marginTop: 4, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)', alignSelf: 'stretch', alignItems: 'center' },
  editBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.07)', marginTop: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#22D3EE' },
  tabLabel: { color: '#6B7280', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  tabLabelActive: { color: '#22D3EE' },
  gridCountPill: { backgroundColor: 'rgba(34,211,238,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  gridCountText: { color: '#22D3EE', fontSize: 11, fontWeight: '700' },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { width: GRID_ITEM_WIDTH, height: GRID_ITEM_HEIGHT, backgroundColor: '#0D0D0D', overflow: 'hidden' },
  textThumb: { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' },
  textThumbCaption: { color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  emptyGrid: { paddingVertical: 60, alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { color: '#374151', fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#1F2937', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', backgroundColor: 'rgba(5,5,8,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingBottom: 4 },
  navLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600', letterSpacing: 0.2 },
});

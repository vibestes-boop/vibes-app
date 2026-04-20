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
  Linking,
  Modal,
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
  Link,
  CheckCircle2,
  Share2,
  ShieldOff,
  Shield,
  Flag,
  X,
  Swords,
  Bell,
  BellOff,
  ShoppingBag,
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
import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { StoryRingAvatar } from '@/components/ui/StoryRingAvatar';
import { AvatarZoomViewer } from '@/components/ui/AvatarZoomViewer';
import { useTheme } from '@/lib/useTheme';
import { useBattleStats } from '@/lib/useBattleStats';
import { BattleHistoryList } from '@/components/profile/BattleHistoryList';
import { useIsHostMuted, useToggleMuteHost } from '@/lib/useMutedLiveHosts';
import { useShopProducts, type Product } from '@/lib/useShop';

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
  website: string | null;
  avatar_url: string | null;
  guild_id: string | null;
  guild_name?: string | null;
  is_verified?: boolean | null;
  is_private?: boolean | null;
  teip?: string | null;  // Tschetschenischer Clan
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
  const { colors } = useTheme();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostThumb[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<PostThumb[]>([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [repostLoading, setRepostLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'liked' | 'reposts' | 'battles' | 'shop'>('posts');

  // v1.17.0: Battle-History Tab nur zeigen wenn der User schon gebattled hat.
  const { data: battleStats } = useBattleStats(id);
  const showBattlesTab = !!battleStats && battleStats.totalBattles > 0;

  // v1.26.5: Shop-Tab — nur anzeigen wenn der User min. 1 aktives Produkt hat.
  // `useShopProducts({ sellerId })` filtert serverseitig via RPC-Parameter
  // (siehe lib/useShop.ts Z. 100–119) → gibt nur aktive Produkte zurück.
  const { data: shopProducts = [] } = useShopProducts({ sellerId: id, limit: 60 });
  const showShopTab = shopProducts.length > 0;

  // v1.17.0: Go-Live Push-Preferences — Host für Live-Pushes stumm schalten.
  // Nur relevant wenn man eingeloggt ist UND nicht sein eigenes Profil ansieht.
  const { data: isLivePushMuted } = useIsHostMuted(id);
  const toggleMuteHost = useToggleMuteHost();
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [avatarZoomed, setAvatarZoomed] = useState(false);
  const [showProfileMenu, setShowProfileMenu]       = useState(false);
  const [showReportSheet, setShowReportSheet]       = useState(false);
  const [showProfileShareSheet, setShowProfileShareSheet] = useState(false);

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
        .select('id, username, bio, website, avatar_url, guild_id, is_private, is_verified, teip, guilds(name)')
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

  const handleReportUser = (reason: 'spam' | 'harassment' | 'inappropriate' | 'fake_account') => {
    setShowReportSheet(false);
    reportUser({ reportedId: id, reason });
    setTimeout(() => Alert.alert('✅ Gemeldet', 'Danke. Wir prüfen das Profil zeitnah.'), 300);
  };

  // — TikTok-Style ⋯ Bottom Sheet (oben rechts)
  const handleMore = () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowProfileMenu(true);
  };

  if (loading) {
    return (
      <View style={[s.loadingWrap, { backgroundColor: colors.bg.primary }]}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[s.loadingWrap, { backgroundColor: colors.bg.primary }]}>
        <Text style={{ color: colors.text.muted, fontSize: 16 }}>Profil nicht gefunden.</Text>
        <Pressable onPress={onBack} style={[s.backPill, { backgroundColor: colors.bg.elevated }]}>
          <Text style={{ color: colors.text.primary, fontWeight: '600' }}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  const initials = profile.username.slice(0, 2).toUpperCase();
  const isOwn = currentUserId === id;

  const Header = (
    <View>
      {/* ── Compact Nav Bar — nur Buttons, kein doppelter Username ── */}
      <View style={[s.navBar, { paddingTop: insets.top, backgroundColor: colors.bg.secondary, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={onBack} hitSlop={12} style={s.navIconBtn}>
          <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {!isOwn ? (
          <Pressable onPress={handleMore} hitSlop={12} style={s.navIconBtn}>
            <MoreHorizontal size={20} color={isBlocked ? '#EF4444' : colors.icon.muted} strokeWidth={2.2} />
          </Pressable>
        ) : (
          <View style={s.navIconBtn} />
        )}
      </View>

      {/* ── Profile Row: Avatar links + Inline Stats rechts (Instagram) ── */}
      <View style={s.profileRow}>
        <Pressable
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setAvatarZoomed(true);
          }}
          delayLongPress={350}
        >
          <Animated.View style={avatarStyle}>
            <StoryRingAvatar
              userId={id ?? ''}
              avatarUrl={profile.avatar_url}
              size={AVATAR_SIZE}
              initials={initials}
              fallbackColors={[colors.bg.elevated, colors.bg.subtle] as [string, string]}
            />
          </Animated.View>
        </Pressable>

        <View style={s.inlineStatsWrap}>
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: colors.text.primary }]}>{postCount}</Text>
            <Text style={[s.statLabel, { color: colors.text.muted }]}>Posts</Text>
          </View>
          <Pressable style={s.statItem} onPress={() => router.push({ pathname: '/follow-list', params: { userId: id, mode: 'followers', username: profile.username } })}>
            <Text style={[s.statValue, { color: colors.text.primary }]}>{counts?.followers ?? 0}</Text>
            <Text style={[s.statLabel, { color: colors.text.muted }]}>Follower</Text>
          </Pressable>
          <Pressable style={s.statItem} onPress={() => router.push({ pathname: '/follow-list', params: { userId: id, mode: 'following', username: profile.username } })}>
            <Text style={[s.statValue, { color: colors.text.primary }]}>{counts?.following ?? 0}</Text>
            <Text style={[s.statLabel, { color: colors.text.muted }]}>Following</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Username + Badges + VibeScore kompakt in einer Zeile ── */}
      <View style={s.userInfoSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          {/* Links: Username + alle Badges in flexWrap Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
            <Text style={[s.username, { color: colors.text.primary }]} numberOfLines={1}>
              @{profile.username}
            </Text>
            {profile.is_verified && (
              <CheckCircle2 size={15} color="#FBBF24" fill="rgba(251,191,36,0.15)" strokeWidth={2.5} />
            )}
            {profile.guild_name && (
              <View style={[s.guildPill, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}>
                <Zap size={9} color={colors.text.primary} fill={colors.text.primary} />
                <Text style={[s.guildPillText, { color: colors.text.primary }]}>{profile.guild_name}</Text>
              </View>
            )}
            {profile.teip && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: colors.bg.elevated, borderRadius: 10,
                paddingHorizontal: 8, paddingVertical: 3,
                borderWidth: 1, borderColor: colors.border.default,
              }}>
                <Text style={{ fontSize: 11 }}>🏔️</Text>
                <Text style={{ color: colors.text.primary, fontSize: 11, fontWeight: '600' }}>
                  {profile.teip}
                </Text>
              </View>
            )}
          </View>
          {/* Rechts: VibeScore Ring */}
          {!loading && <VibeScoreRing score={avgResonanz} size={48} />}
        </View>

        {profile.bio ? <Text style={[s.bio, { color: colors.text.secondary }]}>{profile.bio}</Text> : null}
        {profile.website ? (
          <Pressable
            onPress={() => {
              const url = profile.website as string;
              const full = url.startsWith('http') ? url : `https://${url}`;
              Linking.openURL(full).catch(() => { });
            }}
            style={s.websiteRow}
            hitSlop={8}
          >
            <Link size={11} color="#FFFFFF" strokeWidth={2} />
            <Text style={s.websiteLink} numberOfLines={1}>
              {(profile.website as string).replace(/^https?:\/\//, '')}
            </Text>
          </Pressable>
        ) : null}
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
                // Folgst du — Outline (dezent)
                <View style={[s.followBtnOutline, {
                  backgroundColor: colors.bg.elevated,
                  borderColor: colors.border.strong,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                }]}>
                  {followLoading
                    ? <ActivityIndicator size="small" color={colors.text.primary} />
                    : <><UserCheck size={14} color={colors.text.primary} strokeWidth={2.2} /><Text style={[s.followBtnText, { color: colors.text.primary, fontSize: 13 }]}>Folgst du</Text></>
                  }
                </View>
              ) : hasPendingRequest ? (
                // Angefragt — Gold Outline
                <View style={[s.followBtnOutline, { borderColor: 'rgba(251,191,36,0.5)', backgroundColor: 'rgba(251,191,36,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
                  {withdrawing
                    ? <ActivityIndicator size="small" color="#FBBF24" />
                    : <><Timer size={14} color="#FBBF24" strokeWidth={2.2} /><Text style={[s.followBtnText, { color: '#FBBF24', fontSize: 13 }]}>Angefragt</Text></>
                  }
                </View>
              ) : (
                // Folgen — Solid (Primäraktion)
                <View style={[s.followBtnFill, { backgroundColor: colors.text.primary }]}>
                  {(followLoading || sendingRequest)
                    ? <ActivityIndicator size="small" color={colors.bg.primary} />
                    : <><UserPlus size={16} color={colors.bg.primary} strokeWidth={2.2} /><Text style={[s.followBtnText, { color: colors.bg.primary }]}>{(profile as any)?.is_private ? 'Anfragen' : 'Folgen'}</Text></>
                  }
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* DM‑Button — Outline wie eigenes Profil "Teilen"-Button */}
          <Animated.View style={[dmBtnWidthStyle, { flex: 1 }]}>
            <Pressable
              onPress={handleDM}
              disabled={dmLoading}
              style={[s.followBtnWrap, { flex: 1 }]}
            >
              {isFollowing ? (
                <View style={[s.followBtnOutline, {
                  backgroundColor: colors.bg.elevated,
                  borderColor: colors.border.strong,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                }]}>
                  {dmLoading
                    ? <ActivityIndicator size="small" color={colors.text.primary} />
                    : <><MessageCircle size={16} color={colors.text.primary} strokeWidth={2} /><Text style={[s.followBtnText, { color: colors.text.primary, fontSize: 14 }]}>Nachricht</Text></>
                  }
                </View>
              ) : (
                <View style={[s.iconBtn, {
                  width: '100%', borderRadius: 12,
                  backgroundColor: colors.bg.elevated,
                  borderColor: colors.border.strong,
                }]}>
                  {dmLoading
                    ? <ActivityIndicator size="small" color={colors.text.primary} />
                    : <MessageCircle size={20} color={colors.text.secondary} strokeWidth={2} />}
                </View>
              )}
            </Pressable>
          </Animated.View>

        </View>
      )}
      {isOwn && (
        <Pressable onPress={() => router.push('/settings')} style={[s.editBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}>
          <Text style={[s.editBtnText, { color: colors.text.muted }]}>Profil bearbeiten</Text>
        </Pressable>
      )}
      <ProfileHighlightsRow userId={id ?? null} isOwn={isOwn} />

      {/* ── TABS ── */}
      <View style={[s.tabBar, { borderTopColor: colors.border.subtle, backgroundColor: colors.bg.secondary }]}>
        <Pressable
          style={[s.tab, activeTab === 'posts' && [s.tabActive, { borderBottomColor: colors.text.primary }]]}
          onPress={() => { setActiveTab('posts'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Grid3X3 size={24} color={activeTab === 'posts' ? colors.text.primary : colors.icon.muted} strokeWidth={2} />
          <Text style={[s.tabLabel, { color: activeTab === 'posts' ? colors.text.primary : colors.text.muted }]}>Posts</Text>
          {postCount > 0 && activeTab === 'posts' && (
            <View style={[s.gridCountPill, { backgroundColor: colors.bg.elevated }]}><Text style={[s.gridCountText, { color: colors.text.primary }]}>{postCount}</Text></View>
          )}
        </Pressable>
        <Pressable
          style={[s.tab, activeTab === 'liked' && [s.tabActive, { borderBottomColor: '#F472B6' }]]}
          onPress={() => { setActiveTab('liked'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Heart size={24} color={activeTab === 'liked' ? '#F472B6' : colors.icon.muted} fill={activeTab === 'liked' ? '#F472B6' : 'transparent'} strokeWidth={2} />
          <Text style={[s.tabLabel, { color: activeTab === 'liked' ? '#F472B6' : colors.text.muted }]}>Gefällt mir</Text>
        </Pressable>
        <Pressable
          style={[s.tab, activeTab === 'reposts' && [s.tabActive, { borderBottomColor: colors.text.primary }]]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('reposts');
          }}
        >
          <Repeat2 size={24} color={activeTab === 'reposts' ? colors.text.primary : colors.icon.muted} strokeWidth={2} />
          <Text style={[s.tabLabel, { color: activeTab === 'reposts' ? colors.text.primary : colors.text.muted }]}>Geteilt</Text>
        </Pressable>
        {showBattlesTab && (
          <Pressable
            style={[s.tab, activeTab === 'battles' && [s.tabActive, { borderBottomColor: '#FF2E63' }]]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('battles');
            }}
          >
            <Swords size={24} color={activeTab === 'battles' ? '#FF2E63' : colors.icon.muted} strokeWidth={2} />
            <Text style={[s.tabLabel, { color: activeTab === 'battles' ? '#FF2E63' : colors.text.muted }]}>Battles</Text>
          </Pressable>
        )}
        {showShopTab && (
          <Pressable
            style={[s.tab, activeTab === 'shop' && [s.tabActive, { borderBottomColor: colors.text.primary }]]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('shop');
            }}
          >
            <ShoppingBag size={24} color={activeTab === 'shop' ? colors.text.primary : colors.icon.muted} strokeWidth={2} />
            <Text style={[s.tabLabel, { color: activeTab === 'shop' ? colors.text.primary : colors.text.muted }]}>Shop</Text>
            {shopProducts.length > 0 && activeTab === 'shop' && (
              <View style={[s.gridCountPill, { backgroundColor: colors.bg.elevated }]}>
                <Text style={[s.gridCountText, { color: colors.text.primary }]}>{shopProducts.length}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );

  const REPORT_REASONS = [
    { key: 'spam' as const,          label: 'Spam',                  sub: 'Massenhafte oder irreführende Inhalte', color: '#F59E0B' },
    { key: 'harassment' as const,    label: 'Belästigung / Hassrede', sub: 'Beleidigende oder bedrohliche Inhalte',  color: '#EF4444' },
    { key: 'inappropriate' as const, label: 'Unangemessener Inhalt',  sub: 'Sexuelle oder schockierende Inhalte',   color: '#EC4899' },
    { key: 'fake_account' as const,  label: 'Fake-Account',           sub: 'Gibt vor eine andere Person zu sein',   color: '#8B5CF6' },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.bg.secondary }]}>
      <AvatarZoomViewer
        visible={avatarZoomed}
        avatarUrl={profile.avatar_url}
        initials={initials}
        onClose={() => setAvatarZoomed(false)}
      />

      {/* ── Profil-Optionen Bottom Sheet ─────────────────────── */}
      <Modal transparent visible={showProfileMenu} animationType="slide" onRequestClose={() => setShowProfileMenu(false)}>
        <Pressable style={pm.backdrop} onPress={() => setShowProfileMenu(false)}>
          <Pressable style={[pm.sheet, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]} onPress={e => e.stopPropagation()}>
            <View style={[pm.handle, { backgroundColor: colors.border.strong }]} />
            {/* Header */}
            <View style={pm.header}>
              <View style={[pm.avatarCircle, { backgroundColor: colors.bg.subtle }]}>
                <User size={18} color={colors.icon.default} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[pm.headerName, { color: colors.text.primary }]}>@{profile?.username}</Text>
                <Text style={[pm.headerSub, { color: colors.text.muted }]}>Profiloptionen</Text>
              </View>
              <Pressable onPress={() => setShowProfileMenu(false)} style={[pm.closeBtn, { backgroundColor: colors.bg.subtle }]} hitSlop={12}>
                <X size={16} color={colors.icon.muted} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View style={[pm.divider, { backgroundColor: colors.border.subtle }]} />

            <Pressable style={pm.row} onPress={() => { setShowProfileMenu(false); setTimeout(() => setShowProfileShareSheet(true), 250); }}>
              <View style={[pm.iconBox, { backgroundColor: colors.bg.subtle }]}>
                <Share2 size={20} color={colors.icon.default} strokeWidth={2} />
              </View>
              <View style={pm.rowText}>
                <Text style={[pm.rowLabel, { color: colors.text.primary }]}>Profil teilen</Text>
                <Text style={[pm.rowSub, { color: colors.text.muted }]}>In-App oder Link teilen</Text>
              </View>
            </Pressable>

            {/* v1.17.0: Live-Push Stumm-Toggle (nur wenn nicht eigenes Profil) */}
            {!isOwn && (
              <Pressable
                style={pm.row}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleMuteHost.mutate({ hostId: id, mute: !isLivePushMuted });
                }}
              >
                <View style={[pm.iconBox, { backgroundColor: colors.bg.subtle }]}>
                  {isLivePushMuted
                    ? <BellOff size={20} color={colors.icon.default} strokeWidth={2} />
                    : <Bell    size={20} color={colors.icon.default} strokeWidth={2} />}
                </View>
                <View style={pm.rowText}>
                  <Text style={[pm.rowLabel, { color: colors.text.primary }]}>
                    {isLivePushMuted ? 'Live-Pushes aktivieren' : 'Live-Pushes stumm schalten'}
                  </Text>
                  <Text style={[pm.rowSub, { color: colors.text.muted }]}>
                    {isLivePushMuted
                      ? 'Du bekommst wieder Push wenn sie live gehen'
                      : 'Kein Push mehr wenn dieser User live geht'}
                  </Text>
                </View>
              </Pressable>
            )}

            <Pressable style={pm.row} onPress={() => { setShowProfileMenu(false); setTimeout(handleBlock, 200); }}>
              <View style={[pm.iconBox, { backgroundColor: colors.bg.subtle }]}>
                {isBlocked
                  ? <Shield size={20} color={colors.icon.default} strokeWidth={2} />
                  : <ShieldOff size={20} color={colors.accent.danger} strokeWidth={2} />}
              </View>
              <View style={pm.rowText}>
                <Text style={[pm.rowLabel, { color: isBlocked ? colors.text.primary : colors.accent.danger }]}>
                  {isBlocked ? 'Entblocken' : 'Blockieren'}
                </Text>
                <Text style={[pm.rowSub, { color: colors.text.muted }]}>
                  {isBlocked ? 'Dieser User kann dir wieder folgen' : 'Kein Kontakt mehr möglich'}
                </Text>
              </View>
            </Pressable>

            <Pressable style={pm.row} onPress={() => { setShowProfileMenu(false); setTimeout(() => setShowReportSheet(true), 250); }}>
              <View style={[pm.iconBox, { backgroundColor: colors.bg.subtle }]}>
                <Flag size={20} color={colors.accent.danger} strokeWidth={2} />
              </View>
              <View style={pm.rowText}>
                <Text style={[pm.rowLabel, { color: colors.accent.danger }]}>Melden</Text>
                <Text style={[pm.rowSub, { color: colors.text.muted }]}>Verstoß gegen Community-Richtlinien</Text>
              </View>
            </Pressable>

            <View style={{ height: 24 }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Melde-Grund Bottom Sheet ─────────────────────────── */}
      <Modal transparent visible={showReportSheet} animationType="slide" onRequestClose={() => setShowReportSheet(false)}>
        <Pressable style={pm.backdrop} onPress={() => setShowReportSheet(false)}>
          <Pressable style={[pm.sheet, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]} onPress={e => e.stopPropagation()}>
            <View style={[pm.handle, { backgroundColor: colors.border.strong }]} />
            <View style={pm.header}>
              <View style={[pm.iconBox, { backgroundColor: colors.bg.subtle }]}>
                <Flag size={18} color={colors.accent.danger} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[pm.headerName, { color: colors.text.primary }]}>@{profile?.username} melden</Text>
                <Text style={[pm.headerSub, { color: colors.text.muted }]}>Wähle den Grund</Text>
              </View>
              <Pressable onPress={() => setShowReportSheet(false)} style={[pm.closeBtn, { backgroundColor: colors.bg.subtle }]} hitSlop={12}>
                <X size={16} color={colors.icon.muted} strokeWidth={2.5} />
              </Pressable>
            </View>
            <View style={[pm.divider, { backgroundColor: colors.border.subtle }]} />
            {REPORT_REASONS.map(r => (
              <Pressable key={r.key} style={pm.row} onPress={() => handleReportUser(r.key)}>
                <View style={[pm.iconBox, { backgroundColor: colors.bg.subtle }]}>
                  <Flag size={18} color={colors.icon.default} strokeWidth={2} />
                </View>
                <View style={pm.rowText}>
                  <Text style={[pm.rowLabel, { color: colors.text.primary }]}>{r.label}</Text>
                  <Text style={[pm.rowSub, { color: colors.text.muted }]}>{r.sub}</Text>
                </View>
              </Pressable>
            ))}
            <View style={{ height: 24 }} />
          </Pressable>
        </Pressable>
      </Modal>
      {/* ── TikTok-Style Profil-Share-Sheet ───────────────────── */}
      <ProfileShareSheet
        visible={showProfileShareSheet}
        onClose={() => setShowProfileShareSheet(false)}
        userId={id}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        isOwnProfile={isOwn}
      />

      <FlatList
        ref={listRef}
        refreshControl={
          <RefreshControl
            refreshing={repostLoading && activeTab === 'reposts'}
            onRefresh={() => { if (activeTab === 'reposts') loadReposts(); }}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        }
        // Battles-Tab: FlatList-Daten leer → BattleHistoryList via ListEmptyComponent
        // Shop-Tab: Produkte statt Posts — kleinerer Typ (Product), aber gleiches 3-col Grid
        data={
          activeTab === 'battles' ? []
            : activeTab === 'posts' ? posts
              : activeTab === 'liked' ? likedPosts
                : activeTab === 'reposts' ? repostedPosts
                  : activeTab === 'shop' ? (shopProducts as any)
                    : []
        }
        // columnWrapperStyle darf nicht bei numColumns=1 (bzw. leerer Liste mit numColumns) gesetzt werden
        key={activeTab === 'battles' ? 'battles-list' : 'grid'}
        keyExtractor={(item) => item.id}
        numColumns={activeTab === 'battles' ? 1 : GRID_COLS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={Header}
        columnWrapperStyle={activeTab === 'battles' ? undefined : s.gridRow}
        ListEmptyComponent={
          activeTab === 'battles' ? (
            <BattleHistoryList userId={id} />
          ) : (activeTab === 'liked' && likedLoading) || (activeTab === 'reposts' && repostLoading) ? (
            <View style={s.emptyGrid}><ActivityIndicator color="#FFFFFF" /></View>
          ) : activeTab === 'shop' ? (
            <View style={s.emptyGrid}>
              <ShoppingBag size={36} stroke="#1F2937" strokeWidth={1.2} />
              <Text style={[s.emptyTitle, { color: colors.text.secondary }]}>Noch keine Produkte</Text>
              <Text style={[s.emptySub, { color: colors.text.muted }]}>
                {profile?.username ?? 'Dieser User'} hat aktuell keinen aktiven Shop.
              </Text>
            </View>
          ) : (
            <View style={s.emptyGrid}>
              <Users size={36} stroke="#1F2937" strokeWidth={1.2} />
              <Text style={[s.emptyTitle, { color: colors.text.secondary }]}>
                {activeTab === 'liked' ? 'Keine gelikten Posts'
                  : activeTab === 'reposts' ? 'Keine geteilten Posts'
                    : 'Noch keine Posts'}
              </Text>
              <Text style={[s.emptySub, { color: colors.text.muted }]}>
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
        renderItem={({ item, index }) => {
          // v1.26.5: Shop-Tab → Produkt-Thumbnail statt Post-Thumbnail
          if (activeTab === 'shop') {
            const product = item as unknown as Product;
            const salePrice = product.sale_price_coins != null && product.sale_price_coins < product.price_coins
              ? product.sale_price_coins
              : null;
            const shownPrice = salePrice ?? product.price_coins;
            return (
              <Pressable
                style={[s.gridItem, { backgroundColor: colors.bg.elevated }]}
                onPress={() => router.push({ pathname: '/shop/[id]', params: { id: product.id } })}
              >
                {product.cover_url ? (
                  <>
                    {/* 3-Layer Blur-Fill, konsistent mit app/shop/index.tsx + app/shop/[id].tsx */}
                    <Image
                      source={{ uri: product.cover_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      blurRadius={25}
                    />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
                    <Image
                      source={{ uri: product.cover_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="contain"
                    />
                  </>
                ) : (
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <ShoppingBag size={28} color={colors.text.muted} strokeWidth={1.2} />
                  </View>
                )}
                {salePrice != null && (
                  <View style={s.shopSaleBadge}>
                    <Text style={s.shopSaleBadgeText}>
                      -{Math.round((1 - salePrice / product.price_coins) * 100)}%
                    </Text>
                  </View>
                )}
                <View style={s.shopPricePill}>
                  <Text style={s.shopPriceText} numberOfLines={1}>
                    🪙 {shownPrice.toLocaleString('de-DE')}
                  </Text>
                </View>
              </Pressable>
            );
          }

          const handlePress = () => {
            if (activeTab === 'posts') {
              // Posts-Tab: alle Posts des Users — userId-Modus
              router.push({ pathname: '/user-posts', params: { userId: id, startIndex: String(index), username: profile.username } });
            } else {
              // Liked / Reposts: explizite IDs übergeben für TikTok-Scroll
              const currentList = activeTab === 'liked' ? likedPosts : repostedPosts;
              const ids = currentList.map((p) => p.id).join(',');
              router.push({ pathname: '/user-posts', params: { postIds: ids, startIndex: String(index), username: profile.username } });
            }
          };
          return (
          <Pressable
            style={[s.gridItem, { backgroundColor: colors.bg.elevated }]}
            onPress={handlePress}
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
          </Pressable>
          );
        }}
      />


      {/* ── Left-Edge-Swipe → zurück ── */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 30, zIndex: 200 }} {...backSwipePan.panHandlers} />
    </View>
  );
}

// ─── Styles (identisch mit user/[id].tsx) ────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },  // backgroundColor via inline
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  backPill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },

  // ── Compact Nav Bar ───────────────────────────────────────────
  navBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingBottom: 8,
    backgroundColor: '#050508',   // via inline überschrieben mit colors.bg.secondary
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
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }, // color via inline
  statLabel: { fontSize: 12, fontWeight: '500' }, // color via inline

  // ── User Info Section ───────────────────────────────────────
  userInfoSection: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  avatarRingGradient: {
    width: AVATAR_SIZE + 6, height: AVATAR_SIZE + 6, borderRadius: (AVATAR_SIZE + 6) / 2, padding: 3,
    shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 12,
  },
  avatarGap: { flex: 1, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  infoSection: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },   // backgroundColor via inline
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  username: { fontSize: 22, fontWeight: '800', letterSpacing: -0.7 }, // color via inline
  guildPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    // backgroundColor + borderColor via inline mit colors
  },
  guildPillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
  bio: { fontSize: 14, lineHeight: 21, maxWidth: 280 }, // color via inline
  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  websiteLink: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 240,
  },

  metricsRow: {
    flexDirection: 'row', borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, paddingVertical: 4, overflow: 'hidden',
    // backgroundColor und borderColor via inline mit colors
  },
  metricDivider: { width: StyleSheet.hairlineWidth, marginVertical: 10 },   // backgroundColor via inline
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  followBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  followBtnFill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  followBtnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  followBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  iconBtn: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    // backgroundColor + borderColor via inline mit colors
  },
  editBtn: { marginTop: 4, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignSelf: 'stretch', alignItems: 'center' },
  editBtnText: { fontSize: 14, fontWeight: '600' },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.07)', marginTop: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: 'transparent' },   // set inline via colors.text.primary
  tabLabel: { color: '#6B7280', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  tabLabelActive: {},   // color set inline
  gridCountPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  gridCountText: { fontSize: 11, fontWeight: '700' },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { width: GRID_ITEM_WIDTH, height: GRID_ITEM_HEIGHT, overflow: 'hidden' },   // backgroundColor via inline
  // v1.26.5: Shop-Thumbnail-Overlays
  shopSaleBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: '#EF4444',
    borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  shopSaleBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.1 },
  shopPricePill: {
    position: 'absolute', left: 6, right: 6, bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  shopPriceText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.1 },
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

// ── Profile Menu Bottom Sheet Styles ─────────────────────────────────────────
const pm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 30,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerName: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.3,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.38)', fontSize: 12, marginTop: 1,
  },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16, marginBottom: 6,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 14,
  },
  iconBox: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '600',
  },
  rowSub: {
    color: 'rgba(255,255,255,0.38)', fontSize: 12, lineHeight: 16,
  },
});


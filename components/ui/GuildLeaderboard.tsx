import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import { FadeInDown } from 'react-native-reanimated';
import { Timer, Flame, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGuildLeaderboard, type LeaderboardPost, type LeaderboardMember } from '@/lib/useGuildLeaderboard';
import { VideoGridThumb } from './VideoGridThumb';
import { useTheme } from '@/lib/useTheme';
import type { ThemeColors } from '@/lib/theme';

// ── Medaillen ──────────────────────────────────────────────────────────────
const MEDAL = ['🥇', '🥈', '🥉'];
const RANK_COLORS = [
  ['#FFD700', '#FFA500'],  // Gold
  ['#C0C0C0', '#A8A8A8'],  // Silber
  ['#CD7F32', '#A0522D'],  // Bronze
];

/** Engagement-Farbe anhand von Schwellenwerten */
function vibeBarColor(pct: number): string {
  if (pct >= 70) return '#34D399'; // grün  — hohes Engagement
  if (pct >= 40) return '#FBBF24'; // gelb  — mittleres Engagement
  return '#F87171';                 // rot   — niedriges Engagement
}

function ResonanzBadge({ pct, seconds, colors }: { pct: number; seconds: number; colors: ThemeColors }) {
  const color = vibeBarColor(pct);
  return (
    <View style={[badge.wrap, { borderColor: color + '44', backgroundColor: colors.bg.elevated }]}>
      <Timer size={11} color={color} strokeWidth={2.2} />
      <Text style={[badge.pct, { color }]}>{pct}%</Text>
      <Text style={[badge.secs, { color: colors.text.muted }]}>{seconds}s</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  pct: { fontSize: 12, fontWeight: '800' },
  secs: { fontSize: 10, fontWeight: '500' },
});

// ── Top-Post Karte ─────────────────────────────────────────────────────────
function TopPostCard({
  post, rank, guildColors, colors,
}: { post: LeaderboardPost; rank: number; guildColors: string[]; colors: ThemeColors }) {
  const medal = MEDAL[rank] ?? `#${rank + 1}`;
  const rankColors = RANK_COLORS[rank] ?? ['#CCCCCC', '#FFFFFF'];
  const initial = (post.author_username ?? '?')[0].toUpperCase();

  return (
    <Animated.View entering={FadeInDown.delay(rank * 20).duration(120)}>
      <Pressable
        style={[card.wrap, { backgroundColor: colors.bg.secondary, borderColor: colors.border.default }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/post/[id]', params: { id: post.id } });
        }}
      >
        {/* Rang-Badge */}
        <View style={card.rankBadge}>
          <LinearGradient colors={rankColors as any} style={card.rankGrad}>
            <Text style={card.rankEmoji}>{medal}</Text>
          </LinearGradient>
        </View>

        {/* Thumbnail */}
        <View style={card.thumb}>
          {post.media_type === 'video' ? (
            <VideoGridThumb
              uri={post.media_url}
              thumbnailUrl={post.thumbnail_url}
              style={{ width: 72, height: 96, borderRadius: 12 }}
            />
          ) : (
            <Image
              source={{ uri: post.media_url }}
              style={{ width: 72, height: 96, borderRadius: 12 }}
              contentFit="cover"
            />
          )}
        </View>

        {/* Info */}
        <View style={card.info}>
          {/* Autor */}
          <Pressable
            style={card.authorRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/user/[id]', params: { id: post.author_id } });
            }}
          >
            {post.author_avatar ? (
              <Image source={{ uri: post.author_avatar }} style={card.avatar} />
            ) : (
              <View style={[card.avatar, card.avatarFallback]}>
                <Text style={card.avatarInitial}>{initial}</Text>
              </View>
            )}
            <Text style={[card.username, { color: colors.text.secondary }]}>@{post.author_username ?? '?'}</Text>
          </Pressable>

          {/* Caption */}
          {post.caption ? (
            <Text style={[card.caption, { color: colors.text.muted }]} numberOfLines={2}>{post.caption}</Text>
          ) : null}

          {/* Resonanz */}
          <ResonanzBadge pct={post.completion_pct} seconds={post.avg_seconds} colors={colors} />

          <Text style={[card.dwellLabel, { color: colors.text.muted }]}>✦ Resonanz</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const card = StyleSheet.create({
  wrap: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  rankBadge: { position: 'absolute', top: 10, left: 10, zIndex: 2 },
  rankGrad: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankEmoji: { fontSize: 14 },
  thumb: { borderRadius: 12, overflow: 'hidden' },
  info: { flex: 1, gap: 6 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 22, height: 22, borderRadius: 11 },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  username: { fontSize: 12, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 17 },
  dwellLabel: { fontSize: 10, marginTop: -2 },
});

// ── Mitglieder-Zeile ────────────────────────────────────────────────────────
function MemberRow({
  member, rank, guildColors, colors,
}: { member: LeaderboardMember; rank: number; guildColors: string[]; colors: ThemeColors }) {
  const medal = MEDAL[rank] ?? `#${rank + 1}`;
  const rankColors = RANK_COLORS[rank] ?? guildColors;
  const initial = (member.username ?? '?')[0].toUpperCase();

  return (
    <Animated.View entering={FadeInDown.delay(rank * 20).duration(120)}>
      <Pressable
        style={[member_s.wrap, { borderBottomColor: colors.border.subtle }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/user/[id]', params: { id: member.id } });
        }}
      >
        {/* Rang */}
        <View style={member_s.rankWrap}>
          {rank < 3 ? (
            <LinearGradient colors={rankColors as any} style={member_s.rankGrad}>
              <Text style={member_s.rankEmoji}>{medal}</Text>
            </LinearGradient>
          ) : (
            <View style={[member_s.rankNum, { backgroundColor: colors.bg.elevated }]}>
              <Text style={[member_s.rankNumText, { color: colors.text.muted }]}>{rank + 1}</Text>
            </View>
          )}
        </View>

        {/* Avatar */}
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={[member_s.avatar, { borderColor: colors.border.default }]} />
        ) : (
          <View style={[member_s.avatar, member_s.avatarFallback, { borderColor: colors.border.default }]}>
            <Text style={member_s.avatarInitial}>{initial}</Text>
          </View>
        )}

        {/* Info */}
        <View style={member_s.info}>
          <Text style={[member_s.username, { color: colors.text.primary }]}>@{member.username ?? '?'}</Text>
          <Text style={[member_s.sub, { color: colors.text.muted }]}>{member.post_count} Post{member.post_count !== 1 ? 's' : ''} diese Woche</Text>
        </View>

        {/* Score */}
        <View style={member_s.scoreWrap}>
          <Text style={member_s.scoreNum}>{member.avg_completion_pct}%</Text>
          <Text style={[member_s.scoreLabel, { color: colors.text.muted }]}>Ø Vibe-Score</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const member_s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankWrap: { width: 32, alignItems: 'center' },
  rankGrad: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankEmoji: { fontSize: 14 },
  rankNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankNumText: { fontSize: 12, fontWeight: '700' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5 },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  info: { flex: 1 },
  username: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 2 },
  scoreWrap: { alignItems: 'flex-end' },
  scoreNum: { color: '#34D399', fontSize: 18, fontWeight: '800' },
  scoreLabel: { fontSize: 10, marginTop: 1 },
});

// ── Abschnitt-Header ────────────────────────────────────────────────────────
function SectionHeader({ icon, title, sub, colors }: { icon: React.ReactNode; title: string; sub: string; colors: ThemeColors }) {
  return (
    <View style={sec.wrap}>
      <View style={[sec.iconWrap, { backgroundColor: colors.bg.elevated }]}>{icon}</View>
      <View>
        <Text style={[sec.title, { color: colors.text.primary }]}>{title}</Text>
        <Text style={[sec.sub, { color: colors.text.muted }]}>{sub}</Text>
      </View>
    </View>
  );
}

const sec = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 11, marginTop: 1 },
});

// ── Hauptkomponente ────────────────────────────────────────────────────────
export function GuildLeaderboard({
  guildId, guildColors,
}: { guildId: string | null | undefined; guildColors: string[] }) {
  const { data, isLoading } = useGuildLeaderboard(guildId);
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[lb.loading, { backgroundColor: colors.bg.primary }]}>
        <ActivityIndicator color={guildColors[0]} size="large" />
        <Text style={[lb.loadingText, { color: colors.text.muted }]}>Lade Rangliste…</Text>
      </View>
    );
  }

  const posts = data?.top_posts ?? [];
  const members = data?.top_members ?? [];
  const isEmpty = posts.length === 0 && members.length === 0;

  if (isEmpty) {
    return (
      <View style={[lb.empty, { backgroundColor: colors.bg.primary }]}>
        <Text style={lb.emptyIcon}>🏆</Text>
        <Text style={[lb.emptyTitle, { color: colors.text.primary }]}>Noch keine Rangliste</Text>
        <Text style={[lb.emptyDesc, { color: colors.text.muted }]}>
          Poste diese Woche im Guild-Room — deine Verweildauer entscheidet über den Platz.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[lb.scroll, { backgroundColor: colors.bg.primary }]}
      contentContainerStyle={lb.content}
      showsVerticalScrollIndicator={false}
    >
      {/* USP-Erklärung */}
      <Animated.View entering={FadeInDown.duration(120)} style={[lb.uspBanner, { backgroundColor: colors.bg.secondary, borderColor: 'rgba(52,211,153,0.25)' }]}>
        <Timer size={16} color="#34D399" strokeWidth={2} />
        <Text style={[lb.uspText, { color: colors.text.secondary }]}>
          Keine Likes. Nur echte Verweildauer entscheidet.
        </Text>
      </Animated.View>

      {/* Top Posts */}
      {posts.length > 0 && (
        <View style={lb.section}>
          <SectionHeader
            icon={<Flame size={18} color="#F97316" strokeWidth={2} />}
            title="Top Posts"
            sub="Diese Woche · sortiert nach Ø Verweildauer"
            colors={colors}
          />
          <View style={lb.postList}>
            {posts.map((post, i) => (
              <TopPostCard key={post.id} post={post} rank={i} guildColors={guildColors} colors={colors} />
            ))}
          </View>
        </View>
      )}

      {/* Divider */}
      {posts.length > 0 && members.length > 0 && (
        <View style={[lb.divider, { backgroundColor: colors.border.subtle }]} />
      )}

      {/* Top Mitglieder */}
      {members.length > 0 && (
        <View style={lb.section}>
          <SectionHeader
            icon={<Trophy size={18} color="#FBBF24" strokeWidth={2} />}
            title="Top Mitglieder"
            sub="Diese Woche · Ø Vibe-Score aller Posts"
            colors={colors}
          />
          <View>
            {members.map((m, i) => (
              <MemberRow key={m.id} member={m} rank={i} guildColors={guildColors} colors={colors} />
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const lb = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  uspBanner: { borderRadius: 14, overflow: 'hidden', marginBottom: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  uspText: { fontSize: 12, fontStyle: 'italic', flex: 1 },
  section: { marginBottom: 8 },
  postList: { gap: 10 },
  divider: { height: 1, marginVertical: 24 },
});

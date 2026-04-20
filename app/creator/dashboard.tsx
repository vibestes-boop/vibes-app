/**
 * app/creator/dashboard.tsx — Creator Studio
 *
 * Design: App-native Monochrom-Stil (kein hardcoded Lila).
 * Accent = colors.accent.primary (Weiß im Dark, Schwarz im Light Mode).
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Eye, Heart, MessageCircle, Users,
  TrendingUp, TrendingDown, Sparkles, Play,
  Diamond, ChevronRight, BarChart2, Gift, Radio,
  Clock, FileText, Timer,
} from 'lucide-react-native';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/lib/useTheme';
import {
  useCreatorOverview,
  useCreatorEarnings,
  useCreatorTopPosts,
  useCreatorGiftHistory,
  useFollowerGrowth,
  useCreatorEngagementHours,
  useCreatorWatchTime,
  fmtNum,
  fmtDuration,
  formatDelta,
  type AnalyticsPeriod,
} from '@/lib/useAnalytics';
import {
  EngagementHoursHeatmap,
  EngagementHoursHeatmapEmpty,
} from '@/components/creator/EngagementHoursHeatmap';
import { useScheduledPosts } from '@/lib/useScheduledPosts';
import { usePostDraftsCloud } from '@/lib/usePostDraftsCloud';

const { width: W } = Dimensions.get('window');

// ─── Period Toggle ─────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '7T', value: 7 },
  { label: '28T', value: 28 },
  { label: '90T', value: 90 },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreatorDashboard() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuthStore();
  const userId = profile?.id ?? null;

  const [period, setPeriod] = useState<AnalyticsPeriod>(28);

  const overview  = useCreatorOverview(userId, period);
  const earnings  = useCreatorEarnings(userId, period);
  const topPosts  = useCreatorTopPosts(userId, 'views', 5);
  const giftHist  = useCreatorGiftHistory(userId, 8);
  const follGrowth = useFollowerGrowth(userId, period);

  // v1.20 — Peak-Hours + Watch-Time
  const engagementHours = useCreatorEngagementHours(userId, period);
  const watchTime       = useCreatorWatchTime(userId, period);

  // v1.20 — Scheduled Posts + Drafts (counts only on dashboard)
  const scheduled = useScheduledPosts();
  const drafts    = usePostDraftsCloud();

  const refetchAll = () => {
    overview.refetch(); earnings.refetch();
    topPosts.refetch(); giftHist.refetch(); follGrowth.refetch();
    engagementHours.refetch(); watchTime.refetch();
    scheduled.refetch(); drafts.refetch();
  };

  const ov = overview.data;
  const ea = earnings.data;
  const isLoading = overview.isLoading || earnings.isLoading;
  const isRefreshing = overview.isRefetching || earnings.isRefetching;

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>

        <View style={s.headerCenter}>
          <View style={[s.headerBadge, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <Sparkles size={12} color={colors.text.primary} strokeWidth={2} />
            <Text style={[s.headerBadgeText, { color: colors.text.primary }]}>Creator Studio</Text>
          </View>
        </View>

        <Pressable
          hitSlop={16}
          style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
          onPress={() => router.push('/creator/payout-request' as any)}
          accessibilityLabel="Auszahlung beantragen"
        >
          <Diamond size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      </View>

      {/* ── Hero: Diamonds + Name ────────────────────────────────── */}
      <View style={[s.hero, { borderBottomColor: colors.border.subtle }]}>
        <View>
          <Text style={[s.heroLabel, { color: colors.text.muted }]}>Dein Guthaben</Text>
          <View style={s.heroRow}>
            <Text style={[s.heroValue, { color: colors.text.primary }]}>
              {ea ? fmtNum(ea.diamonds_balance) : '–'}
            </Text>
            <Text style={[s.heroCurrency, { color: colors.text.muted }]}>💎</Text>
          </View>
          <Text style={[s.heroSub, { color: colors.text.muted }]}>
            {profile?.display_name ?? profile?.username ?? ''}
          </Text>
        </View>
        <Pressable
          style={[s.payoutCta, { backgroundColor: colors.text.primary }]}
          onPress={() => router.push('/creator/payout-request' as any)}
          accessibilityRole="button"
          accessibilityLabel="Auszahlung beantragen"
        >
          <Text style={[s.payoutCtaText, { color: colors.bg.primary }]}>Auszahlen →</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetchAll} tintColor={colors.accent.primary} />}
      >
        {/* ── Period Tabs ─────────────────────────────────────────── */}
        <View style={[s.periodRow, { borderBottomColor: colors.border.subtle }]}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => setPeriod(p.value)}
              style={[s.periodTab, period === p.value && { borderBottomColor: colors.text.primary, borderBottomWidth: 2 }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === p.value }}
            >
              <Text style={[s.periodTabText, { color: period === p.value ? colors.text.primary : colors.text.muted }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.accent.primary} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* ── Metriken ─────────────────────────────────────────── */}
            <View style={s.section}>
              <SectionLabel title="Performance" colors={colors} />
              <View style={s.metricsGrid}>
                <MetricCard icon={<Eye size={16} color={colors.text.muted} strokeWidth={2} />}  label="Views"       value={fmtNum(ov?.total_views ?? 0)}    delta={ov?.views_delta ?? null}    colors={colors} />
                <MetricCard icon={<Heart size={16} color={colors.text.muted} strokeWidth={2} />} label="Likes"       value={fmtNum(ov?.total_likes ?? 0)}    delta={ov?.likes_delta ?? null}    colors={colors} />
                <MetricCard icon={<MessageCircle size={16} color={colors.text.muted} strokeWidth={2} />} label="Kommentare" value={fmtNum(ov?.total_comments ?? 0)} delta={ov?.comments_delta ?? null}  colors={colors} />
                <MetricCard icon={<Users size={16} color={colors.text.muted} strokeWidth={2} />} label="Follower +"  value={fmtNum(ov?.new_followers ?? 0)}  delta={ov?.followers_delta ?? null} colors={colors} />
              </View>

              {/* Engagement Rate */}
              {ov && (
                <View style={[s.engagRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
                  <BarChart2 size={14} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[s.engagLabel, { color: colors.text.secondary }]}>Engagement Rate</Text>
                  <Text style={[s.engagValue, { color: colors.text.primary }]}>{ov.engagement_rate}%</Text>
                </View>
              )}
            </View>

            {/* ── Einnahmen ────────────────────────────────────────── */}
            {ea && (
              <View style={s.section}>
                <SectionLabel title="Einnahmen" colors={colors} />
                <View style={[s.table, { borderColor: colors.border.subtle }]}>
                  <EarningsRow emoji="🎁" label="Gifts empfangen" value={`${ea.period_gifts}`} colors={colors} last={false} />
                  <EarningsRow emoji="💎" label="Diamonds diesen Zeitraum" value={`+${fmtNum(ea.period_diamonds)}`} colors={colors} last={false} />
                  <EarningsRow emoji="⭐" label={ea.top_gift_name ? `${ea.top_gift_emoji} ${ea.top_gift_name}` : 'Kein Gift'} label2="Beliebtestes Gift" colors={colors} last={false} />
                  <EarningsRow emoji="👑" label={ea.top_gifter_name ?? '–'} label2="Top Supporter" colors={colors} last />
                </View>
              </View>
            )}

            {/* ── Gift-Historie ────────────────────────────────────── */}
            {(giftHist.data?.length ?? 0) > 0 && (
              <View style={s.section}>
                <SectionLabel title="Letzte Gifts" colors={colors} />
                <View style={[s.table, { borderColor: colors.border.subtle }]}>
                  {giftHist.data!.map((g, i) => (
                    <View key={i} style={[s.giftRow, i < giftHist.data!.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle }]}>
                      {g.sender_avatar
                        ? <Image source={{ uri: g.sender_avatar }} style={s.giftAvatar} contentFit="cover" />
                        : <View style={[s.giftAvatar, { backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 12 }}>👤</Text></View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={[s.giftSender, { color: colors.text.primary }]}>@{g.sender_name}</Text>
                        <Text style={[s.giftName, { color: colors.text.muted }]}>{g.gift_emoji} {g.gift_name}</Text>
                      </View>
                      <Text style={[s.giftValue, { color: colors.text.primary }]}>+{g.diamond_value} 💎</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Top Posts ────────────────────────────────────────── */}
            {(topPosts.data?.length ?? 0) > 0 && (
              <View style={s.section}>
                <SectionLabel title="Top Posts" colors={colors} />
                <View style={[s.table, { borderColor: colors.border.subtle }]}>
                  {topPosts.data!.map((post, i) => (
                    <Pressable
                      key={post.post_id}
                      style={[s.postRow, i < topPosts.data!.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle }]}
                      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.post_id } } as any)}
                      accessibilityRole="button"
                    >
                      <View style={[s.thumb, { backgroundColor: colors.bg.elevated }]}>
                        {(post.thumbnail_url || post.media_url)
                          ? <Image source={{ uri: post.thumbnail_url ?? post.media_url! }} style={StyleSheet.absoluteFill} contentFit="cover" />
                          : <Play size={14} color={colors.text.muted} strokeWidth={2} />
                        }
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[s.postCaption, { color: colors.text.primary }]} numberOfLines={2}>
                          {post.caption ?? '(kein Text)'}
                        </Text>
                        <View style={s.postStats}>
                          <StatChip icon="👁" value={fmtNum(post.view_count)} colors={colors} />
                          <StatChip icon="❤️" value={fmtNum(post.like_count)} colors={colors} />
                          <StatChip icon="💬" value={fmtNum(post.comment_count)} colors={colors} />
                        </View>
                      </View>
                      <Text style={[s.postRank, { color: colors.text.muted }]}>#{post.rank}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* ── Peak-Hours Heatmap (v1.20) ──────────────────────── */}
            <View style={s.section}>
              <SectionLabel title="Audience" colors={colors} />
              <View style={[s.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
                {(engagementHours.data?.length ?? 0) > 0 ? (
                  <EngagementHoursHeatmap data={engagementHours.data!} colors={colors} />
                ) : (
                  <EngagementHoursHeatmapEmpty colors={colors} />
                )}
                {watchTime.data && watchTime.data.total_seconds_est > 0 && (
                  <View style={[s.watchTimeRow, { borderTopColor: colors.border.subtle }]}>
                    <Timer size={14} color={colors.text.muted} strokeWidth={2} />
                    <Text style={[s.watchTimeLabel, { color: colors.text.secondary }]}>
                      Watch-Time (Schätzung)
                    </Text>
                    <Text style={[s.watchTimeValue, { color: colors.text.primary }]}>
                      {fmtDuration(watchTime.data.total_seconds_est)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Content-Planung (v1.20) ──────────────────────────── */}
            <View style={s.section}>
              <SectionLabel title="Content-Planung" colors={colors} />

              {/* Geplante Posts */}
              <Pressable
                style={[s.navRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
                onPress={() => router.push('/creator/scheduled' as any)}
                accessibilityRole="button"
                accessibilityLabel="Geplante Posts öffnen"
              >
                <View style={[s.navIcon, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
                  <Clock size={16} color={colors.text.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.navTitle, { color: colors.text.primary }]}>
                    Geplante Posts {scheduled.pending.length > 0 && (
                      <Text style={{ color: colors.text.muted }}>· {scheduled.pending.length}</Text>
                    )}
                  </Text>
                  <Text style={[s.navSub, { color: colors.text.muted }]}>
                    {scheduled.pending.length > 0
                      ? `Nächster: ${scheduled.nextUp?.caption?.slice(0, 40) ?? '(ohne Text)'}`
                      : 'Posts für später planen'}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} />
              </Pressable>

              {/* Entwürfe */}
              <Pressable
                style={[s.navRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle, marginTop: 10 }]}
                onPress={() => router.push('/creator/drafts' as any)}
                accessibilityRole="button"
                accessibilityLabel="Entwürfe öffnen"
              >
                <View style={[s.navIcon, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
                  <FileText size={16} color={colors.text.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.navTitle, { color: colors.text.primary }]}>
                    Entwürfe {drafts.drafts.length > 0 && (
                      <Text style={{ color: colors.text.muted }}>· {drafts.drafts.length}</Text>
                    )}
                  </Text>
                  <Text style={[s.navSub, { color: colors.text.muted }]}>
                    Cloud-Entwürfe — Gerät-übergreifend verfügbar
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} />
              </Pressable>
            </View>

            {/* ── Live-Streams ─────────────────────────────────────── */}
            <View style={s.section}>
              <SectionLabel title="Live-Streams" colors={colors} />
              <Pressable
                style={[s.navRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
                onPress={() => router.push('/creator/live-history' as any)}
                accessibilityRole="button"
                accessibilityLabel="Stream-Historie öffnen"
              >
                <View style={[s.navIcon, { backgroundColor: colors.bg.primary, borderColor: colors.border.subtle }]}>
                  <Radio size={16} color={colors.text.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.navTitle, { color: colors.text.primary }]}>Stream-Historie</Text>
                  <Text style={[s.navSub, { color: colors.text.muted }]}>
                    Peak-Viewer, Gifts & Battle-Ergebnisse der letzten 30 Streams
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} />
              </Pressable>
            </View>

            {/* ── Auszahlung CTA ───────────────────────────────────── */}
            <View style={s.section}>
              <SectionLabel title="Auszahlung" colors={colors} />
              <PayoutBar ea={ea} colors={colors} router={router} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-Komponenten ──────────────────────────────────────────────────────────

function SectionLabel({ title, colors }: { title: string; colors: any }) {
  return <Text style={[s.sectionLabel, { color: colors.text.muted }]}>{title.toUpperCase()}</Text>;
}

function MetricCard({ icon, label, value, delta, colors }: { icon: React.ReactNode; label: string; value: string; delta: number | null; colors: any }) {
  const d = formatDelta(delta);
  return (
    <View style={[s.metricCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      {icon}
      <Text style={[s.metricValue, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: colors.text.muted }]}>{label}</Text>
      {d && (
        <View style={[s.deltaBadge, { backgroundColor: d.positive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }]}>
          {d.positive ? <TrendingUp size={9} color="#22C55E" strokeWidth={2.5} /> : <TrendingDown size={9} color="#EF4444" strokeWidth={2.5} />}
          <Text style={[s.deltaText, { color: d.positive ? '#22C55E' : '#EF4444' }]}>{d.label}</Text>
        </View>
      )}
    </View>
  );
}

function EarningsRow({ emoji, label, label2, value, colors, last }: { emoji: string; label: string; label2?: string; value?: string; colors: any; last: boolean }) {
  return (
    <View style={[s.earningsRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle }]}>
      <Text style={s.earningsEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        {label2 && <Text style={[s.earningsLabel2, { color: colors.text.muted }]}>{label2}</Text>}
        <Text style={[s.earningsLabel, { color: colors.text.secondary }]}>{label}</Text>
      </View>
      {value && <Text style={[s.earningsValue, { color: colors.text.primary }]}>{value}</Text>}
    </View>
  );
}

function StatChip({ icon, value, colors }: { icon: string; value: string; colors: any }) {
  return (
    <View style={s.statChip}>
      <Text style={s.statChipIcon}>{icon}</Text>
      <Text style={[s.statChipVal, { color: colors.text.muted }]}>{value}</Text>
    </View>
  );
}

const MIN_PAYOUT = 2500;
function PayoutBar({ ea, colors, router }: { ea: any; colors: any; router: any }) {
  const balance = ea?.diamonds_balance ?? 0;
  const eligible = balance >= MIN_PAYOUT;
  const pct = Math.min(100, (balance / MIN_PAYOUT) * 100);

  return (
    <View style={[s.payoutCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <View style={s.payoutTop}>
        <Text style={[s.payoutBalance, { color: colors.text.primary }]}>
          {fmtNum(balance)} 💎
        </Text>
        <Text style={[s.payoutMin, { color: colors.text.muted }]}>
          von {fmtNum(MIN_PAYOUT)} 💎 Minimum
        </Text>
      </View>
      {/* Progress */}
      <View style={[s.progressTrack, { backgroundColor: colors.border.subtle }]}>
        <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: eligible ? colors.text.primary : colors.text.secondary }]} />
      </View>
      <Pressable
        onPress={() => router.push('/creator/payout-request' as any)}
        disabled={!eligible}
        style={[s.payoutBtn, { backgroundColor: eligible ? colors.text.primary : colors.bg.elevated, borderColor: eligible ? colors.text.primary : colors.border.subtle, opacity: eligible ? 1 : 0.5 }]}
        accessibilityRole="button"
      >
        <Text style={[s.payoutBtnText, { color: eligible ? colors.bg.primary : colors.text.muted }]}>
          {eligible ? 'Auszahlung beantragen →' : `Noch ${fmtNum(MIN_PAYOUT - balance)} 💎`}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700' },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heroLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1.5 },
  heroCurrency: { fontSize: 20 },
  heroSub: { fontSize: 12, marginTop: 4 },
  payoutCta: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  payoutCtaText: { fontSize: 13, fontWeight: '800' },

  // Period Tabs
  periodRow: {
    flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
  },
  periodTab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  periodTabText: { fontSize: 13, fontWeight: '700' },

  // Section
  section: { padding: 20, gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  // Metrics
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: (W - 40 - 10) / 2,
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 4,
  },
  metricValue: { fontSize: 26, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginTop: 2 },
  deltaText: { fontSize: 10, fontWeight: '700' },

  // Engagement
  engagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  engagLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  engagValue: { fontSize: 15, fontWeight: '900' },

  // Table
  table: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },

  // Earnings
  earningsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  earningsEmoji: { fontSize: 16, width: 22 },
  earningsLabel2: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  earningsLabel: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  earningsValue: { fontSize: 14, fontWeight: '800' },

  // Gift History
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  giftAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  giftSender: { fontSize: 13, fontWeight: '700' },
  giftName: { fontSize: 11, marginTop: 1 },
  giftValue: { fontSize: 13, fontWeight: '800' },

  // Posts
  postRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  thumb: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  postCaption: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  postStats: { flexDirection: 'row', gap: 10 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statChipIcon: { fontSize: 10 },
  statChipVal: { fontSize: 10, fontWeight: '600' },
  postRank: { fontSize: 11, fontWeight: '700', minWidth: 24, textAlign: 'right' },

  // Card (generisch, v1.20 — Audience)
  card: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 12,
  },

  // Watch-Time (v1.20)
  watchTimeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12, marginTop: 4,
  },
  watchTimeLabel: { flex: 1, fontSize: 12, fontWeight: '600' },
  watchTimeValue: { fontSize: 14, fontWeight: '800' },

  // Nav-Row (für Live-Streams CTA)
  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  navIcon: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 14, fontWeight: '800' },
  navSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Payout
  payoutCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  payoutTop: { gap: 4 },
  payoutBalance: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  payoutMin: { fontSize: 12, fontWeight: '500' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, minWidth: 4 },
  payoutBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  payoutBtnText: { fontSize: 14, fontWeight: '800' },
});

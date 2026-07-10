/**
 * AnalyticsTab.tsx — Creator Analytics Dashboard
 * Premium Monochrome Design — kein Pink/Lila, maximaler Informationsgehalt
 */

import {
fmtNum,formatDelta,
useCreatorEarnings,useCreatorGiftHistory,
useCreatorOverview,useCreatorTopPosts,useFollowerGrowth,
type AnalyticsPeriod,type ContentSortBy,
} from '@/lib/useAnalytics';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
import { impactAsync,ImpactFeedbackStyle } from 'expo-haptics';
import { Image } from 'expo-image';
import {
ArrowDownRight,
ArrowUpRight,
BarChart2,
Eye,
Gem,
Heart,MessageCircle,
Minus,
TrendingUp,
Users
} from 'lucide-react-native';
import React from 'react';
import {
ActivityIndicator,
Dimensions,
Pressable,ScrollView,
StyleSheet,
Text,
View,
} from 'react-native';
import Svg,{ Line,Rect,Text as SvgText } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 32;
const CHART_H = 120;

const PERIODS: AnalyticsPeriod[] = [7, 28, 60];

// ─── Trend Arrow ─────────────────────────────────────────────────────────────
function TrendChip({ delta }: { delta: number | null }) {
  const { colors } = useTheme();
  const d = formatDelta(delta);
  if (!d) return <View style={s.trendNeutral}><Minus size={9} color={colors.text.muted} strokeWidth={2.5} /><Text style={[s.trendText, { color: colors.text.muted }]}>—</Text></View>;
  const positive = d.positive;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const color = positive ? colors.accent.success : colors.accent.danger;
  const bg    = positive ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)';
  return (
    <View style={[s.trendChip, { backgroundColor: bg }]}>
      <Icon size={9} color={color} strokeWidth={2.5} />
      <Text style={[s.trendText, { color }]}>{d.label}</Text>
    </View>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ Icon, label, value, delta, sub }: {
  Icon: React.ElementType; label: string; value: string;
  delta: number | null; sub?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[s.kpiCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
      <View style={s.kpiTop}>
        <View style={[s.kpiIconWrap, { backgroundColor: colors.bg.elevated }]}>
          <Icon size={13} color={colors.icon.default} strokeWidth={2} />
        </View>
        <TrendChip delta={delta} />
      </View>
      <Text style={[s.kpiValue, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[s.kpiLabel, { color: colors.text.muted }]}>{label}</Text>
      {sub && <Text style={[s.kpiSub, { color: colors.text.muted }]}>{sub}</Text>}
    </View>
  );
}

// ─── Horizontal Mini Bar (für Engagement-Rate) ───────────────────────────────
function EngagementBar({ rate, colors }: { rate: number; colors: any }) {
  const { t } = useI18n();
  const pct = Math.min(rate, 100);
  const quality =
    pct >= 6 ? { label: t('analytics.qExcellent'), color: colors.accent.success }
    : pct >= 3 ? { label: t('analytics.qGood'), color: colors.text.primary }
    : pct >= 1 ? { label: t('analytics.qAverage'), color: colors.text.secondary }
    : { label: t('analytics.qLow'), color: colors.accent.danger };

  return (
    <View style={[s.engCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
      <View style={s.engHeader}>
        <View>
          <Text style={[s.engTitle, { color: colors.text.primary }]}>{t('analytics.engRate')}</Text>
          <Text style={[s.engSub, { color: colors.text.muted }]}>{t('analytics.engSub')}</Text>
        </View>
        <View style={s.engRateWrap}>
          <Text style={[s.engRate, { color: quality.color }]}>{pct.toFixed(1)}%</Text>
          <Text style={[s.engQuality, { color: quality.color }]}>{quality.label}</Text>
        </View>
      </View>
      <View style={[s.engTrack, { backgroundColor: colors.bg.elevated }]}>
        <View style={[s.engFill, { width: `${pct}%` as any, backgroundColor: quality.color }]} />
      </View>
      <View style={s.engBenchmarks}>
        <Text style={[s.engBenchText, { color: colors.text.muted }]}>0%</Text>
        <Text style={[s.engBenchText, { color: colors.text.muted }]}>Ø 3%</Text>
        <Text style={[s.engBenchText, { color: colors.text.muted }]}>6%+</Text>
      </View>
    </View>
  );
}

// ─── Follower Growth Chart ─────────────────────────────────────────────────────
function FollowerChart({ data, colors, isDark }: { data: { day: string; new_followers: number }[]; colors: any; isDark: boolean }) {
  const { t } = useI18n();
  const labelColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)';
  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  if (data.length === 0) return (
    <View style={[s.emptyChart, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
      <TrendingUp size={22} color={colors.icon.muted} strokeWidth={1.5} />
      <Text style={[s.emptyChartText, { color: colors.text.muted }]}>{t('analytics.noGrowth')}</Text>
    </View>
  );

  const max = Math.max(...data.map((d) => d.new_followers), 1);
  const barCount = Math.min(data.length, 30);
  const displayData = data.slice(-barCount);
  const barW = Math.max(4, (CHART_W / barCount) - 2);
  const gap  = (CHART_W - barW * barCount) / Math.max(barCount - 1, 1);
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        {/* Grid lines */}
        {gridLevels.map((level) => {
          const y = CHART_H - 16 - level * (CHART_H - 32);
          return <Line key={level} x1={0} y1={y} x2={CHART_W} y2={y} stroke={gridColor} strokeWidth={1} />;
        })}
        {/* Bars */}
        {displayData.map((d, i) => {
          const barH  = Math.max(3, (d.new_followers / max) * (CHART_H - 32));
          const x     = i * (barW + gap);
          const y     = CHART_H - 16 - barH;
          const isLast = i === displayData.length - 1;
          const barColor = isDark
            ? (isLast ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)')
            : (isLast ? 'rgba(0,0,0,0.75)'      : 'rgba(0,0,0,0.18)');
          return (
            <React.Fragment key={d.day}>
              <Rect x={x} y={y} width={barW} height={barH} rx={barW / 3} fill={barColor} />
              {(i === 0 || isLast) && (
                <SvgText x={x + barW / 2} y={CHART_H - 2} fill={labelColor} fontSize={7.5} textAnchor="middle">
                  {d.day.slice(5)}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      {/* Max label */}
      <Text style={[s.chartMaxLabel, { color: colors.text.muted }]}>{t('analytics.maxPerDay', { n: max })}</Text>
    </View>
  );
}

// ─── Post Row ─────────────────────────────────────────────────────────────────
function PostRow({ post, idx, contentSort, onPress, colors }: {
  post: any; idx: number; contentSort: ContentSortBy;
  onPress: () => void; colors: any;
}) {
  const { t } = useI18n();
  const metricValue =
    contentSort === 'views'   ? post.view_count
    : contentSort === 'likes' ? post.like_count
    : post.comment_count;

  const completionPct = Math.min(Math.round((post.dwell_time_score ?? 0) * 100), 100);

  return (
    <Pressable style={[s.postRow, { borderBottomColor: colors.border.subtle }]} onPress={onPress} accessibilityRole="button">
      {/* Rank */}
      <View style={s.rankWrap}>
        <Text style={[s.rank, { color: idx < 3 ? colors.text.primary : colors.text.muted }]}>
          {idx + 1}
        </Text>
      </View>

      {/* Thumbnail */}
      <View style={s.thumbWrap}>
        {(post.thumbnail_url ?? post.media_url) ? (
          <Image
            source={{ uri: post.thumbnail_url ?? post.media_url }}
            style={[s.thumb, { backgroundColor: colors.bg.elevated }]}
            contentFit="cover" cachePolicy="memory-disk"
          />
        ) : (
          <View style={[s.thumb, s.thumbFallback, { backgroundColor: colors.bg.elevated }]}>
            <BarChart2 size={14} color={colors.icon.muted} />
          </View>
        )}
        {post.media_type === 'video' && (
          <View style={s.videoTag}><Text style={s.videoTagText}>▶</Text></View>
        )}
      </View>

      {/* Info */}
      <View style={s.postInfo}>
        <Text style={[s.postCaption, { color: colors.text.primary }]} numberOfLines={1}>
          {post.caption || (post.media_type === 'video' ? t('analytics.video') : t('analytics.image'))}
        </Text>
        {/* Mini stats row */}
        <View style={s.miniStats}>
          <Eye size={9} color={colors.icon.muted} strokeWidth={2} />
          <Text style={[s.miniStatText, { color: colors.text.muted }]}>{fmtNum(post.view_count)}</Text>
          <Heart size={9} color={colors.icon.muted} strokeWidth={2} />
          <Text style={[s.miniStatText, { color: colors.text.muted }]}>{fmtNum(post.like_count)}</Text>
          <MessageCircle size={9} color={colors.icon.muted} strokeWidth={2} />
          <Text style={[s.miniStatText, { color: colors.text.muted }]}>{fmtNum(post.comment_count)}</Text>
        </View>
        {/* Completion bar */}
        <View style={s.completionRow}>
          <View style={[s.completionTrack, { backgroundColor: colors.bg.elevated }]}>
            <View style={[s.completionFill, { width: `${completionPct}%` as any, backgroundColor: colors.text.primary }]} />
          </View>
          <Text style={[s.completionPct, { color: colors.text.muted }]}>{completionPct}%</Text>
        </View>
      </View>

      {/* Primary Metric */}
      <View style={s.metricWrap}>
        <Text style={[s.metricValue, { color: colors.text.primary }]}>{fmtNum(metricValue)}</Text>
        <Text style={[s.metricLabel, { color: colors.text.muted }]}>
          {contentSort === 'views' ? t('analytics.viewsShort') : contentSort === 'likes' ? t('analytics.likes') : t('analytics.commentsShort')}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Earnings Panel ───────────────────────────────────────────────────────────
function EarningsPanel({ userId, period, colors }: { userId: string | null; period: AnalyticsPeriod; colors: any }) {
  const { t } = useI18n();
  const { data: earnings, isLoading } = useCreatorEarnings(userId, period);
  const { data: history = [] } = useCreatorGiftHistory(userId, 5);

  // 100 Diamonds = 2,00 € — Creator-Kurs
  const euroValue = ((earnings?.diamonds_balance ?? 0) / 100 * 2).toFixed(2);
  const periodEuro = ((earnings?.period_diamonds ?? 0) / 100 * 2).toFixed(2);

  return (
    <View style={ep.container}>
      {/* Wallet-Card — solide Fläche, konsistent mit den übrigen Cards */}
      <View style={[ep.walletCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
        {/* Wallet-Stand */}
        <View style={ep.walletHeader}>
          <View style={ep.walletLeft}>
            <Text style={[ep.walletLabel, { color: colors.text.muted }]}>{t('analytics.earningsCaps')}</Text>
            <Text style={[ep.walletBalance, { color: colors.text.primary }]}>
              {isLoading ? '…' : `${euroValue} €`}
            </Text>
            <View style={ep.walletSubRow}>
              <Gem size={12} color={colors.accent.rose} strokeWidth={2} />
              <Text style={[ep.walletSub, { color: colors.text.muted }]}>
                {t('analytics.points', { n: fmtNum(earnings?.diamonds_balance ?? 0) })}
              </Text>
            </View>
          </View>
          <View style={[ep.walletIcon, { backgroundColor: colors.accent.rose + '1A' }]}>
            <Gem size={24} color={colors.accent.rose} strokeWidth={1.8} />
          </View>
        </View>

        {/* Periode-Stats — eingebettetes Panel */}
        <View style={[ep.periodRow, { backgroundColor: colors.bg.elevated }]}>
          <View style={ep.periodStat}>
            <Text style={[ep.periodValue, { color: colors.text.primary }]}>
              {isLoading ? '…' : `${((earnings?.period_diamonds ?? 0) * 0.02).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
            </Text>
            <Text style={[ep.periodLabel, { color: colors.text.muted }]}>{t('analytics.earned')}</Text>
          </View>
          <View style={[ep.periodDivider, { backgroundColor: colors.border.subtle }]} />
          <View style={ep.periodStat}>
            <Text style={[ep.periodValue, { color: colors.text.primary }]}>
              {isLoading ? '…' : fmtNum(earnings?.period_gifts ?? 0)}
            </Text>
            <Text style={[ep.periodLabel, { color: colors.text.muted }]}>{t('analytics.giftsReceived')}</Text>
          </View>
          <View style={[ep.periodDivider, { backgroundColor: colors.border.subtle }]} />
          <View style={ep.periodStat}>
            <Text style={[ep.periodValue, { color: colors.text.primary }]}>{periodEuro} €</Text>
            <Text style={[ep.periodLabel, { color: colors.text.muted }]}>{t('analytics.payable')}</Text>
          </View>
        </View>

        {/* Top Gift + Top Gifter */}
        {(earnings?.top_gift_name || earnings?.top_gifter_name) && (
          <View style={ep.topRow}>
            {earnings.top_gift_name && (
              <View style={[ep.topBadge, { backgroundColor: colors.bg.elevated }]}>
                <Text style={ep.topBadgeEmoji}>{earnings.top_gift_emoji ?? '🎁'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[ep.topBadgeLabel, { color: colors.text.muted }]}>{t('analytics.topGift')}</Text>
                  <Text style={[ep.topBadgeValue, { color: colors.text.primary }]} numberOfLines={1}>{earnings.top_gift_name}</Text>
                </View>
              </View>
            )}
            {earnings.top_gifter_name && (
              <View style={[ep.topBadge, { backgroundColor: colors.bg.elevated }]}>
                <Text style={ep.topBadgeEmoji}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[ep.topBadgeLabel, { color: colors.text.muted }]}>{t('analytics.topSender')}</Text>
                  <Text style={[ep.topBadgeValue, { color: colors.text.primary }]} numberOfLines={1}>@{earnings.top_gifter_name}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Gift-Historie */}
      {history.length > 0 && (
        <View style={[ep.historyCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
          <Text style={[ep.historyTitle, { color: colors.text.muted }]}>{t('analytics.lastGifts')}</Text>
          {history.map((item, i) => (
            <View
              key={i}
              style={[ep.historyRow, i < history.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle }]}
            >
              <Text style={ep.historyEmoji}>{item.gift_emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ep.historyName, { color: colors.text.primary }]}>
                  {item.gift_name} <Text style={{ color: colors.text.muted, fontWeight: '400' }}>{t('analytics.fromUser', { name: item.sender_name })}</Text>
                </Text>
              </View>
              <Text style={[ep.historyDiamonds, { color: colors.accent.rose }]}>+{(item.diamond_value * 0.02).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const ep = StyleSheet.create({
  container: { gap: 10, marginBottom: 4 },
  walletCard: {
    borderRadius: 20, borderWidth: 1,
    padding: 20, gap: 16,
  },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  walletLeft: { gap: 4, flex: 1 },
  walletLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  walletBalance: { fontSize: 38, fontWeight: '600', letterSpacing: -1 },
  walletSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  walletSub: { fontSize: 12.5, fontWeight: '500' },
  walletIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  periodRow: { flexDirection: 'row', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 4 },
  periodStat: { flex: 1, alignItems: 'center', gap: 4 },
  periodValue: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  periodLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  periodDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  topRow: { flexDirection: 'row', gap: 12 },
  topBadge: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 12, padding: 10 },
  topBadgeEmoji: { fontSize: 20 },
  topBadgeLabel: { fontSize: 10, fontWeight: '600' },
  topBadgeValue: { fontSize: 13, fontWeight: '700' },
  historyCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  historyTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, padding: 12, paddingBottom: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  historyEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  historyName: { fontSize: 13, fontWeight: '600' },
  historyDiamonds: { fontSize: 13, fontWeight: '700' },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
interface AnalyticsTabProps {
  userId: string | null;
  period: AnalyticsPeriod;
  onPeriodChange: (p: AnalyticsPeriod) => void;
  contentSort: ContentSortBy;
  onContentSortChange: (s: ContentSortBy) => void;
  onPostPress: (postId: string, mediaUrl: string | null, mediaType: string | null, caption: string | null) => void;
}

export function AnalyticsTab({
  userId, period, onPeriodChange, contentSort, onContentSortChange, onPostPress,
}: AnalyticsTabProps) {
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const { data: overview, isLoading: loadingOverview } = useCreatorOverview(userId, period);
  const { data: topPosts = [], isLoading: loadingPosts } = useCreatorTopPosts(userId, contentSort, 8);
  const { data: followerGrowth = [] } = useFollowerGrowth(userId, period);

  const totalInteractions = (overview?.total_likes ?? 0) + (overview?.total_comments ?? 0);
  const avgPerPost = topPosts.length > 0
    ? Math.round((overview?.total_views ?? 0) / topPosts.length)
    : 0;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

      {/* ── Period Picker ── */}
      <View style={[s.periodRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        {PERIODS.map((value) => {
          const active = period === value;
          return (
            <Pressable
              key={value}
              onPress={() => { impactAsync(ImpactFeedbackStyle.Light); onPeriodChange(value); }}
              style={[s.periodBtn, active && { backgroundColor: colors.bg.primary }]}
              accessibilityRole="button"
            >
              <Text style={[s.periodText, { color: active ? colors.text.primary : colors.text.muted }]}>
                {t('analytics.days', { n: value })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loadingOverview ? (
        <View style={s.loadingBox}><ActivityIndicator color={colors.text.muted} /></View>
      ) : (
        <>
          {/* ── KPI 2×2 ── */}
          <SectionLabel label={t('analytics.overview')} colors={colors} />
          <View style={s.kpiGrid}>
            <KpiCard Icon={Eye} label={t('analytics.totalViews')} value={fmtNum(overview?.total_views ?? 0)} delta={overview?.views_delta ?? null} sub={t('analytics.perPost', { n: fmtNum(avgPerPost) })} />
            <KpiCard Icon={Users} label={t('analytics.followers')} value={fmtNum(overview?.total_followers ?? 0)} delta={overview?.followers_delta ?? null} sub={t('analytics.newN', { n: fmtNum(overview?.new_followers ?? 0) })} />
            <KpiCard Icon={Heart} label={t('analytics.likes')} value={fmtNum(overview?.total_likes ?? 0)} delta={overview?.likes_delta ?? null} />
            <KpiCard Icon={MessageCircle} label={t('analytics.comments')} value={fmtNum(overview?.total_comments ?? 0)} delta={overview?.comments_delta ?? null} sub={t('analytics.interactions', { n: fmtNum(totalInteractions) })} />
          </View>

          {/* ── Engagement Rate ── */}
          <EngagementBar rate={overview?.engagement_rate ?? 0} colors={colors} />

          {/* ── Einnahmen (Serlo Coins / Diamonds) ── */}
          <SectionLabel label={t('analytics.earningsSec', { n: period })} colors={colors} />
          <EarningsPanel userId={userId} period={period} colors={colors} />

          {/* ── Follower-Wachstum ── */}
          <SectionLabel label={t('analytics.growthSec', { n: period })} colors={colors} />
          <View style={[s.chartCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
            <FollowerChart data={followerGrowth} colors={colors} isDark={isDark} />
          </View>
        </>
      )}

      {/* ── Top Posts ── */}
      <View style={s.topPostsHeader}>
        <SectionLabel label={t('analytics.topContent')} colors={colors} />
        <View style={[s.sortRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          {([
            { key: 'views'    as ContentSortBy, label: t('analytics.views') },
            { key: 'likes'    as ContentSortBy, label: t('analytics.likes') },
            { key: 'comments' as ContentSortBy, label: t('analytics.comments') },
          ]).map(({ key, label }) => {
            const active = contentSort === key;
            return (
              <Pressable
                key={key}
                onPress={() => { impactAsync(ImpactFeedbackStyle.Light); onContentSortChange(key); }}
                style={[s.sortBtn, active && { backgroundColor: colors.bg.primary }]}
                accessibilityRole="button"
              >
                <Text style={[s.sortBtnText, { color: active ? colors.text.primary : colors.text.muted }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[s.postsCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
        <View style={[s.postsCardHeader, { borderBottomColor: colors.border.subtle }]}>
          <Text style={[s.postsCardHeaderText, { color: colors.text.muted }]}>#</Text>
          <Text style={[s.postsCardHeaderText, { color: colors.text.muted, flex: 1, marginLeft: 52 }]}>{t('analytics.postCompletion')}</Text>
          <Text style={[s.postsCardHeaderText, { color: colors.text.muted }]}>
            {contentSort === 'views' ? t('analytics.views') : contentSort === 'likes' ? t('analytics.likes') : t('analytics.commentsShort')}
          </Text>
        </View>

        {loadingPosts ? (
          <View style={s.loadingBox}><ActivityIndicator color={colors.text.muted} /></View>
        ) : topPosts.length === 0 ? (
          <View style={s.noPosts}>
            <BarChart2 size={26} color={colors.icon.muted} strokeWidth={1.5} />
            <Text style={[s.noPostsText, { color: colors.text.muted }]}>{t('analytics.noData')}</Text>
            <Text style={[s.noPostsSub, { color: colors.text.muted }]}>{t('analytics.noDataSub')}</Text>
          </View>
        ) : (
          topPosts.map((post, idx) => (
            <PostRow
              key={post.post_id}
              post={post}
              idx={idx}
              contentSort={contentSort}
              onPress={() => onPostPress(post.post_id, post.media_url, post.media_type, post.caption)}
              colors={colors}
            />
          ))
        )}
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────
function SectionLabel({ label, colors }: { label: string; colors: any }) {
  return <Text style={[s.sectionLabel, { color: colors.text.muted }]}>{label.toUpperCase()}</Text>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 0 },

  // Period
  periodRow: {
    flexDirection: 'row', borderRadius: 14, padding: 4,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 20,
  },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  periodText: { fontSize: 13, fontWeight: '600' },

  // Loading
  loadingBox: { paddingVertical: 32, alignItems: 'center' },

  // Section label
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    marginTop: 20, marginBottom: 10,
  },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpiCard: {
    width: '47.5%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    padding: 14, gap: 4,
  },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  kpiIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 26, fontWeight: '600', letterSpacing: -1 },
  kpiLabel: { fontSize: 11, fontWeight: '500' },
  kpiSub: { fontSize: 10, marginTop: 2 },

  // Trend chips
  trendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  trendNeutral: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 3 },
  trendText: { fontSize: 10, fontWeight: '700' },

  // Engagement Bar
  engCard: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    padding: 16, marginBottom: 4, gap: 10,
  },
  engHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  engTitle: { fontSize: 14, fontWeight: '700' },
  engSub: { fontSize: 11, marginTop: 2 },
  engRateWrap: { alignItems: 'flex-end' },
  engRate: { fontSize: 24, fontWeight: '600', letterSpacing: -1 },
  engQuality: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  engTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  engFill: { height: '100%', borderRadius: 3 },
  engBenchmarks: { flexDirection: 'row', justifyContent: 'space-between' },
  engBenchText: { fontSize: 9, fontWeight: '500' },

  // Chart
  chartCard: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    padding: 14, marginBottom: 4,
  },
  emptyChart: {
    height: CHART_H, alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
  },
  emptyChartText: { fontSize: 12 },
  chartMaxLabel: { fontSize: 9, fontWeight: '500', marginTop: 4, textAlign: 'right' },

  // Top Posts
  topPostsHeader: { gap: 0 },
  sortRow: {
    flexDirection: 'row', borderRadius: 12, padding: 3,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 10,
  },
  sortBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  sortBtnText: { fontSize: 11, fontWeight: '600' },

  // Posts Card
  postsCard: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  postsCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postsCardHeaderText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },

  noPosts: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noPostsText: { fontSize: 13, fontWeight: '600' },
  noPostsSub: { fontSize: 11, textAlign: 'center', paddingHorizontal: 20 },

  postRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankWrap: { width: 18, alignItems: 'center' },
  rank: { fontSize: 12, fontWeight: '700' },

  thumbWrap: { position: 'relative' },
  thumb: { width: 42, height: 56, borderRadius: 7 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  videoTag: {
    position: 'absolute', bottom: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1,
  },
  videoTagText: { color: 'rgba(255,255,255,0.9)', fontSize: 7, fontWeight: '700' },

  postInfo: { flex: 1, gap: 5 },
  postCaption: { fontSize: 12, fontWeight: '600' },
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStatText: { fontSize: 10, marginRight: 6 },
  completionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completionTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  completionFill: { height: '100%', borderRadius: 2 },
  completionPct: { fontSize: 9, fontWeight: '600', width: 24, textAlign: 'right' },

  metricWrap: { alignItems: 'flex-end', minWidth: 44 },
  metricValue: { fontSize: 15, fontWeight: '600', letterSpacing: -0.5 },
  metricLabel: { fontSize: 9, fontWeight: '500', marginTop: 1 },
});

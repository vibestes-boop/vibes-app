/**
 * AnalyticsTab.tsx — Creator Analytics Dashboard
 *
 * TikTok-inspiriertes Analytics-Dashboard mit:
 *   - Period-Picker (7 / 28 / 60 Tage)
 *   - KPI Cards mit Delta-Trend (▲/▼ %)
 *   - Top Posts (sortierbar: Views / Likes / Kommentare)
 *   - Follower-Wachstum als SVG-Balkengraph
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import {
  Eye, Heart, MessageCircle, Users, TrendingUp, TrendingDown,
  BarChart2, CheckCircle2, Zap,
} from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import {
  useCreatorOverview,
  useCreatorTopPosts,
  useFollowerGrowth,
  fmtNum,
  formatDelta,
  type AnalyticsPeriod,
  type ContentSortBy,
} from '@/lib/useAnalytics';

const { width: SCREEN_W } = Dimensions.get('window');
const GRAPH_W = SCREEN_W - 32;
const GRAPH_H = 100;

// ─── Period Picker ────────────────────────────────────────────────────────────
const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: '7T',  value: 7  },
  { label: '28T', value: 28 },
  { label: '60T', value: 60 },
];

// ─── Delta Badge ──────────────────────────────────────────────────────────────
function DeltaBadge({ delta }: { delta: number | null }) {
  const d = formatDelta(delta);
  if (!d) return null;
  const color = d.positive ? '#34D399' : '#F87171';
  const Icon  = d.positive ? TrendingUp : TrendingDown;
  return (
    <View style={[styles.deltaBadge, { backgroundColor: d.positive ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)' }]}>
      <Icon size={10} color={color} strokeWidth={2.5} />
      <Text style={[styles.deltaText, { color }]}>{d.label}</Text>
    </View>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, delta, accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number | null;
  accentColor: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiHeader}>
        {icon}
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      <Text style={[styles.kpiValue, { color: accentColor }]}>{value}</Text>
      <DeltaBadge delta={delta} />
    </View>
  );
}

// ─── Follower Growth Chart (SVG bars) ─────────────────────────────────────────
function FollowerChart({ data }: { data: { day: string; new_followers: number }[] }) {
  if (data.length === 0) return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartText}>Noch keine Follower-Daten</Text>
    </View>
  );

  const max = Math.max(...data.map((d) => d.new_followers), 1);
  const barCount = Math.min(data.length, 28);
  const displayData = data.slice(-barCount);
  const barW = Math.max(4, (GRAPH_W / barCount) - 2);
  const gap  = (GRAPH_W - barW * barCount) / Math.max(barCount - 1, 1);

  return (
    <Svg width={GRAPH_W} height={GRAPH_H}>
      {displayData.map((d, i) => {
        const barH  = Math.max(4, (d.new_followers / max) * (GRAPH_H - 20));
        const x     = i * (barW + gap);
        const y     = GRAPH_H - 20 - barH;
        const isLast = i === displayData.length - 1;
        return (
          <React.Fragment key={d.day}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={barW / 2}
              fill={isLast ? '#A78BFA' : 'rgba(167,139,250,0.35)'}
            />
            {/* Datum-Label: nur 1. und letzte */}
            {(i === 0 || isLast) && (
              <SvgText
                x={x + barW / 2}
                y={GRAPH_H - 4}
                fill="rgba(255,255,255,0.25)"
                fontSize={8}
                textAnchor="middle"
              >
                {d.day.slice(5)} {/* MM-DD */}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Main AnalyticsTab ────────────────────────────────────────────────────────
interface AnalyticsTabProps {
  userId: string | null;
  period: AnalyticsPeriod;
  onPeriodChange: (p: AnalyticsPeriod) => void;
  contentSort: ContentSortBy;
  onContentSortChange: (s: ContentSortBy) => void;
  onPostPress: (
    postId: string,
    mediaUrl: string | null,
    mediaType: string | null,
    caption: string | null,
  ) => void;
}

export function AnalyticsTab({
  userId,
  period,
  onPeriodChange,
  contentSort,
  onContentSortChange,
  onPostPress,
}: AnalyticsTabProps) {
  const { data: overview, isLoading: loadingOverview } = useCreatorOverview(userId, period);
  const { data: topPosts = [], isLoading: loadingPosts } = useCreatorTopPosts(userId, contentSort, 5);
  const { data: followerGrowth = [] } = useFollowerGrowth(userId, period);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Period Picker ── */}
      <View style={styles.periodRow}>
        {PERIODS.map(({ label, value }) => (
          <Pressable
            key={value}
            onPress={() => { impactAsync(ImpactFeedbackStyle.Light); onPeriodChange(value); }}
            style={[styles.periodBtn, period === value && styles.periodBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={`${label} Zeitraum`}
          >
            <Text style={[styles.periodText, period === value && styles.periodTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Overview KPIs ── */}
      <Text style={styles.sectionLabel}>OVERVIEW</Text>

      {loadingOverview ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#A78BFA" />
        </View>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            <KpiCard
              icon={<Eye size={12} color="rgba(255,255,255,0.35)" strokeWidth={1.8} />}
              label="Views"
              value={fmtNum(overview?.total_views ?? 0)}
              delta={overview?.views_delta ?? null}
              accentColor="#22D3EE"
            />
            <KpiCard
              icon={<Heart size={12} color="rgba(255,255,255,0.35)" strokeWidth={1.8} />}
              label="Likes"
              value={fmtNum(overview?.total_likes ?? 0)}
              delta={overview?.likes_delta ?? null}
              accentColor="#F472B6"
            />
            <KpiCard
              icon={<MessageCircle size={12} color="rgba(255,255,255,0.35)" strokeWidth={1.8} />}
              label="Kommentare"
              value={fmtNum(overview?.total_comments ?? 0)}
              delta={overview?.comments_delta ?? null}
              accentColor="#A78BFA"
            />
            <KpiCard
              icon={<Zap size={12} color="rgba(255,255,255,0.35)" strokeWidth={1.8} />}
              label="Engagement"
              value={`${overview?.engagement_rate ?? 0}%`}
              delta={null}
              accentColor="#FBBF24"
            />
          </View>

          {/* ── Follower Hero Card ── */}
          <LinearGradient
            colors={['rgba(167,139,250,0.15)', 'rgba(167,139,250,0.05)']}
            style={styles.followerCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.followerHeader}>
              <View>
                <Text style={styles.followerLabel}>Gesamte Follower</Text>
                <Text style={styles.followerTotal}>{fmtNum(overview?.total_followers ?? 0)}</Text>
              </View>
              <View style={styles.followerRight}>
                <Users size={18} color="rgba(167,139,250,0.6)" strokeWidth={1.8} />
                <View style={styles.netFollowersWrap}>
                  <Text style={styles.netFollowersLabel}>+{fmtNum(overview?.new_followers ?? 0)} neu</Text>
                  <DeltaBadge delta={overview?.followers_delta ?? null} />
                </View>
              </View>
            </View>

            {/* SVG Balkengraph */}
            <View style={styles.chartWrap}>
              <FollowerChart data={followerGrowth} />
            </View>
          </LinearGradient>
        </>
      )}

      {/* ── Top Posts ── */}
      <View style={styles.sectionRowHeader}>
        <Text style={styles.sectionLabel}>TOP INHALTE</Text>
        <View style={styles.contentSortRow}>
          {([
            { key: 'views' as ContentSortBy,    label: 'Views' },
            { key: 'likes' as ContentSortBy,    label: 'Likes' },
            { key: 'comments' as ContentSortBy, label: 'Kommentare' },
          ]).map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => { impactAsync(ImpactFeedbackStyle.Light); onContentSortChange(key); }}
              style={[styles.sortChip, contentSort === key && styles.sortChipActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.sortChipText, contentSort === key && styles.sortChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loadingPosts ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#A78BFA" />
        </View>
      ) : topPosts.length === 0 ? (
        <View style={styles.noPosts}>
          <BarChart2 size={28} color="rgba(255,255,255,0.1)" />
          <Text style={styles.noPostsText}>Noch keine Posts</Text>
        </View>
      ) : (
        topPosts.map((post, idx) => {
          const metricValue =
            contentSort === 'views'    ? post.view_count
            : contentSort === 'likes'  ? post.like_count
            : post.comment_count;
          const metricColor =
            contentSort === 'views'    ? '#22D3EE'
            : contentSort === 'likes'  ? '#F472B6'
            : '#A78BFA';

          return (
            <Pressable
              key={post.post_id}
              style={styles.postRow}
              onPress={() => onPostPress(post.post_id, post.media_url, post.media_type, post.caption)}
              accessibilityRole="button"
              accessibilityLabel={`Post ${idx + 1}`}
            >
              {/* Rank */}
              <Text style={[styles.rank, idx < 3 && styles.rankTop]}>{idx + 1}</Text>

              {/* Thumbnail */}
              <View style={styles.thumbWrap}>
                {(post.thumbnail_url ?? post.media_url) ? (
                  <Image
                    source={{ uri: post.thumbnail_url ?? post.media_url! }}
                    style={styles.thumb}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback]}>
                    <BarChart2 size={14} color="rgba(255,255,255,0.15)" />
                  </View>
                )}
                {post.media_type === 'video' && (
                  <View style={styles.videoTag}>
                    <Text style={styles.videoTagText}>▶</Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.postInfo}>
                <Text style={styles.postCaption} numberOfLines={1}>
                  {post.caption || (post.media_type === 'video' ? '🎬 Video' : '🖼 Bild')}
                </Text>
                <Text style={styles.postDate}>
                  {new Date(post.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                </Text>
              </View>

              {/* Primary Metric */}
              <View style={styles.metricBadge}>
                <Text style={[styles.metricValue, { color: metricColor }]}>
                  {fmtNum(metricValue)}
                </Text>
                <Text style={styles.metricLabel}>
                  {contentSort === 'views' ? 'Views' : contentSort === 'likes' ? 'Likes' : 'Komm.'}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Period
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  periodBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  periodBtnActive: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderColor: 'rgba(167,139,250,0.5)',
  },
  periodText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#A78BFA',
  },

  // Section labels
  sectionLabel: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  sectionRowHeader: {
    marginTop: 28,
    marginBottom: 12,
  },

  // Loading
  loadingRow: {
    paddingVertical: 30,
    alignItems: 'center',
  },

  // KPI Grid – 2×2
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kpiLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 34,
  },

  // Delta badge
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deltaText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Follower Card
  followerCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.2)',
    padding: 16,
    marginBottom: 4,
  },
  followerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  followerLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  followerTotal: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  followerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  netFollowersWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  netFollowersLabel: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  chartWrap: {
    marginTop: 4,
  },
  emptyChart: {
    height: GRAPH_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
  },

  // Content sort
  contentSortRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sortChipActive: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderColor: 'rgba(167,139,250,0.4)',
  },
  sortChipText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#A78BFA',
  },

  // Top Posts
  noPosts: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noPostsText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 13,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rank: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 13,
    fontWeight: '700',
    width: 18,
    textAlign: 'center',
  },
  rankTop: {
    color: '#FBBF24',
  },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 46,
    height: 60,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTag: {
    position: 'absolute', bottom: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1,
  },
  videoTagText: { color: 'rgba(255,255,255,0.8)', fontSize: 7, fontWeight: '700' },
  postInfo: { flex: 1, gap: 3 },
  postCaption: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  postDate: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
  },
  metricBadge: {
    alignItems: 'flex-end',
    minWidth: 52,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    fontWeight: '500',
  },
});

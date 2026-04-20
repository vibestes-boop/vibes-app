/**
 * app/creator/live-history.tsx — Creator Studio: Live-Stream History
 *
 * Zeigt die letzten 30 Streams des Hosts mit:
 *   • Trend-Chart (peak_viewers) oben
 *   • Liste mit Datum, Dauer, Peak-Viewer, Gift-Coins, W/L/D-Chip (wenn Battle)
 *
 * Design: App-native Monochrom-Stil, konsistent mit dashboard.tsx.
 */

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Eye, Gift, MessageCircle, Trophy,
  X as XIcon, Minus, Clock, Radio, Sparkles, Play,
} from 'lucide-react-native';
import { useHostRecordings } from '@/lib/useLiveRecording';
import Svg, { Rect, Line } from 'react-native-svg';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/lib/useTheme';
import { fmtNum } from '@/lib/useAnalytics';
import {
  useCreatorLiveHistory,
  formatDuration,
  formatRelativeTime,
  type CreatorLiveSession,
  type BattleResult,
} from '@/lib/useCreatorLiveHistory';

const { width: W } = Dimensions.get('window');

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreatorLiveHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuthStore();
  const userId = profile?.id ?? null;

  const { data, isLoading, refetch, isRefetching } = useCreatorLiveHistory(userId, 30);

  // v1.18.0: Replay-Verfügbarkeit pro Session nachladen
  const { data: recordings } = useHostRecordings(userId, 30);
  const replayableSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of recordings ?? []) {
      if (r.status === 'ready' && r.fileUrl) set.add(r.sessionId);
    }
    return set;
  }, [recordings]);

  // Aggregat-Zahlen fürs Header-Summary
  const summary = useMemo(() => {
    const rows = data ?? [];
    const totalStreams = rows.length;
    const totalSeconds = rows.reduce((s, r) => s + (r.duration_secs ?? 0), 0);
    const totalDiamonds = rows.reduce((s, r) => s + (r.total_gift_diamonds ?? 0), 0);
    const maxPeak = rows.reduce((m, r) => Math.max(m, r.peak_viewers ?? 0), 0);
    return { totalStreams, totalSeconds, totalDiamonds, maxPeak };
  }, [data]);

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View
        style={[
          s.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>

        <View style={s.headerCenter}>
          <View style={[s.headerBadge, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <Radio size={12} color={colors.text.primary} strokeWidth={2} />
            <Text style={[s.headerBadgeText, { color: colors.text.primary }]}>Live-History</Text>
          </View>
        </View>

        <View style={s.iconBtnSpacer} />
      </View>

      <FlatList<CreatorLiveSession>
        data={data ?? []}
        keyExtractor={(it) => it.session_id}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={
          <View>
            {/* Summary-Chips */}
            <View style={s.summaryRow}>
              <SummaryChip
                icon={<Radio size={12} color={colors.text.muted} strokeWidth={2} />}
                label="Streams"
                value={fmtNum(summary.totalStreams)}
                colors={colors}
              />
              <SummaryChip
                icon={<Eye size={12} color={colors.text.muted} strokeWidth={2} />}
                label="Peak-Max"
                value={fmtNum(summary.maxPeak)}
                colors={colors}
              />
              <SummaryChip
                icon={<Clock size={12} color={colors.text.muted} strokeWidth={2} />}
                label="Gesamt"
                value={formatDuration(summary.totalSeconds)}
                colors={colors}
              />
              <SummaryChip
                icon={<Text style={{ fontSize: 11 }}>💎</Text>}
                label="Diamonds"
                value={fmtNum(summary.totalDiamonds)}
                colors={colors}
              />
            </View>

            {/* Peak-Viewer Trend-Chart */}
            {(data?.length ?? 0) > 1 && (
              <View style={s.chartWrap}>
                <View style={s.chartHeader}>
                  <Sparkles size={12} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[s.chartTitle, { color: colors.text.muted }]}>
                    PEAK-VIEWER · LETZTE {data!.length} STREAMS
                  </Text>
                </View>
                <PeakTrendChart
                  rows={data!}
                  colors={colors}
                />
              </View>
            )}

            {/* Section-Label für Liste */}
            {(data?.length ?? 0) > 0 && (
              <Text style={[s.sectionLabel, { color: colors.text.muted }]}>
                STREAM-HISTORIE
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <LiveRow
            item={item}
            colors={colors}
            router={router}
            hasReplay={replayableSet.has(item.session_id)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={[s.rowSep, { backgroundColor: colors.border.subtle }]} />
        )}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.accent.primary} style={{ marginTop: 80 }} />
          ) : (
            <View style={s.empty}>
              <Radio size={32} color={colors.text.muted} strokeWidth={1.5} />
              <Text style={[s.emptyTitle, { color: colors.text.primary }]}>
                Noch keine Streams
              </Text>
              <Text style={[s.emptyBody, { color: colors.text.muted }]}>
                Sobald du live gehst, erscheint hier deine Stream-Historie mit
                Peak-Viewern, Gift-Statistiken und Battle-Ergebnissen.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

// ─── LiveRow ──────────────────────────────────────────────────────────────────

function LiveRow({
  item,
  colors,
  router,
  hasReplay,
}: {
  item: CreatorLiveSession;
  colors: any;
  router: ReturnType<typeof useRouter>;
  hasReplay: boolean;
}) {
  const dateLabel = formatRelativeTime(item.started_at);
  const dur = formatDuration(item.duration_secs);

  return (
    <Pressable
      style={s.row}
      onPress={() => {
        // v1.18.0: Hat die Session ein fertiges Replay → direkt öffnen.
        if (hasReplay) {
          router.push({
            pathname: '/live/replay/[id]' as any,
            params:   { id: item.session_id },
          });
          return;
        }
        // Fallback: Wenn Battle war, Gegner-Profil öffnen.
        if (item.battle_opponent_id) {
          router.push({
            pathname: '/user/[id]',
            params: { id: item.battle_opponent_id },
          } as any);
        }
      }}
      android_ripple={{ color: colors.border.subtle }}
    >
      {/* Zeile 1 — Titel + Datum + Battle-Chip */}
      <View style={s.rowTop}>
        <Text style={[s.rowTitle, { color: colors.text.primary }]} numberOfLines={1}>
          {item.title?.trim() || 'Live-Stream'}
        </Text>
        {hasReplay && (
          <View style={[s.replayChip, { backgroundColor: colors.accent.primary + '22', borderColor: colors.accent.primary + '55' }]}>
            <Play size={10} color={colors.accent.primary} strokeWidth={2.4} fill={colors.accent.primary} />
            <Text style={[s.replayChipText, { color: colors.accent.primary }]}>REPLAY</Text>
          </View>
        )}
        {item.battle_result && (
          <BattleChip result={item.battle_result} />
        )}
      </View>

      <Text style={[s.rowDate, { color: colors.text.muted }]}>
        {dateLabel} · {dur}
      </Text>

      {/* Zeile 2 — Stats */}
      <View style={s.rowStats}>
        <StatItem
          icon={<Eye size={12} color={colors.text.muted} strokeWidth={2} />}
          value={fmtNum(item.peak_viewers)}
          colors={colors}
        />
        <StatItem
          icon={<Gift size={12} color={colors.text.muted} strokeWidth={2} />}
          value={fmtNum(item.gift_count)}
          colors={colors}
        />
        <StatItem
          icon={<Text style={{ fontSize: 11 }}>💎</Text>}
          value={fmtNum(item.total_gift_diamonds)}
          colors={colors}
        />
        <StatItem
          icon={<MessageCircle size={12} color={colors.text.muted} strokeWidth={2} />}
          value={fmtNum(item.comment_count)}
          colors={colors}
        />
      </View>

      {/* Optional — Battle-Detail mit Gegner */}
      {item.battle_opponent_id && (
        <View style={s.battleRow}>
          {item.battle_opponent_avatar ? (
            <Image
              source={{ uri: item.battle_opponent_avatar }}
              style={s.oppAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[s.oppAvatar, { backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 10 }}>👤</Text>
            </View>
          )}
          <Text style={[s.oppName, { color: colors.text.secondary }]} numberOfLines={1}>
            vs. @{item.battle_opponent_name ?? 'unbekannt'}
          </Text>
          <Text style={[s.oppScore, { color: colors.text.primary }]}>
            {item.battle_host_score ?? 0} : {item.battle_guest_score ?? 0}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Sub-Komponenten ──────────────────────────────────────────────────────────

function SummaryChip({
  icon, label, value, colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={[s.summaryChip, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <View style={s.summaryIcon}>{icon}</View>
      <Text style={[s.summaryValue, { color: colors.text.primary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[s.summaryLabel, { color: colors.text.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatItem({
  icon, value, colors,
}: {
  icon: React.ReactNode;
  value: string;
  colors: any;
}) {
  return (
    <View style={s.statItem}>
      {icon}
      <Text style={[s.statValue, { color: colors.text.secondary }]}>{value}</Text>
    </View>
  );
}

function BattleChip({ result }: { result: BattleResult }) {
  const cfg =
    result === 'win'
      ? { icon: <Trophy size={10} color="#22C55E" strokeWidth={2.5} />, label: 'Sieg',     bg: 'rgba(34,197,94,0.1)',   fg: '#22C55E' }
      : result === 'loss'
      ? { icon: <XIcon  size={10} color="#EF4444" strokeWidth={2.5} />, label: 'Nieder.',  bg: 'rgba(239,68,68,0.1)',   fg: '#EF4444' }
      : { icon: <Minus  size={10} color="#A1A1AA" strokeWidth={2.5} />, label: 'Unent.',   bg: 'rgba(161,161,170,0.15)', fg: '#A1A1AA' };

  return (
    <View style={[s.battleChip, { backgroundColor: cfg.bg }]}>
      {cfg.icon}
      <Text style={[s.battleChipText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Peak-Viewer Chart ────────────────────────────────────────────────────────

function PeakTrendChart({
  rows,
  colors,
}: {
  rows: CreatorLiveSession[];
  colors: any;
}) {
  // Neueste zuletzt (X-Achse zeitlich von links=alt nach rechts=neu)
  const series = useMemo(() => {
    return [...rows].reverse().map((r) => r.peak_viewers ?? 0);
  }, [rows]);

  const width  = W - 40 - 24; // Screen - padding(20*2) - innerer Pad(12*2)
  const height = 90;
  const max    = Math.max(1, ...series);
  const n      = series.length;
  if (n < 2) return null;

  const barWidth = Math.max(3, (width - (n - 1) * 3) / n);

  return (
    <View style={[s.chartCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <Svg width={width} height={height}>
        {/* Baseline */}
        <Line
          x1={0}
          y1={height - 0.5}
          x2={width}
          y2={height - 0.5}
          stroke={colors.border.subtle}
          strokeWidth={1}
        />
        {series.map((v, i) => {
          const h = (v / max) * (height - 8);
          const x = i * (barWidth + 3);
          const y = height - h;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={2}
              fill={colors.text.primary}
              opacity={0.85}
            />
          );
        })}
      </Svg>
      <View style={s.chartFootRow}>
        <Text style={[s.chartFoot, { color: colors.text.muted }]}>älter</Text>
        <Text style={[s.chartFoot, { color: colors.text.muted }]}>Max {fmtNum(max)}</Text>
        <Text style={[s.chartFoot, { color: colors.text.muted }]}>jetzt</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnSpacer: { width: 36, height: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
  },
  headerBadgeText: { fontSize: 13, fontWeight: '700' },

  // Summary
  summaryRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  summaryChip: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 10, gap: 2,
  },
  summaryIcon: { flexDirection: 'row' },
  summaryValue: { fontSize: 15, fontWeight: '900', letterSpacing: -0.4, marginTop: 4 },
  summaryLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2, marginTop: 1 },

  // Chart
  chartWrap: { marginBottom: 20 },
  chartHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  chartTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  chartCard: {
    borderWidth: 1, borderRadius: 14, padding: 12, gap: 8,
  },
  chartFootRow: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  chartFoot: { fontSize: 10, fontWeight: '600' },

  // Section-Label
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Row
  row: { paddingVertical: 14, gap: 6 },
  rowTop: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  rowDate: { fontSize: 11, fontWeight: '500' },
  rowStats: {
    flexDirection: 'row', gap: 16, marginTop: 4,
  },
  rowSep: { height: StyleSheet.hairlineWidth },

  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 12, fontWeight: '600' },

  // Battle-Row
  battleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
  },
  oppAvatar: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden' },
  oppName: { flex: 1, fontSize: 12, fontWeight: '600' },
  oppScore: { fontSize: 12, fontWeight: '800', letterSpacing: -0.2 },

  // Battle-Chip
  battleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
  },
  battleChipText: { fontSize: 10, fontWeight: '800' },

  // Replay-Chip (v1.18.0)
  replayChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  replayChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // Empty
  empty: { alignItems: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptyBody: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
});

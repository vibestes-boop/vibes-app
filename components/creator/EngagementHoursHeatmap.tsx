/**
 * components/creator/EngagementHoursHeatmap.tsx
 *
 * v1.20.0 — Creator-Studio Pro.
 *
 * 7×24 Heatmap der Audience-Aktivität (weekday × hour_of_day).
 * Quelle: get_creator_engagement_hours RPC (likes + comments auf eigene Posts).
 *
 * Reine StyleSheet-Implementierung (kein SVG, kein Chart-Library) — rendert
 * gut auf beiden Plattformen und respektiert Dark/Light Theme.
 *
 * Design:
 *   • Grid-Cell intensiver gefärbt je höher engagement_count
 *   • Zeit-Labels links (Mo/Di/Mi/…), Stunden-Labels unten (0/6/12/18)
 *   • Peak-Cell hervorgehoben + Tap auf Zelle zeigt Tooltip mit Count
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import type { EngagementHourPoint } from '@/lib/useAnalytics';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOUR_LABELS: { hour: number; label: string }[] = [
  { hour: 0,  label: '0' },
  { hour: 6,  label: '6' },
  { hour: 12, label: '12' },
  { hour: 18, label: '18' },
];

interface Props {
  data:     EngagementHourPoint[];
  colors:   any;
  title?:   string;
  subtitle?: string;
}

export function EngagementHoursHeatmap({
  data, colors, title = 'Peak-Aktivität',
  subtitle = 'Wann ist deine Audience wach',
}: Props) {
  const { width: W } = Dimensions.get('window');

  // ── Dense-Grid: 7×24 mit Counts (0 wenn nicht in Rohdaten) ──────────
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const p of data) {
      if (p.weekday >= 0 && p.weekday < 7 && p.hour_of_day >= 0 && p.hour_of_day < 24) {
        g[p.weekday][p.hour_of_day] = p.engagement_count;
      }
    }
    return g;
  }, [data]);

  const max = useMemo(() => {
    let m = 0;
    for (const row of grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [grid]);

  const peak = useMemo(() => {
    if (max === 0) return null;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (grid[d][h] === max) return { weekday: d, hour: h, count: max };
      }
    }
    return null;
  }, [grid, max]);

  const [selected, setSelected] = useState<{ weekday: number; hour: number; count: number } | null>(null);

  // Zellen-Größe: volle Breite - Labels-Links(24) - Margin(32) / 24 Stunden
  const cellSize = Math.max(8, Math.floor((W - 32 - 24) / 24));

  // Farbe nach Intensität (0..1). Basis-Akzent = colors.text.primary.
  // Wir mischen via RGBA auf colors.bg.elevated.
  const cellColor = (count: number) => {
    if (max === 0 || count === 0) return colors.bg.elevated;
    const ratio = Math.sqrt(count / max); // sqrt → mittlere Werte sichtbarer
    const alpha = 0.15 + ratio * 0.75;     // 0.15..0.9
    // Accent ist im Dark-Mode weiß, im Light-Mode schwarz — wir brauchen RGB
    const isLight = colors.bg.primary === '#FFFFFF' || colors.bg.primary === '#fff';
    return isLight
      ? `rgba(0, 0, 0, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`;
  };

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.text.muted }]}>{subtitle}</Text>
        </View>
        {peak && (
          <View style={[styles.peakPill, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <Text style={[styles.peakText, { color: colors.text.primary }]}>
              Peak: {WEEKDAYS[peak.weekday]} {String(peak.hour).padStart(2, '0')}:00
            </Text>
          </View>
        )}
      </View>

      {/* Grid */}
      <View style={styles.gridWrap}>
        {/* Weekday labels column */}
        <View style={{ width: 20, marginRight: 4, gap: 2 }}>
          {WEEKDAYS.map((w, d) => (
            <View key={w} style={{ height: cellSize, justifyContent: 'center' }}>
              <Text style={[styles.axisLabel, { color: colors.text.muted }]}>{w}</Text>
            </View>
          ))}
        </View>

        {/* 7×24 cells */}
        <View style={{ gap: 2, flex: 1 }}>
          {grid.map((row, d) => (
            <View key={d} style={{ flexDirection: 'row', gap: 2 }}>
              {row.map((count, h) => {
                const isSel = selected?.weekday === d && selected?.hour === h;
                const isPeak = peak?.weekday === d && peak?.hour === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => setSelected(count > 0 ? { weekday: d, hour: h, count } : null)}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: cellColor(count),
                      borderRadius: 3,
                      borderWidth: isPeak || isSel ? 1 : 0,
                      borderColor: isSel ? colors.accent.primary : colors.text.primary,
                    }}
                    accessibilityLabel={`${WEEKDAYS[d]} ${h}:00, ${count} Interaktionen`}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Hour labels bottom */}
      <View style={[styles.hourLabelsRow, { paddingLeft: 24 }]}>
        {HOUR_LABELS.map(({ hour, label }) => {
          const pct = (hour / 24) * 100;
          return (
            <Text
              key={hour}
              style={[
                styles.axisLabel,
                styles.hourLabel,
                { color: colors.text.muted, left: `${pct}%` },
              ]}
            >
              {label}
            </Text>
          );
        })}
      </View>

      {/* Tooltip (selected cell) */}
      {selected && (
        <View style={[styles.tooltip, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <Text style={[styles.tooltipText, { color: colors.text.primary }]}>
            {WEEKDAYS[selected.weekday]} {String(selected.hour).padStart(2, '0')}:00
          </Text>
          <Text style={[styles.tooltipCount, { color: colors.text.muted }]}>
            {selected.count} Interaktionen
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legendRow}>
        <Text style={[styles.axisLabel, { color: colors.text.muted }]}>Wenig</Text>
        <View style={styles.legendBar}>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((a) => {
            const isLight = colors.bg.primary === '#FFFFFF' || colors.bg.primary === '#fff';
            const bg = isLight ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
            return <View key={a} style={[styles.legendCell, { backgroundColor: bg }]} />;
          })}
        </View>
        <Text style={[styles.axisLabel, { color: colors.text.muted }]}>Viel</Text>
      </View>
    </View>
  );
}

// ─── Empty-State Variante ───────────────────────────────────────────────────
export function EngagementHoursHeatmapEmpty({ colors }: { colors: any }) {
  return (
    <View style={[styles.emptyRoot, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Peak-Aktivität</Text>
      <Text style={[styles.subtitle, { color: colors.text.muted, marginTop: 4 }]}>
        Sobald deine Posts Likes/Kommentare bekommen, siehst du hier wann deine Audience am aktivsten ist.
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {},
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  title:    { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
  peakPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  peakText: { fontSize: 11, fontWeight: '600' },

  gridWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  axisLabel: { fontSize: 10, fontWeight: '500' },

  hourLabelsRow: { position: 'relative', height: 14, marginTop: 4 },
  hourLabel: { position: 'absolute', top: 0 },

  tooltip: {
    marginTop: 10, padding: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  tooltipText:  { fontSize: 13, fontWeight: '600' },
  tooltipCount: { fontSize: 11, marginTop: 2 },

  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'center',
  },
  legendBar:  { flexDirection: 'row', gap: 2 },
  legendCell: { width: 16, height: 8, borderRadius: 2 },

  emptyRoot: {
    padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    minHeight: 80, justifyContent: 'center',
  },
});

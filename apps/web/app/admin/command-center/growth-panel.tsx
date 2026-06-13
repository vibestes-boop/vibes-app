'use client';

import { useMemo, useState } from 'react';
import type {
  CommandCenterArea,
  CommandGrowthPoint,
  CommandGrowthRange,
  CommandGrowthSeries,
} from '@/app/actions/admin';

const RANGE_OPTIONS: Array<{ value: CommandGrowthRange; label: string }> = [
  { value: '7d', label: 'Letzte 7 Tage' },
  { value: '30d', label: 'Letzte 30 Tage' },
  { value: '90d', label: 'Letzte 90 Tage' },
];

const CHART = {
  width: 360,
  height: 132,
  left: 32,
  right: 32,
  top: 22,
  bottom: 32,
};

export function GrowthPanel({
  area,
  series,
  defaultRange = '7d',
}: {
  area?: CommandCenterArea;
  series: CommandGrowthSeries;
  defaultRange?: CommandGrowthRange;
}) {
  const [range, setRange] = useState<CommandGrowthRange>(defaultRange);
  const points = useMemo(() => series[range] ?? [], [series, range]);
  const detail = area?.detail ?? {};
  const activeCreators = toNumber(detail.active_creators_7d);
  const northStar = toNumber(detail.north_star);
  const registrationMax = roundedMax(Math.max(1, ...points.map((point) => point.new_registrations)));
  const activeMax = roundedMax(Math.max(1, ...points.map((point) => point.active_users)));
  const bars = barRects(points.map((point) => point.new_registrations), registrationMax);
  const activePoints = chartCoordinates(points.map((point) => point.active_users), activeMax);
  const activePath = smoothPath(activePoints);
  const axisTicks = useMemo(() => buildAxisTicks(points, range), [points, range]);
  const baseline = CHART.top + plotHeight();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Neue Registrierungen
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Aktive Nutzer
          </span>
        </div>
        <select
          value={range}
          onChange={(event) => setRange(event.target.value as CommandGrowthRange)}
          className="h-7 rounded-md border border-border bg-card px-2 text-[10px] font-semibold text-foreground/80 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-ring/20"
          aria-label="Zeitraum fuer Nutzerwachstum"
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative h-36 overflow-hidden rounded-lg border border-border/60 bg-muted/40">
        {points.length > 0 ? (
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <clipPath id="growth-plot-clip">
                <rect
                  x={CHART.left}
                  y={CHART.top}
                  width={CHART.width - CHART.left - CHART.right}
                  height={plotHeight()}
                />
              </clipPath>
              <linearGradient id="growth-green" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="growth-bar-blue" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.65" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((ratio) => {
              const y = CHART.top + ratio * plotHeight();
              const leftLabel = Math.round(registrationMax * (1 - ratio));
              const rightLabel = Math.round(activeMax * (1 - ratio));
              return (
                <g key={ratio}>
                  <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} stroke="#dbe4ef" strokeWidth="1" />
                  <text x={CHART.left - 8} y={y + 3} fill="#2563eb" fontSize="9" fontWeight="600" textAnchor="end">
                    {formatCompactNumber(leftLabel)}
                  </text>
                  <text x={CHART.width - CHART.right + 8} y={y + 3} fill="#64748b" fontSize="9" fontWeight="600">
                    {formatCompactNumber(rightLabel)}
                  </text>
                </g>
              );
            })}
            <line x1={CHART.left} x2={CHART.width - CHART.right} y1={baseline} y2={baseline} stroke="#94a3b8" strokeOpacity="0.45" strokeWidth="1.2" />
            <g clipPath="url(#growth-plot-clip)">
              <path d={areaPath(activePoints)} fill="url(#growth-green)" />
              {bars.map((bar, index) => (
                <rect
                  key={`registration-bar-${index}`}
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  rx="1.5"
                  fill="url(#growth-bar-blue)"
                />
              ))}
              <path d={activePath} fill="none" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              {visibleDots(activePoints).map(([x, y], index) => (
                <circle key={`active-${index}`} cx={x} cy={y} r="2.4" fill="#10b981" stroke="#f8fafc" strokeWidth="1.4" />
              ))}
            </g>
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-muted-foreground/70">
            Zeitreihe noch nicht verfuegbar
          </div>
        )}
        <div className="absolute inset-x-0 bottom-2 h-3 text-[10px] font-medium text-muted-foreground/70">
          {axisTicks.map((tick) => (
            <span
              key={`${tick.label}-${tick.x}`}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${tick.x}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-muted/50 px-2 py-1">
          <div className="text-muted-foreground">Creator 7d</div>
          <div className="font-bold tabular-nums text-foreground">{formatCompactNumber(activeCreators)}</div>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1">
          <div className="text-muted-foreground">North Star</div>
          <div className="font-bold tabular-nums text-foreground">{formatCompactNumber(northStar)}</div>
        </div>
      </div>
    </div>
  );
}

function buildAxisTicks(
  points: CommandGrowthPoint[],
  range: CommandGrowthRange,
): Array<{ label: string; x: number }> {
  if (points.length === 0) return [{ label: 'Start', x: 0 }, { label: 'Heute', x: 100 }];
  const indexes =
    range === '7d'
      ? points.map((_, index) => index)
      : range === '30d'
        ? pickTickIndexes(points.length, 5)
        : pickMonthTickIndexes(points);
  const lastIndex = Math.max(1, points.length - 1);
  return indexes.map((index) => ({
    label: points[index]?.label ?? '',
    x: 7 + (index / lastIndex) * 86,
  }));
}

function pickTickIndexes(length: number, desired: number): number[] {
  if (length <= desired) return Array.from({ length }, (_, index) => index);
  const lastIndex = length - 1;
  return Array.from({ length: desired }, (_, index) => Math.round((index / (desired - 1)) * lastIndex));
}

function pickMonthTickIndexes(points: CommandGrowthPoint[]): number[] {
  const indexes = new Set<number>([0, points.length - 1]);
  for (let index = 1; index < points.length; index += 1) {
    const previousMonth = points[index - 1]?.date.slice(5, 7);
    const month = points[index]?.date.slice(5, 7);
    if (month && month !== previousMonth) indexes.add(index);
  }
  if (indexes.size < 4) {
    for (const index of pickTickIndexes(points.length, 4)) indexes.add(index);
  }
  return [...indexes].sort((a, b) => a - b);
}

function chartCoordinates(values: number[], maxValue: number): Array<[number, number]> {
  if (values.length === 0) return [];
  const width = CHART.width - CHART.left - CHART.right;
  const height = plotHeight();
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  return values.map((value, index) => {
    const x = CHART.left + index * step;
    const rawY = CHART.top + height - (Math.max(0, value) / maxValue) * height;
    const y = clamp(rawY, CHART.top, CHART.top + height);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
}

function barRects(values: number[], maxValue: number): Array<{ x: number; y: number; width: number; height: number }> {
  if (values.length === 0) return [];
  const width = CHART.width - CHART.left - CHART.right;
  const height = plotHeight();
  const step = values.length === 1 ? width : width / values.length;
  const barWidth = Math.max(2, Math.min(7, step * 0.42));
  const baseline = CHART.top + height;
  return values.map((value, index) => {
    const barHeight = clamp((Math.max(0, value) / maxValue) * height, 0, height);
    const x = CHART.left + index * step + (step - barWidth) / 2;
    return {
      x: Number(x.toFixed(2)),
      y: Number((baseline - barHeight).toFixed(2)),
      width: Number(barWidth.toFixed(2)),
      height: Number(Math.max(0, barHeight).toFixed(2)),
    };
  });
}

function smoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  const commands = [`M ${points[0][0]} ${points[0][1]}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] ?? current;
    const afterNext = points[index + 2] ?? next;
    const smoothing = 0.16;
    const cp1: [number, number] = [
      current[0] + (next[0] - previous[0]) * smoothing,
      current[1] + (next[1] - previous[1]) * smoothing,
    ];
    const cp2: [number, number] = [
      next[0] - (afterNext[0] - current[0]) * smoothing,
      next[1] - (afterNext[1] - current[1]) * smoothing,
    ];
    commands.push(`C ${cp1[0].toFixed(2)} ${cp1[1].toFixed(2)}, ${cp2[0].toFixed(2)} ${cp2[1].toFixed(2)}, ${next[0]} ${next[1]}`);
  }
  return commands.join(' ');
}

function areaPath(points: Array<[number, number]>): string {
  if (points.length < 2) return '';
  const baseline = CHART.top + plotHeight();
  return `${smoothPath(points)} L ${points[points.length - 1][0]} ${baseline} L ${points[0][0]} ${baseline} Z`;
}

function visibleDots(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length <= 30) return points;
  const lastIndex = points.length - 1;
  return points.filter((_, index) => index === 0 || index === lastIndex || index % 10 === 0);
}

function roundedMax(value: number): number {
  if (value <= 2) return 2;
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function plotHeight(): number {
  return CHART.height - CHART.top - CHART.bottom;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

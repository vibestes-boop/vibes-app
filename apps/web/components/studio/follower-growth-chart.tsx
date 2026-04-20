import type { FollowerGrowthPoint } from '@/lib/data/studio';

// -----------------------------------------------------------------------------
// FollowerGrowthChart — Pure SVG/CSS Line+Bar-Chart.
//
// Ansatz: Area-Chart mit gefülltem Polygon + dünner Top-Linie + Tooltip-Hover
// via CSS-Group (title-Attribut auf jedem Bar). Kein Chart-Lib — hält das
// Bundle leicht und ist für einen simplen Sparkline-artigen Chart völlig ok.
//
// Skalierung: y = max(points.newFollowers); x = index/count. Edge-Case: nur
// ein Datenpunkt → wir zeichnen einen zentrierten Punkt statt Polygon.
// -----------------------------------------------------------------------------

interface Props {
  points: FollowerGrowthPoint[];
}

const W = 800;
const H = 160;
const PADDING_X = 8;
const PADDING_Y = 12;

export function FollowerGrowthChart({ points }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-muted/40 text-sm text-muted-foreground">
        Keine Follower-Daten im Zeitraum.
      </div>
    );
  }

  const maxY = Math.max(1, ...points.map((p) => p.newFollowers));
  const innerW = W - 2 * PADDING_X;
  const innerH = H - 2 * PADDING_Y;

  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const xyPoints = points.map((p, i) => {
    const x = PADDING_X + i * step;
    const y = PADDING_Y + innerH - (p.newFollowers / maxY) * innerH;
    return { x, y, value: p.newFollowers, day: p.day };
  });

  // Polygon für Area-Fill: Line-Points + unten-rechts + unten-links
  const polyPoints = [
    ...xyPoints.map((p) => `${p.x},${p.y}`),
    `${xyPoints[xyPoints.length - 1]?.x ?? PADDING_X},${H - PADDING_Y}`,
    `${xyPoints[0]?.x ?? PADDING_X},${H - PADDING_Y}`,
  ].join(' ');

  const linePoints = xyPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Labels: erster und letzter Tag + mittlerer
  const labels: Array<{ x: number; text: string }> = [];
  if (points.length >= 1) {
    labels.push({ x: PADDING_X, text: shortDay(points[0].day) });
  }
  if (points.length >= 3) {
    const mid = Math.floor(points.length / 2);
    labels.push({ x: PADDING_X + mid * step, text: shortDay(points[mid].day) });
  }
  if (points.length >= 2) {
    labels.push({ x: PADDING_X + (points.length - 1) * step, text: shortDay(points[points.length - 1].day) });
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-48 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Follower-Wachstum im Zeitraum"
      >
        <defs>
          <linearGradient id="fg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid-Lines horizontal */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PADDING_X}
            x2={W - PADDING_X}
            y1={PADDING_Y + innerH * f}
            y2={PADDING_Y + innerH * f}
            className="stroke-muted"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}

        {/* Area-Fill */}
        <polygon points={polyPoints} fill="url(#fg-fill)" className="text-primary" />

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data-Points mit Tooltip */}
        {xyPoints.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={3}
              className="fill-primary"
            />
            <title>
              {p.day}: +{p.value} Follower
            </title>
          </g>
        ))}

        {/* X-Axis Labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - 2}
            textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
            className="fill-muted-foreground text-[9px]"
          >
            {l.text}
          </text>
        ))}

        {/* Max-Label oben rechts */}
        <text
          x={W - PADDING_X}
          y={PADDING_Y + 8}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          max {maxY.toLocaleString('de-DE')}
        </text>
      </svg>
    </div>
  );
}

function shortDay(iso: string): string {
  // Input: "2026-04-15" oder ISO → nur Tag/Monat
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${mon}`;
}

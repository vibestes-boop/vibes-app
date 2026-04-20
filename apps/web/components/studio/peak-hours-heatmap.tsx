import type { PeakHoursCell } from '@/lib/data/studio';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// PeakHoursHeatmap — 7×24 Grid mit Engagement-Intensitäten.
//
// Native-Parität: `weekday` 0=Mo..6=So (ISO-konvention, nicht JS-0=Sonntag).
// Hour ist 0..23 in UTC (kein Timezone-Shift weil Native ebenfalls UTC lieft).
//
// Farbgebung: 6 Stufen von `bg-muted` bis `bg-primary` via Tailwind-Opacity.
// Pure CSS Grid, keine JS-abhängigen Tooltips außer `title` fürs Hover.
// -----------------------------------------------------------------------------

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface Props {
  cells: PeakHoursCell[];
}

export function PeakHoursHeatmap({ cells }: Props) {
  // Normalisieren: 7×24 Matrix mit 0-Default
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const c of cells) {
    if (c.weekday >= 0 && c.weekday < 7 && c.hour >= 0 && c.hour < 24) {
      matrix[c.weekday][c.hour] = c.engagement;
    }
  }

  const maxVal = Math.max(1, ...cells.map((c) => c.engagement));

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour-Labels oben */}
          <div className="ml-10 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className={cn(
                  'text-center text-[9px] tabular-nums text-muted-foreground',
                  h % 3 !== 0 && 'opacity-0',
                )}
              >
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Rows */}
          {matrix.map((row, wd) => (
            <div key={wd} className="mt-1 flex items-center gap-1">
              <div className="w-9 shrink-0 text-right text-[10px] font-medium text-muted-foreground">
                {WEEKDAY_LABELS[wd]}
              </div>
              <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5">
                {row.map((val, hr) => {
                  const intensity = val / maxVal;
                  return (
                    <div
                      key={hr}
                      className={cn(
                        'aspect-square rounded-sm transition-transform hover:scale-110 hover:ring-2 hover:ring-primary',
                        cellClassFor(intensity),
                      )}
                      title={`${WEEKDAY_LABELS[wd]} ${String(hr).padStart(2, '0')}:00 UTC — ${val.toLocaleString('de-DE')} Interaktionen`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
        <span>weniger</span>
        <div className="flex items-center gap-0.5">
          <div className="h-3 w-3 rounded-sm bg-muted" />
          <div className="h-3 w-3 rounded-sm bg-primary/20" />
          <div className="h-3 w-3 rounded-sm bg-primary/40" />
          <div className="h-3 w-3 rounded-sm bg-primary/60" />
          <div className="h-3 w-3 rounded-sm bg-primary/80" />
          <div className="h-3 w-3 rounded-sm bg-primary" />
        </div>
        <span>mehr</span>
      </div>
    </div>
  );
}

function cellClassFor(intensity: number): string {
  if (intensity === 0) return 'bg-muted';
  if (intensity <= 0.2) return 'bg-primary/20';
  if (intensity <= 0.4) return 'bg-primary/40';
  if (intensity <= 0.6) return 'bg-primary/60';
  if (intensity <= 0.8) return 'bg-primary/80';
  return 'bg-primary';
}

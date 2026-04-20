import Link from 'next/link';
import type { Route } from 'next';
import type { ScheduledPostRow } from '@/lib/data/posts';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// ScheduledCalendar — Monats-Raster mit Post-Dots pro Tageszelle.
//
// Layout-Strategie:
// - Montags-basiertes 7-Spalten-Raster (ISO-Wochen-Konvention, wie Native).
// - Padding mit Zellen vom Vor-/Folge-Monat, damit das Grid sauber endet.
// - Jede Zelle zeigt: Tageszahl, bis zu 3 Posts als kompakte Chips mit Status-
//   Dot, „N+ weitere" als Link zur Listen-Ansicht wenn mehr vorhanden.
// - Heute wird mit primary-Ring markiert.
// -----------------------------------------------------------------------------

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface Props {
  monthStart: Date;
  monthEnd: Date;
  posts: ScheduledPostRow[];
}

export function ScheduledCalendar({ monthStart, monthEnd, posts }: Props) {
  const cells = buildCells(monthStart, monthEnd);
  const todayKey = toDateKey(new Date());

  // Posts-Index nach YYYY-MM-DD-Key
  const byDay = new Map<string, ScheduledPostRow[]>();
  for (const p of posts) {
    const key = toDateKey(new Date(p.publish_at));
    const arr = byDay.get(key) ?? [];
    arr.push(p);
    byDay.set(key, arr);
  }
  // pro Tag chronologisch sortieren (ASC)
  for (const arr of byDay.values()) {
    arr.sort((a, b) => new Date(a.publish_at).getTime() - new Date(b.publish_at).getTime());
  }

  return (
    <div className="w-full">
      {/* Weekday-Header */}
      <div className="grid grid-cols-7 gap-px rounded-lg bg-border">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="bg-muted/60 px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day-Cells */}
      <div className="grid grid-cols-7 gap-px rounded-lg bg-border">
        {cells.map((cell, i) => {
          const key = toDateKey(cell.date);
          const dayPosts = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isCurrentMonth = cell.inMonth;

          return (
            <div
              key={i}
              className={cn(
                'flex min-h-[84px] flex-col gap-0.5 bg-background p-1.5 sm:min-h-[100px]',
                !isCurrentMonth && 'bg-muted/30',
              )}
            >
              <div
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                  isToday
                    ? 'bg-primary text-primary-foreground'
                    : isCurrentMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {cell.date.getDate()}
              </div>

              {dayPosts.slice(0, 3).map((p) => (
                <PostChip key={p.id} post={p} />
              ))}
              {dayPosts.length > 3 && (
                <Link
                  href={'/create/scheduled' as Route}
                  className="truncate rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground hover:bg-muted/80"
                >
                  + {dayPosts.length - 3} weitere
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PostChip({ post }: { post: ScheduledPostRow }) {
  const time = new Date(post.publish_at).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dot = {
    pending: 'bg-sky-500',
    publishing: 'bg-amber-500',
    published: 'bg-emerald-500',
    failed: 'bg-red-500',
    cancelled: 'bg-muted-foreground/50',
  }[post.status];

  const caption = post.caption?.trim() || 'Ohne Caption';

  const href: Route =
    post.status === 'published' && post.published_post_id
      ? (`/p/${post.published_post_id}` as Route)
      : ('/create/scheduled' as Route);

  return (
    <Link
      href={href}
      title={`${time} — ${caption}`}
      className={cn(
        'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] transition-colors hover:bg-muted',
        post.status === 'failed' && 'bg-red-500/10 text-red-700 dark:text-red-400',
        post.status === 'published' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      <span className="shrink-0 tabular-nums">{time}</span>
      <span className="truncate">{caption}</span>
    </Link>
  );
}

function buildCells(
  monthStart: Date,
  monthEnd: Date,
): Array<{ date: Date; inMonth: boolean }> {
  const cells: Array<{ date: Date; inMonth: boolean }> = [];

  // Wochen-Offset zur Mo-Kalender-Start:
  // JS getDay(): 0=So, 1=Mo, ... 6=Sa. ISO Mo=0, So=6.
  const firstJsDay = monthStart.getDay();
  const isoWeekdayMonStart = (firstJsDay + 6) % 7; // 0=Mo
  // Wenn Monatsanfang ein Mi ist (isoWeekday=2), 2 Zellen davor Mo/Di einfügen
  for (let i = isoWeekdayMonStart; i > 0; i--) {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - i);
    cells.push({ date: d, inMonth: false });
  }

  // Monat selbst
  for (let day = 1; day <= monthEnd.getDate(); day++) {
    cells.push({
      date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day),
      inMonth: true,
    });
  }

  // Folgemonat bis Raster mit 42 (6×7) Zellen füllt — oder 35 (5×7) wenn
  // Monat komplett drin ist.
  const target = cells.length > 35 ? 42 : 35;
  let nextDay = 1;
  while (cells.length < target) {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, nextDay);
    cells.push({ date: d, inMonth: false });
    nextDay++;
  }

  return cells;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Clock, Plus, List, CalendarDays } from 'lucide-react';
import { getMyScheduledPosts } from '@/lib/data/posts';
import { ScheduledCalendar } from '@/components/studio/scheduled-calendar';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// /studio/scheduled — Kalender-Ansicht der geplanten Posts.
//
// Strategie:
// - Monats-Kalender mit ~30-35 Zellen (6 Wochen × 7 Tage), sticky Day-Header.
// - `?month=YYYY-MM` Query-Param für Navigation. Default: aktueller Monat.
// - Jede Kalender-Zelle zeigt die ersten 3 Posts mit Titel + Status-Dot,
//   „N+ weitere" als Link wenn mehr da sind. Click auf einen Post → öffnet
//   das Post-Detail (Original-URL `/p/...` wenn published, sonst `/create`
//   für Drafts wenn ich in dem Schema so etwas hätte).
// - Zweites Panel: Chronologische Fallback-Liste für Accessibility + Mobile
//   (Kalender wird mobile zu einer List-Section geswitched).
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Geplante Posts',
  description: 'Kalender-Ansicht deiner geplanten Veröffentlichungen.',
};

export const dynamic = 'force-dynamic';

export default async function StudioScheduledPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const anchor = parseAnchor(sp.month);

  const rows = await getMyScheduledPosts();

  // Posts in den aktuellen Monat filtern (plus ±1 Woche damit im Overflow die
  // Nachbar-Zellen gefüllt sind)
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  const prevMonth = new Date(monthStart);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Geplante Posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length === 0
              ? 'Nichts geplant — nutze den Button „Planen" im Create-Flow.'
              : `${rows.length} geplant${rows.length === 1 ? '' : 'e Posts'}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={'/create/scheduled' as Route}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <List className="h-3.5 w-3.5" />
            Listen-Ansicht
          </Link>
          <Link
            href={'/create' as Route}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Planen
          </Link>
        </div>
      </header>

      {/* Monats-Navigation */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-3">
        <Link
          href={`/studio/scheduled?month=${toMonthParam(prevMonth)}` as Route}
          className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
        >
          ← {prevMonth.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
        </Link>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">
            {monthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </h2>
        </div>
        <Link
          href={`/studio/scheduled?month=${toMonthParam(nextMonth)}` as Route}
          className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
        >
          {nextMonth.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })} →
        </Link>
      </div>

      {/* Calendar */}
      <section className="rounded-xl border bg-card p-2 sm:p-4">
        <ScheduledCalendar monthStart={monthStart} monthEnd={monthEnd} posts={rows} />
      </section>

      {/* Status-Legend */}
      <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Legende:</span>
        <StatusDot status="pending" label="Geplant" />
        <StatusDot status="publishing" label="Wird gepostet" />
        <StatusDot status="published" label="Live" />
        <StatusDot status="failed" label="Fehler" />
        <StatusDot status="cancelled" label="Abgebrochen" />
      </section>

      {/* Empty-Hint */}
      {rows.length === 0 && (
        <EmptyState
          icon={<Clock className="h-7 w-7" strokeWidth={1.75} />}
          title="Kein Post geplant"
          description={'Im Create-Flow kannst du mit „Planen" einen Veröffentlichungs-Zeitpunkt wählen. Der Post wird automatisch zu dieser Zeit live geschaltet.'}
          size="sm"
          bordered
          cta={
            <Link
              href={'/create' as Route}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Post erstellen + planen
            </Link>
          }
        />
      )}
    </div>
  );
}

function StatusDot({
  status,
  label,
}: {
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'cancelled';
  label: string;
}) {
  const bg = {
    pending: 'bg-sky-500',
    publishing: 'bg-amber-500',
    published: 'bg-emerald-500',
    failed: 'bg-red-500',
    cancelled: 'bg-muted-foreground/50',
  }[status];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', bg)} />
      {label}
    </span>
  );
}

function parseAnchor(monthParam: string | undefined): Date {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number);
    // Clamp monat 1-12
    if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
      return new Date(y, m - 1, 1);
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toMonthParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

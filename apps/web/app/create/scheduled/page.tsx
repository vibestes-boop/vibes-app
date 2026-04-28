import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { Clock, ArrowLeft, AlertCircle, CheckCircle2, Video, ImageIcon, Ban } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import { getMyScheduledPosts, type ScheduledStatus } from '@/lib/data/posts';
import { ScheduledRowActions } from '@/components/create/scheduled-row-actions';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// /create/scheduled — Liste geplanter Posts. Sortiert nach publish_at ASC,
// mit Status-Badge (pending/publishing/published/failed/cancelled). Nur
// `pending` ist vom User umplanbar/abbrechbar — alle anderen sind Read-Only.
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export default async function ScheduledPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/create/scheduled');

  const rows = await getMyScheduledPosts();

  // Aktiv = pending + failed (braucht User-Aufmerksamkeit); Archiv-Abschnitt
  // enthält published + cancelled.
  const active = rows.filter((r) => r.status === 'pending' || r.status === 'failed' || r.status === 'publishing');
  const archive = rows.filter((r) => r.status === 'published' || r.status === 'cancelled');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 lg:px-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href={'/create' as Route}
          className="grid h-9 w-9 place-items-center rounded-full border hover:bg-muted"
          aria-label="Zurück"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Geplante Posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length === 0
              ? 'Nichts geplant.'
              : `${active.length} aktiv, ${archive.length} im Archiv.`}
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-8 w-8" strokeWidth={1.75} />}
          title="Nichts geplant"
          description={'Plane einen Post über den „Planen"-Button in /create. Er veröffentlicht sich automatisch zur angegebenen Zeit.'}
          size="md"
          cta={
            <Link
              href={'/create' as Route}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Post planen
            </Link>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Aktiv</h2>
              <ul className="flex flex-col gap-2">
                {active.map((r) => (
                  <ScheduledRow key={r.id} row={r} />
                ))}
              </ul>
            </section>
          )}

          {archive.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Archiv</h2>
              <ul className="flex flex-col gap-2">
                {archive.map((r) => (
                  <ScheduledRow key={r.id} row={r} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ScheduledRow({
  row,
}: {
  row: Awaited<ReturnType<typeof getMyScheduledPosts>>[number];
}) {
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  const mutable = row.status === 'pending' || row.status === 'failed';

  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="relative h-16 w-16 flex-none overflow-hidden rounded-lg bg-muted">
        {row.thumbnail_url ? (
          <Image src={row.thumbnail_url} alt="" fill className="object-cover" sizes="64px" />
        ) : row.media_url && row.media_type === 'image' ? (
          <Image src={row.media_url} alt="" fill className="object-cover" sizes="64px" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            {row.media_type === 'video' ? <Video className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              meta.className,
            )}
          >
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
          <span className="truncate text-xs tabular-nums text-muted-foreground">
            {formatDE(row.publish_at)}
          </span>
        </div>
        <div className="mt-1 truncate text-sm">
          {row.caption?.trim() || <span className="italic text-muted-foreground">Ohne Caption</span>}
        </div>
        {row.status === 'failed' && row.last_error && (
          <div className="mt-1 truncate text-xs text-red-500" title={row.last_error}>
            Fehler: {row.last_error.slice(0, 80)}
          </div>
        )}
      </div>

      {mutable && <ScheduledRowActions scheduledId={row.id} currentPublishAt={row.publish_at} />}
      {row.status === 'published' && row.published_post_id && (
        <Link
          href={`/p/${row.published_post_id}` as Route}
          className="inline-flex h-9 items-center rounded-full border px-3 text-xs hover:bg-muted"
        >
          Ansehen
        </Link>
      )}
    </li>
  );
}

const STATUS_META: Record<
  ScheduledStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: 'Geplant',
    icon: Clock,
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  publishing: {
    label: 'Wird gepostet…',
    icon: Clock,
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  published: {
    label: 'Live',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  failed: {
    label: 'Fehler',
    icon: AlertCircle,
    className: 'bg-red-500/10 text-red-700 dark:text-red-400',
  },
  cancelled: {
    label: 'Abgebrochen',
    icon: Ban,
    className: 'bg-muted text-muted-foreground',
  },
};

function formatDE(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${mon}.${y} · ${h}:${mi}`;
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type {
  CommandCenterArea,
  CommandActivityItem,
  CommandQueueItem,
} from '@/app/actions/admin';

// Geteilte, self-contained Admin-Bausteine für die Command-Center-Unterseiten
// (Analytics, Sicherheit, Inhalte, Live Feed). Gleiche Design-Tokens wie das
// Dashboard, aber ohne die dichten internen Helfer der page.tsx.

export function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex h-full flex-col rounded-lg border border-border bg-card p-3 shadow-sm', className)}>
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="truncate text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</div>
      {sub ? <div className="mt-1 truncate text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border px-3 text-center text-[11px] text-muted-foreground">
      {label}
    </div>
  );
}

const STATUS_STYLES: Record<'green' | 'yellow' | 'red', { dot: string; text: string; label: string }> = {
  green: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'OK' },
  yellow: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Warnung' },
  red: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Kritisch' },
};

export function OverallStatusBadge({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const s = STATUS_STYLES[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold">
      <span className={cn('h-2 w-2 rounded-full', s.dot)} />
      <span className={s.text}>{s.label}</span>
    </span>
  );
}

export function AreaCard({ area }: { area: CommandCenterArea }) {
  const s = STATUS_STYLES[area.status];
  const entries = Object.entries(area.detail ?? {}).slice(0, 6);
  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', s.dot)} />
          <h2 className="truncate text-xs font-bold text-foreground">{area.label}</h2>
        </div>
        <span className={cn('shrink-0 text-[10px] font-semibold', s.text)}>{s.label}</span>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">{area.summary}</p>
      {entries.length > 0 ? (
        <div className="mt-auto divide-y divide-border/60">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 py-1 text-[11px]">
              <span className="min-w-0 truncate text-muted-foreground">{humanizeKey(k)}</span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatDetailValue(v)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ActivityList({ items }: { items: CommandActivityItem[] }) {
  if (items.length === 0) return <EmptyState label="Keine aktuellen Aktivitäten verfügbar." />;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[2.6rem_1fr] items-start gap-2 text-[11px]">
          <div className="text-[10px] tabular-nums text-muted-foreground">{formatTime(item.created_at)}</div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{item.label}</div>
            <div className="truncate text-[10px] text-muted-foreground">{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QueueList({ rows }: { rows: CommandQueueItem[] }) {
  if (rows.length === 0) return <EmptyState label="Keine offenen Reports in der Warteschlange." />;
  const toneFor = (p: CommandQueueItem['priority']) =>
    p === 'Hoch' ? 'text-red-600 dark:text-red-400' : p === 'Mittel' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[380px] border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground">
            <th className="pb-1.5 font-semibold">Inhalt</th>
            <th className="pb-1.5 font-semibold">Grund</th>
            <th className="pb-1.5 font-semibold">Priorität</th>
            <th className="pb-1.5 font-semibold">Wartezeit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/60 last:border-0">
              <td className="py-1 pr-2 text-foreground/80">{normalizeTargetType(row.target_type)} {shortId(row.target_id)}</td>
              <td className="py-1 pr-2 text-foreground/80">{row.reason}</td>
              <td className={cn('py-1 pr-2 font-semibold', toneFor(row.priority))}>{row.priority}</td>
              <td className="py-1 pr-2 text-foreground/80">{row.wait_label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDetailValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return new Intl.NumberFormat('de-DE').format(v);
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (Array.isArray(v)) return `${v.length} Einträge`;
  if (typeof v === 'object') return '…';
  return String(v);
}

function shortId(id: string): string {
  return id ? `#${id.slice(0, 6)}` : '';
}

function normalizeTargetType(value: string | null | undefined): string {
  switch (value) {
    case 'post': return 'Post';
    case 'profile': return 'Profil';
    case 'comment': return 'Kommentar';
    case 'live': return 'Live';
    case 'product': return 'Produkt';
    default: return value ?? 'Inhalt';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  Flag,
  Megaphone,
  MessageSquare,
  Rocket,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  getAdminCommandCenterSnapshot,
  getAdminRoleStatus,
  type AdminRoleStatus,
  type CommandActivityItem,
  type CommandCampaignSnapshot,
  type CommandCenterArea,
  type CommandMetric,
  type CommandQueueItem,
  type CommandReportCategory,
  type CommandRegionSnapshot,
  type CommandSupportInbox,
  type CommandSystemRow,
} from '@/app/actions/admin';
import { GrowthPanel } from '@/app/admin/command-center/growth-panel';
import { TopContentPanel } from '@/app/admin/command-center/top-content-panel';
import { WORLD_COUNTRY_PATHS } from '@/lib/geo/world-country-paths';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin - Command Center',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users,
  registrations: Users,
  posts: Sparkles,
  north_star: BarChart3,
};

const ACTIVITY_ICONS: Record<CommandActivityItem['kind'], React.ComponentType<{ className?: string }>> = {
  post: Sparkles,
  comment: MessageSquare,
  report: Flag,
};

type QuickAction = {
  label: string;
  href: Route;
  icon: React.ComponentType<{ className?: string }>;
  role: 'admin' | 'moderate' | 'operate' | 'creator_ops';
  disabled?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Inhalte prüfen', href: '/admin/reports' as Route, icon: Search, role: 'moderate' },
  { label: 'Creator aktivieren', href: '/admin/activation' as Route, icon: Rocket, role: 'operate' },
  { label: 'Nutzer suchen', href: '/admin/users' as Route, icon: Users, role: 'admin' },
  { label: 'Reports öffnen', href: '/admin/reports' as Route, icon: Flag, role: 'moderate' },
  { label: 'Regionen prüfen', href: '/admin/regions' as Route, icon: BarChart3, role: 'operate' },
  { label: 'Support prüfen', href: '/admin/support' as Route, icon: MessageSquare, role: 'moderate' },
  { label: 'Kampagnen', href: '/admin/campaigns' as Route, icon: Megaphone, role: 'operate' },
  { label: 'Payouts prüfen', href: '/admin/payouts' as Route, icon: Download, role: 'creator_ops' },
  { label: 'Systemstatus', href: '/admin/command-center' as Route, icon: AlertTriangle, role: 'operate' },
];

export default async function AdminCommandCenterPage() {
  const roles = await getAdminRoleStatus();
  if (!roles.can_operate) redirect('/admin' as Route);

  const snapshot = await getAdminCommandCenterSnapshot();
  const redCount = snapshot.areas.filter((area) => area.status === 'red').length;
  const yellowCount = snapshot.areas.filter((area) => area.status === 'yellow').length;
  const openAlerts = redCount + yellowCount;
  const productArea = snapshot.areas.find((area) => area.key === 'product');
  const pushFeedArea = snapshot.areas.find((area) => area.key === 'push-feed');
  const moderationArea = snapshot.areas.find((area) => area.key === 'moderation');
  const costArea = snapshot.areas.find((area) => area.key === 'cost');
  const visibleQuickActions = QUICK_ACTIONS.filter((action) => canUseQuickAction(action.role, roles));

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Serlo Command Center
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Moderation, Wachstum und Betrieb — auf einen Blick.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={snapshot.overall_status} />
          <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
            {openAlerts > 0 ? `${openAlerts} aktive Warnungen` : 'Keine aktiven Warnungen'}
          </div>
        </div>
      </section>

      <OperationalAlerts areas={snapshot.areas} />

      <section className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr_1fr]">
        <CommandPanel title="Nutzerwachstum">
          <GrowthPanel area={productArea} series={snapshot.growth_series} />
          <PanelLink href="/admin/activation">Activation Review</PanelLink>
        </CommandPanel>

        <CommandPanel title="Moderations-Übersicht">
          <ModerationOverview area={moderationArea} queue={snapshot.moderation_queue} />
          <PanelLink href="/admin/reports">Zur Moderation</PanelLink>
        </CommandPanel>

        <CommandPanel title="Gemeldete Inhalte nach Kategorie">
          <ReportCategoryBreakdown categories={snapshot.report_categories} />
          <PanelLink href="/admin/reports">Alle Kategorien anzeigen</PanelLink>
        </CommandPanel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[repeat(24,minmax(0,1fr))]">
        <CommandPanel title="Plattform-Überblick" className="min-h-[190px] p-3.5 xl:col-span-10">
          <div className="grid grid-cols-4 gap-2">
            {snapshot.platform_metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} variant="overview" />
            ))}
          </div>
        </CommandPanel>

        <CommandPanel className="xl:col-span-6" title="Live-Aktivitäten" action={<span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Live</span>}>
          <ActivityList items={snapshot.activity} />
          <PanelLink href="/admin/command-center">Alle Aktivitäten anzeigen</PanelLink>
        </CommandPanel>

        <CommandPanel
          className="xl:col-span-8"
          title="Moderations-Warteschlange"
          action={<span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{snapshot.moderation_queue.length} sichtbar</span>}
        >
          <ModerationQueueTable rows={snapshot.moderation_queue} />
          <PanelLink href="/admin/reports">Zur Moderation</PanelLink>
        </CommandPanel>
        <CommandPanel className="xl:col-span-5" title="Gemeldete Inhalte & Nutzer">
          <DetailRows area={moderationArea} emptyLabel="Keine Moderationsdaten verfügbar." />
          <PanelLink href="/admin/reports">Alle Meldungen anzeigen</PanelLink>
        </CommandPanel>

        <CommandPanel className="xl:col-span-5" title="Nutzerwachstum">
          <DetailRows area={productArea} emptyLabel="Product Health noch nicht verfügbar." />
          <PanelLink href="/admin/activation">Creator Activation öffnen</PanelLink>
        </CommandPanel>

        <CommandPanel className="xl:col-span-8" title="Top Inhalte">
          <TopContentPanel posts={snapshot.top_content} reels={snapshot.top_reels} stories={snapshot.top_stories} />
          <PanelLink href="/admin/command-center">Alle Top Inhalte anzeigen</PanelLink>
        </CommandPanel>

        <CommandPanel className="xl:col-span-6" title="Kampagnen-Übersicht">
          <CampaignOverview campaigns={snapshot.campaigns} />
          <PanelLink href="/admin/campaigns">Alle Kampagnen anzeigen</PanelLink>
        </CommandPanel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_1fr_0.9fr_1.2fr]">
        <CommandPanel title="Nachrichten / Support-Posteingang">
          <SupportInboxPreview support={snapshot.support_inbox} />
          <PanelLink href="/admin/support">Posteingang öffnen</PanelLink>
        </CommandPanel>

        <CommandPanel title="Trust & Safety">
          <DetailRows area={moderationArea} emptyLabel="Noch nicht getrackt." />
        </CommandPanel>

        <CommandPanel title="Systemstatus">
          <SystemRows rows={snapshot.system_rows} />
          <PanelLink href="/admin/command-center">Statusseite anzeigen</PanelLink>
        </CommandPanel>

        <CommandPanel title="Schnellaktionen">
          <QuickActionGrid actions={visibleQuickActions} />
        </CommandPanel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[0.9fr_2.1fr]">
        <CommandPanel title="Kostenstatus">
          <DetailRows area={costArea} emptyLabel="Cost Health noch nicht verfügbar." />
        </CommandPanel>
        <CommandPanel title="Regionale Aktivität">
          <RegionOverview regions={snapshot.regions} />
          <PanelLink href="/admin/regions">Alle Regionen anzeigen</PanelLink>
        </CommandPanel>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Aktualisiert: {formatDate(snapshot.generated_at)}
      </p>
    </div>
  );
}

function CommandPanel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('flex h-full flex-col rounded-lg border border-border bg-card p-2.5 shadow-sm', className)}>
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function OperationalAlerts({ areas }: { areas: CommandCenterArea[] }) {
  const active = areas.filter((area) => area.status !== 'green');
  if (active.length === 0) return null;

  return (
    <section className="grid gap-2 lg:grid-cols-2">
      {active.map((area) => (
        <Link
          key={area.key}
          href={(area.href ?? '/admin/command-center') as Route}
          className={cn(
            'rounded-lg border px-3 py-2 text-xs shadow-sm transition hover:bg-muted/50',
            area.status === 'red'
              ? 'border-red-500/30 bg-red-500/10/70 text-red-950'
              : 'border-amber-500/30 bg-amber-500/10/70 text-amber-950',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold">{area.label}</div>
              <div className="mt-0.5 text-[11px] opacity-80">{area.summary}</div>
              <div className="mt-1 text-[11px] font-semibold">
                Nächster Schritt: {String(area.detail.next_action ?? defaultNextAction(area))}
              </div>
            </div>
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          </div>
        </Link>
      ))}
    </section>
  );
}

function MetricCard({
  metric,
  variant = 'default',
}: {
  metric: CommandMetric;
  variant?: 'default' | 'overview';
}) {
  const Icon = METRIC_ICONS[metric.key] || Activity;
  const isOverview = variant === 'overview';
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card',
        isOverview ? 'min-h-[118px] min-w-0 px-2.5 py-2.5' : 'min-h-28 p-3',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          isOverview ? 'mb-3 h-8 w-8' : 'mb-4 h-9 w-9',
          metricTone(metric.tone),
        )}
      >
        <Icon className={cn('text-white', isOverview ? 'h-4 w-4' : 'h-4 w-4')} />
      </div>
      <div className={cn('truncate font-medium text-muted-foreground', isOverview ? 'text-[10px]' : 'text-[11px]')}>
        {metric.label}
      </div>
      <div
        className={cn(
          'font-bold tabular-nums text-foreground',
          isOverview ? 'mt-1 text-lg leading-none' : 'mt-1 text-xl',
        )}
      >
        {metric.value || 'Nicht verfügbar'}
      </div>
      <div className={cn('truncate text-muted-foreground', isOverview ? 'mt-1.5 text-[10px]' : 'mt-1 text-[11px]')}>
        {metric.sublabel}
      </div>
    </div>
  );
}

function ActivityList({ items }: { items: CommandActivityItem[] }) {
  if (items.length === 0) {
    return <EmptyState label="Keine aktuellen Aktivitäten verfügbar." />;
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const Icon = ACTIVITY_ICONS[item.kind];
        return (
          <div key={item.id} className="grid grid-cols-[2.45rem_1fr_auto] items-center gap-1.5 text-[11px]">
            <div className="text-[10px] tabular-nums text-muted-foreground">{formatTime(item.created_at)}</div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{item.label}</div>
              <div className="truncate text-[10px] text-muted-foreground">{item.detail}</div>
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Icon className="h-3 w-3" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModerationQueueTable({ rows }: { rows: CommandQueueItem[] }) {
  if (rows.length === 0) {
    return <EmptyState label="Keine offenen Reports in der Warteschlange." />;
  }

  return (
    <AdminTable
      columns={['Inhalt', 'Grund', 'Priorität', 'Wartezeit']}
      rows={rows.map((row) => [
        `${normalizeTargetType(row.target_type)} ${shortId(row.target_id)}`,
        row.reason,
        <PriorityBadge key={`${row.id}-priority`} priority={row.priority} />,
        row.wait_label,
      ])}
    />
  );
}

function AdminTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[430px] border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground">
            {columns.map((column) => (
              <th key={column} className="pb-1.5 font-semibold">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/60 last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="py-1 pr-2 text-foreground/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailRows({
  area,
  emptyLabel,
}: {
  area?: CommandCenterArea;
  emptyLabel: string;
}) {
  if (!area) return <EmptyState label={emptyLabel} />;
  const entries = Object.entries(area.detail).slice(0, 5);
  if (entries.length === 0) return <EmptyState label={emptyLabel} />;

  return (
    <div className="divide-y divide-border/60">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-2 py-1 text-[11px]">
          <span className="min-w-0 truncate text-muted-foreground">{humanizeKey(key)}</span>
          <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

function ModerationOverview({
  area,
  queue,
}: {
  area?: CommandCenterArea;
  queue: CommandQueueItem[];
}) {
  const detail = area?.detail ?? {};
  const pending = toNumber(detail.pending_reports);
  const overSla = toNumber(detail.pending_over_sla);
  const legacy = toNumber(detail.legacy_unqueued);
  const audit = toNumber(detail.audit_events_7d);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        <MiniKpi label="In Prüfung" value={pending} tone="blue" compact />
        <MiniKpi label="Über SLA" value={overSla} tone={overSla > 0 ? 'red' : 'green'} compact />
        <MiniKpi label="Legacy" value={legacy} tone={legacy > 0 ? 'amber' : 'green'} compact />
        <MiniKpi label="Audit 7d" value={audit} tone="slate" compact />
      </div>
      <div>
        <div className="mb-1.5 text-[10px] font-bold text-foreground/80">Warteschlange</div>
        <ModerationQueueTable rows={queue.slice(0, 4)} />
      </div>
    </div>
  );
}

function ReportCategoryBreakdown({ categories }: { categories: CommandReportCategory[] }) {
  const total = categories.reduce((sum, category) => sum + category.count, 0);

  return (
    <div className="grid gap-3 md:grid-cols-[0.8fr_1fr]">
      <div className="flex items-center justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-[14px] border-border bg-card">
          <div className="text-center">
            <div className="text-sm font-bold tabular-nums text-foreground">{formatCompactNumber(total)}</div>
            <div className="text-[10px] text-muted-foreground">30 Tage</div>
          </div>
        </div>
      </div>
      {categories.length === 0 ? (
        <EmptyState label="Keine Report-Kategorien in den letzten 30 Tagen." />
      ) : (
        <div className="divide-y divide-border/60">
          {categories.slice(0, 5).map((category) => (
            <div key={category.key} className="grid grid-cols-[1fr_auto] gap-2 py-1 text-[11px]">
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground/80">{category.label}</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${category.percentage}%` }} />
                </div>
              </div>
              <div className="text-right tabular-nums text-muted-foreground">
                <div>{category.percentage}%</div>
                <div className="text-[10px]">{formatCompactNumber(category.count)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupportInboxPreview({ support }: { support: CommandSupportInbox }) {
  if (support.status === 'missing_model') {
    return <EmptyState label="Support-Modell noch nicht deployed." />;
  }

  if (support.status === 'error') {
    return <EmptyState label="Support-Daten konnten nicht geladen werden." />;
  }

  if (support.latest.length === 0) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <MiniKpi label="Offen" value={support.open} tone="blue" compact />
          <MiniKpi label="Wartend" value={support.pending} tone="amber" compact />
          <MiniKpi label="SLA" value={support.over_sla} tone={support.over_sla > 0 ? 'red' : 'green'} compact />
        </div>
        <EmptyState label="Keine offenen Supportfälle." />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        <MiniKpi label="Offen" value={support.open} tone="blue" compact />
        <MiniKpi label="Wartend" value={support.pending} tone="amber" compact />
        <MiniKpi label="SLA" value={support.over_sla} tone={support.over_sla > 0 ? 'red' : 'green'} compact />
      </div>
      <div className="space-y-1.5">
        {support.latest.slice(0, 4).map((thread) => (
          <div key={thread.id} className="grid grid-cols-[1fr_auto] gap-2 text-[11px]">
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{thread.subject}</div>
              <div className="truncate text-[10px] text-muted-foreground">
                {thread.username ? `@${thread.username}` : 'Unbekannter Nutzer'} · {thread.priority}
              </div>
            </div>
            <div className="text-right text-[10px] tabular-nums text-muted-foreground">
              {thread.age_seconds === null ? '-' : formatDuration(thread.age_seconds)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  compact?: boolean;
}) {
  return (
    <div className={cn('rounded-md border border-border', compact ? 'px-1.5 py-1.5' : 'px-2 py-2')}>
      <div className={cn('truncate font-semibold', compact ? 'text-[10px]' : 'text-[10px]', miniKpiTone(tone))}>{label}</div>
      <div className={cn('mt-0.5 font-bold tabular-nums text-foreground', compact ? 'text-sm' : 'text-lg')}>
        {formatCompactNumber(value)}
      </div>
    </div>
  );
}

function CampaignOverview({ campaigns }: { campaigns: CommandCampaignSnapshot }) {
  if (campaigns.status === 'missing_model') {
    return <EmptyState label="Kampagnen-Modell noch nicht deployed." />;
  }

  if (campaigns.status === 'error') {
    return <EmptyState label="Kampagnen-Daten konnten nicht geladen werden." />;
  }

  if (campaigns.total === 0) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          <MiniKpi label="Aktiv" value={campaigns.active} tone="green" compact />
          <MiniKpi label="Pausiert" value={campaigns.paused} tone="slate" compact />
          <MiniKpi label="Fehler" value={campaigns.failed} tone={campaigns.failed > 0 ? 'red' : 'green'} compact />
          <MiniKpi label="ROAS" value={0} tone="blue" compact />
        </div>
        <EmptyState label="Noch keine echten Kampagnen angelegt." />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5">
        <MiniKpi label="Aktiv" value={campaigns.active} tone="green" compact />
        <MiniKpi label="Spend 30d" value={Math.round(campaigns.spend_cents_30d / 100)} tone="blue" compact />
        <MiniKpi label="Conv." value={campaigns.conversions_30d} tone="amber" compact />
        <MiniKpi label="Fehler" value={campaigns.failed} tone={campaigns.failed > 0 ? 'red' : 'green'} compact />
      </div>
      {campaigns.latest.length === 0 ? (
        <EmptyState label="Keine Kampagnen in der Liste." />
      ) : (
        <AdminTable
          columns={['Kampagne', 'Status', 'Budget', 'Ergebnis 30d']}
          rows={campaigns.latest.map((item) => [
            item.title,
            <CampaignStatusBadge key={`${item.id}-status`} status={item.status} />,
            formatEuroCents(item.budget_cents),
            campaignResultLabel(item),
          ])}
        />
      )}
    </div>
  );
}

function RegionOverview({ regions }: { regions: CommandRegionSnapshot }) {
  if (regions.status === 'missing_model') {
    return <EmptyState label="Regionen-Modell noch nicht deployed." />;
  }

  if (regions.status === 'error') {
    return <EmptyState label="Regionen-Daten konnten nicht geladen werden." />;
  }

  if (regions.latest.length === 0) {
    // Kein riesiger Karten-Platzhalter für eine leere Tabelle — eine ruhige
    // Zeile reicht, bis echte Regionsdaten existieren.
    return <EmptyState label="Noch keine Regionen-Daten. Die Karte erscheint, sobald Metriken vorliegen." />;
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-[1.55fr_0.75fr]">
        <WorldActivityMap regions={regions.latest} />
        <div className="min-w-0">
          <div className="grid max-w-[180px] grid-cols-3 gap-1">
            <MiniKpi label="Profile" value={regions.total_profiles} tone="blue" compact />
            <MiniKpi label="Views" value={regions.views_30d} tone="green" compact />
            <MiniKpi label="Reports" value={regions.reports_30d} tone={regions.reports_30d > 0 ? 'amber' : 'green'} compact />
          </div>
          <div className="mt-2 divide-y divide-border/60">
            {regions.latest.slice(0, 5).map((region) => (
              <div key={region.country_code} className="grid grid-cols-[1fr_auto] gap-2 py-1 text-[11px]">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{region.country_name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {region.country_code} · {formatCompactNumber(region.posts_30d)} Posts · {formatCompactNumber(region.active_users_30d)} aktiv
                  </div>
                </div>
                <div className="text-right tabular-nums text-foreground/80">
                  {formatCompactNumber(region.total_profiles || region.active_users_30d)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorldActivityMap({ regions }: { regions: CommandRegionSnapshot['latest'] }) {
  const maxActive = Math.max(1, ...regions.map((region) => region.total_profiles || region.active_users_30d));
  const regionByCode = new Map(regions.map((region) => [region.country_code, region]));
  const activeCountries = WORLD_COUNTRY_PATHS
    .map((country) => {
      const code = WORLD_ATLAS_ID_TO_ISO2[country.id];
      const region = code ? regionByCode.get(code) : undefined;
      const mapValue = region ? region.total_profiles || region.active_users_30d : 0;
      return { country, region, mapValue };
    })
    .filter((entry): entry is {
      country: typeof WORLD_COUNTRY_PATHS[number];
      region: CommandRegionSnapshot['latest'][number];
      mapValue: number;
    } => Boolean(entry.region) && entry.mapValue > 0);

  return (
    <div className="relative min-h-[300px] overflow-hidden rounded-md border border-border/60 bg-gradient-to-b from-muted to-card">
      <svg viewBox="300 58 110 48" className="absolute inset-0 h-full w-full" role="img" aria-label="Regionale Aktivitätskarte" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="regional-map-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#94a3b8" floodOpacity="0.22" />
          </filter>
        </defs>
        <g filter="url(#regional-map-shadow)">
          {WORLD_COUNTRY_PATHS.map((country) => {
            return (
              <path
                key={country.id}
                d={country.d}
                fill="#dbe7f3"
                stroke="#ffffff"
                strokeWidth="0.55"
                vectorEffect="non-scaling-stroke"
              >
                <title>{country.name}</title>
              </path>
            );
          })}
        </g>
        <g>
          {activeCountries.map(({ country, region, mapValue }) => (
            <path
              key={`active-${country.id}`}
              d={country.d}
              fill={countryFill(mapValue, maxActive)}
              stroke="#1d4ed8"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${region.country_name}: ${formatCompactNumber(mapValue)} Profile/Aktive`}</title>
            </path>
          ))}
        </g>
      </svg>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
        <span>Niedrig</span>
        <span className="h-1.5 w-24 rounded-full bg-gradient-to-r from-blue-100 via-blue-300 to-blue-600" />
        <span>Hoch</span>
      </div>
      {regions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/35 text-[10px] font-semibold text-muted-foreground/70">
          Wartet auf echte Regionsdaten
        </div>
      )}
    </div>
  );
}

function countryFill(value: number, maxValue: number): string {
  if (value <= 0) return '#dbe7f3';
  const ratio = Math.min(1, Math.max(0.18, value / Math.max(1, maxValue)));
  if (ratio > 0.82) return '#1d4ed8';
  if (ratio > 0.62) return '#2563eb';
  if (ratio > 0.42) return '#3b82f6';
  if (ratio > 0.24) return '#60a5fa';
  return '#93c5fd';
}

const WORLD_ATLAS_ID_TO_ISO2: Record<string, string> = {
  '032': 'AR',
  '036': 'AU',
  '040': 'AT',
  '076': 'BR',
  '124': 'CA',
  '156': 'CN',
  '203': 'CZ',
  '208': 'DK',
  '246': 'FI',
  '250': 'FR',
  '276': 'DE',
  '300': 'GR',
  '356': 'IN',
  '360': 'ID',
  '372': 'IE',
  '380': 'IT',
  '392': 'JP',
  '410': 'KR',
  '484': 'MX',
  '528': 'NL',
  '566': 'NG',
  '578': 'NO',
  '616': 'PL',
  '620': 'PT',
  '643': 'RU',
  '682': 'SA',
  '710': 'ZA',
  '724': 'ES',
  '752': 'SE',
  '756': 'CH',
  '792': 'TR',
  '804': 'UA',
  '818': 'EG',
  '826': 'GB',
  '840': 'US',
};

function SystemRows({ rows }: { rows: CommandSystemRow[] }) {
  if (rows.length === 0) return <EmptyState label="Systemstatus nicht verfügbar." />;

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold text-foreground">{row.label}</div>
            <div className="truncate text-[10px] text-muted-foreground">{row.summary}</div>
          </div>
          <StatusDot status={row.status} />
        </div>
      ))}
    </div>
  );
}

function QuickActionGrid({
  actions,
}: {
  actions: QuickAction[];
}) {
  if (actions.length === 0) return <EmptyState label="Keine Schnellaktionen für diese Rolle." />;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            href={action.href}
            aria-disabled={action.disabled}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border border-border bg-card px-1.5 text-center text-[10px] font-semibold text-foreground/80 transition hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-400',
              action.disabled && 'pointer-events-none opacity-60',
            )}
          >
            <Icon className={cn('h-4 w-4', action.label.includes('sperren') && 'text-red-500')} />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}

function PanelLink({ href, children }: { href: Route; children: React.ReactNode }) {
  return (
    <div className="mt-auto flex justify-center border-t border-border/60 pt-1.5">
      <Link href={href} className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
        {children}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: CommandCenterArea['status'] }) {
  const copy = {
    green: ['Stabil', CheckCircle2, 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
    yellow: ['Beobachten', AlertTriangle, 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'],
    red: ['Eingreifen', AlertTriangle, 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400'],
  } as const;
  const [label, Icon, className] = copy[status];
  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold', className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function StatusDot({ status }: { status: CommandCenterArea['status'] }) {
  const className = status === 'green'
    ? 'bg-emerald-500'
    : status === 'yellow'
      ? 'bg-amber-500'
      : 'bg-red-500';
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', className)} />;
}

function PriorityBadge({ priority }: { priority: CommandQueueItem['priority'] }) {
  const className = priority === 'Hoch'
    ? 'bg-red-500/10 text-red-700 dark:text-red-400'
    : priority === 'Mittel'
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', className)}>{priority}</span>;
}

function CampaignStatusBadge({ status }: { status: string }) {
  const className = status === 'active'
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : status === 'failed'
      ? 'bg-red-500/10 text-red-700 dark:text-red-400'
      : status === 'paused'
        ? 'bg-muted text-muted-foreground'
        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', className)}>{humanizeKey(status)}</span>;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-16 items-center justify-center rounded-md border border-dashed border-border px-2 text-center text-[11px] text-muted-foreground">
      {label}
    </div>
  );
}

function metricTone(tone: CommandMetric['tone']): string {
  switch (tone) {
    case 'blue':
      return 'bg-blue-500';
    case 'green':
      return 'bg-emerald-500';
    case 'violet':
      return 'bg-violet-500';
    case 'amber':
      return 'bg-amber-500';
    case 'red':
      return 'bg-red-500';
    default:
      return 'bg-muted/500';
  }
}

function canUseQuickAction(role: QuickAction['role'], roles: AdminRoleStatus): boolean {
  if (role === 'admin') return roles.can_admin;
  if (role === 'moderate') return roles.can_moderate;
  if (role === 'creator_ops') return roles.can_creator_ops;
  return roles.can_operate;
}

function defaultNextAction(area: CommandCenterArea): string {
  if (area.key === 'product') return 'Creator Activation Review';
  if (area.key === 'push-feed') return 'Unread Backlog und Push Tokens prüfen';
  if (area.key === 'moderation') return 'Reports mit SLA-Verstoss bearbeiten';
  if (area.key === 'cost') return 'Budget/Provider-Kosten prüfen';
  if (area.key === 'data-lifecycle') return 'Integrity Queue und Cron prüfen';
  return 'Owner-Runbook öffnen';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatValue(value: string | number | boolean | null): string {
  if (typeof value === 'number') return new Intl.NumberFormat('de-DE').format(value);
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (value === null) return 'Nicht verfügbar';
  return value;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function campaignResultLabel(item: CommandCampaignSnapshot['latest'][number]): string {
  if (item.conversions_30d > 0) return `${formatCompactNumber(item.conversions_30d)} Conv.`;
  if (item.clicks_30d > 0) return `${formatCompactNumber(item.clicks_30d)} Klicks`;
  if (item.impressions_30d > 0) return `${formatCompactNumber(item.impressions_30d)} Impr.`;
  if (item.revenue_cents_30d > 0) return formatEuroCents(item.revenue_cents_30d);
  return 'Noch keine Metriken';
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function miniKpiTone(tone: 'blue' | 'green' | 'amber' | 'red' | 'slate'): string {
  switch (tone) {
    case 'blue':
      return 'text-blue-600 dark:text-blue-400';
    case 'green':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'amber':
      return 'text-amber-600 dark:text-amber-400';
    case 'red':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeTargetType(value: string): string {
  if (value === 'post') return 'Post';
  if (value === 'profile') return 'Profil';
  if (value === 'comment') return 'Kommentar';
  if (value === 'live') return 'Live';
  if (value === 'product') return 'Produkt';
  return value || 'Inhalt';
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

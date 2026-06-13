'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Flag,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Activity,
  ExternalLink,
  ShieldCheck,
  EyeOff,
  MessageCircleOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAdminReports, adminResolveReport, adminEnforceReport,
  type ContentReport,
  type ModerationHealth,
} from '@/app/actions/admin';

// -----------------------------------------------------------------------------
// AdminReportsClient — Status-Tabs + Inline-Resolve
// Parity mit app/admin/reports.tsx
// -----------------------------------------------------------------------------

type Status = 'pending' | 'reviewed' | 'actioned' | 'dismissed';
type EnforcementAction =
  | 'remove_post'
  | 'ban_profile'
  | 'restrict_profile'
  | 'shadowban_profile'
  | 'mute_live_host';

const TABS: { label: string; value: Status; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Ausstehend', value: 'pending',   icon: Clock },
  { label: 'Bearbeitet', value: 'reviewed',  icon: CheckCircle },
  { label: 'Aktioniert', value: 'actioned',  icon: CheckCircle },
  { label: 'Abgelehnt',  value: 'dismissed', icon: XCircle },
];

const TARGET_LABELS: Record<string, string> = {
  post: 'Post', profile: 'Profil', comment: 'Kommentar', live: 'Live-Stream', product: 'Produkt',
};

const ENFORCEMENT_LABELS: Record<EnforcementAction, string> = {
  remove_post: 'Post entfernt',
  ban_profile: 'Profil gesperrt',
  restrict_profile: 'Profil beschränkt',
  shadowban_profile: 'Profil shadowbanned',
  mute_live_host: 'Live-Host stummgeschaltet',
};

export function AdminReportsClient({
  initialReports,
  initialStatus,
  health,
}: {
  initialReports: ContentReport[];
  initialStatus: Status;
  health: ModerationHealth | null;
}) {
  const [activeTab, setActiveTab] = useState<Status>(initialStatus);
  const [reports, setReports]     = useState<ContentReport[]>(initialReports);
  const [loading, startLoad]      = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [actionId, setActionId]   = useState<string | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function switchTab(tab: Status) {
    setActiveTab(tab);
    setExpandedId(null);
    startLoad(async () => {
      const data = await getAdminReports(tab);
      setReports(data);
    });
  }

  async function handleResolve(
    report: ContentReport,
    status: 'reviewed' | 'actioned' | 'dismissed',
    note: string,
  ) {
    setActionId(report.id);
    const result = await adminResolveReport(report.id, status, note || undefined);
    setActionId(null);

    if (result.ok) {
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      setExpandedId(null);
      showToast(
        status === 'actioned'
          ? 'Meldung aktioniert'
          : status === 'reviewed'
            ? 'Meldung bearbeitet'
            : 'Meldung abgelehnt',
        true,
      );
    } else {
      showToast(`Fehler: ${result.error}`, false);
    }
  }

  async function handleEnforce(
    report: ContentReport,
    action: EnforcementAction,
    note: string,
  ) {
    setActionId(report.id);
    const result = await adminEnforceReport(report.id, action, note || undefined);
    setActionId(null);

    if (result.ok) {
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      setExpandedId(null);
      showToast(`${ENFORCEMENT_LABELS[action]} und Report aktioniert`, true);
    } else {
      showToast(`Fehler: ${result.error}`, false);
    }
  }

  return (
    <div className="space-y-4">
      <ModerationHealthPanel health={health} />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/40 p-1">
        {TABS.map(({ label, value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => switchTab(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              activeTab === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {loading ? (
          <Loader2 className="inline h-3 w-3 animate-spin" />
        ) : (
          `${reports.length} Meldung${reports.length !== 1 ? 'en' : ''}`
        )}
      </p>

      {/* Report list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {reports.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
            <Flag className="h-6 w-6 opacity-30" />
            <span>Keine {TABS.find((t) => t.value === activeTab)?.label.toLowerCase()} Meldungen.</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                loading={actionId === report.id}
                expanded={expandedId === report.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === report.id ? null : report.id))
                }
                onResolve={(status, note) => handleResolve(report, status, note)}
                onEnforce={(action, note) => handleEnforce(report, action, note)}
                showActions={activeTab === 'pending'}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg',
            toast.ok ? 'bg-green-600' : 'bg-destructive',
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── ModerationHealthPanel ───────────────────────────────────────────────────

function ModerationHealthPanel({ health }: { health: ModerationHealth | null }) {
  if (!health) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Moderation-Health konnte nicht geladen werden. Bitte `npm run moderation:health` prüfen.</span>
      </div>
    );
  }

  const reports = health.content_reports;
  const legacy = health.legacy_unqueued;
  const audit = health.admin_audit;
  const red = reports.pending_over_sla > 0 || legacy.total > 0;
  const yellow = !red && reports.pending > 0;
  const statusLabel = red ? 'SLA blockiert' : yellow ? 'Queue offen' : 'Queue gesund';
  const statusClass = red
    ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
    : yellow
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
      : 'border-green-500/30 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300';

  return (
    <section className="space-y-3">
      <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', statusClass)}>
        {red ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{statusLabel}</p>
          <p className="mt-0.5 text-xs opacity-85">
            SLA {health.sla_hours}h · älteste offene Meldung {formatAge(reports.oldest_pending_age_seconds)}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <HealthMetric label="Ausstehend" value={reports.pending} tone={reports.pending > 0 ? 'warn' : 'ok'} />
        <HealthMetric label="Über SLA" value={reports.pending_over_sla} tone={reports.pending_over_sla > 0 ? 'danger' : 'ok'} />
        <HealthMetric label="Legacy offen" value={legacy.total} tone={legacy.total > 0 ? 'danger' : 'ok'} />
        <HealthMetric label="Audit 7d" value={audit.moderation_events_7d} tone="neutral" />
      </div>
    </section>
  );
}

function HealthMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
}) {
  const toneClass = {
    ok: 'text-green-600 dark:text-green-400',
    warn: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
    neutral: 'text-foreground',
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className={cn('text-lg font-bold tabular-nums', toneClass)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ─── ReportRow ────────────────────────────────────────────────────────────────

function ReportRow({
  report,
  loading,
  expanded,
  onToggle,
  onResolve,
  onEnforce,
  showActions,
}: {
  report: ContentReport;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onResolve: (status: 'reviewed' | 'actioned' | 'dismissed', note: string) => void;
  onEnforce: (action: EnforcementAction, note: string) => void;
  showActions: boolean;
}) {
  const [note, setNote] = useState('');

  const statusColor: Record<string, string> = {
    pending:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    reviewed:  'bg-green-500/10 text-green-600 dark:text-green-400',
    actioned:  'bg-red-500/10 text-red-600 dark:text-red-400',
    dismissed: 'bg-muted text-muted-foreground',
  };
  const targetHref = getTargetHref(report);
  const isOverSla = report.status === 'pending' && ageHours(report.created_at) >= 24;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        {/* Type icon */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
          <Flag className="h-4 w-4 text-red-500" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {TARGET_LABELS[report.target_type] ?? report.target_type}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{report.reason}</span>
            {isOverSla && (
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                SLA
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                statusColor[report.status],
              )}
            >
              {report.status === 'pending'
                ? 'Ausstehend'
                : report.status === 'actioned'
                  ? 'Aktioniert'
                  : report.status === 'reviewed'
                    ? 'Bearbeitet'
                    : 'Abgelehnt'}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {report.reporter && <span>von @{report.reporter.username}</span>}
            <span>
              {new Date(report.created_at).toLocaleDateString('de-DE', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
            <span>{formatAgeSince(report.created_at)}</span>
            <span className="font-mono text-[10px] opacity-50">{report.target_id.slice(0, 8)}…</span>
          </div>
          {report.admin_note && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              Notiz: {report.admin_note}
            </p>
          )}
        </div>

        {loading ? (
          <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
        ) : expanded ? (
          <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Resolve panel */}
      {expanded && showActions && (
        <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3">
          {targetHref ? (
            <Link
              href={targetHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Ziel öffnen
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Kein direkter Ziel-Link für diesen Typ.
            </div>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Admin-Notiz (optional)…"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            {report.target_type === 'post' && (
              <button
                type="button"
                onClick={() => onEnforce('remove_post', note)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
              >
                <XCircle className="h-3.5 w-3.5" />
                Post entfernen
              </button>
            )}
            {report.target_type === 'profile' && (
              <>
                <button
                  type="button"
                  onClick={() => onEnforce('ban_profile', note)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Profil sperren
                </button>
                <button
                  type="button"
                  onClick={() => onEnforce('restrict_profile', note)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 transition-colors hover:bg-amber-500/15 disabled:opacity-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Profil beschränken
                </button>
                <button
                  type="button"
                  onClick={() => onEnforce('shadowban_profile', note)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Shadowban
                </button>
              </>
            )}
            {report.target_type === 'live' && (
              <button
                type="button"
                onClick={() => onEnforce('mute_live_host', note)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 transition-colors hover:bg-amber-500/15 disabled:opacity-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
              >
                <MessageCircleOff className="h-3.5 w-3.5" />
                Live-Host stummschalten
              </button>
            )}
            <button
              type="button"
              onClick={() => onResolve('actioned', note)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 transition-colors hover:bg-green-500/15 disabled:opacity-50 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-400"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Bearbeitet — Aktion durchgeführt
            </button>
            <button
              type="button"
              onClick={() => onResolve('reviewed', note)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Nur geprüft
            </button>
            <button
              type="button"
              onClick={() => onResolve('dismissed', note)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Ablehnen
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function getTargetHref(report: ContentReport): Route | null {
  if (report.target_type === 'post') return `/p/${report.target_id}` as Route;
  if (report.target_type === 'live') return `/live/${report.target_id}` as Route;
  if (report.target_type === 'product') return `/shop/${report.target_id}` as Route;
  return null;
}

function ageHours(date: string): number {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, (Date.now() - timestamp) / 3_600_000);
}

function formatAgeSince(date: string): string {
  const hours = ageHours(date);
  if (hours < 1) return 'gerade eben';
  if (hours < 48) return `seit ${Math.floor(hours)}h`;
  return `seit ${Math.floor(hours / 24)}d`;
}

function formatAge(seconds: number | null): string {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return 'keine';
  const hours = value / 3600;
  if (hours < 48) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

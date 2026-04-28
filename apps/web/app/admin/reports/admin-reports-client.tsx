'use client';

import { useState, useTransition } from 'react';
import { Flag, CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAdminReports, adminResolveReport,
  type ContentReport,
} from '@/app/actions/admin';

// -----------------------------------------------------------------------------
// AdminReportsClient — Status-Tabs + Inline-Resolve
// Parity mit app/admin/reports.tsx
// -----------------------------------------------------------------------------

type Status = 'pending' | 'reviewed' | 'dismissed';

const TABS: { label: string; value: Status; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Ausstehend', value: 'pending',   icon: Clock },
  { label: 'Bearbeitet', value: 'reviewed',  icon: CheckCircle },
  { label: 'Abgelehnt',  value: 'dismissed', icon: XCircle },
];

const TARGET_LABELS: Record<string, string> = {
  post: 'Post', user: 'Nutzer', live: 'Live-Stream',
};

export function AdminReportsClient({
  initialReports,
  initialStatus,
}: {
  initialReports: ContentReport[];
  initialStatus: Status;
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
    status: 'reviewed' | 'dismissed',
    note: string,
  ) {
    setActionId(report.id);
    const result = await adminResolveReport(report.id, status, note || undefined);
    setActionId(null);

    if (result.ok) {
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      setExpandedId(null);
      showToast(status === 'reviewed' ? 'Meldung bearbeitet' : 'Meldung abgelehnt', true);
    } else {
      showToast(`Fehler: ${result.error}`, false);
    }
  }

  return (
    <div className="space-y-4">
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

// ─── ReportRow ────────────────────────────────────────────────────────────────

function ReportRow({
  report,
  loading,
  expanded,
  onToggle,
  onResolve,
  showActions,
}: {
  report: ContentReport;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onResolve: (status: 'reviewed' | 'dismissed', note: string) => void;
  showActions: boolean;
}) {
  const [note, setNote] = useState('');

  const statusColor: Record<string, string> = {
    pending:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    reviewed:  'bg-green-500/10 text-green-600 dark:text-green-400',
    dismissed: 'bg-muted text-muted-foreground',
  };

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
            <span
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                statusColor[report.status],
              )}
            >
              {report.status === 'pending' ? 'Ausstehend' : report.status === 'reviewed' ? 'Bearbeitet' : 'Abgelehnt'}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {report.reporter && <span>von @{report.reporter.username}</span>}
            <span>
              {new Date(report.created_at).toLocaleDateString('de-DE', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
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
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Admin-Notiz (optional)…"
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onResolve('reviewed', note)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-100 disabled:opacity-50 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-400"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Bearbeitet — Aktion durchgeführt
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

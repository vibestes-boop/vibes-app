import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import {
  Users, FileText, ShoppingBag, Flag,
  TrendingUp, Zap, CreditCard, AlertTriangle,
} from 'lucide-react';
import { getAdminStats } from '@/app/actions/admin';

// -----------------------------------------------------------------------------
// /admin — Übersichts-Dashboard
//
// v1.w.UI.215: Parity mit app/admin/index.tsx.
// Zeigt Plattform-Stats und Quick-Links zu Sub-Sektionen.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Admin — Übersicht',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();

  return (
    <div className="space-y-8">
      {/* Stat grid */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Plattform-Statistiken
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label="Nutzer gesamt"
            value={fmt(stats.total_users)}
            sub={`+${fmt(stats.new_users_7d)} diese Woche`}
            accent="#3b82f6"
            href="/admin/users"
          />
          <StatCard
            icon={FileText}
            label="Posts"
            value={fmt(stats.total_posts)}
            accent="#8b5cf6"
          />
          <StatCard
            icon={Zap}
            label="Aktive Lives"
            value={stats.active_lives}
            accent="#f59e0b"
          />
          <StatCard
            icon={ShoppingBag}
            label="Bestellungen"
            value={fmt(stats.total_orders)}
            accent="#10b981"
            href="/admin/payouts"
          />
          <StatCard
            icon={TrendingUp}
            label="Coin-Umsatz"
            value={`🪙 ${fmt(stats.total_revenue)}`}
            accent="#f59e0b"
          />
          <StatCard
            icon={Flag}
            label="Offene Meldungen"
            value={stats.pending_reports}
            accent={stats.pending_reports > 0 ? '#ef4444' : undefined}
            sub={stats.pending_reports > 0 ? 'Ausstehend' : 'Alles erledigt'}
            href="/admin/reports"
          />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Schnellzugriff
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <QuickLink
            href="/admin/users"
            icon={Users}
            title="Nutzerverwaltung"
            desc="Suchen, sperren, verifizieren, Admin-Rechte"
          />
          <QuickLink
            href="/admin/reports"
            icon={Flag}
            title="Meldungen"
            desc="Inhalts-Reports bearbeiten und lösen"
            badge={stats.pending_reports > 0 ? stats.pending_reports : undefined}
          />
          <QuickLink
            href="/admin/payouts"
            icon={CreditCard}
            title="Auszahlungen"
            desc="Seller-Guthaben und Auszahlungs-Anfragen"
          />
        </div>
      </section>

      {/* Warning if pending reports */}
      {stats.pending_reports > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-sm">
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {stats.pending_reports} offene Meldung{stats.pending_reports !== 1 ? 'en' : ''}
            </span>
            <span className="ml-1 text-amber-600/80 dark:text-amber-500/80">
              warten auf Überprüfung.{' '}
              <Link href="/admin/reports" className="underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-400">
                Jetzt ansehen →
              </Link>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  href,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  href?: Route;
}) {
  const inner = (
    <div className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-card/80">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: accent ? `${accent}18` : undefined }}
      >
        <Icon className="h-4 w-4" style={{ color: accent ?? 'var(--muted-foreground)' }} />
      </div>
      <div>
        <div className="text-xl font-bold tabular-nums tracking-tight text-foreground">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && (
          <div className="mt-0.5 text-[11px]" style={{ color: accent ?? 'var(--muted-foreground)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

// ─── QuickLink ────────────────────────────────────────────────────────────────

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
  badge,
}: {
  href: Route;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-foreground/70" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{title}</span>
          {badge !== undefined && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}

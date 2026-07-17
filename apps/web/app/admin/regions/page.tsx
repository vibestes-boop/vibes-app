import type { Route } from 'next';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Globe2, MapPin, RadioTower } from 'lucide-react';
import { adminRefreshRegionMetricsFromProfiles, adminUpsertRegionDailyMetrics, getAdminRegionMetrics, getAdminRoleStatus } from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin - Regionen',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminRegionsPage() {
  const roles = await getAdminRoleStatus();
  if (!roles.can_operate) redirect('/admin' as Route);

  const metrics = await getAdminRegionMetrics();
  const totalProfiles = metrics.reduce((sum, metric) => sum + metric.total_profiles, 0);
  const totalActive = metrics.reduce((sum, metric) => sum + metric.active_users, 0);
  const totalViews = metrics.reduce((sum, metric) => sum + metric.views, 0);
  const countryCount = new Set(metrics.map((metric) => metric.country_code)).size;

  async function upsertRegionMetrics(formData: FormData) {
    'use server';
    await adminUpsertRegionDailyMetrics(formData);
  }

  async function refreshProfileRegions() {
    'use server';
    await adminRefreshRegionMetricsFromProfiles();
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Regionale Aktivität</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Freiwillige Profilangaben und explizit gepflegte Länder-/Region-Metriken für das Admin Command Center.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryPill label="Regionen" value={countryCount} tone="blue" />
          <SummaryPill label="Profile" value={formatCompact(totalProfiles)} tone="blue" />
          <SummaryPill label="Aktive" value={formatCompact(totalActive)} tone="green" />
          <SummaryPill label="Views" value={formatCompact(totalViews)} tone="blue" />
        </div>
      </section>

      {roles.can_admin && (
        <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Globe2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Region-Metriken eintragen</h2>
              <p className="text-[11px] text-muted-foreground">Upsert pro ISO-2-Land, Datum und Quelle. Keine Standortdaten werden geraten.</p>
            </div>
          </div>
          <form action={refreshProfileRegions} className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2">
            <p className="text-[11px] text-blue-900 dark:text-blue-300">
              Freiwillige Profilregionen aggregieren. Diese Aktion liest nur explizit gespeicherte Profilangaben.
            </p>
            <button
              type="submit"
              className="h-8 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Profilregionen aktualisieren
            </button>
          </form>
          <form action={upsertRegionMetrics} className="grid gap-2 lg:grid-cols-[0.45fr_1fr_0.8fr_repeat(6,0.65fr)_0.75fr_auto]">
            <Field label="Code">
              <input
                name="country_code"
                required
                maxLength={2}
                placeholder="DE"
                className="h-9 w-full rounded-md border border-border px-2.5 text-xs uppercase outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </Field>
            <Field label="Land">
              <input
                name="country_name"
                required
                maxLength={80}
                placeholder="Deutschland"
                className="h-9 w-full rounded-md border border-border px-2.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </Field>
            <Field label="Datum">
              <input
                name="metric_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-9 w-full rounded-md border border-border px-2.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </Field>
            <NumberField name="total_profiles" label="Profile" />
            <NumberField name="active_users" label="Aktive" />
            <NumberField name="new_registrations" label="Neue" />
            <NumberField name="posts" label="Posts" />
            <NumberField name="views" label="Views" />
            <NumberField name="reports" label="Reports" />
            <Field label="Quelle">
              <input
                name="source"
                defaultValue="manual"
                maxLength={40}
                className="h-9 w-full rounded-md border border-border px-2.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </Field>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-9 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Speichern
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
        {metrics.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 text-center text-xs text-muted-foreground">
            <MapPin className="h-5 w-5 text-muted-foreground/50" />
            <span>Noch keine echten Regionen-Metriken erfasst.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="pb-2 font-semibold">Region</th>
                  <th className="pb-2 font-semibold">Datum</th>
                  <th className="pb-2 text-right font-semibold">Aktive</th>
                  <th className="pb-2 text-right font-semibold">Profile</th>
                  <th className="pb-2 text-right font-semibold">Neue</th>
                  <th className="pb-2 text-right font-semibold">Posts</th>
                  <th className="pb-2 text-right font-semibold">Views</th>
                  <th className="pb-2 text-right font-semibold">Reports</th>
                  <th className="pb-2 text-right font-semibold">Quelle</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-foreground">{metric.country_name} <span className="text-muted-foreground/70">({metric.country_code})</span></td>
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">{metric.metric_date}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground/80">{formatNumber(metric.active_users)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground/80">{formatNumber(metric.total_profiles)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground/80">{formatNumber(metric.new_registrations)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground/80">{formatNumber(metric.posts)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground/80">{formatNumber(metric.views)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground/80">{formatNumber(metric.reports)}</td>
                    <td className="py-2 text-right text-muted-foreground">{metric.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xs font-bold text-foreground">Nächste Stufe</h2>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          Diese Tabelle ist bewusst ein expliziter Admin-Importkanal. Später kann sie aus Analytics,
          CDN-Logs oder Provider-Exports befüllt werden, ohne personenbezogene Standortdaten in Profile zu schreiben.
        </p>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <Field label={label}>
      <input
        name={name}
        type="number"
        min="0"
        step="1"
        defaultValue="0"
        className="h-9 w-full rounded-md border border-border px-2.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </Field>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'blue' | 'green' | 'amber';
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <div className={cn('text-[10px] font-semibold uppercase', toneClass(tone))}>{label}</div>
      <div className="mt-1 text-sm font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function toneClass(tone: 'blue' | 'green' | 'amber'): string {
  if (tone === 'green') return 'text-emerald-600 dark:text-emerald-400';
  if (tone === 'amber') return 'text-amber-600 dark:text-amber-400';
  return 'text-blue-600 dark:text-blue-400';
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

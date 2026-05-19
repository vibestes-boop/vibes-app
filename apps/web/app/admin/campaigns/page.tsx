import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CalendarDays, Megaphone, Target, Wallet } from 'lucide-react';
import {
  adminCreateCampaign,
  adminUpdateCampaignStatus,
  adminUpsertCampaignDailyMetrics,
  getAdminCampaigns,
  getAdminRoleStatus,
} from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin - Kampagnen',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCampaignsPage() {
  const roles = await getAdminRoleStatus();
  if (!roles.can_operate) redirect('/admin');

  const campaigns = await getAdminCampaigns();
  const activeCount = campaigns.filter((campaign) => campaign.status === 'active').length;
  const pausedCount = campaigns.filter((campaign) => campaign.status === 'paused').length;
  const failedCount = campaigns.filter((campaign) => campaign.status === 'failed').length;
  const totalBudget = campaigns.reduce((sum, campaign) => sum + campaign.budget_cents, 0);

  async function createCampaign(formData: FormData) {
    'use server';
    await adminCreateCampaign(formData);
  }

  async function updateCampaignStatus(formData: FormData) {
    'use server';
    await adminUpdateCampaignStatus(formData);
  }

  async function upsertCampaignMetrics(formData: FormData) {
    'use server';
    await adminUpsertCampaignDailyMetrics(formData);
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-950">Kampagnen</h1>
          <p className="mt-1 text-xs text-slate-500">
            Echte interne Kampagnensteuerung fuer Budget, Status und spaetere Performance-Metriken.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryPill label="Aktiv" value={activeCount} tone="green" />
          <SummaryPill label="Pausiert" value={pausedCount} tone="slate" />
          <SummaryPill label="Fehler" value={failedCount} tone={failedCount > 0 ? 'red' : 'green'} />
          <SummaryPill label="Budget" value={formatEuroCents(totalBudget)} tone="blue" />
        </div>
      </section>

      {roles.can_admin && (
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-950">Neue Kampagne</h2>
              <p className="text-[11px] text-slate-500">Erstellt echte Backend-Daten, keine Demo-Zahlen.</p>
            </div>
          </div>
          <form action={createCampaign} className="grid gap-2 lg:grid-cols-[1.4fr_0.75fr_0.75fr_0.9fr_0.75fr_auto]">
            <Field label="Titel">
              <input
                name="title"
                required
                maxLength={120}
                placeholder="z. B. Creator Activation Mai"
                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <Field label="Kanal">
              <input
                name="channel"
                defaultValue="manual"
                maxLength={40}
                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <Field label="Status">
              <select
                name="status"
                defaultValue="draft"
                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="draft">Draft</option>
                <option value="active">Aktiv</option>
                <option value="paused">Pausiert</option>
              </select>
            </Field>
            <Field label="Zielmetrik">
              <input
                name="target_metric"
                maxLength={80}
                placeholder="z. B. D7 Retention"
                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <Field label="Budget EUR">
              <input
                name="budget_euros"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-9 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Anlegen
              </button>
            </div>
          </form>
        </section>
      )}

      {roles.can_admin && campaigns.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-950">Tagesmetriken eintragen</h2>
              <p className="text-[11px] text-slate-500">Upsert pro Kampagne und Datum. Diese Werte fuellen die Dashboard-Uebersicht.</p>
            </div>
          </div>
          <form action={upsertCampaignMetrics} className="grid gap-2 lg:grid-cols-[1.2fr_0.8fr_repeat(5,0.7fr)_auto]">
            <Field label="Kampagne">
              <select
                name="campaign_id"
                required
                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Datum">
              <input
                name="metric_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </Field>
            <NumberField name="impressions" label="Impr." />
            <NumberField name="clicks" label="Klicks" />
            <NumberField name="conversions" label="Conv." />
            <NumberField name="revenue_euros" label="Umsatz EUR" step="0.01" />
            <NumberField name="spend_euros" label="Spend EUR" step="0.01" />
            <div className="flex items-end">
              <button
                type="submit"
                className="h-9 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Speichern
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        {campaigns.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-200 px-3 text-center text-xs text-slate-500">
            <Megaphone className="h-5 w-5 text-slate-300" />
            <span>Noch keine echten Kampagnen angelegt.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th className="pb-2 font-semibold">Kampagne</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Kanal</th>
                  <th className="pb-2 font-semibold">Zielmetrik</th>
                  <th className="pb-2 text-right font-semibold">Budget</th>
                  <th className="pb-2 text-right font-semibold">Spend</th>
                  <th className="pb-2 text-right font-semibold">Aktualisiert</th>
                  {roles.can_admin && <th className="pb-2 text-right font-semibold">Aktion</th>}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-slate-100 last:border-0">
                    <td className="max-w-[260px] truncate py-2 pr-3 font-semibold text-slate-800">{campaign.title}</td>
                    <td className="py-2 pr-3"><StatusBadge status={campaign.status} /></td>
                    <td className="py-2 pr-3 text-slate-600">{campaign.channel}</td>
                    <td className="py-2 pr-3 text-slate-600">{campaign.target_metric || '-'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatEuroCents(campaign.budget_cents)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatEuroCents(campaign.spend_cents)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-500">{formatDate(campaign.updated_at)}</td>
                    {roles.can_admin && (
                      <td className="py-2 pl-3">
                        <form action={updateCampaignStatus} className="flex justify-end gap-1.5">
                          <input type="hidden" name="campaign_id" value={campaign.id} />
                          <select
                            name="status"
                            defaultValue={campaign.status}
                            className="h-8 rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Aktiv</option>
                            <option value="paused">Pausiert</option>
                            <option value="completed">Fertig</option>
                            <option value="failed">Fehler</option>
                            <option value="archived">Archiv</option>
                          </select>
                          <button
                            type="submit"
                            className="h-8 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            Setzen
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <InfoCard icon={Target} title="Ziel" text="Jede Kampagne braucht eine Zielmetrik, damit sie spaeter Keep / Improve / Kill bewertet werden kann." />
        <InfoCard icon={Wallet} title="Kosten" text="Budget und Spend laufen in Cent im Backend und koennen in Cost Health einbezogen werden." />
        <InfoCard icon={CalendarDays} title="Naechste Stufe" text="Als naechstes ergaenzen wir Statuswechsel und taegliche Metrik-Importe." />
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  name,
  label,
  step = '1',
}: {
  name: string;
  label: string;
  step?: string;
}) {
  return (
    <Field label={label}>
      <input
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue="0"
        className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
  tone: 'blue' | 'green' | 'red' | 'slate';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className={cn('text-[10px] font-semibold uppercase', pillTone(tone))}>{label}</div>
      <div className="mt-1 text-sm font-bold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600" />
        <h3 className="text-xs font-bold text-slate-950">{title}</h3>
      </div>
      <p className="text-[11px] leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className = status === 'active'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'failed'
      ? 'bg-red-50 text-red-700'
      : status === 'paused'
        ? 'bg-slate-100 text-slate-600'
        : 'bg-blue-50 text-blue-700';
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', className)}>{humanize(status)}</span>;
}

function pillTone(tone: 'blue' | 'green' | 'red' | 'slate'): string {
  if (tone === 'blue') return 'text-blue-600';
  if (tone === 'green') return 'text-emerald-600';
  if (tone === 'red') return 'text-red-600';
  return 'text-slate-500';
}

function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

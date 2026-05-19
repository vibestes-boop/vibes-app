import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  MessageSquare,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  adminCreateActivationSupportThread,
  getAdminRoleStatus,
  getCreatorActivationSnapshot,
  type CreatorActivationEngagementCandidate,
  type CreatorActivationFirstPostCandidate,
} from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin - Creator Aktivierung',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

async function submitActivationSupportThread(formData: FormData): Promise<void> {
  'use server';
  await adminCreateActivationSupportThread(formData);
}

export default async function AdminActivationPage() {
  const roles = await getAdminRoleStatus();
  if (!roles.can_operate && !roles.can_creator_ops) redirect('/admin');

  const snapshot = await getCreatorActivationSnapshot();
  const summary = snapshot.summary;
  const northStarReady = summary.active_creators_7d > 0 && summary.posts_7d > 0;
  const engagementRate = summary.views_30d > 0
    ? summary.meaningful_engagement_30d / summary.views_30d
    : null;

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
            <Rocket className="h-3.5 w-3.5" />
            Product Recovery
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            Creator Activation Review
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Echte Backend-Signale fuer North Star, erste Posts und Creator mit fehlendem Engagement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill ready={northStarReady} />
          <Link
            href="/admin/command-center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            Command Center
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {snapshot.status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          Creator-Activation-Snapshot konnte nicht geladen werden: {snapshot.error ?? 'Unbekannter Fehler'}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Sparkles}
          label="North Star"
          value={summary.active_creators_7d}
          sub={`${formatNumber(summary.posts_7d)} Posts in 7 Tagen`}
          tone={northStarReady ? 'green' : 'amber'}
        />
        <KpiCard
          icon={Users}
          label="Ohne ersten Post"
          value={summary.users_without_first_post_30d}
          sub={`${formatNumber(summary.new_users_30d)} neue Nutzer 30d`}
          tone={summary.users_without_first_post_30d > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          icon={MessageSquare}
          label="Engagement 30d"
          value={summary.meaningful_engagement_30d}
          sub={engagementRate === null ? 'Noch keine Views' : `${formatPercent(engagementRate)} pro View`}
          tone="blue"
        />
        <KpiCard
          icon={BarChart3}
          label="Posts 30d"
          value={summary.posts_30d}
          sub={`${formatNumber(summary.posts_with_meaningful_engagement_30d)} mit Engagement`}
          tone="violet"
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Neue Nutzer ohne ersten Post" action={`${snapshot.need_first_post.length} sichtbar`}>
          <FirstPostTable rows={snapshot.need_first_post} />
        </Panel>

        <Panel title="Creator mit Posts ohne Engagement" action={`${snapshot.need_engagement.length} sichtbar`}>
          <EngagementTable rows={snapshot.need_engagement} />
        </Panel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Naechste Schritte">
          <ActionList actions={snapshot.next_actions} northStarReady={northStarReady} />
        </Panel>

        <Panel title="Interpretation">
          <div className="grid gap-2 sm:grid-cols-3">
            <Insight
              label="Aktivierungsproblem"
              value={summary.users_without_first_post_30d > 0 ? 'Ja' : 'Nein'}
              detail={summary.users_without_first_post_30d > 0
                ? 'Neue Nutzer brauchen einen klaren ersten Post-Impuls.'
                : 'Neue Nutzer haben keinen offenen Erstpost-Stau.'}
            />
            <Insight
              label="Engagementproblem"
              value={summary.creators_with_zero_engagement_30d > 0 ? 'Ja' : 'Nein'}
              detail={summary.creators_with_zero_engagement_30d > 0
                ? 'Creator posten, bekommen aber noch keine Reaktion.'
                : 'Aktuelle Creator bekommen meaningful engagement.'}
            />
            <Insight
              label="North Star"
              value={northStarReady ? 'Gruen' : 'Beobachten'}
              detail={northStarReady
                ? 'Mindestens ein aktiver Creator mit Engagement ist sichtbar.'
                : 'Es fehlt ein Creator mit Post und Engagement in 7 Tagen.'}
            />
          </div>
        </Panel>
      </section>

      <p className="text-[11px] text-slate-500">
        Aktualisiert: {formatDate(snapshot.generated_at)}
      </p>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-950">{title}</h2>
        {action && (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
            {action}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
  tone: 'blue' | 'green' | 'amber' | 'violet';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-full text-white', toneClass(tone))}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{formatNumber(value)}</div>
      <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}

function FirstPostTable({ rows }: { rows: CreatorActivationFirstPostCandidate[] }) {
  if (rows.length === 0) {
    return <EmptyState label="Keine neuen Nutzer ohne ersten Post." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] text-slate-500">
            <th className="pb-2 font-semibold">Nutzer</th>
            <th className="pb-2 font-semibold">Registriert</th>
            <th className="pb-2 font-semibold">Wartet seit</th>
            <th className="pb-2 text-right font-semibold">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.user_id}-${row.username ?? 'unknown'}`} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3">
                <UserLabel username={row.username} displayName={row.display_name} fallback={row.user_id} />
              </td>
              <td className="py-2 pr-3 text-slate-600">{formatDateShort(row.created_at)}</td>
              <td className="py-2 pr-3 font-semibold tabular-nums text-slate-900">
                {formatNumber(row.days_since_signup)}d
              </td>
              <td className="py-2 text-right">
                <ActivationActions
                  profileId={row.profile_id}
                  username={row.username}
                  kind="first_post"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EngagementTable({ rows }: { rows: CreatorActivationEngagementCandidate[] }) {
  if (rows.length === 0) {
    return <EmptyState label="Keine Creator mit Posts ohne Engagement." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] text-slate-500">
            <th className="pb-2 font-semibold">Creator</th>
            <th className="pb-2 font-semibold">Posts</th>
            <th className="pb-2 font-semibold">Views</th>
            <th className="pb-2 font-semibold">Likes</th>
            <th className="pb-2 font-semibold">Kommentare</th>
            <th className="pb-2 font-semibold">Letzter Post</th>
            <th className="pb-2 text-right font-semibold">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.user_id}-${row.username ?? 'unknown'}`} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3">
                <UserLabel username={row.username} displayName={row.display_name} fallback={row.user_id} />
              </td>
              <td className="py-2 pr-3 tabular-nums text-slate-700">{formatNumber(row.posts_30d)}</td>
              <td className="py-2 pr-3 tabular-nums text-slate-700">{formatNumber(row.views)}</td>
              <td className="py-2 pr-3 tabular-nums text-slate-700">{formatNumber(row.likes)}</td>
              <td className="py-2 pr-3 tabular-nums text-slate-700">{formatNumber(row.comments)}</td>
              <td className="py-2 pr-3 text-slate-600">{row.latest_post_at ? formatDateShort(row.latest_post_at) : '-'}</td>
              <td className="py-2 text-right">
                <ActivationActions
                  profileId={row.profile_id}
                  username={row.username}
                  kind="engagement"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserLabel({
  username,
  displayName,
  fallback,
}: {
  username: string | null;
  displayName: string | null;
  fallback: string;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-slate-900">
        {displayName || (username ? `@${username}` : fallback)}
      </div>
      <div className="truncate text-[11px] text-slate-500">
        {username ? `@${username}` : fallback}
      </div>
    </div>
  );
}

function AdminUserLink({ username }: { username: string | null }) {
  const href = username ? (`/admin/users?q=${encodeURIComponent(username)}` as Route) : ('/admin/users' as Route);
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800">
      Nutzer pruefen
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function ActivationActions({
  profileId,
  username,
  kind,
}: {
  profileId: string;
  username: string | null;
  kind: 'first_post' | 'engagement';
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <AdminUserLink username={username} />
      <form action={submitActivationSupportThread}>
        <input type="hidden" name="user_id" value={profileId} />
        <input type="hidden" name="kind" value={kind} />
        <button
          type="submit"
          disabled={!profileId}
          className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
        >
          Supportfall
        </button>
      </form>
    </div>
  );
}

function ActionList({ actions, northStarReady }: { actions: string[]; northStarReady: boolean }) {
  const displayActions = actions.length > 0 ? actions : [
    'Guide new users without first post to create one public post',
    'Review creators with posts but no meaningful engagement',
    'Seed engagement loops through comments, follows, saves, or creator prompts',
  ];

  return (
    <div className="space-y-2">
      {displayActions.map((action) => (
        <div key={action} className="flex items-start gap-2 rounded-md border border-slate-100 px-2 py-2 text-xs text-slate-700">
          <CheckCircle2 className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', northStarReady ? 'text-emerald-500' : 'text-amber-500')} />
          <span>{translateAction(action)}</span>
        </div>
      ))}
    </div>
  );
}

function Insight({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-slate-200 px-3 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold',
        ready
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
      )}
    >
      {ready ? 'North Star aktiv' : 'Activation beobachten'}
    </div>
  );
}

function toneClass(tone: 'blue' | 'green' | 'amber' | 'violet'): string {
  if (tone === 'green') return 'bg-emerald-500';
  if (tone === 'amber') return 'bg-amber-500';
  if (tone === 'violet') return 'bg-violet-500';
  return 'bg-blue-500';
}

function translateAction(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes('without first post')) return 'Neue Nutzer ohne ersten Post gezielt zum ersten oeffentlichen Post fuehren.';
  if (normalized.includes('without meaningful engagement')) return 'Creator mit Posts, aber ohne meaningful engagement pruefen.';
  if (normalized.includes('engagement loops')) return 'Engagement-Loops ueber Kommentare, Follows, Saves oder Creator-Prompts anstossen.';
  if (normalized.includes('pause non-activation')) return 'Nicht-aktivierende Features pausieren, solange die Weekly Active Creators schwach bleiben.';
  return action;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDateShort(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

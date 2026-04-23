import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ShieldBan, UserX, Volume, Flag, ArrowRight, Hourglass } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// /studio/moderation — Globale Blocklist + Live-Chat-Wordlist.
//
// Dieses Panel ist absichtlich ein Stub (read-only, keine neuen Actions) —
// die Moderations-Actions existieren bereits verteilt:
//   - Profil-Block via `/settings/blocked` (bestehende Seite)
//   - Live-Chat Shadow-Ban via Host-Override während Live-Sessions
//   - Live-Chat Wordlist via `/studio/live/[id]/moderation` (pro-Session)
//
// Diese Seite zentralisiert die Counters + Links zu den spezifischen
// Management-Oberflächen. Eine vollständige globale Mod-Queue kommt in einer
// späteren Phase (v1.w.10+), wenn wir einen Reports-Inbox-Flow etablieren.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Moderation',
  description: 'Blockliste, Chat-Moderation, Meldungen.',
};

export const dynamic = 'force-dynamic';

export default async function StudioModerationPage() {
  const user = await getUser();
  if (!user) return null; // Layout hat bereits redirected

  const supabase = await createClient();

  const [blockedRes, wordlistRes, reportsRes] = await Promise.all([
    supabase
      .from('user_blocks')
      .select('blocked_id', { head: true, count: 'exact' })
      .eq('blocker_id', user.id),
    supabase
      .from('live_sessions')
      .select('id', { head: true, count: 'exact' })
      .eq('host_id', user.id)
      .eq('moderation_enabled', true),
    supabase
      .from('reports')
      .select('id', { head: true, count: 'exact' })
      .eq('reporter_id', user.id),
  ]);

  const blockedCount = blockedRes.count ?? 0;
  const activeModSessions = wordlistRes.count ?? 0;
  const myReports = reportsRes.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
          <ShieldBan className="h-7 w-7 text-red-500" />
          Moderation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Blockierte Profile, Chat-Moderation, von dir abgesendete Meldungen — auf einen
          Blick.
        </p>
      </header>

      {/* Stats */}
      <section className="grid gap-3 md:grid-cols-3">
        <ModStatCard
          icon={UserX}
          label="Blockierte Profile"
          value={blockedCount}
          description="Accounts die dich nicht mehr sehen oder kontaktieren können."
        />
        <ModStatCard
          icon={Volume}
          label="Live-Sessions mit Moderation"
          value={activeModSessions}
          description="Sessions mit aktivierter Chat-Filterung + Wortlisten."
        />
        <ModStatCard
          icon={Flag}
          label="Von dir gemeldet"
          value={myReports}
          description="Meldungen die du an das Moderations-Team geschickt hast."
        />
      </section>

      {/* Quick-Actions */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Moderations-Werkzeuge</h2>
          <p className="text-xs text-muted-foreground">
            Verwalte Blocklist, Live-Chat und Meldungen.
          </p>
        </div>
        <ul className="divide-y">
          <ModLinkRow
            href={'/settings/blocked' as Route}
            icon={UserX}
            title="Blockierte Nutzer"
            subtitle="Profile wieder entsperren oder neue hinzufügen."
          />
          <ModLinkRow
            href={'/studio/live' as Route}
            icon={Volume}
            title="Live-Chat-Moderation"
            subtitle="Pro Session eigene Wortlisten, Shadow-Ban-Timeouts, Slow-Mode."
          />
          <ModLinkRow
            href={'/studio/moderation' as Route}
            icon={Flag}
            title="Meldungen"
            subtitle="Ausstehende Meldungen + Status-Feedback (kommt in Phase 12)."
            disabled
          />
        </ul>
      </section>

      {/* Coming-Soon-Note */}
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <Hourglass className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h3 className="text-sm font-semibold">Globale Mod-Queue</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Eine zentrale Inbox mit allen Meldungen gegen deine Posts + Live-Streams kommt
              in einer späteren Phase. Bis dahin triffst du Moderations-Entscheidungen direkt
              im jeweiligen Kontext (Live-Studio, Kommentare am Post, Block aus dem
              Nutzer-Profil).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModStatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof UserX;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {value.toLocaleString('de-DE')}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{description}</div>
    </div>
  );
}

function ModLinkRow({
  href,
  icon: Icon,
  title,
  subtitle,
  disabled = false,
}: {
  href: Route;
  icon: typeof UserX;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  // Disabled-Zeilen rendern ohne Link (kein Next-Navigation), ansonsten geht
  // `/settings`-Redirect durch und führt zu `/settings/billing` — das verwirrt
  // beim „kommt in Phase 12"-Placeholder. Kein Hover-Highlight, kein Pfeil,
  // gedimmt + `aria-disabled` für Screen-Reader.
  if (disabled) {
    return (
      <li
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-3 px-4 py-3 opacity-60"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

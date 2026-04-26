import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { Swords, Trophy, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BattleRecord } from '@/lib/data/public';

// -----------------------------------------------------------------------------
// BattleList — v1.w.UI.52 Profil Battles-Tab.
//
// Zeigt die Battle-History eines Users als chronologische Liste.
// Jede Row: Ergebnis-Badge (Won/Lost/Draw) + Opponent-Avatar + Score + Datum.
// -----------------------------------------------------------------------------

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Heute';
  if (days === 1) return 'Gestern';
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 30) return `vor ${Math.floor(days / 7)} Wochen`;
  if (days < 365) return `vor ${Math.floor(days / 30)} Monaten`;
  return `vor ${Math.floor(days / 365)} Jahren`;
}

const RESULT_CONFIG = {
  won:  { label: 'Gewonnen', icon: Trophy, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  lost: { label: 'Verloren', icon: X,      className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  draw: { label: 'Unentschieden', icon: Minus, className: 'bg-muted text-muted-foreground' },
};

function initials(name: string | null, username: string | null): string {
  const n = name ?? username ?? '?';
  return n.slice(0, 2).toUpperCase();
}

export function BattleList({ battles }: { battles: BattleRecord[] }) {
  if (battles.length === 0) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-violet-500/15 via-indigo-500/10 to-sky-500/5 px-6 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-elevation-2 ring-1 ring-violet-500/20">
          <Swords className="h-8 w-8 text-foreground/80" strokeWidth={1.75} />
        </div>
        <div className="max-w-sm">
          <p className="text-base font-semibold">Noch keine Battles</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Battles entstehen im Live-Stream — fordere andere Creator heraus.
          </p>
        </div>
      </div>
    );
  }

  // W-L-D Zusammenfassung
  const won  = battles.filter((b) => b.result === 'won').length;
  const lost = battles.filter((b) => b.result === 'lost').length;
  const draw = battles.filter((b) => b.result === 'draw').length;

  return (
    <div>
      {/* Stats-Header */}
      <div className="mb-4 flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
        <Swords className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex gap-5 text-sm">
          <span><span className="font-semibold text-emerald-600 dark:text-emerald-400">{won}</span> <span className="text-muted-foreground">Siege</span></span>
          <span><span className="font-semibold text-red-600 dark:text-red-400">{lost}</span> <span className="text-muted-foreground">Niederlagen</span></span>
          <span><span className="font-semibold">{draw}</span> <span className="text-muted-foreground">Unentschieden</span></span>
        </div>
      </div>

      {/* Battle-Rows */}
      <ul className="divide-y divide-border/60">
        {battles.map((b) => {
          const cfg = RESULT_CONFIG[b.result];
          const ResultIcon = cfg.icon;
          const opp = b.opponent;

          return (
            <li key={b.id} className="flex items-center gap-3 py-3">
              {/* Ergebnis-Badge */}
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', cfg.className)}>
                <ResultIcon className="h-4 w-4" />
              </div>

              {/* Opponent */}
              <Link
                href={opp.username ? (`/u/${opp.username}` as Route) : ('#' as Route)}
                className="flex flex-1 items-center gap-2 min-w-0"
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                  {opp.avatar_url ? (
                    <Image src={opp.avatar_url} alt="" fill className="object-cover" sizes="36px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                      {initials(opp.display_name, opp.username)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {opp.display_name ?? `@${opp.username}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelative(b.ended_at)}</p>
                </div>
              </Link>

              {/* Score + Duration */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">
                  <span className={b.result === 'won' ? 'text-emerald-600 dark:text-emerald-400' : b.result === 'lost' ? 'text-red-600 dark:text-red-400' : ''}>
                    {b.my_score.toLocaleString('de-DE')}
                  </span>
                  <span className="mx-1 text-muted-foreground">:</span>
                  <span>{b.opponent_score.toLocaleString('de-DE')}</span>
                </p>
                <p className="text-xs text-muted-foreground">{formatDuration(b.duration_secs)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

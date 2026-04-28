'use client';

// -----------------------------------------------------------------------------
// LiveBattleBar — v1.w.UI.181
//
// TikTok-style split battle score bar. Positioned absolute at the top of the
// 9:16 video frame (below the top-bar controls). Pure CSS — no Animated.Value.
//
// Layout:
//   ┌─────────────────────────────────────────────┐
//   │       [     ⏱ 00:45    ]                   │  ← countdown pill (centered)
//   │  🔴 1,234   [⚔️]   456 🔵                  │  ← score row
//   │  [████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │  ← progress underline
//   └─────────────────────────────────────────────┘
//
//   Winner overlay fades in when ended=true.
// -----------------------------------------------------------------------------

import { cn } from '@/lib/utils';
import type { BattleStoreState, BattleWinner } from './live-battle-store';

function fmtScore(n: number): string {
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('de-DE');
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

function winnerLabel(winner: BattleWinner, hostName: string, coHostName: string): string {
  if (winner === 'host') return `🏆 ${hostName} gewinnt!`;
  if (winner === 'guest') return `🏆 ${coHostName} gewinnt!`;
  return '🤝 Unentschieden!';
}

const HOST_COLOR = '#FF2D6D';
const GUEST_COLOR = '#00D4FF';

interface LiveBattleBarProps {
  state: Pick<
    BattleStoreState,
    'hostScore' | 'guestScore' | 'hostFraction' | 'secondsLeft' | 'ended' | 'winner'
  >;
  hostName: string;
  coHostName: string;
}

export function LiveBattleBar({ state, hostName, coHostName }: LiveBattleBarProps) {
  const { hostScore, guestScore, hostFraction, secondsLeft, ended, winner } = state;
  const pct = Math.round(hostFraction * 100);

  return (
    <div className="absolute inset-x-0 top-28 z-30 select-none">
      {/* Countdown pill */}
      <div className="flex justify-center">
        <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              secondsLeft <= 10 && !ended ? 'animate-pulse bg-red-500' : 'bg-white/50',
            )}
          />
          {ended ? 'Beendet' : fmtTime(secondsLeft)}
        </div>
      </div>

      {/* Score row */}
      <div className="flex items-center justify-between bg-black/50 px-4 py-1 backdrop-blur-sm">
        {/* Host side */}
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: HOST_COLOR }}
          />
          <span className="text-sm font-bold" style={{ color: HOST_COLOR }}>
            {fmtScore(hostScore)}
          </span>
          <span className="hidden max-w-[80px] truncate text-[11px] text-white/60 sm:block">
            {hostName}
          </span>
        </div>

        {/* VS badge */}
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white"
          style={{ background: `linear-gradient(135deg, ${HOST_COLOR}, ${GUEST_COLOR})` }}
        >
          ⚔️
        </div>

        {/* Guest side */}
        <div className="flex items-center gap-1.5">
          <span className="hidden max-w-[80px] truncate text-[11px] text-white/60 sm:block">
            {coHostName}
          </span>
          <span className="text-sm font-bold" style={{ color: GUEST_COLOR }}>
            {fmtScore(guestScore)}
          </span>
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: GUEST_COLOR }}
          />
        </div>
      </div>

      {/* Progress underline — width transitions via CSS */}
      <div className="h-1 w-full" style={{ background: GUEST_COLOR }}>
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: HOST_COLOR }}
        />
      </div>

      {/* Winner overlay */}
      {ended && winner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <p className="text-center text-base font-bold text-white drop-shadow-lg">
            {winnerLabel(winner, hostName, coHostName)}
          </p>
        </div>
      )}
    </div>
  );
}

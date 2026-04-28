'use client';

// -----------------------------------------------------------------------------
// LiveGiftGoalViewer — Viewer-facing gift-goal progress overlay (v1.w.UI.137).
//
// Host-Pendant: live-gifts-feed.tsx (enthält auch den Goal-Editor und Sender-Feed).
//
// Positionierung: absolute bottom-20 right-3 — rechts über der Action-Bar,
// damit der Chat-Overlay links nicht überlappt (Chat belegt sm:w-[62%] links).
//
// Daten-Flow:
//  • initialGoal → SSR-Seed (von getActiveGiftGoal() in der Page)
//  • Realtime: live_gift_goals UPDATE-Event → aktualisiert current_coins
//  • Wenn goal null → nichts gerendert (unsichtbar, kein DOM)
//  • Wenn goal.current_coins >= goal.target_coins → Celebrate-State (grün, ✓)
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Target, Coins } from 'lucide-react';
import type { ActiveGiftGoal } from '@/lib/data/live-host';
import { glassSurface } from '@/lib/ui/glass-pill';
import { cn } from '@/lib/utils';

function supa() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface LiveGiftGoalViewerProps {
  sessionId: string;
  initialGoal: ActiveGiftGoal | null;
}

export function LiveGiftGoalViewer({ sessionId, initialGoal }: LiveGiftGoalViewerProps) {
  const [goal, setGoal] = useState<ActiveGiftGoal | null>(initialGoal);

  // ── Realtime: live_gift_goals UPDATE ──────────────────────────────────────
  useEffect(() => {
    const db = supa();
    const ch = db
      .channel(`live-goal-viewer-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_gift_goals',
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          // Re-fetch statt payload nutzen — payload enthält kein closed_at zuverlässig
          const { data } = await db
            .from('live_gift_goals')
            .select('id, session_id, host_id, label, target_coins, current_coins, created_at')
            .eq('session_id', sessionId)
            .is('closed_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setGoal((data as ActiveGiftGoal | null) ?? null);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_gift_goals',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          // Neues Ziel → sofort anzeigen
          setGoal(payload.new as ActiveGiftGoal);
        },
      )
      .subscribe();

    return () => {
      db.removeChannel(ch);
    };
  }, [sessionId]);

  if (!goal) return null;

  const pct = Math.min(100, Math.round((goal.current_coins / goal.target_coins) * 100));
  const reached = goal.current_coins >= goal.target_coins;

  return (
    <div
      className={cn(
        glassSurface,
        'flex w-44 flex-col gap-1.5 rounded-2xl p-2.5 shadow-elevation-2',
        reached && 'ring-1 ring-green-500/40',
      )}
    >
      {/* Label + icon */}
      <div className="flex items-center gap-1.5">
        <Target className={cn('h-3.5 w-3.5 flex-shrink-0', reached ? 'text-green-400' : 'text-white/70')} />
        <span className="truncate text-[11px] font-semibold text-white leading-tight">
          {goal.label}
        </span>
      </div>

      {/* Coin count */}
      <div className="flex items-center gap-1 text-[10px] text-white/70">
        <Coins className="h-3 w-3 flex-shrink-0" />
        <span>
          {goal.current_coins.toLocaleString('de-DE')}
          <span className="text-white/40"> / {goal.target_coins.toLocaleString('de-DE')}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            reached ? 'bg-green-500' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {reached && (
        <p className="text-center text-[10px] font-semibold text-green-400">
          🎉 Ziel erreicht!
        </p>
      )}
    </div>
  );
}

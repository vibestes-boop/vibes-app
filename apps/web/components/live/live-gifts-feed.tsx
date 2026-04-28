'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Gift, Target, Loader2, Plus, Check, Trash2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { createLiveGiftGoal, closeActiveGiftGoal } from '@/app/actions/live-host';

function supa() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
import type { SessionGiftRow, ActiveGiftGoal } from '@/lib/data/live-host';

// -----------------------------------------------------------------------------
// LiveGiftsFeed — zeigt eingehende Geschenke + optionales Coin-Goal.
//
// Realtime:
//  • DB-Subscription auf live_gifts.INSERT mit session_id-Filter
//  • DB-Subscription auf live_gift_goals.UPDATE (current_coins-Änderung)
//
// Goal-Editor:
//  • Host kann Ziel setzen (100-1.000.000 Coins) mit Label
//  • Celebrate bei Erreichen (visuell: grüner Check + Pulse)
// -----------------------------------------------------------------------------

export interface LiveGiftsFeedProps {
  sessionId: string;
  initialGifts: SessionGiftRow[];
  initialGoal: ActiveGiftGoal | null;
}

export function LiveGiftsFeed({ sessionId, initialGifts, initialGoal }: LiveGiftsFeedProps) {
  const [gifts, setGifts] = useState<SessionGiftRow[]>(initialGifts);
  const [goal, setGoal] = useState<ActiveGiftGoal | null>(initialGoal);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [isClosingGoal, startCloseGoal] = useTransition();

  // -----------------------------------------------------------------------------
  // Realtime-Subscriptions
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = supa();

    const giftsChannel = supabase
      .channel(`live-gifts-feed-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_gifts',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            recipient_id: string;
            gift_id: string;
            coin_cost: number;
            created_at: string;
          };
          // Sender + Gift lazy nachladen
          const [{ data: sender }, { data: giftMeta }] = await Promise.all([
            supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', row.sender_id)
              .maybeSingle(),
            supabase
              .from('live_gift_catalog')
              .select('name, image_url')
              .eq('id', row.gift_id)
              .maybeSingle(),
          ]);
          setGifts((prev) =>
            [
              {
                id: row.id,
                sender_id: row.sender_id,
                recipient_id: row.recipient_id,
                gift_id: row.gift_id,
                coin_cost: row.coin_cost,
                created_at: row.created_at,
                sender: (sender as { username: string; avatar_url: string | null } | null) ?? null,
                gift: (giftMeta as { name: string; image_url: string | null } | null) ?? null,
              } as SessionGiftRow,
              ...prev,
            ].slice(0, 100),
          );
        },
      )
      .subscribe();

    const goalChannel = supabase
      .channel(`live-goals-watch-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_gift_goals',
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          const { data } = await supabase
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
      .subscribe();

    return () => {
      supabase.removeChannel(giftsChannel);
      supabase.removeChannel(goalChannel);
    };
  }, [sessionId]);

  // -----------------------------------------------------------------------------
  // Aggregat: Top-Supporter (Session-weit)
  // -----------------------------------------------------------------------------
  const topSupporter = useMemo(() => {
    const sums = new Map<
      string,
      { sender_id: string; username: string | null; avatar_url: string | null; coins: number }
    >();
    for (const g of gifts) {
      const entry = sums.get(g.sender_id);
      if (entry) {
        entry.coins += g.coin_cost;
      } else {
        sums.set(g.sender_id, {
          sender_id: g.sender_id,
          username: g.sender?.username ?? null,
          avatar_url: g.sender?.avatar_url ?? null,
          coins: g.coin_cost,
        });
      }
    }
    return Array.from(sums.values()).sort((a, b) => b.coins - a.coins)[0] ?? null;
  }, [gifts]);

  const goalReached = goal && goal.current_coins >= goal.target_coins;
  const goalProgress = goal ? Math.min(100, Math.round((goal.current_coins / goal.target_coins) * 100)) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Gift className="h-3.5 w-3.5" />
          Geschenke
        </h3>
        {!goal && (
          <button
            type="button"
            onClick={() => setShowGoalEditor((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Target className="h-3 w-3" />
            Ziel setzen
          </button>
        )}
      </div>

      {/* Goal-Editor */}
      {showGoalEditor && !goal && (
        <GoalEditor
          sessionId={sessionId}
          onDone={() => setShowGoalEditor(false)}
        />
      )}

      {/* Active Goal */}
      {goal && (
        <div
          className={`rounded-lg border px-3 py-2 ${
            goalReached ? 'border-green-500 bg-green-500/10' : 'bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              {goalReached ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Target className="h-4 w-4 text-primary" />
              )}
              {goal.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-xs text-muted-foreground">
                {goal.current_coins.toLocaleString('de-DE')} / {goal.target_coins.toLocaleString('de-DE')}
              </span>
              {/* v1.w.UI.209 — remove goal button (mobile parity: setLiveGoal(null)) */}
              <button
                type="button"
                title="Ziel entfernen"
                disabled={isClosingGoal}
                onClick={() =>
                  startCloseGoal(async () => {
                    await closeActiveGiftGoal(sessionId);
                  })
                }
                className="rounded p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
              >
                {isClosingGoal ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${goalReached ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${goalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Top-Supporter */}
      {topSupporter && (
        <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 px-3 py-2 text-xs">
          <span className="text-base">🏆</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{topSupporter.username ?? 'Unbekannt'}</p>
            <p className="text-muted-foreground">
              {topSupporter.coins.toLocaleString('de-DE')} Coins
            </p>
          </div>
        </div>
      )}

      {/* Gifts-Liste */}
      {gifts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Geschenke. Viewer können dich mit Coins unterstützen.
        </p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
          {gifts.slice(0, 20).map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
            >
              {g.gift?.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.gift.image_url}
                  alt={g.gift.name}
                  className="h-8 w-8 flex-shrink-0 object-contain"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium">{g.sender?.username ?? 'Unbekannt'}</span>{' '}
                  <span className="text-muted-foreground">schickt</span>{' '}
                  <span className="font-medium">{g.gift?.name ?? 'Geschenk'}</span>
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  🪙 {g.coin_cost.toLocaleString('de-DE')} ·{' '}
                  {new Date(g.created_at).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// GoalEditor — kleiner Inline-Editor für Coin-Ziel
// -----------------------------------------------------------------------------

function GoalEditor({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    const target = parseInt(amount, 10);
    if (!Number.isFinite(target) || target < 100 || target > 1_000_000) {
      setError('100 – 1.000.000 Coins.');
      return;
    }
    if (!label.trim()) {
      setError('Label angeben.');
      return;
    }
    startTransition(async () => {
      const result = await createLiveGiftGoal(sessionId, target, label.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone();
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value.slice(0, 80))}
        placeholder="z.B. Neuer Stream-Setup"
        className="rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Zielsumme in Coins"
        min={100}
        max={1_000_000}
        className="rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border px-2.5 py-1 text-xs"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Ziel setzen
        </button>
      </div>
    </div>
  );
}

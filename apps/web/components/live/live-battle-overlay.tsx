'use client';

// -----------------------------------------------------------------------------
// LiveBattleOverlay — v1.w.UI.181
//
// Manages battle state for the web live viewer. Renders LiveBattleBar when
// the cohost layout is 'battle', writes state to the module-level store so
// LiveGiftPicker can access sendBattleGift without prop threading.
//
// Subscriptions:
//   co-host-signals-{sessionId}   — layout changes (co-host-accepted /
//                                   co-host-layout-changed / co-host-ended)
//   battle:{sessionId}            — score events (battle-gift /
//                                   battle-started / battle-ended)
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  setBattleStore,
  resetBattleStore,
  type BattleTeam,
  type BattleWinner,
} from './live-battle-store';
import { LiveBattleBar } from './live-battle-bar';

interface Props {
  sessionId: string;
  hostName: string;
  coHostName: string | null;
  /** When null (no active cohost) battle mode is impossible — component sleeps. */
  coHostId: string | null;
}

// ─── Battle state (local to overlay) ─────────────────────────────────────────

interface BattleState {
  hostScore: number;
  guestScore: number;
  hostFraction: number;
  secondsLeft: number;
  ended: boolean;
  winner: BattleWinner;
}

function calcFraction(host: number, guest: number): number {
  const total = host + guest;
  if (total === 0) return 0.5;
  return Math.max(0.05, Math.min(0.95, host / total));
}

const INIT_STATE: BattleState = {
  hostScore: 0,
  guestScore: 0,
  hostFraction: 0.5,
  secondsLeft: 60,
  ended: false,
  winner: null,
};

export function LiveBattleOverlay({ sessionId, hostName, coHostName, coHostId }: Props) {
  const [isBattle, setIsBattle] = useState(false);
  const [durationSecs, setDurationSecs] = useState(60);
  const [battleState, setBattleState] = useState<BattleState>(INIT_STATE);

  // refs
  const hostRef = useRef(0);
  const guestRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(60);
  const signalChannelRef = useRef<RealtimeChannel | null>(null);
  const battleChannelRef = useRef<RealtimeChannel | null>(null);

  // ── helpers ─────────────────────────────────────────────────────────────────

  const resetBattle = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    hostRef.current = 0;
    guestRef.current = 0;
    setBattleState(INIT_STATE);
  }, []);

  const addScore = useCallback((team: BattleTeam, coins: number) => {
    if (team === 'host') hostRef.current += coins;
    else guestRef.current += coins;
    const h = hostRef.current;
    const g = guestRef.current;
    const newState: Partial<BattleState> = {
      hostScore: h,
      guestScore: g,
      hostFraction: calcFraction(h, g),
    };
    setBattleState((prev) => ({ ...prev, ...newState }));
    setBattleStore(newState);
  }, []);

  const endBattle = useCallback((w: BattleWinner) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const patch: Partial<BattleState> = { ended: true, winner: w, secondsLeft: 0 };
    setBattleState((prev) => ({ ...prev, ...patch }));
    setBattleStore(patch);
  }, []);

  const startTimer = useCallback((dur: number, startedAt?: number) => {
    if (timerRef.current) return; // already running
    const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    secondsRef.current = Math.max(1, dur - elapsed);
    setBattleState((prev) => ({ ...prev, secondsLeft: secondsRef.current }));
    setBattleStore({ secondsLeft: secondsRef.current });

    timerRef.current = setInterval(() => {
      secondsRef.current -= 1;
      setBattleState((prev) => ({ ...prev, secondsLeft: secondsRef.current }));
      setBattleStore({ secondsLeft: secondsRef.current });
      if (secondsRef.current <= 0) {
        const h = hostRef.current; const g = guestRef.current;
        const w: BattleWinner = h > g ? 'host' : g > h ? 'guest' : 'draw';
        endBattle(w);
      }
    }, 1000);
  }, [endBattle]);

  // sendBattleGift — Viewer broadcasts score event after sending a coin gift
  const sendBattleGift = useCallback((team: BattleTeam, coins: number) => {
    if (!battleChannelRef.current) return;
    battleChannelRef.current.send({
      type: 'broadcast',
      event: 'battle-gift',
      payload: { team, coins, senderName: '' },
    });
    // Optimistic local score update (self: false → won't echo, so we add manually)
    addScore(team, coins);
  }, [addScore]);

  // ── Subscribe to co-host-signals for layout ──────────────────────────────────
  useEffect(() => {
    if (!coHostId) return;
    const supabase = createClient();

    const ch = supabase
      .channel(`co-host-signals-${sessionId}`, {
        config: { broadcast: { ack: false, self: false } },
      })
      .on('broadcast', { event: 'co-host-accepted' }, ({ payload }) => {
        const { layout, battleDuration } = payload as {
          layout?: string;
          battleDuration?: number;
        };
        if (layout === 'battle') {
          const dur = battleDuration ?? 60;
          setDurationSecs(dur);
          secondsRef.current = dur;
          resetBattle();
          setIsBattle(true);
          setBattleStore({ isBattle: true, durationSecs: dur, sendBattleGift });
        }
      })
      .on('broadcast', { event: 'co-host-layout-changed' }, ({ payload }) => {
        const { layout, battleDuration } = payload as {
          layout?: string;
          battleDuration?: number;
        };
        if (layout === 'battle') {
          const dur = battleDuration ?? 60;
          setDurationSecs(dur);
          secondsRef.current = dur;
          resetBattle();
          setIsBattle(true);
          setBattleStore({ isBattle: true, durationSecs: dur, sendBattleGift });
        } else {
          setIsBattle(false);
          resetBattle();
          resetBattleStore();
        }
      })
      .on('broadcast', { event: 'co-host-ended' }, () => {
        setIsBattle(false);
        resetBattle();
        resetBattleStore();
      })
      .subscribe();

    signalChannelRef.current = ch;
    return () => {
      signalChannelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [sessionId, coHostId, resetBattle, sendBattleGift]);

  // ── Subscribe to battle channel for score events ─────────────────────────────
  useEffect(() => {
    if (!isBattle) return;
    const supabase = createClient();

    const ch = supabase
      .channel(`battle:${sessionId}`, {
        config: { broadcast: { ack: false, self: false } },
      })
      .on('broadcast', { event: 'battle-gift' }, ({ payload }) => {
        const { team, coins } = payload as { team: BattleTeam; coins: number };
        addScore(team, coins);
      })
      .on('broadcast', { event: 'battle-started' }, ({ payload }) => {
        const { startedAt, durationSecs: dur } = payload as {
          startedAt: number;
          durationSecs: number;
        };
        setDurationSecs(dur);
        startTimer(dur, startedAt);
      })
      .on('broadcast', { event: 'battle-ended' }, ({ payload }) => {
        const { winner } = payload as { winner: BattleWinner };
        endBattle(winner);
      })
      .subscribe();

    battleChannelRef.current = ch;
    // Update store with sendBattleGift now that channel is ready
    setBattleStore({ sendBattleGift });

    return () => {
      battleChannelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [isBattle, sessionId, addScore, endBattle, startTimer, sendBattleGift]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      resetBattleStore();
    };
  }, []);

  if (!isBattle || !coHostId) return null;

  return (
    <LiveBattleBar
      state={battleState}
      hostName={hostName}
      coHostName={coHostName ?? 'Guest'}
    />
  );
}

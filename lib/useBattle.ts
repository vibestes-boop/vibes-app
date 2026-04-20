/**
 * lib/useBattle.ts
 *
 * Echtzeit-Score-Tracking für den Battle-Split-Modus.
 *
 * Broadcast-Protokoll (eigener Channel → kein Konflikt mit co-host-signals):
 *   "battle-gift"     Viewer → alle: { team: 'host'|'guest', coins, senderName }
 *   "battle-ended"    Host → alle:   { winner: 'host'|'guest'|'draw' }
 *
 * Scores werden NICHT in die DB geschrieben — rein Event-basiert.
 * → Null Latenz, kein Schema-Change nötig.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type BattleTeam = 'host' | 'guest';

export type BattleWinner = 'host' | 'guest' | 'draw' | null;

export interface BattleState {
  hostScore:    number;
  guestScore:   number;
  totalCoins:   number;  // hostScore + guestScore
  /** Anteil des Hosts: 0.0 – 1.0 (0.5 = gleichstand) */
  hostFraction: number;
  secondsLeft:  number;
  ended:        boolean;
  winner:       BattleWinner;
}

export interface BattleGiftEvent {
  team:       BattleTeam;
  coins:      number;
  senderName: string;
}

// ─── Channel-Name ─────────────────────────────────────────────────────────────
const battleChannel = (sessionId: string) => `battle:${sessionId}`;

// ─── Hilfsfunktion: Fraction berechnen ───────────────────────────────────────
function calcFraction(host: number, guest: number): number {
  const total = host + guest;
  if (total === 0) return 0.5;
  return Math.max(0.05, Math.min(0.95, host / total)); // clamp: min 5%, max 95%
}

// ─── Hook: Battle-State verwalten ─────────────────────────────────────────────

/**
 * Universeller Battle-Hook für Host UND Viewer.
 * Beide Seiten subscriben auf denselben Channel und akkumulieren Scores lokal.
 *
 * @param sessionId     Live-Session ID
 * @param durationSecs  Battle-Dauer in Sekunden (default: 60)
 * @param autoStart     True → Timer startet sofort beim Mounten
 */
export function useBattle(
  sessionId: string | null,
  durationSecs: number = 60,
  autoStart: boolean = false,
  /** Guest-User-ID — nur Host übergibt das, wird für DB-Persistenz benötigt.
   *  Viewers passen hier `null`, weil sie das Battle nicht finalisieren. */
  guestId: string | null = null,
) {
  const { profile } = useAuthStore();

  const [state, setState] = useState<BattleState>({
    hostScore:    0,
    guestScore:   0,
    totalCoins:   0,
    hostFraction: 0.5,
    secondsLeft:  durationSecs,
    ended:        false,
    winner:       null,
  });

  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef  = useRef(durationSecs); // Sync-Ref für setInterval-Closure
  const hostRef     = useRef(0);
  const guestRef    = useRef(0);
  // Ref auf endBattle — verhindert Stale-Closure in Inline-Timern (Neu-2 Fix)
  const endBattleRef = useRef<(broadcast: boolean) => void>(() => {});

  // ── Score akkumulieren ───────────────────────────────────────────────────
  const addScore = useCallback((team: BattleTeam, coins: number) => {
    if (team === 'host') {
      hostRef.current += coins;
    } else {
      guestRef.current += coins;
    }
    const h = hostRef.current;
    const g = guestRef.current;
    setState((prev) => ({
      ...prev,
      hostScore:    h,
      guestScore:   g,
      totalCoins:   h + g,
      hostFraction: calcFraction(h, g),
    }));
  }, []);

  // ── Battle beenden ───────────────────────────────────────────────────────
  const endBattle = useCallback((broadcastEnd = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const h = hostRef.current;
    const g = guestRef.current;
    const winner: BattleWinner = h > g ? 'host' : g > h ? 'guest' : 'draw';

    setState((prev) => ({
      ...prev,
      ended:  true,
      winner,
      secondsLeft: 0,
    }));

    // Host broadcastet das Ende an alle (Viewers) UND persistiert in der DB.
    // Nur der Host hat `guestId` — Viewer rufen endBattle(false) auf und
    // überspringen DB-Persistenz (RLS würde sie eh nicht reinlassen).
    if (broadcastEnd && channelRef.current) {
      channelRef.current.send({
        type:    'broadcast',
        event:   'battle-ended',
        payload: { winner },
      });

      // v1.16.0: DB-Persistenz via finalize_battle RPC (idempotent).
      // `duration_secs` = durationSecs - secondsLeft (wie lange das Battle
      // tatsächlich lief; Force-End zählt nicht die vollen durationSecs).
      if (sessionId && guestId) {
        const actualDuration = Math.max(0, durationSecs - secondsRef.current);
        supabase
          .rpc('finalize_battle', {
            p_session_id:    sessionId,
            p_guest_id:      guestId,
            p_host_score:    h,
            p_guest_score:   g,
            p_duration_secs: actualDuration,
          })
          .then(({ error }) => {
            if (error) {
              __DEV__ && console.warn('[useBattle] finalize_battle failed:', error.message);
            }
          });
      }
    }
  }, [sessionId, guestId, durationSecs]);

  // Ref immer aktuell halten (Neu-2 Fix)
  // useEffect-unabhängig — einfaches Ref-Update vor dem nächsten Render
  endBattleRef.current = endBattle;

  // ── Timer starten ────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) return; // kein doppelter Start
    secondsRef.current = durationSecs;

    // Timestamp broadcasten → Viewer synchronisieren sich (Bug 2 Fix)
    channelRef.current?.send({
      type:    'broadcast',
      event:   'battle-started',
      payload: { startedAt: Date.now(), durationSecs },
    });

    timerRef.current = setInterval(() => {
      secondsRef.current -= 1;
      setState((prev) => ({ ...prev, secondsLeft: secondsRef.current }));

      if (secondsRef.current <= 0) {
        endBattleRef.current(true); // Neu-2 Fix: Ref statt direkter endBattle-Referenz
      }
    }, 1000);
  }, [durationSecs]);  // endBattle entfernt — Ref stabil

  // ── Gift senden (Viewer) — trägt zu einem Team bei ───────────────────────
  const sendBattleGift = useCallback((team: BattleTeam, coins: number) => {
    if (!sessionId || !profile || !channelRef.current) return;
    const event: BattleGiftEvent = {
      team,
      coins,
      senderName: profile.username,
    };
    channelRef.current.send({
      type:    'broadcast',
      event:   'battle-gift',
      payload: event,
    });
    // Optimistisch lokal updaten (Sender sieht sofort seinen Beitrag)
    addScore(team, coins);
  }, [sessionId, profile, addScore]);

  // ── Channel subscriben ───────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    // Phase 1.1: Beim Re-Mount (sessionId null → aktiv, z.B. Layout-Switch zurück
    // zu 'battle') refs + State auf Ausgangswerte zurücksetzen, sonst würden
    // Scores aus der vorherigen Runde einfach weiterlaufen.
    hostRef.current    = 0;
    guestRef.current   = 0;
    secondsRef.current = durationSecs;
    setState({
      hostScore:    0,
      guestScore:   0,
      totalCoins:   0,
      hostFraction: 0.5,
      secondsLeft:  durationSecs,
      ended:        false,
      winner:       null,
    });

    const channel = supabase
      .channel(battleChannel(sessionId), {
        // self: false — Sender empfängt eigene Broadcasts NICHT
        // Verhindert Double-Count bei sendBattleGift() (Bug 1 Fix)
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'battle-gift' }, (msg) => {
        const e = msg.payload as BattleGiftEvent;
        addScore(e.team, e.coins);
      })
      .on('broadcast', { event: 'battle-started' }, (msg) => {
        // Viewer synchronisiert Timer mit Host-Timestamp (Bug 2 Fix)
        if (timerRef.current) return; // bereits gestartet (Host sendet sich selbst nicht)
        const { startedAt, durationSecs: dur } = msg.payload as { startedAt: number; durationSecs: number };
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(1, dur - elapsed);
        secondsRef.current = remaining;
        setState((prev) => ({ ...prev, secondsLeft: remaining }));

        // Timer mit synchronisierter Startzeit beginnen
        timerRef.current = setInterval(() => {
          secondsRef.current -= 1;
          setState((prev) => ({ ...prev, secondsLeft: secondsRef.current }));
          if (secondsRef.current <= 0) endBattleRef.current(false); // Neu-2 Fix: Ref
        }, 1000);
      })
      .on('broadcast', { event: 'battle-ended' }, (msg) => {
        const { winner } = msg.payload as { winner: BattleWinner };
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setState((prev) => ({ ...prev, ended: true, winner, secondsLeft: 0 }));
      })
      .subscribe();

    channelRef.current = channel;

    if (autoStart) startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // durationSecs in Deps → beim Host-seitigen Battle-Dauer-Wechsel startet eine
    // saubere neue Runde (Phase 1.1).
  }, [sessionId, autoStart, startTimer, addScore, durationSecs]);

  return {
    state,
    startTimer,
    endBattle: () => endBattle(true),
    sendBattleGift,
    channelRef,
  };
}

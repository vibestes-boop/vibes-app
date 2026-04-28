'use client';

// -----------------------------------------------------------------------------
// live-battle-store — v1.w.UI.181
//
// Module-level pub/sub singleton so LiveBattleOverlay can write battle state
// and LiveGiftPicker can read it — without prop-drilling across the RSC
// boundary or wrapping the page canvas in a client Context provider.
//
// Works purely in the browser (all consumers are 'use client'). SSR never
// reaches this code because useSyncExternalStore always returns the server
// snapshot (INITIAL) and the real state is hydrated client-side.
// -----------------------------------------------------------------------------

import { useSyncExternalStore } from 'react';

export type BattleTeam = 'host' | 'guest';
export type BattleWinner = 'host' | 'guest' | 'draw' | null;

export interface BattleStoreState {
  isBattle: boolean;
  durationSecs: number;
  hostScore: number;
  guestScore: number;
  /** hostScore / (hostScore + guestScore), clamped 0.05–0.95. 0.5 at start. */
  hostFraction: number;
  secondsLeft: number;
  ended: boolean;
  winner: BattleWinner;
  sendBattleGift: ((team: BattleTeam, coins: number) => void) | null;
}

const INITIAL: BattleStoreState = {
  isBattle: false,
  durationSecs: 60,
  hostScore: 0,
  guestScore: 0,
  hostFraction: 0.5,
  secondsLeft: 0,
  ended: false,
  winner: null,
  sendBattleGift: null,
};

let _state: BattleStoreState = { ...INITIAL };
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((l) => l());
}

export function setBattleStore(patch: Partial<BattleStoreState>) {
  _state = { ..._state, ...patch };
  notify();
}

export function resetBattleStore() {
  _state = { ...INITIAL };
  notify();
}

export function useBattleStore(): BattleStoreState {
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    () => _state,
    () => INITIAL,
  );
}

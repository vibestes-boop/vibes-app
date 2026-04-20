/**
 * shared/catalog/gifts.ts
 *
 * Statischer Gift-Katalog. Shared mit Native und Web.
 * Live-Session-spezifischer DB-Katalog (`live_gift_catalog`) überschreibt
 * diese Defaults pro Saison / pro Host.
 */

import type { Gift } from '../types';

export const DEFAULT_GIFTS: Gift[] = [
  { id: 'rose',        name: 'Rose',          emoji: '🌹', coinCost: 1,     lottieUrl: null, tier: 'common' },
  { id: 'heart',       name: 'Herz',          emoji: '❤️',  coinCost: 5,     lottieUrl: null, tier: 'common' },
  { id: 'crown',       name: 'Krone',         emoji: '👑', coinCost: 99,    lottieUrl: null, tier: 'rare'   },
  { id: 'dragon',      name: 'Drache',        emoji: '🐉', coinCost: 999,   lottieUrl: null, tier: 'epic'   },
  { id: 'lion',        name: 'Löwe',          emoji: '🦁', coinCost: 4999,  lottieUrl: null, tier: 'legendary' },
  { id: 'ferrari',     name: 'Ferrari',       emoji: '🏎️', coinCost: 19999, lottieUrl: null, tier: 'legendary' },
];

export function findGift(id: string): Gift | undefined {
  return DEFAULT_GIFTS.find((g) => g.id === id);
}

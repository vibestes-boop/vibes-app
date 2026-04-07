/**
 * lib/gifts.ts — Virtuelle Geschenke Definitionen
 *
 * Gift-Katalog, Typen, Formatierungs-Hilfsfunktionen.
 * Spiegelt den Supabase gift_catalog Tisch wider.
 */

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  coinCost: number;
  diamondValue: number;
  color: string;
  lottieUrl?: string;  // korrigiert: war 'lottiUrl' (Tippfehler)
  /** Animationssequenz (Emoji-Kaskade als Fallback) */
  burstEmojis: string[];
}

export interface GiftTransaction {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  giftId: string;
  gift: GiftItem;
  createdAt: string;
}

/** Wird via Supabase Realtime gesendet, wenn ein Geschenk eingeht */
export interface GiftRealtimePayload {
  senderId:   string;
  senderName: string;
  senderAvatar?: string;
  giftId:     string;
  sessionId:  string;
}

// ─── Coin-Pakete (Apple IAP) ────────────────────────────────────────────────

export interface CoinPackage {
  id: string;           // App Store Product ID
  coins: number;
  price: string;        // Anzeigepreis
  label: string;
  badge?: string;       // z.B. "Beliebt" | "Bestes Angebot"
  bonusCoins?: number;
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'vibes.coins.70',  coins: 70,   price: '0,99 €', label: '70 Coins' },
  { id: 'vibes.coins.350', coins: 350,  price: '4,99 €', label: '350 Coins', badge: 'Beliebt' },
  { id: 'vibes.coins.700', coins: 700,  price: '9,99 €', label: '700 Coins', bonusCoins: 50 },
  { id: 'vibes.coins.1750',coins: 1750, price: '24,99 €',label: '1.750 Coins',bonusCoins: 150, badge: 'Bestes Angebot' },
  { id: 'vibes.coins.3500',coins: 3500, price: '49,99 €',label: '3.500 Coins',bonusCoins: 500 },
];

// ─── Geschenk-Katalog ────────────────────────────────────────────────────────

export const GIFT_CATALOG: GiftItem[] = [
  {
    id: 'rose',
    name: 'Rose',
    emoji: '🌹',
    coinCost: 10,
    diamondValue: 8,
    color: '#f43f5e',
    burstEmojis: ['🌹', '🌸', '💕'],
  },
  {
    id: 'heart',
    name: 'Heart',
    emoji: '❤️',
    coinCost: 25,
    diamondValue: 20,
    color: '#ef4444',
    burstEmojis: ['❤️', '💗', '💖'],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    emoji: '💎',
    coinCost: 100,
    diamondValue: 85,
    color: '#06b6d4',
    burstEmojis: ['💎', '✨', '💙'],
  },
  {
    id: 'crown',
    name: 'Crown',
    emoji: '👑',
    coinCost: 250,
    diamondValue: 215,
    color: '#f59e0b',
    burstEmojis: ['👑', '⭐', '✨'],
  },
  {
    id: 'trophy',
    name: 'Trophy',
    emoji: '🏆',
    coinCost: 500,
    diamondValue: 435,
    color: '#eab308',
    burstEmojis: ['🏆', '🥇', '🎉'],
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    emoji: '🌌',
    coinCost: 1000,
    diamondValue: 880,
    color: '#8b5cf6',
    burstEmojis: ['🌌', '🚀', '⭐', '💫'],
  },
  {
    id: 'lion',
    name: 'Löwe',
    emoji: '🦁',
    coinCost: 2500,
    diamondValue: 2200,
    color: '#f97316',
    burstEmojis: ['🦁', '🔥', '👑', '💥'],
  },
  {
    id: 'unicorn',
    name: 'Unicorn',
    emoji: '🦄',
    coinCost: 5000,
    diamondValue: 4400,
    color: '#ec4899',
    burstEmojis: ['🦄', '🌈', '✨', '💖', '⭐'],
  },
];

// ─── Gift Lookup ──────────────────────────────────────────────────────────────

export const GIFT_BY_ID = Object.fromEntries(
  GIFT_CATALOG.map((g) => [g.id, g])
) as Record<string, GiftItem>;

// ─── Hilfs-Funktionen ─────────────────────────────────────────────────────────

/** Coins formatieren: 1000 → "1.000" */
export function formatCoins(n: number): string {
  return n.toLocaleString('de-DE');
}

/** Kurz-Format: 1500 → "1,5K" (deutsch, konsistent mit formatCoins) */
export function formatCoinsShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + 'M';
  if (n >= 1_000)     return (n / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + 'K';
  return String(n);
}

/**
 * lib/gifts.ts — Virtuelle Geschenke Definitionen
 *
 * Gift-Katalog, Typen, Formatierungs-Hilfsfunktionen.
 * Spiegelt den Supabase gift_catalog Tisch wider.
 */

// ─── Typen ──────────────────────────────────────────────────────────────────

export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  coinCost: number;
  diamondValue: number;
  color: string;
  lottieUrl?: string;
  lottieAsset?: object; // require('../assets/lottie/xxx.json')
  imageAsset?: number;
  /** Lokales MP4-Video (require) für Premium-Overlay */
  videoAsset?: number;
  /** Remote MP4 URL (Fallback falls kein lokales Asset) */
  videoUrl?: string;
  /** Animationssequenz (Emoji-Kaskade als Fallback) */
  burstEmojis: string[];
  /** v1.17.0: Rarität — steuert UI-Glow und Filter */
  rarity?: GiftRarity;
  /**
   * v1.17.0: Saison-Tag. Wenn gesetzt, wird ein "Season"-Badge angezeigt
   * und das Gift erscheint in einem eigenen Karussell (z.B. "Ramadan 2026").
   */
  seasonTag?: string;
  /** ISO — Gift erscheint erst ab diesem Zeitpunkt. Null = sofort. */
  availableFrom?: string | null;
  /** ISO — Gift verschwindet nach diesem Zeitpunkt. Null = permanent. */
  availableUntil?: string | null;
}

/**
 * UI-Meta pro Rarity: Glow-Farbe + deutsches Label.
 * Die Clients konsumieren das, um Gift-Kacheln passend zu rendern.
 */
export const RARITY_META: Record<GiftRarity, { label: string; glow: string; border: string }> = {
  common:    { label: 'Standard',  glow: 'transparent',       border: 'rgba(255,255,255,0.08)' },
  rare:      { label: 'Selten',    glow: 'rgba(59,130,246,0.55)',  border: 'rgba(59,130,246,0.6)'  }, // blue
  epic:      { label: 'Episch',    glow: 'rgba(168,85,247,0.55)',  border: 'rgba(168,85,247,0.6)'  }, // purple
  legendary: { label: 'Legendär',  glow: 'rgba(250,204,21,0.55)',  border: 'rgba(250,204,21,0.6)'  }, // gold
};

/** Rarity eines Gifts heuristisch aus coin_cost ableiten (Fallback für lokale Gifts). */
export function rarityFromCost(coinCost: number): GiftRarity {
  if (coinCost <= 50)   return 'common';
  if (coinCost <= 300)  return 'rare';
  if (coinCost <= 1500) return 'epic';
  return 'legendary';
}

/** Ist ein Gift gerade aktiv (Saison-Window)? */
export function isGiftActive(g: GiftItem, now: Date = new Date()): boolean {
  const ms = now.getTime();
  if (g.availableFrom  && new Date(g.availableFrom).getTime()  > ms) return false;
  if (g.availableUntil && new Date(g.availableUntil).getTime() <= ms) return false;
  return true;
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
  senderId:    string;
  senderName:  string;
  senderAvatar?: string;
  giftId:      string;
  sessionId:   string;
  /**
   * Combo-Zähler: wie oft dieses Gift vom gleichen Sender in der aktuellen
   * Combo-Sequenz gesendet wurde. Startet bei 1 für das erste Gift.
   */
  comboCount:  number;
  /**
   * Eindeutiger Schlüssel für eine Combo-Sequenz: `${senderId}-${giftId}`.
   * Alle Viewer suchen anhand dieses Keys ein vorhandenes Pill und updaten
   * dessen Zähler, statt ein neues Pill zu erstellen.
   */
  comboKey:    string;
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
    lottieAsset: require('../assets/lottie/rose.json'),
    imageAsset: require('../assets/gifts/rose.png'),
    burstEmojis: ['🌹', '🌸', '💕'],
  },
  {
    id: 'heart',
    name: 'Heart',
    emoji: '❤️',
    coinCost: 25,
    diamondValue: 20,
    color: '#ef4444',
    lottieAsset: require('../assets/lottie/heart.json'),
    imageAsset: require('../assets/gifts/heart.png'),
    burstEmojis: ['❤️', '💗', '💖'],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    emoji: '💎',
    coinCost: 100,
    diamondValue: 85,
    color: '#06b6d4',
    lottieAsset: require('../assets/lottie/diamond.json'),
    imageAsset: require('../assets/gifts/diamond.png'),
    burstEmojis: ['💎', '✨', '💙'],
  },
  {
    id: 'crown',
    name: 'Crown',
    emoji: '👑',
    coinCost: 250,
    diamondValue: 215,
    color: '#f59e0b',
    lottieAsset: require('../assets/lottie/crown.json'),
    imageAsset: require('../assets/gifts/crown.png'),
    burstEmojis: ['👑', '⭐', '✨'],
  },
  {
    id: 'trophy',
    name: 'Trophy',
    emoji: '🏆',
    coinCost: 500,
    diamondValue: 435,
    color: '#eab308',
    lottieAsset: require('../assets/lottie/trophy.json'),
    imageAsset: require('../assets/gifts/trophy.png'),
    burstEmojis: ['🏆', '🥇', '🎉'],
  },
  {
    id: 'chechen_tower',
    name: 'Башня',
    emoji: '🏰',
    coinCost: 750,
    diamondValue: 660,
    color: '#b45309',
    lottieAsset: require('../assets/lottie/chechen_tower.json'),
    imageAsset: require('../assets/gifts/chechen_tower.png'),
    burstEmojis: ['🏰', '🔥', '⚔️', '🗡️'],
  },
  {
    id: 'chechen_tower_premium',
    name: 'Башня Премиум',
    emoji: '🏯',
    coinCost: 2000,
    diamondValue: 1760,
    color: '#92400e',
    videoAsset: require('../assets/gifts/video3.mp4'),
    lottieAsset: require('../assets/lottie/chechen_tower_premium.json'),
    imageAsset: require('../assets/gifts/chechen_tower_premium.png'),
    burstEmojis: ['🏯', '🔥', '⚔️', '👑', '💥'],
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    emoji: '🌌',
    coinCost: 1000,
    diamondValue: 880,
    color: '#8b5cf6',
    imageAsset: require('../assets/gifts/galaxy.png'),
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


// ─── Rarity-Backfill für lokalen Katalog (vor Lookup-Build) ───────────────────
// Die echte Source-of-Truth ist die DB; dieser lokale Katalog ist der Offline-Fallback.
GIFT_CATALOG.forEach((g) => {
  if (!g.rarity) g.rarity = rarityFromCost(g.coinCost);
});

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

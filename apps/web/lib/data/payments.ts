import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Payments-Data-Layer — SSR-Reads für Coin-Shop, Billing und Wallet-Balance.
//
// Tabellen + RPCs:
//   - `coin_pricing_tiers` (public read, active=true)
//   - `web_coin_orders` — eigene Orders via RLS-Filter
//   - `coins_wallets` — Wallet-Balance (coins + diamonds)
//   - RPC `get_my_coin_order_history` — persistiert Order-Historie mit
//     Paginierung, SECURITY DEFINER, RLS-equivalent
//
// Design-Parität zu studio.ts / shop.ts:
//   1. React `cache()` für Request-Memo (dedupe parallele Reads in RSC).
//   2. Graceful-Degradation — bei RPC-Fehlern null/empty returnen statt werfen.
//   3. Keine Writes hier — Writes in `app/actions/payments.ts` als Server-Actions.
// -----------------------------------------------------------------------------

// ─── Pricing Tiers ──────────────────────────────────────────────────────────

export interface CoinPricingTier {
  id: string;
  coins: number;
  bonus_coins: number;
  price_cents: number;
  currency: string;
  badge_label: string | null;
  sort_order: number;
}

export const getCoinPricingTiers = cache(async (): Promise<CoinPricingTier[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('coin_pricing_tiers')
    .select('id, coins, bonus_coins, price_cents, currency, badge_label, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error || !data) return [];
  return data as CoinPricingTier[];
});

export const getCoinPricingTier = cache(async (id: string): Promise<CoinPricingTier | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('coin_pricing_tiers')
    .select('id, coins, bonus_coins, price_cents, currency, badge_label, sort_order')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as CoinPricingTier;
});

// ─── Wallet-Balance ─────────────────────────────────────────────────────────

export interface CoinBalance {
  coins: number;
  diamonds: number;
  totalGifted: number;
}

export const getMyCoinBalance = cache(async (): Promise<CoinBalance | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('coins_wallets')
    .select('coins, diamonds, total_gifted')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    // Kein Wallet-Row = User hat noch nie Coins besessen → null-Semantik gleich 0
    return { coins: 0, diamonds: 0, totalGifted: 0 };
  }

  return {
    coins: data.coins ?? 0,
    diamonds: data.diamonds ?? 0,
    totalGifted: data.total_gifted ?? 0,
  };
});

// ─── Order-History ──────────────────────────────────────────────────────────

export type CoinOrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export interface CoinOrder {
  id: string;
  tier_id: string;
  coins: number;
  bonus_coins: number;
  price_cents: number;
  currency: string;
  status: CoinOrderStatus;
  invoice_url: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
}

export const getMyCoinOrders = cache(
  async (limit = 50, offset = 0): Promise<CoinOrder[]> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_my_coin_order_history', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error || !data || !Array.isArray(data)) return [];
    return data as CoinOrder[];
  },
);

// ─── Lookup-Helper: einzelne Order für Success-Page ─────────────────────────

export const getMyCoinOrderById = cache(async (id: string): Promise<CoinOrder | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('web_coin_orders')
    .select(
      'id, tier_id, coins, bonus_coins, price_cents, currency, status, invoice_url, receipt_url, paid_at, created_at',
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as CoinOrder;
});

export const getMyCoinOrderBySession = cache(
  async (sessionId: string): Promise<CoinOrder | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('web_coin_orders')
      .select(
        'id, tier_id, coins, bonus_coins, price_cents, currency, status, invoice_url, receipt_url, paid_at, created_at',
      )
      .eq('stripe_session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) return null;
    return data as CoinOrder;
  },
);

// ─── Helper: Preis-Formatierung ─────────────────────────────────────────────

export function formatPrice(cents: number, currency = 'eur'): string {
  const eur = cents / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(eur);
}

export function totalCoins(tier: { coins: number; bonus_coins: number }): number {
  return tier.coins + tier.bonus_coins;
}

export function coinsPerEuro(tier: CoinPricingTier): number {
  if (tier.price_cents === 0) return 0;
  return Math.round(totalCoins(tier) / (tier.price_cents / 100));
}

// ─── Tier-Labels ────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<CoinOrderStatus, string> = {
  pending: 'Ausstehend',
  paid: 'Bezahlt',
  failed: 'Fehlgeschlagen',
  refunded: 'Erstattet',
  cancelled: 'Abgebrochen',
};

export const STATUS_TONE: Record<CoinOrderStatus, 'neutral' | 'success' | 'warn' | 'error'> = {
  pending: 'warn',
  paid: 'success',
  failed: 'error',
  refunded: 'neutral',
  cancelled: 'neutral',
};

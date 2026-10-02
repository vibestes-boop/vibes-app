import type { Product } from './useShop';
export function productDisplayPrice(p: Pick<Product, 'sale_mode' | 'price_eur' | 'price_coins' | 'sale_price_coins'>): { currency: 'coins' | 'eur'; amount: number | null } {
  if (p.sale_mode === 'cash' || p.sale_mode === 'preorder') {
    return { currency: 'eur', amount: typeof p.price_eur === 'number' && Number.isFinite(p.price_eur) && p.price_eur >= 0 ? p.price_eur : null };
  }
  const base = p.price_coins;
  const sale = p.sale_price_coins;
  return { currency: 'coins', amount: sale != null && Number.isFinite(sale) && sale >= 0 && sale < base ? sale : base };
}

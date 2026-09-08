import type { Listing } from './useListings';
import type { SoldItem } from './useSellerProfile';

export type SellerShopRow =
  | { id: string; rowType: 'listings'; cells: (Listing | null)[] }
  | { id: string; rowType: 'sold'; cells: (SoldItem | null)[] }
  | { id: string; rowType: 'shop-footer' | 'history' };

/** Mixed column counts share one vertical list; no nested, fully mounted grid. */
export function sellerShopRows(listings: Listing[], sold: SoldItem[], soldOpen: boolean): SellerShopRow[] {
  const rows: SellerShopRow[] = [];
  for (let i = 0; i < listings.length; i += 2) {
    rows.push({ id: `listing-row:${listings[i].id}`, rowType: 'listings', cells: [listings[i], listings[i + 1] ?? null] });
  }
  if (listings.length) rows.push({ id: 'shop-footer', rowType: 'shop-footer' });
  rows.push({ id: 'history', rowType: 'history' });
  if (soldOpen) {
    for (let i = 0; i < sold.length; i += 3) {
      rows.push({ id: `sold-row:${sold[i].id}`, rowType: 'sold', cells: [sold[i], sold[i + 1] ?? null, sold[i + 2] ?? null] });
    }
  }
  return rows;
}

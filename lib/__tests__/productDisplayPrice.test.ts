import { productDisplayPrice } from '../productDisplayPrice';
const product = { price_coins: 100, sale_price_coins: null };
it('shows discounted coins, including a zero-price promotion', () => {
  expect(productDisplayPrice({ ...product, sale_price_coins: 75 })).toEqual({ currency: 'coins', amount: 75 });
  expect(productDisplayPrice({ ...product, sale_price_coins: 0 }).amount).toBe(0);
});
it('does not treat a higher or invalid sale price as a discount', () => {
  for (const sale_price_coins of [-20, 120, NaN]) expect(productDisplayPrice({ ...product, sale_price_coins }).amount).toBe(100);
});
it.each(['cash', 'preorder'] as const)('uses euros for %s even when a coin value exists', sale_mode => {
  expect(productDisplayPrice({ ...product, sale_mode, price_eur: 24.5 })).toEqual({ currency: 'eur', amount: 24.5 });
  expect(productDisplayPrice({ ...product, sale_mode, price_eur: null })).toEqual({ currency: 'eur', amount: null });
});

/**
 * moneyWrappers.test.tsx — RPC-Vertrags-Tests für die Geld-Pfade.
 *
 * Testet NICHT die SQL-Logik (die lebt in den RPCs — dafür wäre pgTAP nötig),
 * sondern den *Vertrag* der TS-Wrapper: ruft der Hook den richtigen RPC mit den
 * richtig benannten Parametern auf, und mappt er die Ergebnisse korrekt?
 *
 * Genau diese Klasse fängt Drift-Bugs wie falsche RPC-/Param-Namen ab
 * (vgl. die author_id/seller_id/sold_count-Drifts, die wir gefunden haben).
 *
 * Mobile-Supabase-Mock (leichtgewichtig, chainable + thenable) — etabliert das
 * Muster für künftige Hook-Tests; bei Bedarf später nach test-utils/ extrahieren.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// -----------------------------------------------------------------------------
// Mocks — vor den SUT-Imports.
// -----------------------------------------------------------------------------
jest.mock('@/lib/supabase', () => {
  // Chainable + thenable Query-Builder-Stub (select/insert/eq/single … → self).
  const makeChain = (result: { data: unknown; error: unknown } = { data: null, error: null }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'range', 'single', 'maybeSingle', 'contains', 'not']) {
      chain[m] = jest.fn(() => chain);
    }
    (chain as { then: unknown }).then = (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb);
    return chain;
  };
  return {
    supabase: {
      rpc: jest.fn(),
      from: jest.fn(() => makeChain()),
      channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn(), send: jest.fn().mockResolvedValue('ok'), unsubscribe: jest.fn() })),
      removeChannel: jest.fn(),
    },
  };
});

jest.mock('@/lib/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 'me-1' }, profile: { id: 'me-1', username: 'me' } }),
}));

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

import { supabase } from '@/lib/supabase';
import { useBuyProduct } from '@/lib/useShop';
import { useSendGift } from '@/lib/useGifts';

const rpc = supabase.rpc as jest.Mock;

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => jest.clearAllMocks());

// -----------------------------------------------------------------------------
// useBuyProduct → RPC buy_product
// -----------------------------------------------------------------------------
describe('useBuyProduct — RPC-Vertrag', () => {
  it('ruft buy_product mit korrekten Param-Namen + Default-Menge 1', async () => {
    rpc.mockResolvedValue({ data: { success: true, order_id: 'o1', new_balance: 50 }, error: null });
    const { result } = renderHook(() => useBuyProduct(), { wrapper });

    let res: unknown;
    await act(async () => { res = await result.current.buyProduct('prod-1'); });

    expect(rpc).toHaveBeenCalledWith('buy_product', { p_product_id: 'prod-1', p_quantity: 1 });
    expect(res).toEqual({ success: true, orderId: 'o1', newBalance: 50 });
  });

  it('reicht die Menge durch', async () => {
    rpc.mockResolvedValue({ data: { success: true, order_id: 'o2', new_balance: 0 }, error: null });
    const { result } = renderHook(() => useBuyProduct(), { wrapper });

    await act(async () => { await result.current.buyProduct('prod-1', 3); });

    expect(rpc).toHaveBeenCalledWith('buy_product', { p_product_id: 'prod-1', p_quantity: 3 });
  });

  it('mappt data.error (insufficient_coins) auf success:false', async () => {
    rpc.mockResolvedValue({ data: { error: 'insufficient_coins' }, error: null });
    const { result } = renderHook(() => useBuyProduct(), { wrapper });

    let res: unknown;
    await act(async () => { res = await result.current.buyProduct('prod-1'); });

    expect(res).toEqual({ success: false, error: 'insufficient_coins' });
  });

  it('mappt RPC-Fehler auf network_error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useBuyProduct(), { wrapper });

    let res: unknown;
    await act(async () => { res = await result.current.buyProduct('prod-1'); });

    expect(res).toEqual({ success: false, error: 'network_error' });
  });
});

// -----------------------------------------------------------------------------
// useSendGift → RPC send_gift
// -----------------------------------------------------------------------------
describe('useSendGift — RPC-Vertrag', () => {
  const channelRef = { current: null } as React.MutableRefObject<null>;

  it('ruft send_gift mit korrekten Param-Namen', async () => {
    rpc.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useSendGift(), { wrapper });

    await act(async () => {
      await result.current.sendGift('recipient-9', 'session-3', 'gift-rose', channelRef);
    });

    expect(rpc).toHaveBeenCalledWith('send_gift', {
      p_recipient_id: 'recipient-9',
      p_live_session_id: 'session-3',
      p_gift_id: 'gift-rose',
    });
  });
});

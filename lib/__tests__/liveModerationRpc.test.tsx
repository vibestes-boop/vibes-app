/**
 * liveModerationRpc.test.tsx — RPC-Vertrags-Tests für die Live-Moderation.
 *
 * Sicherheitskritisch: ein falscher RPC-/Param-Name würde Moderation (Timeout,
 * Slow-Mode, Pin) STILL aushebeln. Ergänzt den Wortfilter-Test
 * (liveModerationWords) um die Enforcement-Wrapper.
 *
 * Testet den TS-Vertrag (richtige RPC + Params + Clamp), nicht die SQL-Logik.
 */
import { renderHook, act } from '@testing-library/react-native';

jest.mock('@/lib/supabase', () => {
  const makeChain = (result: { data: unknown; error: unknown } = { data: null, error: null }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'range', 'single', 'maybeSingle', 'contains', 'not']) {
      chain[m] = jest.fn(() => chain);
    }
    (chain as { then: unknown }).then = (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb);
    return chain;
  };
  const makeChannel = () => {
    const ch: Record<string, unknown> = {};
    ch.on = jest.fn(() => ch);
    ch.subscribe = jest.fn(() => ch);
    ch.send = jest.fn().mockResolvedValue('ok');
    ch.unsubscribe = jest.fn();
    return ch;
  };
  return {
    supabase: {
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      from: jest.fn(() => makeChain()),
      channel: jest.fn(() => makeChannel()),
      removeChannel: jest.fn(),
    },
  };
});

// useLiveSession.ts importiert authStore (→ AsyncStorage, in jest nicht verfügbar).
// useChatModeration/usePinComment nutzen authStore nicht — Modul wegmocken reicht.
jest.mock('@/lib/authStore', () => ({
  useAuthStore: (sel?: (s: unknown) => unknown) => {
    const state = { user: { id: 'me-1' }, profile: { id: 'me-1', username: 'me' } };
    return sel ? sel(state) : state;
  },
}));

import { supabase } from '@/lib/supabase';
import { useChatModeration, usePinComment } from '@/lib/useLiveSession';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

// -----------------------------------------------------------------------------
// useChatModeration → timeout_chat_user / untimeout_chat_user / set_live_slow_mode
// -----------------------------------------------------------------------------
describe('useChatModeration — RPC-Vertrag', () => {
  it('timeoutUser ruft timeout_chat_user mit allen Params (inkl. reason)', async () => {
    rpc.mockResolvedValue({ data: '2026-01-01T00:00:00Z', error: null });
    const { result } = renderHook(() => useChatModeration('s1'));

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.timeoutUser('u9', 60, 'spam'); });

    expect(rpc).toHaveBeenCalledWith('timeout_chat_user', {
      p_session_id: 's1', p_user_id: 'u9', p_seconds: 60, p_reason: 'spam',
    });
    expect(ok).toBe(true);
  });

  it('timeoutUser ohne reason → p_reason: null', async () => {
    const { result } = renderHook(() => useChatModeration('s1'));
    await act(async () => { await result.current.timeoutUser('u9', 30); });
    expect(rpc).toHaveBeenCalledWith('timeout_chat_user',
      expect.objectContaining({ p_user_id: 'u9', p_seconds: 30, p_reason: null }));
  });

  it('untimeoutUser ruft untimeout_chat_user mit session+user', async () => {
    const { result } = renderHook(() => useChatModeration('s1'));
    await act(async () => { await result.current.untimeoutUser('u9'); });
    expect(rpc).toHaveBeenCalledWith('untimeout_chat_user', { p_session_id: 's1', p_user_id: 'u9' });
  });

  it('setSlowMode ruft set_live_slow_mode', async () => {
    const { result } = renderHook(() => useChatModeration('s1'));
    await act(async () => { await result.current.setSlowMode(30); });
    expect(rpc).toHaveBeenCalledWith('set_live_slow_mode', { p_session_id: 's1', p_seconds: 30 });
  });

  it('setSlowMode CLAMPT auf 0..300 + floor (Abuse-Schutz)', async () => {
    const { result } = renderHook(() => useChatModeration('s1'));
    await act(async () => { await result.current.setSlowMode(999); });
    await act(async () => { await result.current.setSlowMode(-5); });
    await act(async () => { await result.current.setSlowMode(45.7); });

    const seconds = rpc.mock.calls
      .filter((c) => c[0] === 'set_live_slow_mode')
      .map((c) => c[1].p_seconds);
    expect(seconds).toEqual([300, 0, 45]);
  });

  it('ohne sessionId: kein RPC, returns false', async () => {
    const { result } = renderHook(() => useChatModeration(null));
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.timeoutUser('u9', 60); });
    expect(ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// usePinComment → pin_live_comment / unpin_live_comment
// -----------------------------------------------------------------------------
describe('usePinComment — RPC-Vertrag', () => {
  const comment = { id: 'c1', username: 'u', text: 'hi' } as unknown as Parameters<
    ReturnType<typeof usePinComment>['pinComment']
  >[0];

  it('pinComment(comment) ruft pin_live_comment mit session+comment', async () => {
    const { result } = renderHook(() => usePinComment('s1'));
    await act(async () => { await result.current.pinComment(comment); });
    expect(rpc).toHaveBeenCalledWith('pin_live_comment',
      expect.objectContaining({ p_session_id: 's1' }));
    expect(rpc.mock.calls.find((c) => c[0] === 'pin_live_comment')).toBeTruthy();
  });

  it('pinComment(null) ruft unpin_live_comment', async () => {
    const { result } = renderHook(() => usePinComment('s1'));
    await act(async () => { await result.current.pinComment(null); });
    expect(rpc).toHaveBeenCalledWith('unpin_live_comment', { p_session_id: 's1' });
  });
});

/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Minimaler Supabase-Broadcast-Mock. Die Kette sieht in Echt so aus:
//   createBrowserClient(…).channel(`live:${id}`).on('broadcast', …).subscribe()
// Der Hook registriert EIN Listener-Objekt auf `broadcast`/`reaction`. Unser
// Mock captured das und stellt `emit(payload)` bereit, um incoming Reactions
// zu simulieren. `removeChannel` wird für die Cleanup-Assertion getrackt.
// -----------------------------------------------------------------------------

let mockEmit: ((payload: unknown) => void) | null = null;
let mockRemoveChannelCalls = 0;
let mockSubscribeCalls = 0;

interface MockChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
}

jest.mock('@supabase/ssr', () => ({
  createBrowserClient: jest.fn(() => {
    const channel: MockChannel = {
      on: jest.fn(
        (_eventType: string, _filter: unknown, handler: (arg: { payload: unknown }) => void) => {
          mockEmit = (payload) => handler({ payload });
          return channel;
        },
      ),
      subscribe: jest.fn(() => {
        mockSubscribeCalls++;
        return channel;
      }),
    };
    return {
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(() => {
        mockRemoveChannelCalls++;
      }),
    };
  }),
}));

import { useRemoteReactions } from '../use-remote-reactions';

beforeEach(() => {
  mockEmit = null;
  mockRemoveChannelCalls = 0;
  mockSubscribeCalls = 0;
});

describe('useRemoteReactions', () => {
  it('subscribes on mount and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );
    expect(mockSubscribeCalls).toBe(1);
    expect(mockRemoveChannelCalls).toBe(0);
    unmount();
    expect(mockRemoveChannelCalls).toBe(1);
  });

  it('emits burst for remote reaction from a different user', () => {
    const { result } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );
    expect(result.current.burst).toBeNull();

    act(() => {
      mockEmit?.({ reaction: 'fire', user_id: 'viewer-b', ts: Date.now() });
    });

    expect(result.current.burst).not.toBeNull();
    expect(result.current.burst?.key).toBe('fire');
    expect(typeof result.current.burst?.id).toBe('number');
  });

  it('filters self-echo (payload.user_id === viewerId)', () => {
    const { result } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );

    act(() => {
      mockEmit?.({ reaction: 'heart', user_id: 'viewer-a', ts: Date.now() });
    });

    expect(result.current.burst).toBeNull();
  });

  it('filters invalid reaction keys', () => {
    const { result } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );

    act(() => {
      mockEmit?.({ reaction: 'rocket', user_id: 'viewer-b', ts: Date.now() });
    });
    expect(result.current.burst).toBeNull();

    act(() => {
      mockEmit?.({ reaction: '', user_id: 'viewer-b', ts: Date.now() });
    });
    expect(result.current.burst).toBeNull();

    act(() => {
      mockEmit?.(null);
    });
    expect(result.current.burst).toBeNull();
  });

  it('generates unique ids for concurrent remote bursts', () => {
    const { result } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );

    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      act(() => {
        mockEmit?.({ reaction: 'clap', user_id: `viewer-${i}`, ts: Date.now() });
      });
      if (result.current.burst) seen.add(result.current.burst.id);
    }
    // Alle 20 Bursts sollten unique IDs haben — sonst würde React mehrere
    // Floater mit gleichem key verwerfen.
    expect(seen.size).toBe(20);
  });

  it('skips subscription when enabled=false', () => {
    renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a', enabled: false }),
    );
    expect(mockSubscribeCalls).toBe(0);
  });

  it('passes through all 6 allowed reaction keys', () => {
    const { result } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );
    const keys = ['heart', 'fire', 'clap', 'laugh', 'wow', 'sad'] as const;
    for (const key of keys) {
      act(() => {
        mockEmit?.({ reaction: key, user_id: 'viewer-b', ts: Date.now() });
      });
      expect(result.current.burst?.key).toBe(key);
    }
  });
});

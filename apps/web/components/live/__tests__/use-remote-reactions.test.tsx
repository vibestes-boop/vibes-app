/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Minimaler Supabase-Broadcast-Mock. Die Kette sieht in Echt so aus:
//   createBrowserClient(…).channel(`live-reactions-${id}`).on('broadcast', …).subscribe()
// Der Hook registriert EIN Listener-Objekt auf `broadcast`/`new-reaction`
// (App-Vertrag, Payload { id, user_id, emoji } — Cross-Platform-Brücke aus
// lib/live-reactions.ts). Unser Mock captured das und stellt `emit(payload)`
// bereit, um incoming Reactions zu simulieren. `removeChannel` wird für die
// Cleanup-Assertion getrackt.
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
import { REACTION_KEY_TO_EMOJI } from '@/lib/live-reactions';

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
      mockEmit?.({ id: 'r-1', user_id: 'viewer-b', emoji: '🔥' });
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
      mockEmit?.({ id: 'r-2', user_id: 'viewer-a', emoji: '❤️' });
    });

    expect(result.current.burst).toBeNull();
  });

  it('filters payloads without emoji', () => {
    const { result } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );

    act(() => {
      mockEmit?.({ id: 'r-3', user_id: 'viewer-b' });
    });
    expect(result.current.burst).toBeNull();

    act(() => {
      mockEmit?.({ id: 'r-4', user_id: 'viewer-b', emoji: '' });
    });
    expect(result.current.burst).toBeNull();

    act(() => {
      mockEmit?.(null);
    });
    expect(result.current.burst).toBeNull();
  });

  it('maps unknown emojis defensively to heart', () => {
    // Der App-Vertrag ist emoji-basiert — schickt ein zukünftiger App-Build
    // ein Emoji außerhalb des Mappings, fällt reactionEmojiToKey auf 'heart'
    // zurück statt die Reaction zu droppen.
    const { result } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );

    act(() => {
      mockEmit?.({ id: 'r-5', user_id: 'viewer-b', emoji: '🚀' });
    });
    expect(result.current.burst?.key).toBe('heart');
  });

  it('generates unique ids for concurrent remote bursts', () => {
    const { result } = renderHook(() =>
      useRemoteReactions({ sessionId: 'sess-1', viewerId: 'viewer-a' }),
    );

    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      act(() => {
        mockEmit?.({ id: `r-${i}`, user_id: `viewer-${i}`, emoji: '👏' });
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
        mockEmit?.({ id: `r-${key}`, user_id: 'viewer-b', emoji: REACTION_KEY_TO_EMOJI[key] });
      });
      expect(result.current.burst?.key).toBe(key);
    }
  });
});

/**
 * @jest-environment jsdom
 */

import { act, render, renderHook } from '@testing-library/react';
import {
  FeedInteractionProvider,
  useFeedInteraction,
} from '../feed-interaction-context';

// -----------------------------------------------------------------------------
// FeedInteractionContext — v1.w.UI.11 Phase C — zentraler State für
// Kommentar-Open/Close aus FeedCard heraus. Fixiert:
//  - no-op-Fallback wenn Hook ohne Provider aufgerufen wird (damit
//    FeedCard isoliert testbar bleibt)
//  - openCommentsFor setzt die Post-ID
//  - closeComments resettet auf null
//  - Mehrfach-Open wechselt das Target korrekt
// -----------------------------------------------------------------------------

describe('FeedInteractionContext', () => {
  it('ohne Provider liefert der Hook einen no-op-Fallback', () => {
    const { result } = renderHook(() => useFeedInteraction());
    expect(result.current.commentsOpenForPostId).toBeNull();

    // no-op-Calls dürfen NICHT werfen
    expect(() => {
      result.current.openCommentsFor('post-1');
      result.current.closeComments();
    }).not.toThrow();

    // State bleibt null, weil no-op
    expect(result.current.commentsOpenForPostId).toBeNull();
  });

  it('openCommentsFor setzt die Post-ID und closeComments resettet', () => {
    const { result } = renderHook(() => useFeedInteraction(), {
      wrapper: FeedInteractionProvider,
    });

    expect(result.current.commentsOpenForPostId).toBeNull();

    act(() => {
      result.current.openCommentsFor('post-42');
    });
    expect(result.current.commentsOpenForPostId).toBe('post-42');

    act(() => {
      result.current.closeComments();
    });
    expect(result.current.commentsOpenForPostId).toBeNull();
  });

  it('Mehrfach-Open wechselt die Target-Post-ID', () => {
    const { result } = renderHook(() => useFeedInteraction(), {
      wrapper: FeedInteractionProvider,
    });

    act(() => {
      result.current.openCommentsFor('post-a');
    });
    expect(result.current.commentsOpenForPostId).toBe('post-a');

    act(() => {
      result.current.openCommentsFor('post-b');
    });
    expect(result.current.commentsOpenForPostId).toBe('post-b');
  });

  it('Provider-Subtree konsumiert denselben State', () => {
    // Two hook instances inside the same provider should share state.
    // A provider-free render would give each hook its own no-op fallback.
    const Consumer = ({ label }: { label: string }) => {
      const { commentsOpenForPostId, openCommentsFor } = useFeedInteraction();
      return (
        <div>
          <span data-testid={`${label}-id`}>{commentsOpenForPostId ?? 'null'}</span>
          <button type="button" onClick={() => openCommentsFor(`from-${label}`)}>
            open from {label}
          </button>
        </div>
      );
    };

    const { getByTestId, getByText } = render(
      <FeedInteractionProvider>
        <Consumer label="a" />
        <Consumer label="b" />
      </FeedInteractionProvider>,
    );

    expect(getByTestId('a-id').textContent).toBe('null');
    expect(getByTestId('b-id').textContent).toBe('null');

    act(() => {
      getByText('open from a').click();
    });

    // Both consumers should now read the same updated state
    expect(getByTestId('a-id').textContent).toBe('from-a');
    expect(getByTestId('b-id').textContent).toBe('from-a');
  });
});

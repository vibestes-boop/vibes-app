/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FollowedAccountsSection } from '../followed-accounts-section';
import type { FollowedAccount } from '@/lib/data/feed';

// -----------------------------------------------------------------------------
// FollowedAccountsSection — v1.w.UI.11 Phase B (TikTok-Parity Sidebar-Section
// „Konten, denen ich folge"). Tests fixieren:
//   - Top-N Rows werden gerendert (Name, @username, Verified-Badge wenn gesetzt)
//   - Empty-State zeigt Explore-CTA, keine Row
//   - „Alle anzeigen" erscheint nur wenn initial.length >= revealAllThreshold
//   - Sheet öffnet + fetcht beim ersten Open
// -----------------------------------------------------------------------------

// Radix-Dialog hat ReadableStream/ResizeObserver-Abhängigkeiten die JSDOM
// nicht nativ bringt. Wir stubben die Portal-Variante auf eine plain-div-
// Implementierung, sodass der Sheet-Inhalt synchron im Test-DOM rendert.
jest.mock('@radix-ui/react-dialog', () => {
  const React = require('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Root: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <div data-testid="sheet-root" data-open={open}>
        {React.Children.map(children, (child: React.ReactNode) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement, { __open: open, __onOpenChange: onOpenChange })
            : child,
        )}
      </div>
    ),
    Trigger: Passthrough,
    Close: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Portal: Passthrough,
    Overlay: Passthrough,
    Content: ({
      children,
      __open,
    }: {
      children?: React.ReactNode;
      __open?: boolean;
    }) => (__open ? <div data-testid="sheet-content">{children}</div> : null),
    Title: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
    Description: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  };
});

const makeAccount = (i: number, overrides?: Partial<FollowedAccount>): FollowedAccount => ({
  id: `user-${i}`,
  username: `user${i}`,
  display_name: `User ${i}`,
  avatar_url: null,
  verified: false,
  ...overrides,
});

// `Response` existiert in jsdom 20.x (was jest-environment-jsdom 29 nutzt) NICHT
// als globales Symbol — anders als in Node 20+. Damit würden `new Response(…)`
// Konstruktor-Aufrufe im Fetch-Mock silent mit `ReferenceError` crashen, von
// `try/catch` im Component geschluckt, und der Test würde im Error-State
// hängen statt die gefetchten Accounts zu rendern. Wir bauen deshalb ein
// minimales Response-Shim, das genau die zwei Felder liefert, die
// `FollowedAccountsSheet` konsumiert: `ok` + `json()`.
const makeOkResponse = <T,>(body: T): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as Response;

describe('FollowedAccountsSection', () => {
  beforeEach(() => {
    // `fetch` ist in JSDOM nicht nativ — pro Test frisch stubben.
    (global as unknown as { fetch?: typeof fetch }).fetch = jest.fn(async () =>
      makeOkResponse<unknown[]>([]),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('rendert bis zu 5 Rows mit Username + Display-Name', () => {
    const accounts = [makeAccount(1), makeAccount(2, { verified: true }), makeAccount(3)];
    render(<FollowedAccountsSection initial={accounts} />);

    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('@user1')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
    expect(screen.getByText('User 3')).toBeInTheDocument();
  });

  it('zeigt Verified-Badge nur bei verifizierten Accounts', () => {
    const accounts = [makeAccount(1, { verified: true }), makeAccount(2, { verified: false })];
    render(<FollowedAccountsSection initial={accounts} />);

    const badges = screen.getAllByLabelText('Verifiziert');
    expect(badges).toHaveLength(1);
  });

  it('zeigt Explore-CTA im Empty-State und keine Account-Rows', () => {
    render(<FollowedAccountsSection initial={[]} />);

    expect(screen.getByText('Accounts entdecken')).toBeInTheDocument();
    expect(screen.queryByText(/^@user/)).not.toBeInTheDocument();
  });

  it('zeigt „Alle anzeigen" nur wenn initial.length >= threshold', () => {
    const { rerender } = render(<FollowedAccountsSection initial={[makeAccount(1)]} />);
    expect(screen.queryByText('Alle anzeigen')).not.toBeInTheDocument();

    rerender(
      <FollowedAccountsSection
        initial={[makeAccount(1), makeAccount(2), makeAccount(3), makeAccount(4), makeAccount(5)]}
      />,
    );
    expect(screen.getByText('Alle anzeigen')).toBeInTheDocument();
  });

  it('fetcht /api/follows/me beim ersten Open des Sheets', async () => {
    const full = [
      makeAccount(10),
      makeAccount(11),
      makeAccount(12, { verified: true }),
    ];
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () =>
      makeOkResponse<FollowedAccount[]>(full),
    );

    const initial = [makeAccount(1), makeAccount(2), makeAccount(3), makeAccount(4), makeAccount(5)];
    render(<FollowedAccountsSection initial={initial} />);

    fireEvent.click(screen.getByText('Alle anzeigen'));

    await waitFor(() => {
      expect(
        (global as unknown as { fetch: jest.Mock }).fetch,
      ).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/follows\/me\?limit=100&offset=0$/),
        expect.any(Object),
      );
    });

    // Nach dem ersten Chunk-Load werden die vollen 3 Accounts im Sheet gerendert.
    await waitFor(() => {
      expect(screen.getAllByText('User 10')).toBeTruthy();
    });
  });
});

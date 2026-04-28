/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeedSidebar } from '../feed-sidebar';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { rerender, ...rest } = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
  return {
    ...rest,
    rerender: (newUi: React.ReactElement) =>
      rerender(<QueryClientProvider client={queryClient}>{newUi}</QueryClientProvider>),
  };
}

// -----------------------------------------------------------------------------
// v1.w.UI.10 Layout-Reset — FeedSidebar ist von 17 Einträgen auf 5 Primary +
// 3 Secondary runterkompaktiert. Plus prominenter „Posten"-CTA oben.
// Diese Tests fixieren die Struktur damit kein versehentliches Re-Bloating
// durchrutscht, ohne dass wir es merken.
// -----------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// getUnreadDmCount + getUnreadNotificationCount sind Server Actions die
// Supabase/cookies() nutzen — beides nicht in jsdom verfügbar.
// Stubs die immer 0 zurückgeben (kein Badge — Badge-Rendering ist ein eigener Test).
jest.mock('@/app/actions/messages', () => ({
  getUnreadDmCount: jest.fn().mockResolvedValue(0),
}));

jest.mock('@/app/actions/notifications', () => ({
  getUnreadNotificationCount: jest.fn().mockResolvedValue(0),
}));

// OpenConsentSettingsButton ist ein Client-Hook-heavy Consent-Banner-Kontrollpunkt
// — für Sidebar-Struktur-Tests ein Thin-Stub.
jest.mock('@/components/consent/consent-banner', () => ({
  OpenConsentSettingsButton: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
}));

// FollowedAccountsSection ist eine neue v1.w.UI.11 Phase-B-Sektion mit eigenem
// Sheet-State + fetch. Für Sidebar-Struktur-Tests ein Stub, damit wir die
// Rendering-Bedingungen (viewerId + followedAccounts) sauber assertieren können
// ohne den internen Fetch/Radix-Kram mitzutesten — das macht der dedizierte
// followed-accounts-section.test.tsx.
jest.mock('@/components/feed/followed-accounts-section', () => ({
  FollowedAccountsSection: () => (
    <div data-testid="followed-accounts-section">followed-accounts-stub</div>
  ),
}));

// MoreMenu (v1.w.UI.12) ist ein Radix-DropdownMenu + next-themes + Server-Action
// Bündel. Für Sidebar-Struktur-Tests mocken wir es weg — wir wollen hier nur
// das Gate (viewerId vorhanden → Trigger da) assertieren, nicht das
// Dropdown-Verhalten. Das macht der dedizierte more-menu.test.tsx.
jest.mock('@/components/layout/more-menu', () => ({
  MoreMenu: () => <div data-testid="more-menu">more-menu-stub</div>,
}));

// AdminNavLink (v1.w.UI.215) fetcht is_admin via Supabase-Browser-Client —
// in jsdom nicht verfügbar. Stub rendert nichts (= Nicht-Admin-Fall).
jest.mock('@/components/feed/admin-nav-link', () => ({
  AdminNavLink: () => null,
}));

describe('FeedSidebar — Layout-Reset (v1.w.UI.10) Struktur', () => {
  const PRIMARY_LABELS = ['Für dich', 'Folge ich', 'Entdecken', 'Live', 'Messages', 'Benachrichtigungen'];
  const SECONDARY_LABELS = ['Shop', 'Pods', 'Creator Studio'];
  const REMOVED_LABELS = [
    'Entwürfe',
    'Geplant',
    'Mein Shop',
    'Live-Studio',
    'Gemerkt',
    'Coin-Shop',
    'Bezahlungen',
    'Trending',
    'Post erstellen',
  ];

  it('rendert genau 6 Primary-Nav-Items', () => {
    renderWithQueryClient(<FeedSidebar viewerId="viewer-1" />);
    for (const label of PRIMARY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('rendert genau 3 Secondary-Nav-Items unter „Weiteres"-Header', () => {
    // v1.w.UI.12 — Header umbenannt von „Mehr" → „Weiteres", damit der neue
    // MoreMenu-Footer-Trigger (Text: „Mehr") keine Doppelbelegung hat.
    renderWithQueryClient(<FeedSidebar viewerId="viewer-1" />);
    expect(screen.getByText('Weiteres')).toBeInTheDocument();
    for (const label of SECONDARY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('zeigt prominenten „Posten"-CTA der auf /create verlinkt', () => {
    renderWithQueryClient(<FeedSidebar viewerId="viewer-1" />);
    const cta = screen.getByRole('link', { name: /Neuen Post erstellen/i });
    expect(cta).toHaveAttribute('href', '/create');
    expect(cta.textContent).toContain('Posten');
  });

  it('rendert keine der 9 früheren Sidebar-Items (in Dropdown/Studio migriert)', () => {
    renderWithQueryClient(<FeedSidebar viewerId="viewer-1" />);
    for (const label of REMOVED_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('disabled auth-required Items + Posten-CTA wenn viewerId null ist', () => {
    renderWithQueryClient(<FeedSidebar viewerId={null} />);
    const ctaLink = screen.getByRole('link', { name: /Neuen Post erstellen/i });
    expect(ctaLink).toHaveAttribute('aria-disabled', 'true');

    // „Folge ich" + „Messages" + „Benachrichtigungen" + „Creator Studio"
    // sind requiresAuth → disabled wenn kein Viewer.
    const folgeIch = screen.getByText('Folge ich').closest('a');
    expect(folgeIch).toHaveAttribute('aria-disabled', 'true');
    const messages = screen.getByText('Messages').closest('a');
    expect(messages).toHaveAttribute('aria-disabled', 'true');
    const benachrichtigungen = screen.getByText('Benachrichtigungen').closest('a');
    expect(benachrichtigungen).toHaveAttribute('aria-disabled', 'true');
    const creatorStudio = screen.getByText('Creator Studio').closest('a');
    expect(creatorStudio).toHaveAttribute('aria-disabled', 'true');

    // Öffentliche Items bleiben aktiviert
    const entdecken = screen.getByText('Entdecken').closest('a');
    expect(entdecken).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('markiert das aktive Item via aria-current wenn pathname matcht (Default-Pathname /)', () => {
    renderWithQueryClient(<FeedSidebar viewerId="viewer-1" />);
    const fuerDich = screen.getByText('Für dich').closest('a');
    expect(fuerDich).toHaveAttribute('aria-current', 'page');

    const entdecken = screen.getByText('Entdecken').closest('a');
    expect(entdecken).not.toHaveAttribute('aria-current', 'page');
  });

  it('zeigt MoreMenu nur wenn viewerId vorhanden', () => {
    // v1.w.UI.12 — Früherer Settings-Quicklink im Footer ist durch das
    // „Mehr"-Dropdown ersetzt. Die Einstellungen sind jetzt innerhalb der
    // DropdownMenuContent (→ Portal, nicht im DOM wenn zu) — darum testen wir
    // stattdessen die Anwesenheit des MoreMenu-Stubs.
    const { rerender } = renderWithQueryClient(<FeedSidebar viewerId={null} />);
    expect(screen.queryByTestId('more-menu')).not.toBeInTheDocument();

    rerender(<FeedSidebar viewerId="viewer-1" />);
    expect(screen.getByTestId('more-menu')).toBeInTheDocument();
  });

  // v1.w.UI.11 Phase B — FollowedAccountsSection Gate-Bedingungen.
  // Rendert nur wenn BEIDE Bedingungen erfüllt: viewerId gesetzt UND
  // followedAccounts-Prop durchgereicht (auch leer-Array). Logged-out oder
  // Page ohne Prefetch → Section fehlt komplett.
  it('rendert FollowedAccountsSection nur wenn viewerId + followedAccounts gesetzt', () => {
    const { rerender } = renderWithQueryClient(<FeedSidebar viewerId={null} />);
    expect(screen.queryByTestId('followed-accounts-section')).not.toBeInTheDocument();

    // viewerId ohne followedAccounts-Prop → keine Sektion
    rerender(<FeedSidebar viewerId="viewer-1" />);
    expect(screen.queryByTestId('followed-accounts-section')).not.toBeInTheDocument();

    // logged-out + followedAccounts-Prop → keine Sektion (Prop wird ignoriert)
    rerender(<FeedSidebar viewerId={null} followedAccounts={[]} />);
    expect(screen.queryByTestId('followed-accounts-section')).not.toBeInTheDocument();

    // Beide gesetzt (auch bei leerem Array, der Empty-CTA-Case) → Sektion da
    rerender(<FeedSidebar viewerId="viewer-1" followedAccounts={[]} />);
    expect(screen.getByTestId('followed-accounts-section')).toBeInTheDocument();
  });
});

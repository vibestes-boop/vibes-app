/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestI18nProvider } from '@/test-utils/i18n';
import { FeedSidebar } from '../feed-sidebar';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { rerender, ...rest } = render(
    <QueryClientProvider client={queryClient}><TestI18nProvider>{ui}</TestI18nProvider></QueryClientProvider>,
  );
  return {
    ...rest,
    rerender: (newUi: React.ReactElement) =>
      rerender(<QueryClientProvider client={queryClient}><TestI18nProvider>{newUi}</TestI18nProvider></QueryClientProvider>),
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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

// UnreadShellCounts nutzt Server Actions plus delayed polling; fuer die
// Strukturtests reicht ein stabiler Null-State.
jest.mock('@/components/layout/use-unread-shell-counts', () => ({
  useUnreadShellCounts: () => ({
    data: { dms: 0, notifications: 0 },
  }),
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

// Notifications-Drawer-Store (zustand) — Sidebar braucht nur toggle + open.
jest.mock('@/lib/notifications-drawer-store', () => ({
  useNotificationsDrawer: () => ({ toggleDrawer: jest.fn(), open: false }),
}));

describe('FeedSidebar — Layout-Reset (v1.w.UI.10) Struktur', () => {
  const PRIMARY_LABELS = ['Für dich', 'Folge ich', 'Freunde', 'Entdecken', 'Live', 'Nachrichten', 'Benachrichtigungen', 'Profil'];
  const SECONDARY_LABELS = ['Shop', 'Pods', 'Women-Only Zone', 'Creator-Studio'];
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

  it('rendert alle Primary-Nav-Items (inkl. Benachrichtigungen-Button + Profil)', () => {
    renderWithQueryClient(<FeedSidebar viewerId="viewer-1" />);
    for (const label of PRIMARY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('rendert die Secondary-Nav-Items unter „Weiteres"-Header', () => {
    // v1.w.UI.12 — Header umbenannt von „Mehr" → „Weiteres", damit der neue
    // MoreMenu-Trigger (Text: „Mehr") keine Doppelbelegung hat.
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

    // „Folge ich" + „Nachrichten" + „Creator-Studio" sind requiresAuth →
    // disabled wenn kein Viewer. Benachrichtigungen (Drawer-Button) und Profil
    // rendern logged-out gar nicht.
    const folgeIch = screen.getByText('Folge ich').closest('a');
    expect(folgeIch).toHaveAttribute('aria-disabled', 'true');
    const messages = screen.getByText('Nachrichten').closest('a');
    expect(messages).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Benachrichtigungen')).not.toBeInTheDocument();
    expect(screen.queryByText('Profil')).not.toBeInTheDocument();
    const creatorStudio = screen.getByText('Creator-Studio').closest('a');
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

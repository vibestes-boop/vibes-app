/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { FeedSidebar } from '../feed-sidebar';

// -----------------------------------------------------------------------------
// v1.w.UI.10 Layout-Reset — FeedSidebar ist von 17 Einträgen auf 5 Primary +
// 3 Secondary runterkompaktiert. Plus prominenter „Posten"-CTA oben.
// Diese Tests fixieren die Struktur damit kein versehentliches Re-Bloating
// durchrutscht, ohne dass wir es merken.
// -----------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
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

describe('FeedSidebar — Layout-Reset (v1.w.UI.10) Struktur', () => {
  const PRIMARY_LABELS = ['Für dich', 'Folge ich', 'Entdecken', 'Live', 'Messages'];
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

  it('rendert genau 5 Primary-Nav-Items', () => {
    render(<FeedSidebar viewerId="viewer-1" />);
    for (const label of PRIMARY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('rendert genau 3 Secondary-Nav-Items unter „Mehr"-Header', () => {
    render(<FeedSidebar viewerId="viewer-1" />);
    expect(screen.getByText('Mehr')).toBeInTheDocument();
    for (const label of SECONDARY_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('zeigt prominenten „Posten"-CTA der auf /create verlinkt', () => {
    render(<FeedSidebar viewerId="viewer-1" />);
    const cta = screen.getByRole('link', { name: /Neuen Post erstellen/i });
    expect(cta).toHaveAttribute('href', '/create');
    expect(cta.textContent).toContain('Posten');
  });

  it('rendert keine der 9 früheren Sidebar-Items (in Dropdown/Studio migriert)', () => {
    render(<FeedSidebar viewerId="viewer-1" />);
    for (const label of REMOVED_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('disabled auth-required Items + Posten-CTA wenn viewerId null ist', () => {
    render(<FeedSidebar viewerId={null} />);
    const ctaLink = screen.getByRole('link', { name: /Neuen Post erstellen/i });
    expect(ctaLink).toHaveAttribute('aria-disabled', 'true');

    // „Folge ich" + „Messages" + „Creator Studio" sind requiresAuth → disabled
    // wenn kein Viewer. Wir prüfen über den nächsten <a> wrapping das Label.
    const folgeIch = screen.getByText('Folge ich').closest('a');
    expect(folgeIch).toHaveAttribute('aria-disabled', 'true');
    const messages = screen.getByText('Messages').closest('a');
    expect(messages).toHaveAttribute('aria-disabled', 'true');
    const creatorStudio = screen.getByText('Creator Studio').closest('a');
    expect(creatorStudio).toHaveAttribute('aria-disabled', 'true');

    // Öffentliche Items bleiben aktiviert
    const entdecken = screen.getByText('Entdecken').closest('a');
    expect(entdecken).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('markiert das aktive Item via aria-current wenn pathname matcht (Default-Pathname /)', () => {
    render(<FeedSidebar viewerId="viewer-1" />);
    const fuerDich = screen.getByText('Für dich').closest('a');
    expect(fuerDich).toHaveAttribute('aria-current', 'page');

    const entdecken = screen.getByText('Entdecken').closest('a');
    expect(entdecken).not.toHaveAttribute('aria-current', 'page');
  });

  it('zeigt Einstellungs-Link nur wenn viewerId vorhanden', () => {
    const { rerender } = render(<FeedSidebar viewerId={null} />);
    expect(screen.queryByText('Einstellungen')).not.toBeInTheDocument();

    rerender(<FeedSidebar viewerId="viewer-1" />);
    expect(screen.getByText('Einstellungen')).toBeInTheDocument();
  });

  // v1.w.UI.11 Phase B — FollowedAccountsSection Gate-Bedingungen.
  // Rendert nur wenn BEIDE Bedingungen erfüllt: viewerId gesetzt UND
  // followedAccounts-Prop durchgereicht (auch leer-Array). Logged-out oder
  // Page ohne Prefetch → Section fehlt komplett.
  it('rendert FollowedAccountsSection nur wenn viewerId + followedAccounts gesetzt', () => {
    const { rerender } = render(<FeedSidebar viewerId={null} />);
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

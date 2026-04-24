/**
 * @jest-environment jsdom
 *
 * Unit-Tests für `components/profile/live-ring-avatar.tsx` (v1.w.UI.16).
 *
 * Scope:
 *   - Non-live Zustand rendert den klassischen Avatar mit `ring-4
 *     ring-background` und KEIN LIVE-Badge / Gradient-Ring
 *   - Live-Zustand ohne `liveHref` rendert Gradient-Ring + LIVE-Badge
 *     (kein Link-Wrapper)
 *   - Live-Zustand MIT `liveHref` wrappt den Avatar in ein `<a>`-Element
 *     mit `aria-label` (Next.js Link renderted final zu <a>)
 *   - LIVE-Badge-Text akzeptiert Locale-Override (`liveBadgeLabel`)
 *
 * Die Tests greifen auf DOM-Struktur + Klassen zu (Regression-Schutz gegen
 * versehentliche Entfernung der Gradient-Klassen) und auf ARIA-Attribute
 * (damit Screen-Reader den Live-Status korrekt ansagen).
 */

import { render, screen } from '@testing-library/react';
import { LiveRingAvatar } from '../live-ring-avatar';

// Radix Avatar versucht beim Mount, das Image zu laden. jsdom ohne echten
// Network-Stack liefert `onError`, und AvatarImage unmountet sich selbst →
// Fallback wird sichtbar. Das passt exakt für unsere Tests (wir prüfen
// Fallback-Initial-Text bei fehlendem src).

describe('LiveRingAvatar — non-live', () => {
  it('rendert klassischen Avatar mit ring-4 ring-background', () => {
    const { container } = render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={false}
        sizeClassName="h-24 w-24"
      />,
    );
    // Radix Avatar Root trägt unsere sizeClassName + ring-4 ring-background
    const root = container.querySelector('[class*="h-24"]');
    expect(root).not.toBeNull();
    expect(root?.className).toContain('ring-4');
    expect(root?.className).toContain('ring-background');
    // Kein Gradient-Ring, kein LIVE-Badge
    expect(container.querySelector('[class*="from-pink-500"]')).toBeNull();
    expect(screen.queryByText('LIVE')).toBeNull();
  });

  it('zeigt Fallback-Initialen wenn src fehlt', () => {
    render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={false}
        sizeClassName="h-24 w-24"
      />,
    );
    expect(screen.getByText('ZA')).toBeInTheDocument();
  });
});

describe('LiveRingAvatar — live, ohne liveHref', () => {
  it('rendert Gradient-Ring + LIVE-Badge ohne Link-Wrapper', () => {
    const { container } = render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={true}
        sizeClassName="h-24 w-24"
      />,
    );
    // Gradient-Ring als äußerer Wrapper
    const ring = container.querySelector('[class*="from-pink-500"]');
    expect(ring).not.toBeNull();
    expect(ring?.className).toContain('bg-gradient-to-tr');
    expect(ring?.className).toContain('via-red-500');
    expect(ring?.className).toContain('to-amber-400');
    expect(ring?.className).toContain('rounded-full');
    // LIVE-Badge sichtbar (default-Label)
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    // Kein Link-Wrapper wenn liveHref fehlt
    expect(container.querySelector('a')).toBeNull();
  });

  it('LIVE-Badge ist aria-hidden (Text-Duplikat verhindern)', () => {
    render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={true}
        sizeClassName="h-24 w-24"
      />,
    );
    const badge = screen.getByText('LIVE');
    expect(badge.getAttribute('aria-hidden')).toBe('true');
  });

  it('akzeptiert Locale-Override für den LIVE-Badge-Text', () => {
    render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={true}
        sizeClassName="h-24 w-24"
        liveBadgeLabel="ЛАЙВ"
      />,
    );
    expect(screen.getByText('ЛАЙВ')).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).toBeNull();
  });
});

describe('LiveRingAvatar — live, mit liveHref', () => {
  it('wrappt den Avatar in einen <a> mit href + aria-label', () => {
    const { container } = render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={true}
        liveHref="/live/abc-123"
        sizeClassName="h-24 w-24"
        liveLinkLabel="Zaur ist live — jetzt reinschauen"
      />,
    );
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/live/abc-123');
    expect(link?.getAttribute('aria-label')).toBe('Zaur ist live — jetzt reinschauen');
    // Gradient-Ring ist Kind des Links
    expect(link?.querySelector('[class*="from-pink-500"]')).not.toBeNull();
  });

  it('fällt auf generischen aria-label zurück wenn liveLinkLabel fehlt', () => {
    const { container } = render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={true}
        liveHref="/live/abc-123"
        sizeClassName="h-24 w-24"
      />,
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('aria-label')).toBe('Zaur — Live ansehen');
  });
});

describe('LiveRingAvatar — ringThickness', () => {
  it('default (md) nutzt p-[3px]', () => {
    const { container } = render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={true}
        sizeClassName="h-24 w-24"
      />,
    );
    const ring = container.querySelector('[class*="from-pink-500"]');
    expect(ring?.className).toContain('p-[3px]');
  });

  it('sm nutzt p-[2px]', () => {
    const { container } = render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={true}
        sizeClassName="h-10 w-10"
        ringThickness="sm"
      />,
    );
    const ring = container.querySelector('[class*="from-pink-500"]');
    expect(ring?.className).toContain('p-[2px]');
  });

  it('lg nutzt p-[4px]', () => {
    const { container } = render(
      <LiveRingAvatar
        src={null}
        alt="Zaur"
        fallback="ZA"
        live={true}
        sizeClassName="h-32 w-32"
        ringThickness="lg"
      />,
    );
    const ring = container.querySelector('[class*="from-pink-500"]');
    expect(ring?.className).toContain('p-[4px]');
  });
});

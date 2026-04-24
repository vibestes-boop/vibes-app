/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { User, Trash2 } from 'lucide-react';

import { SettingsRow, ComingSoonBadge } from '../settings-row';

// -----------------------------------------------------------------------------
// SettingsRow — v1.w.UI.18 D7 Settings-Overview Row Primitive.
//
// Tests fixieren die drei Render-Modi:
//   1. href + enabled → `<a>` mit Chevron, klickbar, Hover-State
//   2. right-slot + kein href → `<div>`, kein Chevron, Slot rendert Kind
//   3. disabled → `aria-disabled`, pointer-events-none via class
//
// Plus Variant-Semantik: destructive färbt Icon + Label rot, ComingSoonBadge
// rendert als pill-Span.
// -----------------------------------------------------------------------------

describe('SettingsRow — Link-Variante (mit href, ohne right)', () => {
  it('rendert als <a> mit href + Chevron + kein right-Slot', () => {
    const { container } = render(
      <SettingsRow
        icon={User}
        label="Profil"
        subtitle="Name, Bio, Avatar"
        href={'/settings/profile' as never}
        testId="row-profile"
      />,
    );

    const link = screen.getByTestId('row-profile');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/settings/profile');
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Name, Bio, Avatar')).toBeInTheDocument();
    // Chevron = lucide-chevron-right SVG
    expect(container.querySelector('svg.lucide-chevron-right')).toBeInTheDocument();
    // Kein right-Slot
    expect(container.querySelector('[data-settings-row-right]')).toBeNull();
  });

  it('applied hover + focus-ring + ease-out-expo transition classes', () => {
    render(
      <SettingsRow
        icon={User}
        label="Profil"
        href={'/settings/profile' as never}
        testId="row-hover"
      />,
    );
    const link = screen.getByTestId('row-hover');
    expect(link.className).toContain('hover:bg-muted/60');
    expect(link.className).toContain('duration-base');
    expect(link.className).toContain('ease-out-expo');
    expect(link.className).toContain('focus-visible:ring-2');
  });
});

describe('SettingsRow — Static-Variante (mit right, ohne href)', () => {
  it('rendert als <div>, kein Chevron, right-Slot sichtbar', () => {
    const { container } = render(
      <SettingsRow
        icon={User}
        label="Design"
        right={<span data-testid="theme-slot">LIGHT/DARK</span>}
        testId="row-theme"
      />,
    );

    const row = screen.getByTestId('row-theme');
    expect(row.tagName).toBe('DIV');
    expect(screen.getByTestId('theme-slot')).toBeInTheDocument();
    expect(screen.getByText('LIGHT/DARK')).toBeInTheDocument();
    // Right-Slot Wrapper muss da sein
    expect(row.querySelector('[data-settings-row-right]')).not.toBeNull();
    // KEIN Chevron wenn right-Slot gesetzt
    expect(container.querySelector('svg.lucide-chevron-right')).toBeNull();
  });
});

describe('SettingsRow — Disabled-Variante (coming soon)', () => {
  it('setzt aria-disabled + pointer-events-none class, auch wenn href vorhanden wäre', () => {
    render(
      <SettingsRow
        icon={User}
        label="Profil"
        href={'/settings/profile' as never}
        right={<ComingSoonBadge label="Bald" />}
        disabled
        testId="row-disabled"
      />,
    );
    const row = screen.getByTestId('row-disabled');
    // Weil disabled → div, kein <a>, auch wenn href gesetzt war
    expect(row.tagName).toBe('DIV');
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(row.className).toContain('pointer-events-none');
    expect(row.className).toContain('opacity-50');
    expect(screen.getByText('Bald')).toBeInTheDocument();
  });
});

describe('SettingsRow — Destructive-Variante', () => {
  it('färbt Icon + Label rot, hover-bg wechselt zu red-500/10', () => {
    const { container } = render(
      <SettingsRow
        icon={Trash2}
        label="Konto löschen"
        subtitle="Unwiderruflich"
        href={'/settings/privacy' as never}
        variant="destructive"
        testId="row-destructive"
      />,
    );
    const row = screen.getByTestId('row-destructive');
    expect(row.className).toContain('text-red-600');
    expect(row.className).toContain('hover:bg-red-500/10');
    // Label in span hat text-red-600
    const label = screen.getByText('Konto löschen');
    expect(label.className).toContain('text-red-600');
    // Icon auch
    const icons = container.querySelectorAll('svg');
    const anyIconRed = Array.from(icons).some((svg) =>
      (svg.getAttribute('class') ?? '').includes('text-red-600'),
    );
    expect(anyIconRed).toBe(true);
  });
});

describe('ComingSoonBadge', () => {
  it('rendert das Label in einer kleinen uppercase-Pille', () => {
    render(<ComingSoonBadge label="Soon" />);
    const badge = screen.getByText('Soon');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('uppercase');
    expect(badge.className).toContain('tracking-wider');
    expect(badge.className).toContain('text-muted-foreground');
  });
});

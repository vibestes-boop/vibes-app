/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MoreMenu } from '../more-menu';

// -----------------------------------------------------------------------------
// MoreMenu — linksseitiges Drawer-Panel (Short-Video-Parity).
//
// Controlled Component: `open` + `onToggle`/`onClose` kommen vom Parent
// (FeedSidebar). Tests fixieren:
//   - Trigger ruft onToggle; Label „Mehr" verschwindet im Open-State
//   - Panel-Inhalte (Einstellungen, Coins, Darkmode, Abmelden) sichtbar bei open
//   - Geschlossen: Panel komplett off-screen (width + left-Offset), Backdrop
//     nicht klickbar (pointer-events-none)
//   - Backdrop-Klick und X-Button rufen onClose
//   - Darkmode-Toggle ruft setTheme() mit Gegenteil, OHNE onClose (in-place flip)
//   - Link-Klick ruft onClose
//   - Abmelden ist <form><button type="submit">
// -----------------------------------------------------------------------------

let mockResolvedTheme: 'light' | 'dark' = 'light';
const mockSetTheme = jest.fn();
jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme, setTheme: mockSetTheme }),
}));

const mockSignOut = jest.fn();
jest.mock('@/app/actions/auth', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

function renderMenu(open = false) {
  const onToggle = jest.fn();
  const onClose = jest.fn();
  const utils = render(<MoreMenu open={open} onToggle={onToggle} onClose={onClose} />);
  return { onToggle, onClose, ...utils };
}

describe('MoreMenu', () => {
  beforeEach(() => {
    mockResolvedTheme = 'light';
    mockSetTheme.mockReset();
    mockSignOut.mockReset();
  });

  it('Trigger zeigt Label „Mehr" wenn geschlossen und ruft onToggle bei Klick', () => {
    const { onToggle } = renderMenu(false);
    const trigger = screen.getByRole('button', { name: /Weitere Optionen/i });
    expect(trigger).toHaveTextContent('Mehr');
    fireEvent.click(trigger);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('versteckt das Trigger-Label im Open-State (icon-only)', () => {
    renderMenu(true);
    const trigger = screen.getByRole('button', { name: /Weitere Optionen/i });
    expect(trigger).not.toHaveTextContent('Mehr');
  });

  it('geschlossen: Panel ist im Clip-Container verborgen (klappt aus der Icon-Leiste auf)', () => {
    renderMenu(false);
    const dialog = screen.getByRole('dialog', { name: /Mehr Optionen/i, hidden: true });
    // Panel slidet INNERHALB eines overflow-hidden-Containers an der
    // Icon-Strip-Kante (left-14) — dadurch klappt es aus der Sidebar auf
    // statt von außerhalb des Bildschirms hereinzurutschen (Short-Video-Verhalten).
    expect(dialog.className).toContain('-translate-x-full');
    expect(dialog.className).toContain('pointer-events-none');
    const clip = dialog.parentElement!;
    expect(clip.className).toContain('overflow-hidden');
    expect(clip.className).toContain('left-20');
  });

  it('offen: zeigt Einstellungen, Coins, Darkmode und Abmelden', () => {
    renderMenu(true);
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toBeInTheDocument();
    expect(screen.getByText('Coins')).toBeInTheDocument();
    expect(screen.getByText('Dunkelmodus')).toBeInTheDocument();
    expect(screen.getByText('Abmelden')).toBeInTheDocument();
  });

  it('Einstellungen-Link zeigt auf /settings, Coins auf /coin-shop', () => {
    renderMenu(true);
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByText('Coins').closest('a')).toHaveAttribute('href', '/coin-shop');
  });

  it('Link-Klick ruft onClose (Panel schließt bei Navigation)', () => {
    const { onClose } = renderMenu(true);
    fireEvent.click(screen.getByText('Coins').closest('a')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Darkmode-Toggle ruft setTheme("dark") und NICHT onClose (in-place flip)', () => {
    const { onClose } = renderMenu(true);
    fireEvent.click(screen.getByText('Dunkelmodus'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Dark-Mode aktiv: Label zeigt „Hellmodus" und ruft setTheme("light")', () => {
    mockResolvedTheme = 'dark';
    renderMenu(true);
    expect(screen.getByText('Hellmodus')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hellmodus'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('X-Button ruft onClose', () => {
    const { onClose } = renderMenu(true);
    fireEvent.click(screen.getByRole('button', { name: /Schließen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Backdrop-Klick ruft onClose', () => {
    const { onClose, container } = renderMenu(true);
    void container;
    // Backdrop ist das fixed-inset-0-Element vor dem Clip-Container im Portal.
    const dialog = screen.getByRole('dialog', { name: /Mehr Optionen/i });
    const backdrop = dialog.parentElement!.previousElementSibling as HTMLElement;
    // Backdrop beginnt rechts der Icon-Leiste (left-20), dunkelt den Strip nicht ab.
    expect(backdrop.className).toContain('fixed inset-y-0 left-20 right-0');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Abmelden ist ein Submit-Button in einem <form>', () => {
    renderMenu(true);
    const logoutButton = screen.getByText('Abmelden').closest('button')!;
    expect(logoutButton).toHaveAttribute('type', 'submit');
    expect(logoutButton.closest('form')).not.toBeNull();
  });
});

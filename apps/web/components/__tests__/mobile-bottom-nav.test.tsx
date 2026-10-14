import { render, screen, within } from '@testing-library/react';
import { TestI18nProvider } from '@/test-utils/i18n';
import { MobileBottomNav } from '../mobile-bottom-nav';

let mockPathname = '/explore';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
beforeEach(() => { mockPathname = '/explore'; });

function nav(isAuthed: boolean | null, viewerUsername?: string) {
  return <TestI18nProvider><MobileBottomNav isAuthed={isAuthed} viewerUsername={viewerUsername} /></TestI18nProvider>;
}

test('tabs retain their labels and order while the session loads and changes', () => {
  const { rerender } = render(nav(null));
  const expected = ['Feed', 'Entdecken', 'Erstellen', 'Nachrichten', 'Profil'];
  for (const status of [null, false, true]) {
    rerender(nav(status));
    expect(within(screen.getByRole('navigation')).getAllByRole('link').map(link => link.textContent)).toEqual(expected);
    expect(screen.getByRole('link', { name: 'Entdecken' })).toHaveAttribute('aria-current', 'page');
  }
});

test('guests can reach public content and return to their intended action after login', () => {
  const { rerender } = render(nav(false));
  expect(screen.getByRole('link', { name: 'Entdecken' })).toHaveAttribute('href', '/explore');
  for (const [label, destination] of [['Erstellen', '/create'], ['Nachrichten', '/messages'], ['Profil', '/profile']]) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', `/login?next=${encodeURIComponent(destination)}`);
  }
  rerender(nav(true));
  expect(screen.getByRole('link', { name: 'Erstellen' })).toHaveAttribute('href', '/create');
});

test('viewing another person does not select your own profile tab', () => {
  mockPathname = '/u/someone';
  const { rerender } = render(nav(true, 'me'));
  expect(screen.getByRole('link', { name: 'Profil' })).not.toHaveAttribute('aria-current');
  mockPathname = '/u/me/followers';
  rerender(nav(true, 'me'));
  expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('aria-current', 'page');
  mockPathname = '/u/me-too';
  rerender(nav(true, 'me'));
  expect(screen.getByRole('link', { name: 'Profil' })).not.toHaveAttribute('aria-current');
});

test('messages stays selected inside a conversation', () => {
  mockPathname = '/messages/conversation-123';
  render(nav(true));
  expect(screen.getByRole('link', { name: 'Nachrichten' })).toHaveAttribute('aria-current', 'page');
});

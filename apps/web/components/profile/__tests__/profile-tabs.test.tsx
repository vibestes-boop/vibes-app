import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileTabs } from '../profile-tabs';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/u/test',
  useSearchParams: () => new URLSearchParams('sort=newest'),
}));
jest.mock('@/lib/i18n/client', () => ({ useI18n: () => ({ locale: 'de' }) }));
const labels = { tablist: 'Profil-Inhalte', posts: 'Beiträge', likes: 'Likes', saved: 'Gespeichert', reposts: 'Reposts', shop: 'Shop', battles: 'Battles', lives: 'Live' };

beforeEach(() => jest.clearAllMocks());

test('every tab has a meaningful name and the active tab labels its panel', () => {
  render(<ProfileTabs active="posts" labels={labels} counts={{ posts: 1 }} />);
  for (const label of ['Beiträge', 'Likes', 'Reposts', 'Shop', 'Battles', 'Live']) {
    expect(screen.getByRole('tab', { name: label })).toHaveAccessibleName(label);
  }
  const active = screen.getByRole('tab', { name: 'Beiträge' });
  expect(active).toHaveAttribute('id', 'tab-posts');
  expect(active).toHaveAttribute('aria-controls', 'panel-posts');
  expect(active).toHaveAttribute('tabindex', '0');
  expect(screen.queryByRole('tab', { name: 'Gespeichert' })).not.toBeInTheDocument();
});

test('arrow keys and Home/End move focus without loading a different tab', () => {
  render(<ProfileTabs active="posts" labels={labels} />);
  const first = screen.getByRole('tab', { name: 'Beiträge' });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Likes' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Live' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(first).toHaveFocus();
  expect(mockPush).not.toHaveBeenCalled();
});

test('selecting a tab preserves filters and browser history', async () => {
  render(<ProfileTabs active="posts" labels={labels} savedVisible />);
  fireEvent.click(screen.getByRole('tab', { name: 'Gespeichert' }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/u/test?sort=newest&tab=saved', { scroll: false }));
});

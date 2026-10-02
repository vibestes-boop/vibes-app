import { render, screen, waitFor } from '@testing-library/react';
import { ReturnToRedirect } from '../return-to-redirect';

const mockReplace = jest.fn();
let mockPath = '/studio/shop/new';
let mockQuery = 'category=physical&title=rose+%26+musk';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPath,
  useSearchParams: () => new URLSearchParams(mockQuery),
}));

beforeEach(() => { mockReplace.mockClear(); });

test.each(['/studio/shop/new', '/settings/profile', '/messages/chat-id'])('preserves the complete protected URL %s', async (path) => {
  mockPath = path;
  mockQuery = 'category=physical&title=rose+%26+musk';
  render(<ReturnToRedirect />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  const url = new URL(mockReplace.mock.calls[0][0], 'https://serlo.test');
  expect(url.pathname).toBe('/login');
  expect(url.searchParams.get('next')).toBe(`${path}?${mockQuery}`);
  expect(screen.getByRole('link', { name: 'Zur Anmeldung' })).toHaveAttribute('href', url.pathname + url.search);
});

test('keeps the requested tool when creator activation is required', async () => {
  mockPath = '/studio/shop/new';
  mockQuery = '';
  render(<ReturnToRedirect destination="/creator/activate" />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  const url = new URL(mockReplace.mock.calls[0][0], 'https://serlo.test');
  expect(url.pathname).toBe('/creator/activate');
  expect(url.searchParams.get('next')).toBe('/studio/shop/new');
});

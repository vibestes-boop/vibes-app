import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewConversationButton } from '../new-conversation-button';
import { TestI18nProvider } from '@/test-utils/i18n';
import { getOrCreateConversation } from '@/app/actions/messages';
const mockSearch = jest.fn();
const mockPush = jest.fn();
jest.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({ from: () => ({ select: () => ({ ilike: () => ({ limit: mockSearch }) }) }) }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/app/actions/messages', () => ({ getOrCreateConversation: jest.fn() }));
const person = { id: 'qa-person', username: 'testperson', display_name: 'Testperson', avatar_url: null, verified: false };
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());
function open() {
  render(<TestI18nProvider><NewConversationButton /></TestI18nProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Neu' }));
  return screen.getByRole('textbox');
}
async function search(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  await act(async () => { jest.advanceTimersByTime(210); });
}
test('clearing the query prevents an old response from restoring stale people', async () => {
  let resolve!: (value: unknown) => void;
  mockSearch.mockImplementation(() => new Promise(done => { resolve = done; }));
  const input = open(); await search(input, 'test');
  fireEvent.change(input, { target: { value: '' } });
  await act(async () => resolve({ data: [person], error: null }));
  expect(screen.queryByText('Testperson')).not.toBeInTheDocument();
});
test('failed searches can be retried and conversation failures remain visible', async () => {
  mockSearch.mockResolvedValueOnce({ data: null, error: { message: 'offline' } }).mockResolvedValueOnce({ data: [person], error: null });
  jest.mocked(getOrCreateConversation).mockRejectedValue(new Error('offline'));
  await search(open(), 'test');
  expect(screen.getByRole('alert')).toHaveTextContent('Suche');
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
  await act(async () => { jest.advanceTimersByTime(210); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Testperson/ })); });
  expect(screen.getByRole('alert')).toHaveTextContent('Unterhaltung');
  expect(mockPush).not.toHaveBeenCalled();
});
test('Escape closes the dialog and returns keyboard focus to its trigger', async () => {
  jest.useRealTimers(); const user = userEvent.setup(); open();
  expect(screen.getByRole('dialog')).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Neu' })).toHaveFocus();
});

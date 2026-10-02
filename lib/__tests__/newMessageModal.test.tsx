/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NewMessageModal } from '../../components/messages/NewMessageModal';
const mockPush = jest.fn(); const mockOpen = jest.fn(); const mockRetry = jest.fn();
let mockSearch = { data: [] as { id: string; username: string; avatar_url: null }[], isError: false, isFetching: false, refetch: mockRetry };
let mockOptions: { enabled?: boolean; queryKey?: unknown[] };
const mockProfile = { id: 'me' };
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args), navigate: jest.fn() } }));
jest.mock('@/lib/useMessages', () => ({ useOrCreateConversation: () => ({ mutateAsync: mockOpen }) }));
jest.mock('@/lib/authStore', () => ({ useAuthStore: Object.assign((selector: (s: unknown) => unknown) => selector({ profile: mockProfile }), { getState: () => ({ profile: mockProfile }) }) }));
jest.mock('@tanstack/react-query', () => ({ useQuery: (options: typeof mockOptions) => { mockOptions = options; return mockSearch; } }));
jest.mock('@/lib/useBlock', () => ({ getBlockedIdSet: async () => new Set() }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/useTheme', () => ({ useTheme: () => ({ colors: require('../theme').darkColors }) }));
jest.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (key: string, vars?: { name: string }) => key + (vars?.name ? ':' + vars.name : '') }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const recent = [{ id: 'amina', username: 'amina', avatar_url: null }];
beforeEach(() => { jest.clearAllMocks(); mockSearch = { data: [], isError: false, isFetching: false, refetch: mockRetry }; });
it('shows a useful error after opening a chat fails and permits retry', async () => {
  mockOpen.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('conversation');
  const close = jest.fn(); const screen = render(<NewMessageModal onClose={close} recent={recent} />);
  fireEvent.press(screen.getByLabelText('inbox.openChat:amina'));
  await waitFor(() => expect(screen.getByText('inbox.openError')).toBeTruthy());
  expect(close).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('inbox.openChat:amina'));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ id: 'conversation' }) })));
});
it('ignores duplicate presses and a late result after the sheet is closed', async () => {
  let resolve!: (id: string) => void; mockOpen.mockImplementation(() => new Promise<string>(r => { resolve = r; }));
  const close = jest.fn(); const screen = render(<NewMessageModal onClose={close} recent={recent} />);
  fireEvent.press(screen.getByLabelText('inbox.openChat:amina'));
  fireEvent.press(screen.getByLabelText('inbox.openChat:amina'));
  expect(mockOpen).toHaveBeenCalledTimes(1);
  screen.unmount(); await act(async () => resolve('late'));
  expect(mockPush).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
});
it('does not search a one-character name and distinguishes a failed search from no matches', async () => {
  const screen = render(<NewMessageModal onClose={jest.fn()} />);
  fireEvent.changeText(screen.getByPlaceholderText('messages.searchUser'), 'a');
  await waitFor(() => expect(screen.getByText('ux.searchMinimumPeople')).toBeTruthy());
  expect(mockOptions.enabled).toBe(false);
  mockSearch = { ...mockSearch, isError: true };
  fireEvent.changeText(screen.getByPlaceholderText('messages.searchUser'), 'am');
  await waitFor(() => expect(screen.getByText('inbox.searchError')).toBeTruthy());
  expect(mockOptions.queryKey).toEqual(['dm-recipients', 'me', 'am']);
  expect(screen.queryByText('messages.noUserFound')).toBeNull();
  fireEvent.press(screen.getByText('nativeUi.retry')); expect(mockRetry).toHaveBeenCalledTimes(1);
});

/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import MessagesScreen from '../../app/(tabs)/messages';
const mockConvs = [{ id: 'c1', other_user: { id: 'amina', username: 'amina', avatar_url: null }, last_message: 'hello', last_message_at: new Date().toISOString(), unread_count: 2 }, { id: 'c2', other_user: { id: 'adam', username: 'adam', avatar_url: null }, last_message: 'weekend', last_message_at: new Date().toISOString(), unread_count: 0 }];
let mockData = mockConvs; let mockError = false;
const mockRefetch = jest.fn(); const mockSet = jest.fn(); const mockInvalidate = jest.fn(); const mockDelete = jest.fn();
const mockProfile = { id: 'me', username: 'me', avatar_url: null };
const mockQueryClient = { setQueryData: mockSet, invalidateQueries: mockInvalidate };
jest.mock('expo-router', () => ({ router: { push: jest.fn(), setParams: jest.fn() }, useLocalSearchParams: () => ({}), useFocusEffect: () => {} }));
jest.mock('@/lib/useMessages', () => ({ useConversations: () => ({ data: mockData, isError: mockError, isLoading: false, isRefetching: false, refetch: mockRefetch }), useOrCreateConversation: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/lib/authStore', () => ({ useAuthStore: Object.assign((selector?: (s: unknown) => unknown) => selector ? selector({ profile: mockProfile }) : { profile: mockProfile }, { getState: () => ({ profile: mockProfile }) }) }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ delete: () => ({ eq: () => ({ select: mockDelete }) }) }) } }));
jest.mock('@/lib/useStories', () => ({ useGuildStories: () => ({ data: [], refetch: mockRefetch, isRefetching: false }) }));
jest.mock('@/lib/useLiveSession', () => ({ useActiveLiveSessions: () => ({ data: [] }) }));
jest.mock('@/lib/storyViewerStore', () => ({ useStoryViewerStore: () => jest.fn() }));
jest.mock('@/components/ui/StoriesRow', () => ({ StoriesRow: () => null }));
jest.mock('@/components/messages/NewMessageModal', () => ({ NewMessageModal: () => null }));
jest.mock('@/components/messages/MessagesSkeleton', () => ({ MessagesSkeleton: () => null }));
jest.mock('@shopify/flash-list', () => ({ FlashList: require('react-native').FlatList }));
jest.mock('@/lib/useTheme', () => ({ useTheme: () => ({ colors: require('../theme').darkColors, isDark: true }) }));
jest.mock('@/lib/useThemedStatusBar', () => ({ useThemedStatusBar: () => {} }));
jest.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (key: string, vars?: { name?: string }) => key + (vars?.name ? ':' + vars.name : '') }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
beforeEach(() => { jest.clearAllMocks(); mockData = mockConvs; mockError = false; });
it('distinguishes a failed initial load from an empty inbox and allows retry', () => {
  mockData = []; mockError = true;
  const screen = render(<MessagesScreen />);
  expect(screen.getByText('inbox.loadError')).toBeTruthy();
  expect(screen.queryByText('messages.emptyTitle')).toBeNull();
  fireEvent.press(screen.getByText('nativeUi.retry')); expect(mockRefetch).toHaveBeenCalledTimes(1);
});
it('retains loaded chats when a refresh fails', () => {
  mockError = true; const screen = render(<MessagesScreen />);
  expect(screen.getByText('inbox.refreshError')).toBeTruthy();
  expect(screen.getByLabelText('inbox.openChat:amina')).toBeTruthy();
});
it('combines unread filtering and case-insensitive search, then clears both', () => {
  const screen = render(<MessagesScreen />);
  fireEvent.press(screen.getByText('inbox.unread · 1'));
  expect(screen.queryByLabelText('inbox.openChat:adam')).toBeNull();
  fireEvent.changeText(screen.getByPlaceholderText('inbox.searchChats'), 'HELLO');
  expect(screen.getByLabelText('inbox.openChat:amina')).toBeTruthy();
  fireEvent.changeText(screen.getByPlaceholderText('inbox.searchChats'), 'missing');
  expect(screen.getByText('inbox.noChats')).toBeTruthy();
  fireEvent.press(screen.getByText('inbox.showAll'));
  expect(screen.getByLabelText('inbox.openChat:adam')).toBeTruthy();
});
it.each([{ data: null, error: { message: 'offline' } }, { data: [], error: null }])('does not remove a chat when deletion fails or is not confirmed', async response => {
  mockDelete.mockResolvedValue(response); const confirm = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const screen = render(<MessagesScreen />); fireEvent(screen.getByLabelText('inbox.openChat:amina'), 'longPress');
  confirm.mock.calls[0][2]?.[1].onPress?.();
  await waitFor(() => expect(screen.getByText('inbox.deleteError')).toBeTruthy());
  expect(mockSet).not.toHaveBeenCalled(); expect(screen.getByLabelText('inbox.openChat:amina')).toBeTruthy(); confirm.mockRestore();
});
it('updates the account-specific cache only after a confirmed deletion', async () => {
  mockDelete.mockResolvedValue({ data: [{ id: 'c1' }], error: null }); const confirm = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const screen = render(<MessagesScreen />); fireEvent(screen.getByLabelText('inbox.openChat:amina'), 'longPress'); confirm.mock.calls[0][2]?.[1].onPress?.();
  await waitFor(() => expect(mockSet).toHaveBeenCalledWith(['conversations', 'me'], expect.any(Function)));
  expect(mockSet.mock.calls[0][1](mockConvs)).toEqual([mockConvs[1]]); confirm.mockRestore();
});

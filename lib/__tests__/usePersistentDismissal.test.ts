import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePersistentDismissal } from '../usePersistentDismissal';
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });
it('remembers a dismissal across remounts', async () => {
  const first = renderHook(() => usePersistentDismissal('prompt:alice'));
  await waitFor(() => expect(first.result.current.visible).toBe(true));
  act(() => first.result.current.dismiss());
  expect(first.result.current.visible).toBe(false);
  first.unmount();
  const second = renderHook(() => usePersistentDismissal('prompt:alice'));
  await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledTimes(2));
  expect(second.result.current.visible).toBe(false);
});
it('does not inherit another account’s dismissed prompt', async () => {
  await AsyncStorage.setItem('prompt:alice', '1');
  const hook = renderHook(({ account }) => usePersistentDismissal(account), { initialProps: { account: 'prompt:alice' as string | null } });
  await act(async () => {});
  expect(hook.result.current.visible).toBe(false);
  hook.rerender({ account: 'prompt:bob' });
  await waitFor(() => expect(hook.result.current.visible).toBe(true));
  hook.rerender({ account: null });
  expect(hook.result.current.visible).toBe(false);
});

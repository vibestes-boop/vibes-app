import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useAuthStore, type Profile } from '../authStore';
import { PROFILE_SELECT } from '../profileSelect';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const originalFetch = global.fetch;
const fetchMock = jest.fn();
const session = (id = 'user-a', token = 'test-token') => ({ user: { id }, access_token: token }) as Session;
const profile = (id = 'user-a') => ({ id, username: 'test', onboarding_complete: true }) as Profile;
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body }) as Response;

beforeEach(async () => {
  await useAuthStore.persist.rehydrate();
  await AsyncStorage.clear();
  useAuthStore.getState().setSession(null);
  useAuthStore.getState().setSession(session());
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.test';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

it('loads the readable profile without requesting protected columns', async () => {
  fetchMock.mockImplementation(async (url: string) => response(
    url.includes('select=*') ? null : [profile()], url.includes('select=*') ? 403 : 200,
  ));
  await useAuthStore.getState().fetchProfile('user-a');
  expect(fetchMock.mock.calls[0][0]).toContain(`select=${PROFILE_SELECT}`);
  expect(PROFILE_SELECT).not.toMatch(/push_token|birth_date|\*/);
  expect(useAuthStore.getState()).toMatchObject({ profile: profile(), profileStatus: 'ready', loading: false });
});

it('distinguishes a denied read from an absent profile', async () => {
  fetchMock.mockResolvedValueOnce(response(null, 403));
  await useAuthStore.getState().fetchProfile('user-a');
  expect(useAuthStore.getState()).toMatchObject({ profile: null, profileStatus: 'error', loading: false });
  fetchMock.mockResolvedValueOnce(response([]));
  await useAuthStore.getState().fetchProfile('user-a');
  expect(useAuthStore.getState()).toMatchObject({ profile: null, profileStatus: 'missing', loading: false });
});

it('allows a failed profile load to be retried', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([profile()]));
  await useAuthStore.getState().fetchProfile('user-a');
  expect(useAuthStore.getState().profileStatus).toBe('error');
  await useAuthStore.getState().fetchProfile('user-a');
  expect(useAuthStore.getState().profileStatus).toBe('ready');
});

it('keeps the matching cached profile available during an offline refresh', async () => {
  useAuthStore.getState().setProfile(profile());
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await useAuthStore.getState().fetchProfile('user-a');
  expect(useAuthStore.getState()).toMatchObject({ profile: profile(), profileStatus: 'ready', loading: false });
});

it.each(['logout', 'account-change', 'token-refresh'])('ignores an in-flight profile after %s', async (change) => {
  let finish!: (value: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
  const pending = useAuthStore.getState().fetchProfile('user-a');
  expect(useAuthStore.getState().profileStatus).toBe('loading');
  useAuthStore.getState().setSession(change === 'logout' ? null : session(change === 'account-change' ? 'user-b' : 'user-a', 'new-token'));
  finish(response([profile()]));
  await pending;
  expect(useAuthStore.getState()).toMatchObject({ profile: null, profileStatus: 'idle', loading: false });
});

it('clears a cached profile immediately when switching accounts', () => {
  useAuthStore.getState().setProfile(profile());
  useAuthStore.getState().setSession(session('user-b', 'new-token'));
  expect(useAuthStore.getState().profile).toBeNull();
});

it('does not overwrite a local profile update with an older response', async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { finish = resolve; }));
  const pending = useAuthStore.getState().fetchProfile('user-a');
  const updated = { ...profile(), username: 'updated' };
  useAuthStore.getState().setProfile(updated);
  finish(response([profile()]));
  await pending;
  expect(useAuthStore.getState().profile).toEqual(updated);
});

it('turns a timed-out request into a retryable error', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const pending = useAuthStore.getState().fetchProfile('user-a');
  jest.advanceTimersByTime(10000);
  await pending;
  expect(useAuthStore.getState()).toMatchObject({ profileStatus: 'error', loading: false });
});

it('rejects malformed or mismatched profile responses instead of entering onboarding', async () => {
  for (const body of [{ message: 'invalid' }, [profile('other-user')]]) {
    fetchMock.mockResolvedValueOnce(response(body));
    await useAuthStore.getState().fetchProfile('user-a');
    expect(useAuthStore.getState().profileStatus).toBe('error');
  }
});

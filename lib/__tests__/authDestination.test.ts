import { authDestination } from '../authDestination';

const loggedIn = { authenticated: true, profile: null, profileStatus: 'ready' as const, group: '(auth)' };
it('leaves login after a confirmed missing profile', () => {
  expect(authDestination({ ...loggedIn, profileStatus: 'missing' })).toBe('/(onboarding)');
});
it.each(['idle', 'loading', 'error'] as const)('does not mistake %s for a new account', (profileStatus) => {
  expect(authDestination({ ...loggedIn, profileStatus })).toBeNull();
});
it('routes existing incomplete profiles from login to setup', () => {
  expect(authDestination({ ...loggedIn, profile: { onboarding_complete: false } })).toBe('/(onboarding)');
});
it('routes completed profiles from login to the app', () => {
  expect(authDestination({ ...loggedIn, profile: { onboarding_complete: true } })).toBe('/(tabs)');
});
it('allows unfinished onboarding to advance within its route group', () => {
  expect(authDestination({ ...loggedIn, group: '(onboarding)', profile: { onboarding_complete: false } })).toBeNull();
});
it('sends signed-out users back to login', () => {
  expect(authDestination({ ...loggedIn, authenticated: false, group: '(tabs)' })).toBe('/(auth)/login');
});
it('preserves password recovery even with an authenticated session', () => {
  expect(authDestination({ ...loggedIn, recovering: true, profile: { onboarding_complete: true } })).toBeNull();
});

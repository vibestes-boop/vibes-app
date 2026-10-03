import type { ProfileStatus } from './authStore';

type AuthDestinationInput = {
  authenticated: boolean;
  profile: { onboarding_complete: boolean | null } | null;
  profileStatus: ProfileStatus;
  group?: string;
  recovering?: boolean;
};

export function authDestination({ authenticated, profile, profileStatus, group, recovering }: AuthDestinationInput) {
  if (recovering) return null;
  if (!authenticated) return group === '(auth)' ? null : '/(auth)/login';
  if (!profile && profileStatus !== 'missing') return null;
  if (!profile?.onboarding_complete) return group === '(onboarding)' ? null : '/(onboarding)';
  return group === '(auth)' || group === '(onboarding)' ? '/(tabs)' : null;
}

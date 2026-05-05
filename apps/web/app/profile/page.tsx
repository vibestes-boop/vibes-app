import type { Route } from 'next';
import { redirect } from 'next/navigation';

import { getProfile, getUser } from '@/lib/auth/session';

export default async function ProfileRedirectPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login?next=/profile' as Route);
  }

  const profile = await getProfile();
  redirect((profile?.username ? `/u/${profile.username}` : '/onboarding') as Route);
}

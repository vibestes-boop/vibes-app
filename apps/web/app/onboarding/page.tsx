import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';

import { UsernamePickerForm } from '@/components/auth/username-picker-form';
import { getUser, getProfile } from '@/lib/auth/session';

export const metadata = { title: 'Username wählen' };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : '/';

  // Must be logged in to onboard.
  const user = await getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/onboarding')}`);
  }

  // If they already have a username, onboarding is done — skip straight to destination.
  const profile = await getProfile();
  if (profile?.username) {
    redirect(next);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-4xl font-medium tracking-tight">Willkommen</h1>
          <p className="text-sm text-muted-foreground">
            Noch ein Schritt — wähl deinen Username, damit Freunde dich finden.
          </p>
        </div>

        <UsernamePickerForm next={next} />

        <p className="text-center text-xs text-muted-foreground">
          Email-Adresse: <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </div>
    </main>
  );
}

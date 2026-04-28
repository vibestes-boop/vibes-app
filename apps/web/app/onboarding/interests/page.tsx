import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Sparkles } from 'lucide-react';
import { getUser, getProfile } from '@/lib/auth/session';
import { InterestsPickerForm } from '@/components/onboarding/interests-picker-form';

export const metadata: Metadata = { title: 'Interessen wählen — Serlo' };
export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// /onboarding/interests — Onboarding Schritt 3: Interessen auswählen (v1.w.UI.232)
//
// Parity mit native (onboarding)/interests.tsx.
// User wählt 3+ Kategorien → werden als preferred_tags in profiles gespeichert.
// Feed-Algorithmus nutzt diese sofort — löst das Cold-Start-Problem.
// Skip-Gate: wenn preferred_tags bereits gesetzt → weiter zu /onboarding/follow.
// -----------------------------------------------------------------------------

export default async function OnboardingInterestsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/';

  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/onboarding/interests')}` as Route);

  const profile = await getProfile();
  const existingTags = (profile as unknown as { preferred_tags?: string[] | null } | null)?.preferred_tags ?? [];

  // Skip if interests already set.
  if (existingTags.length >= 3) {
    redirect(`/onboarding/follow?next=${encodeURIComponent(next)}` as Route);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-4xl font-medium tracking-tight">Was interessiert dich?</h1>
          <p className="text-sm text-muted-foreground">
            Wähl mindestens 3 Themen — damit dein Feed von Anfang an passt.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <span className="h-1.5 w-6 rounded-full bg-muted" />
          <span className="h-1.5 w-6 rounded-full bg-muted" />
          <span className="h-1.5 w-6 rounded-full bg-brand-gold" />
          <span className="h-1.5 w-6 rounded-full bg-muted" />
        </div>

        <InterestsPickerForm next={next} />
      </div>
    </main>
  );
}

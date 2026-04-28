import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { Users } from 'lucide-react';
import { getUser, getProfile } from '@/lib/auth/session';
import { getAllGuilds } from '@/lib/data/guilds';
import { GuildPickerForm } from '@/components/onboarding/guild-picker-form';

export const metadata: Metadata = { title: 'Guild wählen — Serlo' };
export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// /onboarding/guild — Onboarding Schritt 2: Guild/Pod auswählen (v1.w.UI.232)
//
// Parity mit native (onboarding)/guild.tsx.
// User weist sich einem der 5 Pods zu — gespeichert in profiles.guild_id.
// Skip-Gate: wenn guild_id bereits gesetzt → direkt weiter zu /onboarding/interests.
// -----------------------------------------------------------------------------

export default async function OnboardingGuildPage({
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
  if (!user) redirect(`/login?next=${encodeURIComponent('/onboarding/guild')}` as Route);

  const profile = await getProfile();

  // Skip if guild already set.
  if ((profile as unknown as { guild_id?: string | null } | null)?.guild_id) {
    redirect(`/onboarding/interests?next=${encodeURIComponent(next)}` as Route);
  }

  const guilds = await getAllGuilds();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
            <Users className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-4xl font-medium tracking-tight">Wähl deinen Pod</h1>
          <p className="text-sm text-muted-foreground">
            Jeder gehört zu einem Pod — deine Community innerhalb von Serlo.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <span className="h-1.5 w-6 rounded-full bg-muted" />
          <span className="h-1.5 w-6 rounded-full bg-brand-gold" />
          <span className="h-1.5 w-6 rounded-full bg-muted" />
          <span className="h-1.5 w-6 rounded-full bg-muted" />
        </div>

        <GuildPickerForm guilds={guilds} next={next} />
      </div>
    </main>
  );
}

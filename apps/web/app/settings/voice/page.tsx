import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Mic } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { VoiceSetup } from '@/components/settings/voice-setup';

// -----------------------------------------------------------------------------
// /settings/voice — v1.w.UI.217 — KI-Stimme (Voice Clone).
//
// RSC-Shell: liest profiles.voice_sample_url aus Supabase → übergibt als
// initialVoiceUrl an den <VoiceSetup>-Client. Auth-Guard: kein User → /login.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'KI-Stimme — Einstellungen',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function VoiceSettingsPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/settings/voice');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('voice_sample_url')
    .eq('id', user.id)
    .single();

  const initialVoiceUrl =
    (profile as { voice_sample_url?: string | null } | null)?.voice_sample_url ?? null;

  return (
    <div>
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <Mic className="h-6 w-6 text-violet-500" />
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Meine KI-Stimme</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Chatterbox spricht in deiner Stimme. Nimm eine kurze Probe auf (5–15 Sek.).
        </p>
      </header>

      {/* Recording UI — max-width so it doesn't stretch too wide */}
      <div className="max-w-sm">
        <VoiceSetup userId={user.id} initialVoiceUrl={initialVoiceUrl} />
      </div>

      {/* Back link for mobile (desktop has sidebar) */}
      <div className="mt-8 lg:hidden">
        <Link
          href={'/settings' as Route}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Einstellungen
        </Link>
      </div>
    </div>
  );
}

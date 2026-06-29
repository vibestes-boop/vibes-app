import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ClaimOnMount } from '@/components/referral/claim-on-mount';

export const dynamic = 'force-dynamic';

async function getReferrer(code: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .ilike('username', code)
    .maybeSingle();
  return data as { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const ref = await getReferrer(code);
  const name = ref?.display_name ?? (ref?.username ? `@${ref.username}` : 'Jemand');
  return {
    title: `${name} lädt dich zu Serlo ein`,
    description: 'Videos, Live-Streams und ein Marktplatz aus der Community — komm dazu.',
    robots: { index: false, follow: false },
  };
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ref = await getReferrer(code);
  const name = ref?.display_name ?? (ref?.username ? `@${ref.username}` : 'Jemand');
  const initial = (ref?.display_name ?? ref?.username ?? '?').slice(0, 1).toUpperCase();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      {/* Setzt den Referral-Cookie bzw. attribuiert sofort (eingeloggt). */}
      <ClaimOnMount code={code} />

      <Avatar className="h-20 w-20">
        {ref?.avatar_url ? <AvatarImage src={ref.avatar_url} alt="" /> : null}
        <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
      </Avatar>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {name} lädt dich zu Serlo ein 🌸
        </h1>
        <p className="text-sm text-muted-foreground">
          Videos, Live-Streams und ein Marktplatz aus der Community. Erstelle dein
          Konto — dann seid ihr verbunden.
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button asChild size="lg">
          <Link href={'/signup' as Route}>Kostenlos beitreten</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={'/' as Route}>Erst mal umschauen</Link>
        </Button>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { AlertCircle } from 'lucide-react';

import { MagicLinkForm } from '@/components/auth/magic-link-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { getUser } from '@/lib/auth/session';

export const metadata = { title: 'Account erstellen' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  const user = await getUser();
  if (user) {
    redirect((params.next && params.next.startsWith('/') ? params.next : '/') as Route);
  }

  const next = params.next && params.next.startsWith('/') && !params.next.startsWith('//') ? params.next : '/';

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="font-serif text-4xl font-medium tracking-tight">Account erstellen</h1>
          <p className="text-sm text-muted-foreground">
            Einmal Email eingeben, einmal auf den Link klicken — fertig.
          </p>
        </div>

        {params.error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{params.error}</p>
          </div>
        ) : null}

        <MagicLinkForm mode="signup" />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
              oder
            </span>
          </div>
        </div>

        <OAuthButtons next={next} />

        <p className="text-center text-xs text-muted-foreground">
          Mit der Erstellung akzeptierst du unsere{' '}
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Nutzungsbedingungen
          </Link>{' '}
          und unsere{' '}
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Datenschutzerklärung
          </Link>
          .
        </p>

        <p className="text-center text-sm text-muted-foreground">
          Schon einen Account?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Einloggen
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            ← Zurück zur Startseite
          </Link>
        </p>
      </div>
    </main>
  );
}

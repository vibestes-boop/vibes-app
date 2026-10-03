import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { AlertCircle } from 'lucide-react';

import { MagicLinkForm } from '@/components/auth/magic-link-form';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { HashSessionRescue } from '@/components/auth/hash-session-rescue';
import { getUser } from '@/lib/auth/session';
import { getSafeReturnPath } from '@/lib/auth/return-path';
import { getT } from '@/lib/i18n/server';

// Metadata muss statisch pro Route sein — Next.js unterstützt zwar async
// `generateMetadata()`, aber für den Title reicht eine neutrale Default-
// Variante. Der sichtbare H1 auf der Seite kommt übersetzt.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('auth.loginTitle') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = getSafeReturnPath(params.next);

  // Already logged in? Skip the form and go directly to destination.
  const user = await getUser();
  if (user) {
    redirect(next as Route);
  }

  const t = await getT();

  return (
    <main className="serlo-auth-page flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:py-12">
      <HashSessionRescue />
      <div className="serlo-auth-card w-full max-w-[420px] space-y-7">
        <div className="space-y-4 text-center">
          <Link href="/" className="serlo-wordmark mx-auto">
            serlo<span>.</span>
          </Link>
          <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{t('auth.loginTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.loginWelcome')}</p>
          </div>
        </div>

        {params.error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{params.error}</p>
          </div>
        ) : null}

        <MagicLinkForm mode="login" next={next} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
              {t('auth.or')}
            </span>
          </div>
        </div>

        <OAuthButtons next={next} />

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/auth/forgot-password"
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Passwort vergessen?
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          {t('auth.noAccount')}{' '}
          <Link
            href={`/signup?next=${encodeURIComponent(next)}` as Route}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            {t('auth.createNow')}
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">
            {t('auth.backToHome')}
          </Link>
        </p>
      </div>
    </main>
  );
}

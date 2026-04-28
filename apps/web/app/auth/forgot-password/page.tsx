import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

// -----------------------------------------------------------------------------
// /auth/forgot-password — v1.w.UI.216
//
// Eingabe der E-Mail-Adresse um einen Passwort-Reset-Link anzufordern.
// Der Link in der Mail führt zu /auth/callback?type=recovery → /auth/reset-password
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Passwort vergessen — Serlo',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="font-serif text-4xl font-medium tracking-tight">
            Passwort vergessen?
          </h1>
          <p className="text-sm text-muted-foreground">
            Gib deine E-Mail-Adresse ein — wir schicken dir einen Link zum
            Zurücksetzen.
          </p>
        </div>

        {params.error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{params.error}</p>
          </div>
        ) : null}

        <ForgotPasswordForm />

        <p className="text-center text-sm text-muted-foreground">
          Wieder eingefallen?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Zurück zum Login
          </Link>
        </p>
      </div>
    </main>
  );
}

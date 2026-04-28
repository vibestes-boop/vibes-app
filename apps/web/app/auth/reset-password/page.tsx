import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

// -----------------------------------------------------------------------------
// /auth/reset-password — v1.w.UI.216
//
// Wird aufgerufen nachdem /auth/callback?type=recovery die Session gesetzt hat.
// Guard: Kein aktiver User in Session → zurück zu /login (Link abgelaufen).
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Neues Passwort festlegen — Serlo',
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Recovery-Session fehlt oder abgelaufen — Recovery-Link erneut anfordern.
    redirect('/auth/forgot-password?error=Session+abgelaufen');
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="font-serif text-4xl font-medium tracking-tight">
            Neues Passwort
          </h1>
          <p className="text-sm text-muted-foreground">
            Wähle ein sicheres Passwort für dein Konto.
          </p>
        </div>

        <ResetPasswordForm />
      </div>
    </main>
  );
}

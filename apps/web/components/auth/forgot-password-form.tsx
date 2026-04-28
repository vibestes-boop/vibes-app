'use client';

import { useState, useTransition } from 'react';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendPasswordResetEmail } from '@/app/actions/auth';

// -----------------------------------------------------------------------------
// ForgotPasswordForm — v1.w.UI.216
//
// Nimmt eine E-Mail-Adresse und ruft sendPasswordResetEmail() auf.
// Gibt immer eine Erfolgs-Meldung aus (kein Email-Enumeration-Leak).
// -----------------------------------------------------------------------------

export function ForgotPasswordForm() {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const fd = new FormData();
    fd.set('email', email);

    startTransition(async () => {
      const result = await sendPasswordResetEmail(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <div>
          <h3 className="text-base font-semibold">E-Mail verschickt</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Falls ein Konto mit dieser Adresse existiert, hast du gleich eine
            Mail mit einem Reset-Link. Schau auch im Spam-Ordner nach.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="reset-email" className="block text-sm font-medium">
          E-Mail-Adresse
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="deine@email.de"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !email}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {isPending ? 'Wird gesendet…' : 'Reset-Link anfordern'}
      </button>
    </form>
  );
}

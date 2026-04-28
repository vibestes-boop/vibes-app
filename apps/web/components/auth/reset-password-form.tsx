'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, CheckCircle2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setNewPassword } from '@/app/actions/auth';

// -----------------------------------------------------------------------------
// ResetPasswordForm — v1.w.UI.216
//
// Wird auf /auth/reset-password gezeigt nachdem der User den Recovery-Link
// geklickt hat und der Callback seine Session gesetzt hat.
// Ruft setNewPassword() → supabase.auth.updateUser({ password }).
// Nach Erfolg: redirect nach /
// -----------------------------------------------------------------------------

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Mindestens 8 Zeichen erforderlich.');
      return;
    }
    if (password !== confirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    const fd = new FormData();
    fd.set('password', password);

    startTransition(async () => {
      const result = await setNewPassword(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      // Brief pause so the success state is visible before navigating.
      setTimeout(() => router.replace('/'), 1800);
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <div>
          <h3 className="text-base font-semibold">Passwort geändert</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Du wirst gleich weitergeleitet…
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* New password */}
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="block text-sm font-medium">
          Neues Passwort
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="new-password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Mindestens 8 Zeichen"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirm */}
      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="block text-sm font-medium">
          Passwort bestätigen
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="confirm-password"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            placeholder="Passwort wiederholen"
            className={cn(
              'w-full rounded-xl border bg-background py-2.5 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              confirm && password && confirm !== password
                ? 'border-destructive focus:ring-destructive/30'
                : 'border-border',
            )}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showConfirm ? 'Passwort verbergen' : 'Passwort anzeigen'}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Strength hint */}
      {password.length > 0 && password.length < 8 && (
        <p className="text-xs text-muted-foreground">
          {8 - password.length} weitere Zeichen benötigt
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !password || !confirm}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background transition-opacity',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {isPending ? 'Wird gespeichert…' : 'Passwort speichern'}
      </button>
    </form>
  );
}

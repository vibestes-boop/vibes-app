'use client';

// -----------------------------------------------------------------------------
// <AccountSecurityRows /> — v1.w.UI.189
//
// Parity with mobile `app/settings.tsx` "Account" section:
//   • E-Mail ändern  → calls supabase.auth.updateUser({ email })
//   • Passwort ändern → calls supabase.auth.updateUser({ password })
//
// Each row expands inline when clicked (no Modal dependency). Uses the
// Supabase browser client directly since auth.updateUser() reads the current
// session cookie automatically via @supabase/ssr createBrowserClient.
//
// ⚠️ RSC-Boundary-Hinweis: Icons are imported inside this 'use client' file,
// never passed as props from RSC parent (forwardRef crash digest 1974146109).
// -----------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { Mail, Lock, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

export interface AccountSecurityRowsProps {
  labels: {
    rowChangeEmailLabel: string;
    rowChangeEmailSubtitle: string;
    rowChangePasswordLabel: string;
    rowChangePasswordSubtitle: string;
    securityEmailPlaceholder: string;
    securityEmailSubmit: string;
    securityEmailSubmitting: string;
    securityEmailSuccess: string;
    securityPasswordPlaceholder: string;
    securityPasswordConfirmPlaceholder: string;
    securityPasswordSubmit: string;
    securityPasswordSubmitting: string;
    securityPasswordSuccess: string;
    securityPasswordMismatch: string;
    securityPasswordTooShort: string;
    securityCancel: string;
  };
}

// ─── Shared row style ─────────────────────────────────────────────────────────

const ROW_BASE =
  'flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-base ease-out-expo hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-muted/60 w-full text-left';

// ─── Inline expand form ───────────────────────────────────────────────────────

function InlineForm({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      {children}
    </div>
  );
}

// ─── Change email sub-form ────────────────────────────────────────────────────

function ChangeEmailForm({
  labels,
  onClose,
}: {
  labels: AccountSecurityRowsProps['labels'];
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) {
        setStatus('error');
        setErrorMsg(error.message);
      } else {
        setStatus('ok');
      }
    });
  };

  if (status === 'ok') {
    return (
      <InlineForm>
        <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{labels.securityEmailSuccess}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {labels.securityCancel}
        </button>
      </InlineForm>
    );
  }

  return (
    <InlineForm>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.securityEmailPlaceholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {status === 'error' && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {errorMsg}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || !email.trim()}
            className={cn(
              'flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isPending ? labels.securityEmailSubmitting : labels.securityEmailSubmit}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {labels.securityCancel}
          </button>
        </div>
      </form>
    </InlineForm>
  );
}

// ─── Change password sub-form ─────────────────────────────────────────────────

function ChangePasswordForm({
  labels,
  onClose,
}: {
  labels: AccountSecurityRowsProps['labels'];
  onClose: () => void;
}) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      setStatus('error');
      setErrorMsg(labels.securityPasswordTooShort);
      return;
    }
    if (pw !== confirm) {
      setStatus('error');
      setErrorMsg(labels.securityPasswordMismatch);
      return;
    }
    setStatus('idle');
    setErrorMsg('');
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setStatus('error');
        setErrorMsg(error.message);
      } else {
        setStatus('ok');
      }
    });
  };

  if (status === 'ok') {
    return (
      <InlineForm>
        <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{labels.securityPasswordSuccess}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {labels.securityCancel}
        </button>
      </InlineForm>
    );
  }

  return (
    <InlineForm>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="password"
          autoComplete="new-password"
          required
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={labels.securityPasswordPlaceholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (status === 'error') { setStatus('idle'); setErrorMsg(''); }
          }}
          placeholder={labels.securityPasswordConfirmPlaceholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {status === 'error' && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {errorMsg}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || !pw || !confirm}
            className={cn(
              'flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isPending ? labels.securityPasswordSubmitting : labels.securityPasswordSubmit}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {labels.securityCancel}
          </button>
        </div>
      </form>
    </InlineForm>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccountSecurityRows({ labels }: AccountSecurityRowsProps) {
  const [expanded, setExpanded] = useState<'email' | 'password' | null>(null);

  const toggle = (row: 'email' | 'password') => {
    setExpanded((prev) => (prev === row ? null : row));
  };

  return (
    <>
      {/* Email row */}
      <div>
        <button
          type="button"
          onClick={() => toggle('email')}
          data-testid="settings-row-change-email"
          className={ROW_BASE}
          aria-expanded={expanded === 'email'}
        >
          <Mail
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium text-foreground">
              {labels.rowChangeEmailLabel}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {labels.rowChangeEmailSubtitle}
            </div>
          </div>
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              expanded === 'email' && 'rotate-90',
            )}
            aria-hidden="true"
          />
        </button>
        {expanded === 'email' && (
          <ChangeEmailForm labels={labels} onClose={() => setExpanded(null)} />
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border" />

      {/* Password row */}
      <div>
        <button
          type="button"
          onClick={() => toggle('password')}
          data-testid="settings-row-change-password"
          className={ROW_BASE}
          aria-expanded={expanded === 'password'}
        >
          <Lock
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium text-foreground">
              {labels.rowChangePasswordLabel}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {labels.rowChangePasswordSubtitle}
            </div>
          </div>
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              expanded === 'password' && 'rotate-90',
            )}
            aria-hidden="true"
          />
        </button>
        {expanded === 'password' && (
          <ChangePasswordForm labels={labels} onClose={() => setExpanded(null)} />
        )}
      </div>
    </>
  );
}

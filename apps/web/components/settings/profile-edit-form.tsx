'use client';

import { useState, useTransition } from 'react';
import { AtSign, CheckCircle2, AlertCircle } from 'lucide-react';

import { updateProfile } from '@/app/actions/profile';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// <ProfileEditForm /> — v1.w.UI.20.
//
// Clientseitige Form für Anzeigename + Bio. Submit geht über die Server-Action
// `updateProfile` (app/actions/profile.ts), die selbst Auth + Validierung
// macht — wir spiegeln hier nur Character-Counts live für UX, die authoritative
// Validierung bleibt serverseitig.
//
// States:
//   - "idle": nichts passiert
//   - "pending": Submit läuft (useTransition)
//   - "success": letzter Submit war erfolgreich (Banner oben, auto-versteckt
//     nach 3s — reine Feedback-Geste, Form bleibt editierbar für weitere
//     Änderungen)
//   - "error": Server-Action hat `ok: false` zurückgegeben; Fehlermeldung
//     bleibt sichtbar bis der User erneut submittet oder das entsprechende
//     Feld ändert
//
// Character-Counts sind der primäre Hint dass ein Feld an seinem Limit ist.
// Wir renderen sie rechts unter dem Input in `text-xs text-muted-foreground`
// und wechseln auf `text-destructive` wenn die Länge überschritten wird
// (zusätzliche client-side Vorwarnung, Server lehnt es sowieso ab).
// -----------------------------------------------------------------------------

const DISPLAY_NAME_MAX = 60;
const BIO_MAX = 200;

export interface ProfileEditFormLabels {
  displayName: string;
  displayNameHint: string;
  bio: string;
  bioHint: string;
  username: string;
  usernameHint: string;
  save: string;
  saving: string;
  saved: string;
  errorFallback: string;
}

export interface ProfileEditFormProps {
  initialDisplayName: string;
  initialBio: string;
  /** Username wird readonly angezeigt; Rename ist out-of-scope. */
  username: string;
  labels: ProfileEditFormLabels;
}

export function ProfileEditForm({
  initialDisplayName,
  initialBio,
  username,
  labels,
}: ProfileEditFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'success' }
    | { kind: 'error'; message: string; field?: string }
  >({ kind: 'idle' });
  const [isPending, startTransition] = useTransition();

  const displayNameTooLong = displayName.length > DISPLAY_NAME_MAX;
  const bioTooLong = bio.length > BIO_MAX;
  const displayNameEmpty = displayName.trim().length === 0;
  const clientInvalid = displayNameTooLong || bioTooLong || displayNameEmpty;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (clientInvalid || isPending) return;

    const fd = new FormData();
    fd.set('display_name', displayName);
    fd.set('bio', bio);

    startTransition(async () => {
      const result = await updateProfile(fd);
      if (result.ok) {
        setStatus({ kind: 'success' });
        // Success-Banner nach 3s wieder ausblenden. Kein useEffect — die
        // setTimeout-Referenz überlebt weitere State-Updates weil der
        // Banner-Check `status.kind === 'success'` bis dahin true bleibt.
        setTimeout(() => {
          setStatus((prev) => (prev.kind === 'success' ? { kind: 'idle' } : prev));
        }, 3000);
      } else {
        setStatus({
          kind: 'error',
          message: result.error || labels.errorFallback,
          field: result.field,
        });
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-border bg-card p-4 sm:p-6"
      data-testid="profile-edit-form"
    >
      {status.kind === 'success' && (
        <div
          className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
          data-testid="profile-edit-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{labels.saved}</span>
        </div>
      )}

      {status.kind === 'error' && (
        <div
          className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
          role="alert"
          data-testid="profile-edit-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{status.message}</span>
        </div>
      )}

      {/* Username — readonly. Wir rendern es als deaktiviertes Input damit es
          visuell zum Editor gehört, aber der AtSign-Icon + Hint machen klar
          dass es nicht bearbeitbar ist. */}
      <div className="space-y-1">
        <label
          htmlFor="profile-username"
          className="text-sm font-medium text-foreground"
        >
          {labels.username}
        </label>
        <div className="relative">
          <AtSign
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="profile-username"
            type="text"
            value={username}
            readOnly
            disabled
            aria-disabled
            className="w-full cursor-not-allowed rounded-lg border border-border bg-muted/40 py-2 pl-9 pr-3 text-sm text-muted-foreground"
            data-testid="profile-username-input"
          />
        </div>
        <p className="text-xs text-muted-foreground">{labels.usernameHint}</p>
      </div>

      {/* Display Name */}
      <div className="space-y-1">
        <label
          htmlFor="profile-display-name"
          className="text-sm font-medium text-foreground"
        >
          {labels.displayName}
        </label>
        <input
          id="profile-display-name"
          name="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX + 20 /* Hartes DOM-Limit etwas über dem
            UI-Limit damit Paste-Overflow immer noch im Char-Counter-Warn-State
            sichtbar wird, nicht silent truncated. */}
          aria-invalid={displayNameTooLong || displayNameEmpty || undefined}
          className={cn(
            'w-full rounded-lg border bg-background px-3 py-2 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
            displayNameTooLong || (displayNameEmpty && status.kind === 'error' && status.field === 'display_name')
              ? 'border-red-500'
              : 'border-border',
          )}
          data-testid="profile-display-name-input"
        />
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{labels.displayNameHint}</p>
          <span
            className={cn(
              'text-xs tabular-nums',
              displayNameTooLong ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            )}
            data-testid="profile-display-name-counter"
          >
            {displayName.length}/{DISPLAY_NAME_MAX}
          </span>
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-1">
        <label
          htmlFor="profile-bio"
          className="text-sm font-medium text-foreground"
        >
          {labels.bio}
        </label>
        <textarea
          id="profile-bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={BIO_MAX + 50}
          aria-invalid={bioTooLong || undefined}
          className={cn(
            'w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
            bioTooLong ? 'border-red-500' : 'border-border',
          )}
          data-testid="profile-bio-input"
        />
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{labels.bioHint}</p>
          <span
            className={cn(
              'text-xs tabular-nums',
              bioTooLong ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            )}
            data-testid="profile-bio-counter"
          >
            {bio.length}/{BIO_MAX}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={clientInvalid || isPending}
          data-testid="profile-save-button"
          className={cn(
            'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors',
            'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {isPending ? labels.saving : labels.save}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { deleteMyAccount } from '@/app/actions/gdpr';

// -----------------------------------------------------------------------------
// <DeleteAccountCard /> — Zwei-Schritt-Bestätigung für Account-Löschung.
//
//   Schritt 1: Button „Konto löschen" expandiert die Karte zur Bestätigungs-
//              Form mit Tipp-Eingabe.
//   Schritt 2: User tippt „ACCOUNT LÖSCHEN" (Case-sensitive) → Submit.
//
// Server-Action `deleteMyAccount` ruft die Supabase-RPC, cleart Session und
// redirectet auf „/?account-deleted=1". Der Client sieht den Redirect als
// Seitenwechsel — State hier muss nicht explizit auf „done" gesetzt werden.
// -----------------------------------------------------------------------------

const CONFIRMATION = 'ACCOUNT LÖSCHEN';

export function DeleteAccountCard() {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [pending, start] = useTransition();

  const matches = text === CONFIRMATION;

  function handleCancel() {
    setExpanded(false);
    setText('');
  }

  function handleSubmit() {
    if (!matches) return;

    start(async () => {
      const res = await deleteMyAccount(text);
      // Bei Erfolg redirectet die Server-Action — wir kommen hier nur im
      // Fehlerfall raus.
      if (res && !res.ok) {
        toast.error(res.error);
      }
    });
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <Trash2 className="h-4 w-4" />
        Konto löschen
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-background p-4">
      <div className="mb-3 flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-foreground">
            Das kann nicht rückgängig gemacht werden.
          </p>
          <p className="mt-1 text-muted-foreground">
            Tippe zur Bestätigung exakt{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {CONFIRMATION}
            </code>{' '}
            ein.
          </p>
        </div>
      </div>

      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={CONFIRMATION}
        autoComplete="off"
        spellCheck={false}
        disabled={pending}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-destructive focus:ring-1 focus:ring-destructive disabled:opacity-60"
      />

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!matches || pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {pending ? 'Lösche…' : 'Konto endgültig löschen'}
        </button>
      </div>
    </div>
  );
}

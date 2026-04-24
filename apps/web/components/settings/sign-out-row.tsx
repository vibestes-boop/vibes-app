'use client';

import { useTransition } from 'react';
import { ChevronRight, LogOut } from 'lucide-react';

import { signOut } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// <SignOutRow /> — v1.w.UI.18 D7.
//
// Destruktive Row die `signOut()` als Server-Action triggert. Sign-Out ist
// keine Navigation und braucht daher einen echten Form-Submit (Next redirected
// dann). Wir wrappen NICHT in SettingsRow weil dort das Form-Markup nicht
// reinpasst (SettingsRow ist bewusst nur `Link` ODER `div`).
//
// `useTransition` markiert den Submit als non-blocking und deaktiviert den
// Button währenddessen (Doppel-Submit-Schutz bei schnellen Klicks).
//
// ⚠️ RSC-Boundary-Hinweis (Hotfix nach Vercel-Error digest 1974146109):
// Das `LogOut`-Icon wird HIER lokal importiert und nicht mehr als Prop von
// außen übergeben. Lucide-Icons sind `React.forwardRef(...)` — Funktionen
// mit `$$typeof`/`render`/`displayName`. Wenn ein Server-Component (wie
// `/settings/page.tsx`) so einen Function-Value als Prop an einen Client-
// Component reicht, versucht Next die Prop zu serialisieren → harter
// Runtime-Crash „Functions cannot be passed directly to Client Components".
// Die saubere Regel: Icon-Komponenten (oder beliebige Funktionen) niemals
// über die RSC-Grenze als Prop reichen. Entweder das Icon INLINE als JSX
// rendern (`icon={<LogOut />}` → wird als ReactNode serialisiert) oder —
// wie hier — im Client-Component selbst referenzieren. Für eine Single-
// Purpose-Komponente wie SignOutRow ist „hardcoded LogOut" am ehrlichsten,
// weil das Icon ohnehin nie variiert.
// -----------------------------------------------------------------------------

export interface SignOutRowProps {
  label: string;
}

export function SignOutRow({ label }: SignOutRowProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(async () => {
          await signOut();
        });
      }}
    >
      <button
        type="submit"
        disabled={isPending}
        data-testid="settings-row-sign-out"
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors duration-base ease-out-expo',
          'text-red-600 hover:bg-red-500/10 dark:text-red-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-red-500/10',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <LogOut className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
        <span className="flex-1 truncate font-medium">{label}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-red-600/70 dark:text-red-400/70" aria-hidden="true" />
      </button>
    </form>
  );
}

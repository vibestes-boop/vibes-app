'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, LogIn } from 'lucide-react';

import { switchGuild } from '@/app/actions/guilds';

// -----------------------------------------------------------------------------
// <SwitchGuildButton /> — CTA auf /g/[id] Detail, wenn User NICHT Mitglied ist.
//
// Confirm-Dialog via `window.confirm` — rudimentär absichtlich: Pod-Switch
// triggert 24h-Cooldown, also einen bewussten Klick. Später könnten wir auf
// eine shadcn/AlertDialog-Komponente upgraden.
// -----------------------------------------------------------------------------

export interface SwitchGuildButtonProps {
  guildId: string;
  guildName: string;
  isMember: boolean;
  isAuthed: boolean;
}

export function SwitchGuildButton({
  guildId,
  guildName,
  isMember,
  isAuthed,
}: SwitchGuildButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isAuthed) {
    return (
      <a
        href={`/login?next=/g/${guildId}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
      >
        <LogIn className="h-4 w-4" />
        Einloggen zum Wechseln
      </a>
    );
  }

  if (isMember) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Dein aktueller Pod
      </span>
    );
  }

  const handleSwitch = () => {
    if (
      !window.confirm(
        `In Pod „${guildName}" wechseln?\n\nDein Feed wird umgestellt und du kannst erst in 24h wieder wechseln.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await switchGuild(guildId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSwitch}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'Wechsle…' : 'In diesen Pod wechseln'}
      </button>
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
}

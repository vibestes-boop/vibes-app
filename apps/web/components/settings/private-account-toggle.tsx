'use client';

import { useState, useTransition } from 'react';
import { Lock, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { setPrivateAccount } from '@/app/actions/profile';

// -----------------------------------------------------------------------------
// PrivateAccountToggle — v1.w.UI.149
//
// Schaltet `profiles.is_private` um. Beim Wechsel auf öffentlich werden
// alle ausstehenden Follow-Requests automatisch in Follows konvertiert
// (server-seitig in setPrivateAccount).
// -----------------------------------------------------------------------------

export function PrivateAccountToggle({ initialIsPrivate }: { initialIsPrivate: boolean }) {
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const next = !isPrivate;

    // Confirm before opening private → public (follow-requests get auto-approved)
    if (!next && isPrivate) {
      if (!window.confirm(
        'Konto auf öffentlich schalten?\n\nAlle ausstehenden Follower-Anfragen werden automatisch angenommen.'
      )) return;
    }

    setIsPrivate(next);
    startTransition(async () => {
      const res = await setPrivateAccount(next);
      if (!res.ok) {
        setIsPrivate(!next); // rollback
        toast.error('Fehler', { description: res.error });
        return;
      }
      toast.success(next ? 'Konto ist jetzt privat' : 'Konto ist jetzt öffentlich');
    });
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
        </div>
        <div>
          <p className="text-sm font-medium">
            {isPrivate ? 'Privates Konto' : 'Öffentliches Konto'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPrivate
              ? 'Nur Follower die du genehmigst können deine Posts und Stories sehen. Neue Follower müssen eine Anfrage stellen.'
              : 'Jeder kann dein Profil, deine Posts und Stories sehen und dir folgen.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isPrivate}
        onClick={handleToggle}
        disabled={isPending}
        className={[
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isPrivate ? 'bg-primary' : 'bg-muted-foreground/30',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
            isPrivate ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

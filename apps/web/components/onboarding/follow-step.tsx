'use client';

// -----------------------------------------------------------------------------
// FollowStep — v1.w.UI.98 Multi-Step Onboarding: Account-Suggestions.
//
// Rendered client-side so Follow buttons can do optimistic updates.
// Suggested accounts come from getSuggestedFollows() (already filtered: no
// already-followed, no self). isFollowing=false / isSelf=false always.
//
// "Los geht's" is always enabled — the user can skip following anyone.
// -----------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Check, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { toggleFollow } from '@/app/actions/engagement';

export interface SuggestedFollowItem {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  verified: boolean;
}

// ---- Single account card ----------------------------------------------------

function AccountCard({
  person,
  isAuthenticated,
}: {
  person: SuggestedFollowItem;
  isAuthenticated: boolean;
}) {
  const [following, setFollowing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    if (!isAuthenticated) {
      toast.error('Bitte melde dich an, um zu folgen.');
      return;
    }

    const wasFollowing = following;
    setFollowing(!wasFollowing);

    startTransition(async () => {
      const result = await toggleFollow(person.id, wasFollowing);
      if (!result.ok) {
        setFollowing(wasFollowing); // rollback
        toast.error('Folgen fehlgeschlagen.');
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      {/* Avatar */}
      <Link href={`/u/${person.username}` as Route} className="shrink-0">
        {person.avatar_url ? (
          <Image
            src={person.avatar_url}
            alt={person.username}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold uppercase text-muted-foreground">
            {(person.display_name ?? person.username).charAt(0)}
          </div>
        )}
      </Link>

      {/* Name + username */}
      <div className="min-w-0 flex-1">
        <Link href={`/u/${person.username}` as Route}>
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {person.display_name ?? person.username}
            {person.verified && (
              <span className="ml-1 inline-block h-3.5 w-3.5 rounded-full bg-brand-gold text-[9px] leading-[14px] text-white" aria-label="Verifiziert">
                ✓
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
        </Link>
      </div>

      {/* Follow button */}
      <button
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={following}
        className={[
          'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          following
            ? 'border border-border bg-transparent text-foreground hover:bg-muted'
            : 'bg-foreground text-background hover:opacity-80',
        ].join(' ')}
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : following ? (
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3" /> Gefolgt
          </span>
        ) : (
          'Folgen'
        )}
      </button>
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function FollowStep({
  suggested,
  next,
  isAuthenticated,
}: {
  suggested: SuggestedFollowItem[];
  next: string;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [navigating, startNav] = useTransition();

  function handleFinish() {
    startNav(() => {
      router.push(next as Route);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Accounts entdecken</h1>
        <p className="text-sm text-muted-foreground">
          Folge Accounts, um deinen Feed zu befüllen — oder überspring diesen Schritt.
        </p>
      </div>

      {/* Account list */}
      {suggested.length > 0 ? (
        <ul className="space-y-2" role="list">
          {suggested.map((person) => (
            <li key={person.id}>
              <AccountCard person={person} isAuthenticated={isAuthenticated} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
          Gerade keine Vorschläge — schau später noch mal rein.
        </div>
      )}

      {/* CTA */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleFinish}
        disabled={navigating}
      >
        {navigating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Los geht&apos;s
      </Button>
    </div>
  );
}

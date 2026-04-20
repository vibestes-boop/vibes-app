import Link from 'next/link';
import type { Route } from 'next';
import { Plus } from 'lucide-react';

import { getActiveStoryGroups } from '@/lib/data/stories';
import { createClient } from '@/lib/supabase/server';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// StoryStrip — Horizontaler Story-Ring-Strip oberhalb des Feeds.
//
// Eigene Story-Card zeigt Plus-Icon wenn noch keine aktive Story existiert,
// sonst den eigenen Story-Ring zum Wiederansehen. Ungesehene Stories haben
// einen goldenen Gradient-Ring, gesehene einen grauen.
//
// SSR: Server-Component, fetcht via `getActiveStoryGroups()`. Revalidierung
// geschieht über `revalidatePath('/')` in `createStory`/`deleteStory`-Actions.
// -----------------------------------------------------------------------------

export async function StoryStrip() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const groups = await getActiveStoryGroups();

  // Eigene Story separieren (wird an erster Stelle mit Plus-Badge gerendert)
  const ownGroup = groups.find((g) => g.userId === user.id) ?? null;
  const otherGroups = groups.filter((g) => g.userId !== user.id);

  // Eigenes Profil kurz fetchen damit wir Avatar/Username auch zeigen können
  // wenn User noch keine Story hat.
  const { data: meRow } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  const me = (meRow as { username: string | null; avatar_url: string | null } | null) ?? null;

  return (
    <div className="border-b border-border bg-background/50 px-3 py-3">
      <div
        className="flex items-start gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        <OwnStoryCard
          username={me?.username ?? null}
          avatarUrl={me?.avatar_url ?? null}
          hasStory={!!ownGroup}
          hasUnviewed={ownGroup?.hasUnviewed ?? false}
          ownUserId={user.id}
        />

        {otherGroups.map((g) => (
          <StoryCard
            key={g.userId}
            userId={g.userId}
            username={g.username}
            avatarUrl={g.avatar_url}
            hasUnviewed={g.hasUnviewed}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Card für eigene Story ────────────────────────────────────────────────

function OwnStoryCard({
  username,
  avatarUrl,
  hasStory,
  hasUnviewed,
  ownUserId,
}: {
  username: string | null;
  avatarUrl: string | null;
  hasStory: boolean;
  hasUnviewed: boolean;
  ownUserId: string;
}) {
  const href = hasStory ? (`/stories/${ownUserId}` as Route) : ('/stories/new' as Route);

  return (
    <Link
      href={href}
      className="flex w-16 shrink-0 flex-col items-center gap-1"
      aria-label={hasStory ? 'Eigene Story ansehen' : 'Story erstellen'}
    >
      <div className="relative">
        <div
          className={cn(
            'rounded-full p-[2px]',
            hasStory && hasUnviewed
              ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-500'
              : hasStory
                ? 'bg-muted'
                : 'bg-transparent',
          )}
        >
          <div className="rounded-full bg-background p-[2px]">
            <Avatar className="h-14 w-14">
              <AvatarImage src={avatarUrl ?? undefined} alt="" />
              <AvatarFallback>
                {(username ?? '?').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        {!hasStory && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-brand-gold text-white">
            <Plus className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </div>
      <span className="max-w-full truncate text-[11px] font-medium">Deine Story</span>
    </Link>
  );
}

// ─── Card für andere User ─────────────────────────────────────────────────

function StoryCard({
  userId,
  username,
  avatarUrl,
  hasUnviewed,
}: {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  hasUnviewed: boolean;
}) {
  return (
    <Link
      href={`/stories/${userId}` as Route}
      className="flex w-16 shrink-0 flex-col items-center gap-1"
      aria-label={`Story von @${username ?? '…'}`}
    >
      <div
        className={cn(
          'rounded-full p-[2px]',
          hasUnviewed
            ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-500'
            : 'bg-muted',
        )}
      >
        <div className="rounded-full bg-background p-[2px]">
          <Avatar className="h-14 w-14">
            <AvatarImage src={avatarUrl ?? undefined} alt="" />
            <AvatarFallback>
              {(username ?? '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
      <span className="max-w-full truncate text-[11px] text-muted-foreground">
        @{username ?? '…'}
      </span>
    </Link>
  );
}

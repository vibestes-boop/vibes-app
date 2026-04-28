import Link from 'next/link';
import type { Route } from 'next';
import { Plus } from 'lucide-react';

import { getActiveStoryGroups } from '@/lib/data/stories';
import { getActiveLiveSessions } from '@/lib/data/live';
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
// v1.w.UI.228 — Live-Bubbles: Aktive Live-Sessions werden als LIVE-Badge
// auf Story-Ringen dargestellt. User die live sind aber keine Story haben
// bekommen einen eigenständigen LIVE-Bubble am Ende des Strips.
// Parität mit native StoriesRow (liveSessions prop).
//
// SSR: Server-Component, fetcht via `getActiveStoryGroups()` +
// `getActiveLiveSessions()`. Revalidierung via `revalidatePath('/')`.
// -----------------------------------------------------------------------------

export async function StoryStrip() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [groups, liveSessions] = await Promise.all([
    getActiveStoryGroups(),
    getActiveLiveSessions(8),
  ]);

  // ── Eigene Story separieren (wird an erster Stelle mit Plus-Badge gerendert)
  const ownGroup = groups.find((g) => g.userId === user.id) ?? null;
  const otherGroups = groups.filter((g) => g.userId !== user.id);

  // ── Live-Session-Lookup: host_id → session id
  const liveByHostId = new Map(liveSessions.map((s) => [s.host_id, s]));

  // ── Story-Authors die auch gerade live sind
  const storyAuthorIds = new Set(groups.map((g) => g.userId));

  // ── Live-only Bubbles: aktive Live-Sessions ohne eigene Story im Strip
  // (eigener Stream ausgeschlossen — der Host hat bessere Wege das zu sehen)
  const liveOnlyBubbles = liveSessions.filter(
    (s) => !storyAuthorIds.has(s.host_id) && s.host_id !== user.id,
  );

  // ── Eigenes Profil kurz fetchen damit wir Avatar/Username auch zeigen können
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
        className="flex items-start gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <OwnStoryCard
          username={me?.username ?? null}
          avatarUrl={me?.avatar_url ?? null}
          hasStory={!!ownGroup}
          hasUnviewed={ownGroup?.hasUnviewed ?? false}
          ownUserId={user.id}
        />

        {otherGroups.map((g) => {
          const live = liveByHostId.get(g.userId);
          return (
            <StoryCard
              key={g.userId}
              userId={g.userId}
              username={g.username}
              avatarUrl={g.avatar_url}
              hasUnviewed={g.hasUnviewed}
              liveSessionId={live?.id ?? null}
            />
          );
        })}

        {/* Live-only Bubbles — Accounts die live sind aber keine Story haben */}
        {liveOnlyBubbles.map((session) => (
          <LiveOnlyCard
            key={session.id}
            sessionId={session.id}
            username={session.host?.username ?? null}
            avatarUrl={session.host?.avatar_url ?? null}
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

// ─── Card für andere User (Story ± LIVE badge) ────────────────────────────

function StoryCard({
  userId,
  username,
  avatarUrl,
  hasUnviewed,
  liveSessionId,
}: {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  hasUnviewed: boolean;
  liveSessionId: string | null;
}) {
  // When user is live, clicking goes to the live stream, not their stories.
  const href = liveSessionId
    ? (`/live/${liveSessionId}` as Route)
    : (`/stories/${userId}` as Route);

  return (
    <Link
      href={href}
      className="flex w-16 shrink-0 flex-col items-center gap-1"
      aria-label={liveSessionId ? `@${username ?? '…'} ist live` : `Story von @${username ?? '…'}`}
    >
      <div className="relative">
        {/* LIVE-Ring: pulsierender roter Rahmen wenn aktiv live */}
        {liveSessionId ? (
          <div className="animate-pulse rounded-full bg-red-500 p-[2.5px]">
            <div className="rounded-full bg-background p-[2px]">
              <Avatar className="h-14 w-14">
                <AvatarImage src={avatarUrl ?? undefined} alt="" />
                <AvatarFallback>
                  {(username ?? '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        ) : (
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
        )}
        {/* LIVE badge */}
        {liveSessionId && (
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-sm bg-red-500 px-1 py-0 text-[8px] font-bold uppercase tracking-widest text-white">
            Live
          </span>
        )}
      </div>
      <span className="max-w-full truncate text-[11px] text-muted-foreground">
        @{username ?? '…'}
      </span>
    </Link>
  );
}

// ─── Standalone LIVE-Bubble (kein Story-Ring) ─────────────────────────────

function LiveOnlyCard({
  sessionId,
  username,
  avatarUrl,
}: {
  sessionId: string;
  username: string | null;
  avatarUrl: string | null;
}) {
  return (
    <Link
      href={`/live/${sessionId}` as Route}
      className="flex w-16 shrink-0 flex-col items-center gap-1"
      aria-label={`@${username ?? '…'} ist live`}
    >
      <div className="relative">
        <div className="animate-pulse rounded-full bg-red-500 p-[2.5px]">
          <div className="rounded-full bg-background p-[2px]">
            <Avatar className="h-14 w-14">
              <AvatarImage src={avatarUrl ?? undefined} alt="" />
              <AvatarFallback>
                {(username ?? '?').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-sm bg-red-500 px-1 py-0 text-[8px] font-bold uppercase tracking-widest text-white">
          Live
        </span>
      </div>
      <span className="max-w-full truncate text-[11px] text-muted-foreground">
        @{username ?? '…'}
      </span>
    </Link>
  );
}

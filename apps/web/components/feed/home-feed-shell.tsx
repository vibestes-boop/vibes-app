'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FeedList } from './feed-list';
import { FeedSidebar } from './feed-sidebar';
import { CommentSheet } from './comment-sheet';
import { CommentPanel } from './comment-panel';
import {
  FeedInteractionProvider,
  useFeedInteraction,
} from './feed-interaction-context';
import type { FeedPost, FollowedAccount, SuggestedFollow } from '@/lib/data/feed';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// HomeFeedShell — Client-Shell für authentifizierte User auf `/`.
// Links: Kategorien/Links (SidebarLeft), Mitte: FeedList (edge-to-edge über die
// volle Höhe, Tab-Pills als Floating-Overlay obenauf), rechts: Suggested-
// Follows (SidebarRight).
//
// Initial-Daten werden SSR-seitig geladen und als Props reingereicht.
// Following-Tab lädt erst on-switch (useQuery mit `enabled: true` erst nach
// Klick) — spart uns den Round-Trip wenn User auf For-You bleibt.
//
// `storyStripSlot` ist ein optionales ReactNode-Slot (wir passen den Server-
// gerenderten <StoryStrip /> durch, damit die Shell ein Client-Component
// bleiben kann ohne selber Auth-Reads zu machen). Seit v1.w.UI.10 wird der
// Strip NUR im Following-Tab angezeigt — im „Für dich"-Feed ist er ausgeblendet
// (TikTok-Referenz: dort gibt es auf For-You überhaupt keine Story-Row, und
// unser For-You-Viewport soll denselben edge-to-edge Video-Flow bekommen).
//
// v1.w.UI.11 Phase C — Comment-Push-Layout:
// - FeedInteractionProvider wrappt den gesamten Shell-Subtree, damit einzelne
//   FeedCards über `useFeedInteraction()` das globale „Welcher Post hat
//   gerade offene Kommentare?" setzen können, ohne Prop-Drilling.
// - Auf xl+ ersetzt ein `<CommentPanel>` die rechte Discover-Sidebar
//   während ein Post aktiv ist — kein Overlay, kein Blur, kein Modal. Die
//   Video-Center-Spalte bleibt interaktiv, man kann weiter liken/scrollen.
// - Auf < xl bleibt der existierende `<CommentSheet>` als Overlay-Flow, weil
//   dort die Viewport-Breite für einen Push nicht reicht.
// -----------------------------------------------------------------------------

export interface HomeFeedShellProps {
  viewerId: string | null;
  initialForYou: FeedPost[];
  initialFollowing: FeedPost[] | null; // null = noch nicht geladen
  suggested: SuggestedFollow[];
  storyStripSlot?: ReactNode;
  /**
   * Initialer Tab — wird von `/following/page.tsx` auf `'following'` gesetzt,
   * damit Deep-Links + Sidebar-Klicks direkt im richtigen Tab landen. Default
   * ist `'foryou'` — bei Home (`/`) soll der For-You-Tab aktiv sein.
   */
  initialTab?: TabKey;
  /**
   * SSR-gefetchte Top-N gefolgte Accounts (v1.w.UI.11 Phase B). Wird an die
   * FeedSidebar durchgereicht, die daraus die „Konten, denen ich folge"-
   * Sektion rendert. Logged-out / nicht-gefetcht → undefined → Sektion
   * verschwindet stillschweigend.
   */
  followedAccounts?: FollowedAccount[];
}

type TabKey = 'foryou' | 'following';

export function HomeFeedShell(props: HomeFeedShellProps) {
  // Provider MUSS außen sein — sonst können FeedCards innerhalb der
  // FeedList die `openCommentsFor`-Action nicht auflösen. Den inneren
  // Shell-Body haben wir aus HomeFeedShell rausextrahiert damit der Body
  // selbst den Hook rufen darf (Hook-Rules: nur unterhalb des Providers).
  return (
    <FeedInteractionProvider>
      <HomeFeedShellBody {...props} />
    </FeedInteractionProvider>
  );
}

function HomeFeedShellBody({
  viewerId,
  initialForYou,
  initialFollowing,
  suggested,
  storyStripSlot,
  initialTab = 'foryou',
  followedAccounts,
}: HomeFeedShellProps) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const { commentsOpenForPostId, closeComments } = useFeedInteraction();

  // Feed-Daten (inkl. `allow_comments`-Flag des aktuell offenen Posts) brauchen
  // wir hier, damit CommentPanel + CommentSheet die korrekten Metadaten kriegen.
  const followingQuery = useQuery<FeedPost[]>({
    queryKey: ['feed', 'following'],
    enabled: tab === 'following' && initialFollowing === null,
    initialData: initialFollowing ?? undefined,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch('/api/feed/following', { cache: 'no-store' });
      if (!res.ok) throw new Error('Feed konnte nicht geladen werden');
      return (await res.json()) as FeedPost[];
    },
  });

  const followingPosts = followingQuery.data ?? initialFollowing ?? [];

  // `allowComments` für den offenen Post auflösen — wir suchen in beiden
  // Tab-Listen, damit der Panel-Content auch nach Tab-Wechsel korrekt bleibt
  // (der User kann z.B. einen Post auf For-You öffnen und dann auf
  // Following switchen — Panel bleibt offen und zeigt weiterhin den Post).
  const activePost: FeedPost | undefined = commentsOpenForPostId
    ? initialForYou.find((p) => p.id === commentsOpenForPostId) ??
      followingPosts.find((p) => p.id === commentsOpenForPostId)
    : undefined;
  // Fallback: wenn der Post aus der aktuellen Liste rausgescrollt ist (weil
  // pagination nachgeladen hat) nehmen wir `true` als sichersten Default —
  // wenn der User tatsächlich posted ohne Kommentar-Berechtigung greift die
  // Server-RPC in createComment() als letzte Verteidigung.
  const activeAllowComments = activePost?.allow_comments ?? true;

  // ESC schließt den Kommentar-Panel (auf xl+ ist das die einzige
  // Tastatur-Möglichkeit, weil kein Radix-Dialog mit eingebautem Handler).
  // Auf < xl rendert Radix-Sheet selber einen Escape-Handler in CommentSheet
  // — dort wäre ein Doppel-Handler okay (Idempotent), aber wir registrieren
  // ihn trotzdem nur wenn der Panel-Mode aktiv ist, um den Scope zu begrenzen.
  useEffect(() => {
    if (!commentsOpenForPostId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeComments();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commentsOpenForPostId, closeComments]);

  // Responsive-Breakpoint-Tracking: Wir brauchen die Info, ob der User
  // gerade auf xl+ ist, um zu entscheiden, welcher Comment-Container
  // rendert (Panel inline vs. Sheet overlay). Tailwind-Breakpoint `xl`
  // = 1280px.
  const [isXl, setIsXl] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => setIsXl(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const showInlinePanel = isXl && !!commentsOpenForPostId;
  // Auf < xl: Sheet-Overlay (kontrolliert über Context-State) sobald ein
  // Post offen ist. Der alte lokale `commentsOpen`-State in FeedCard ist
  // gestrichen (Phase C) — Shell ist der einzige Owner.
  const showMobileSheet = !isXl && !!commentsOpenForPostId;

  return (
    <div
      className={cn(
        'grid h-[100dvh] w-full grid-cols-1 grid-rows-[minmax(0,1fr)]',
        // Grid-Template je nach Panel-Mode.
        // - Default: 260 | Feed | 320 (rechte Discover-Sidebar).
        // - Panel offen (xl+): 260 | Feed | 400 (CommentPanel breiter als
        //   Discover, weil Kommentar-Threads mehr horizontalen Platz brauchen).
        showInlinePanel
          ? 'xl:grid-cols-[260px_1fr_400px]'
          : 'xl:grid-cols-[260px_1fr_320px]',
      )}
    >
      {/* Left Sidebar (Desktop only) */}
      <aside className="hidden border-r border-border xl:block">
        <FeedSidebar viewerId={viewerId} followedAccounts={followedAccounts} />
      </aside>

      {/*
       * Center — Feed als edge-to-edge Video-Stage (v1.w.UI.10 Layout-Reset).
       *
       * Seit v1.w.UI.10: Der frühere „Floating-Window"-Look (xl:m-3 +
       * xl:rounded-2xl + xl:shadow-elevation-3) ist weg. Das Video füllt auf
       * Desktop die komplette Center-Spalte zwischen Sidebar-Kante und rechter
       * Discover-Column, ohne Rand, ohne Rundung, ohne Shadow — TikTok-parität.
       *
       * Der schwarze Canvas (`bg-zinc-950 text-white`) bleibt, weil Video-
       * Content darauf wie designed kontrastiert; die Chroma-Separierung zur
       * hellen Site-Umgebung bleibt erhalten, nur eben flush statt floating.
       *
       * Tab-Pills „Für dich / Folge ich" sind jetzt ein Floating-Overlay am
       * oberen Stage-Rand (absolute top-3 center, z-20). Das nimmt die früher
       * permanente h-12 Tab-Row aus dem Content-Flow heraus und gibt dem Video
       * ~48px zusätzliche Höhe — direkt wie in TikToks Web-Viewer.
       */}
      <div className="relative flex min-w-0 flex-col bg-zinc-950 text-white">
        <div
          role="tablist"
          aria-label="Feed-Quellen"
          className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-6 rounded-full bg-black/35 px-5 py-1.5 backdrop-blur-md"
        >
          <FeedTabButton
            label="Für dich"
            active={tab === 'foryou'}
            onClick={() => setTab('foryou')}
          />
          <FeedTabButton
            label="Folge ich"
            active={tab === 'following'}
            disabled={!viewerId}
            onClick={() => setTab('following')}
          />
        </div>

        <div className="min-h-0 flex-1">
          <div className={cn('h-full', tab !== 'foryou' && 'hidden')}>
            <FeedList
              initialPosts={initialForYou}
              viewerId={viewerId}
              feedKey="foryou"
            />
          </div>
          <div className={cn('flex h-full flex-col', tab !== 'following' && 'hidden')}>
            {storyStripSlot ? <div className="shrink-0">{storyStripSlot}</div> : null}
            <div className="min-h-0 flex-1">
              {followingQuery.isFetching && followingPosts.length === 0 ? (
                <FollowingSkeleton />
              ) : (
                <FeedList
                  initialPosts={followingPosts}
                  viewerId={viewerId}
                  feedKey="following"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column — entweder Discover-Sidebar oder Comment-Panel (xl+).
          Auf < xl werden beide versteckt; Kommentare kommen dort via Sheet. */}
      <aside className="hidden border-l border-border xl:block">
        {showInlinePanel && commentsOpenForPostId ? (
          <CommentPanel
            postId={commentsOpenForPostId}
            allowComments={activeAllowComments}
            viewerId={viewerId}
            onClose={closeComments}
          />
        ) : (
          <FeedSidebarRight suggested={suggested} viewerId={viewerId} />
        )}
      </aside>

      {/* Mobile/< xl: Sheet-Overlay als Kommentar-UI. Mount nur wenn gebraucht,
          damit der interne useComments-Hook on-demand lädt. */}
      {showMobileSheet && commentsOpenForPostId && (
        <CommentSheet
          postId={commentsOpenForPostId}
          open={true}
          onOpenChange={(next) => {
            if (!next) closeComments();
          }}
          allowComments={activeAllowComments}
          viewerId={viewerId}
        />
      )}
    </div>
  );
}

// Unfortunately we need the right sidebar as a separate component too,
// aber der Sidebar-Reuse ist nur minimal → inline here.
// (Imports geshared mit feed-sidebar.tsx wäre Overkill).

import Link from 'next/link';
import type { Route } from 'next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { BadgeCheck, Compass, TrendingUp } from 'lucide-react';
import { useToggleFollow } from '@/hooks/use-engagement';

function FeedSidebarRight({
  suggested,
  viewerId,
}: {
  suggested: SuggestedFollow[];
  viewerId: string | null;
}) {
  const follow = useToggleFollow();
  const [pending, startTransition] = useTransition();

  return (
    <div className="sticky top-0 flex h-[100dvh] flex-col gap-6 overflow-y-auto p-6">
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Compass className="h-3.5 w-3.5" />
          Entdecken
        </h2>
        <div className="flex flex-col gap-1">
          <Link
            href={'/explore' as Route}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <TrendingUp className="h-4 w-4" />
            Trending Hashtags
          </Link>
        </div>
      </section>

      {suggested.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vorgeschlagene Accounts
          </h2>
          <ul className="flex flex-col gap-3">
            {suggested.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <Link href={`/u/${s.username}` as Route} aria-label={`Profil von @${s.username}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={s.avatar_url ?? undefined} />
                    <AvatarFallback>{(s.display_name ?? s.username).slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${s.username}` as Route}
                    className="flex items-center gap-1 truncate text-sm font-semibold hover:underline"
                  >
                    @{s.username}
                    {s.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-gold" />}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.display_name ?? `${s.follower_count} Follower`}
                  </div>
                </div>
                {viewerId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs"
                    onClick={() =>
                      startTransition(() => {
                        follow.mutate({ userId: s.id, following: false });
                      })
                    }
                    disabled={follow.isPending || pending}
                  >
                    Folgen
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-auto text-xs text-muted-foreground">
        <nav className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href={'/terms' as Route} className="hover:text-foreground">AGB</Link>
          <Link href={'/privacy' as Route} className="hover:text-foreground">Datenschutz</Link>
          <Link href={'/imprint' as Route} className="hover:text-foreground">Impressum</Link>
        </nav>
        <div className="mt-2">© {new Date().getFullYear()} Serlo</div>
      </footer>
    </div>
  );
}

function FollowingSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function FeedTabButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  // Tabs sitzen seit v1.w.UI.10 innerhalb einer Floating-Pill direkt auf dem
  // Video-Canvas (absolute top-3 center). Kontrast-Skala bleibt die gleiche
  // wie vorher in der Tab-Bar: aktiv = weiß + kleiner Underline, inaktiv =
  // weiß/60% (weich, aber auf leicht transparentem schwarzen Pill-Hintergrund
  // noch lesbar), disabled = weiß/30% ohne Hover-Feedback.
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'border-b-2 px-0 py-1 text-sm font-semibold transition-colors duration-base ease-out-expo',
        active
          ? 'border-white text-white'
          : 'border-transparent text-white/60 hover:text-white',
        disabled && 'cursor-not-allowed opacity-40 hover:text-white/60',
      )}
    >
      {label}
    </button>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { BadgeCheck, Bookmark, MessageCircle, Search } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import { getConversations } from '@/lib/data/messages';
import type { ConversationPreview } from '@/lib/data/messages';
import { getActiveStoryGroups } from '@/lib/data/stories';
import { getActiveLiveSessions } from '@/lib/data/live';
import { NewConversationButton } from '@/components/messages/new-conversation-button';
import { EmptyState as CanonicalEmptyState } from '@/components/ui/empty-state';
import { StoryStrip } from '@/components/feed/story-strip';
import { cn } from '@/lib/utils';
import { getT } from '@/lib/i18n/server';

// -----------------------------------------------------------------------------
// /messages — Konversations-Liste
//
// SSR-Render des kompletten Konversations-Grids. Realtime-Updates (eingehende
// Nachrichten während die Liste offen ist) kommen über den
// `conversations-realtime`-Channel im Client-Wrapper; für den ersten Render
// reicht der SSR-Snapshot.
//
// v1.w.UI.230 — Parity mit native messages tab:
// - StoryStrip oberhalb der Konversationsliste (Stories + Live-Bubbles)
// - Story-Ring (Gradient für ungesehen, grau für gesehen) auf Conv-Avataren
// - LIVE-Ring + LIVE-Badge auf Avataren von live-streamenden Kontakten
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Nachrichten',
  description: 'Deine Unterhaltungen.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'jetzt';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default async function MessagesPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login?next=/messages');
  }

  // Parallel fetch: Konversationen + Story-Groups + Live-Sessions
  const [conversations, storyGroups, liveSessions, t] = await Promise.all([
    getConversations(),
    getActiveStoryGroups(),
    getActiveLiveSessions(20),
    getT(),
  ]);

  // ── Lookup-Maps für Avatar-Decorations ───────────────────────────────────
  // userId → { hasUnviewed: boolean } — nur andere User (kein self-chat)
  const storyByUserId = new Map(storyGroups.map((g) => [g.userId, g]));
  // userId → live-session-id
  const liveByUserId = new Map(liveSessions.map((s) => [s.host_id, s.id]));

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col py-6">
      <header className="mb-4 flex items-center justify-between px-4 md:px-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MessageCircle className="h-6 w-6 text-primary" />
            {t('messages.title')}
          </h1>
          {conversations.length > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {`${conversations.length} Unterhaltung${conversations.length === 1 ? '' : 'en'}`}
            </p>
          )}
        </div>
        <NewConversationButton />
      </header>

      {/* ── Story + Live Strip (v1.w.UI.230) ──────────────────────────────── */}
      <div className="-mx-0 mb-4">
        <StoryStrip />
      </div>

      {conversations.length === 0 ? (
        <div className="px-4 md:px-6">
          <EmptyState />
        </div>
      ) : (
        // Edge-to-edge Liste (v1.w.UI.1 — D1 aus UI_AUDIT).
        <ul className="-mx-0 flex-1 divide-y divide-border/60">
          {conversations.map((c) => {
            const story = c.is_self ? null : storyByUserId.get(c.other_user_id) ?? null;
            const liveSessionId = c.is_self ? null : liveByUserId.get(c.other_user_id) ?? null;
            return (
              <ConversationRow
                key={c.id}
                conv={c}
                hasUnviewedStory={!!story?.hasUnviewed}
                hasSeenStory={!!story && !story.hasUnviewed}
                liveSessionId={liveSessionId ?? null}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ConversationRow({
  conv,
  hasUnviewedStory,
  hasSeenStory,
  liveSessionId,
}: {
  conv: ConversationPreview;
  hasUnviewedStory: boolean;
  hasSeenStory: boolean;
  liveSessionId: string | null;
}) {
  const isUnread = conv.unread_count > 0;
  const displayName = conv.is_self
    ? 'Meine Notizen'
    : conv.other_display_name ?? `@${conv.other_username}`;
  const preview = conv.last_message ?? (conv.is_self ? 'Notiere hier für dich selbst' : 'Sag Hallo 👋');

  const hasRing = !conv.is_self && (hasUnviewedStory || hasSeenStory || !!liveSessionId);

  // Outer ring wrapper — gradient / red-pulse / gray depending on state
  const ringClass = liveSessionId
    ? 'animate-pulse rounded-full bg-red-500 p-[2.5px]'
    : hasUnviewedStory
      ? 'rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-500 p-[2.5px]'
      : hasSeenStory
        ? 'rounded-full bg-muted p-[2.5px]'
        : null;

  return (
    <li>
      <Link
        href={`/messages/${conv.id}` as Route}
        className="flex items-center gap-4 px-4 py-3 transition-colors duration-fast ease-out-expo hover:bg-muted/60 active:bg-muted md:px-6"
      >
        {/* ── Avatar mit optionalem Ring + LIVE-Badge ────────────────────── */}
        <div className="relative flex-none">
          {hasRing && ringClass ? (
            <div className={ringClass}>
              <div className="rounded-full bg-background p-[2px]">
                <AvatarInner conv={conv} size={52} />
              </div>
            </div>
          ) : (
            <div className="h-[60px] w-[60px] overflow-hidden rounded-full bg-muted">
              <AvatarInner conv={conv} size={60} />
            </div>
          )}

          {/* Unread-Dot (oben rechts) */}
          {isUnread && (
            <span
              className={cn(
                'absolute h-3 w-3 rounded-full border-2 border-background bg-primary',
                hasRing ? '-right-0.5 -top-0.5' : 'right-0 top-0',
              )}
              aria-label={`${conv.unread_count} ungelesen`}
            />
          )}

          {/* LIVE-Badge (unten, mittig) */}
          {liveSessionId && !conv.is_self && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-red-500 px-1 py-px text-[8px] font-bold uppercase tracking-widest text-white">
              Live
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className={`truncate ${isUnread ? 'font-semibold' : 'font-medium'}`}>
                {displayName}
              </span>
              {conv.other_verified && !conv.is_self && (
                <BadgeCheck className="h-4 w-4 flex-none text-sky-500" />
              )}
            </div>
            <span
              className={`flex-none text-xs tabular-nums ${
                isUnread ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {formatRelative(conv.last_message_at)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p
              className={`truncate text-sm ${
                isUnread ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {preview}
            </p>
            {isUnread && (
              <span className="ml-auto flex-none rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary-foreground">
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

/** Inline helper — avatar image / fallback für ConversationRow */
function AvatarInner({ conv, size }: { conv: ConversationPreview; size: number }) {
  const dim = `${size}px`;
  if (conv.is_self) {
    return (
      <div
        style={{ width: dim, height: dim }}
        className="flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500"
      >
        <Bookmark className="h-7 w-7 fill-white text-white" />
      </div>
    );
  }
  if (conv.other_avatar_url) {
    return (
      <Image
        src={conv.other_avatar_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        sizes={dim}
      />
    );
  }
  return (
    <div
      style={{ width: dim, height: dim }}
      className="flex items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground"
    >
      {initials(conv.other_display_name ?? conv.other_username)}
    </div>
  );
}

async function EmptyState() {
  const t = await getT();
  return (
    <CanonicalEmptyState
      icon={<MessageCircle className="h-8 w-8" strokeWidth={1.75} />}
      title={t('messages.emptyTitle')}
      description={t('messages.emptyHint')}
      size="lg"
      bordered
      cta={
        <Link
          href={'/search' as Route}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Search className="h-4 w-4" />
          {t('messages.searchUser')}
        </Link>
      }
      className="flex-1"
    />
  );
}

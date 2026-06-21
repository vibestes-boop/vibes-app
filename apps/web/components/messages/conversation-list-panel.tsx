'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { BadgeCheck, Bookmark, PenSquare, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationPreview } from '@/lib/data/messages';

// -----------------------------------------------------------------------------
// ConversationListPanel — linke Sidebar im Short-Video-Style Messages-Layout.
//
// - Zeigt alle Konversationen mit Avatar, Name, Preview, Timestamp
// - Aktive Konversation via `usePathname()` hervorgehoben
// - Reagiert auf Route-Wechsel ohne Remount (client nav aware)
// -----------------------------------------------------------------------------

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
  return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

export function ConversationListPanel({
  conversations,
  liveByUserId,
  storyByUserId,
}: {
  conversations: ConversationPreview[];
  liveByUserId: Map<string, string>;
  storyByUserId: Map<string, { hasUnviewed: boolean }>;
}) {
  const pathname = usePathname();
  // Active conversation ID aus der URL: /messages/[id]
  const activeId = pathname?.startsWith('/messages/')
    ? pathname.split('/')[2]
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3.5">
        <h2 className="text-lg font-semibold">Nachrichten</h2>
        {/* New conversation — placeholder, Phase 2 */}
        <button type="button" aria-label="Neue Nachricht" className="grid h-8 w-8 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted">
          <PenSquare className="h-4 w-4" />
        </button>
      </div>

      {/* Search (cosmetic — echte Suche wäre Filter-State, Phase 2) */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4 shrink-0" />
          <span>Suchen…</span>
        </div>
      </div>

      {/* Conversation List */}
      <ul className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            Noch keine Nachrichten
          </li>
        )}
        {conversations.map((c) => {
          const isActive = c.id === activeId;
          const isUnread = c.unread_count > 0;
          const displayName = c.is_self
            ? 'Meine Notizen'
            : c.other_display_name ?? `@${c.other_username}`;
          const preview = c.last_message ?? (c.is_self ? 'Notiere hier für dich selbst' : 'Sag Hallo 👋');
          const liveSessionId = c.is_self ? null : liveByUserId.get(c.other_user_id) ?? null;
          const story = c.is_self ? null : storyByUserId.get(c.other_user_id) ?? null;
          const hasUnviewedStory = !!story?.hasUnviewed;
          const hasSeenStory = !!story && !story.hasUnviewed;
          const hasRing = !c.is_self && (hasUnviewedStory || hasSeenStory || !!liveSessionId);

          const ringClass = liveSessionId
            ? 'animate-pulse rounded-full bg-red-500 p-[2.5px]'
            : hasUnviewedStory
              ? 'rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-500 p-[2.5px]'
              : hasSeenStory
                ? 'rounded-full bg-muted p-[2.5px]'
                : null;

          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}` as Route}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 transition-colors',
                  isActive
                    ? 'bg-muted/80'
                    : 'hover:bg-muted/50',
                )}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {c.is_self ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500">
                      <Bookmark className="h-5 w-5 fill-white text-white" />
                    </div>
                  ) : hasRing && ringClass ? (
                    <div className={ringClass}>
                      <div className="rounded-full bg-background p-[2px]">
                        <AvatarImg conv={c} size={44} />
                      </div>
                    </div>
                  ) : (
                    <AvatarImg conv={c} size={48} />
                  )}
                  {/* Unread dot */}
                  {isUnread && (
                    <span className={cn(
                      'absolute h-2.5 w-2.5 rounded-full border-2 border-background bg-primary',
                      hasRing ? '-right-0.5 -top-0.5' : 'right-0 top-0',
                    )} />
                  )}
                  {/* LIVE badge */}
                  {liveSessionId && !c.is_self && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-red-500 px-1 py-px text-[10px] font-bold uppercase tracking-widest text-white">
                      Live
                    </span>
                  )}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className={cn('truncate text-sm', isUnread ? 'font-semibold' : 'font-medium')}>
                        {displayName}
                      </span>
                      {c.other_verified && !c.is_self && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                      )}
                    </div>
                    <span className={cn('shrink-0 text-[11px] tabular-nums', isUnread ? 'text-foreground' : 'text-muted-foreground')}>
                      {formatRelative(c.last_message_at)}
                    </span>
                  </div>
                  <p className={cn('truncate text-xs', isUnread ? 'text-foreground/80' : 'text-muted-foreground')}>
                    {preview}
                  </p>
                </div>

                {/* Unread count badge */}
                {isUnread && (
                  <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                    {c.unread_count > 99 ? '99+' : c.unread_count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AvatarImg({ conv, size }: { conv: ConversationPreview; size: number }) {
  const dim = `${size}px`;
  if (conv.other_avatar_url) {
    return (
      <Image
        src={conv.other_avatar_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: dim, height: dim }}
        sizes={dim}
      />
    );
  }
  return (
    <div
      style={{ width: dim, height: dim }}
      className="flex items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
    >
      {initials(conv.other_display_name ?? conv.other_username)}
    </div>
  );
}

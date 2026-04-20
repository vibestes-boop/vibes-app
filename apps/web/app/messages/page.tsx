import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { BadgeCheck, Bookmark, MessageCircle, Search } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import { getConversations } from '@/lib/data/messages';
import type { ConversationPreview } from '@/lib/data/messages';
import { NewConversationButton } from '@/components/messages/new-conversation-button';

// -----------------------------------------------------------------------------
// /messages — Konversations-Liste
//
// SSR-Render des kompletten Konversations-Grids. Realtime-Updates (eingehende
// Nachrichten während die Liste offen ist) kommen über den
// `conversations-realtime`-Channel im Client-Wrapper; für den ersten Render
// reicht der SSR-Snapshot.
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

  const conversations = await getConversations();

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col px-4 py-6 md:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MessageCircle className="h-6 w-6 text-primary" />
            Nachrichten
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {conversations.length === 0
              ? 'Noch keine Unterhaltungen.'
              : `${conversations.length} Unterhaltung${conversations.length === 1 ? '' : 'en'}`}
          </p>
        </div>
        <NewConversationButton />
      </header>

      {conversations.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex-1 divide-y divide-border overflow-hidden rounded-xl border bg-card">
          {conversations.map((c) => (
            <ConversationRow key={c.id} conv={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConversationRow({ conv }: { conv: ConversationPreview }) {
  const isUnread = conv.unread_count > 0;
  const displayName = conv.is_self
    ? 'Meine Notizen'
    : conv.other_display_name ?? `@${conv.other_username}`;
  const preview = conv.last_message ?? (conv.is_self ? 'Notiere hier für dich selbst' : 'Sag Hallo 👋');

  return (
    <li>
      <Link
        href={`/messages/${conv.id}` as Route}
        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
      >
        <div className="relative h-[60px] w-[60px] flex-none overflow-hidden rounded-full bg-muted">
          {conv.is_self ? (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-pink-500">
              <Bookmark className="h-7 w-7 fill-white text-white" />
            </div>
          ) : conv.other_avatar_url ? (
            <Image src={conv.other_avatar_url} alt="" fill className="object-cover" sizes="60px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-medium text-muted-foreground">
              {initials(conv.other_display_name ?? conv.other_username)}
            </div>
          )}
          {isUnread && (
            <span
              className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-card bg-primary"
              aria-label={`${conv.unread_count} ungelesen`}
            />
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

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-card/30 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10">
        <MessageCircle className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">Noch keine Nachrichten</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        Suche einen Creator, ein Profil oder einen Shop-Seller und starte eine Unterhaltung.
      </p>
      <Link
        href={'/search' as Route}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Search className="h-4 w-4" />
        Nutzer suchen
      </Link>
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { ArrowLeft, BadgeCheck, Bookmark } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import {
  getConversationHeader,
  getConversationMessages,
  getConversationReactions,
  getProductShareContext,
} from '@/lib/data/messages';
import { MessageThread } from '@/components/messages/message-thread';
import { ConversationSearch } from '@/components/messages/conversation-search';

// -----------------------------------------------------------------------------
// /messages/[id] — Thread-View mit Realtime-Messages + Composer.
//
// SSR:
//  • Conversation-Header (Other-User-Profil)
//  • Letzte 80 Messages chronologisch
//  • Aggregierte Reactions (emoji → count + by_me)
//  • Optional `?productId=…` → Product-Share-Context für Composer
//
// Realtime-Transport läuft danach clientseitig via Supabase Broadcast auf
// `messages-{id}`-Channel (1:1 Native-Parität).
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Unterhaltung',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ productId?: string }>;
}

export default async function ConversationPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { productId } = await searchParams;

  const user = await getUser();
  if (!user) {
    redirect(`/login?next=/messages/${id}`);
  }

  const header = await getConversationHeader(id);
  if (!header) notFound();

  const [messages, reactions, productShare] = await Promise.all([
    getConversationMessages(id),
    getConversationReactions(id),
    productId ? getProductShareContext(productId) : Promise.resolve(null),
  ]);

  const displayName = header.is_self
    ? 'Meine Notizen'
    : header.other_user.display_name ?? `@${header.other_user.username}`;

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col">
      {/* relative: ConversationSearch positioniert ihr Overlay absolut relativ zu diesem Container */}
      <header className="relative flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          href={'/messages' as Route}
          aria-label="Zurück zur Liste"
          className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {header.is_self ? (
          <div className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-full bg-gradient-to-br from-amber-400 to-pink-500">
            <Bookmark className="h-5 w-5 fill-white text-white" />
          </div>
        ) : (
          <Link
            href={`/u/${header.other_user.username}` as Route}
            className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-muted"
          >
            {header.other_user.avatar_url && (
              <Image
                src={header.other_user.avatar_url}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
              />
            )}
          </Link>
        )}

        <div className="min-w-0 flex-1">
          {header.is_self ? (
            <div className="truncate font-semibold">{displayName}</div>
          ) : (
            <Link
              href={`/u/${header.other_user.username}` as Route}
              className="block min-w-0"
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold">{displayName}</span>
                {header.other_user.verified && (
                  <BadgeCheck className="h-4 w-4 flex-none text-sky-500" />
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                @{header.other_user.username}
              </div>
            </Link>
          )}
        </div>

        {/* Search-Icon — öffnet ConversationSearch-Overlay im Header */}
        <ConversationSearch conversationId={id} viewerId={user.id} />
      </header>

      <MessageThread
        conversationId={id}
        viewerId={user.id}
        initialMessages={messages}
        initialHasMore={messages.length >= 80}
        initialReactions={reactions}
        otherUser={header.other_user}
        isSelf={header.is_self}
        productShare={productShare}
      />
    </div>
  );
}

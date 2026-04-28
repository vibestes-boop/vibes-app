import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { BadgeCheck, Clock3 } from 'lucide-react';

import { getStory } from '@/lib/data/public';
import { getUser } from '@/lib/auth/session';
import { getStoryViewers } from '@/lib/data/stories';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VideoPlayer } from '@/components/video/video-player';
import { ShareButtons } from '@/components/share/share-buttons';
import { StoryPollWidget } from '@/components/story/story-poll-widget';

// -----------------------------------------------------------------------------
// /s/[storyId] — ephemere Story-View.
//
// WICHTIG: Stories haben 24h TTL. `getStory` prüft `expires_at` selbst und
// gibt null zurück wenn abgelaufen — die Seite muss nichts Extra tun.
//
// Kein ISR hier: wenn eine Story abläuft während sie gerendert gecacht wäre,
// würden wir veraltet abgelaufenen Content ausliefern. `revalidate: 0`
// (dynamic) garantiert frischen TTL-Check pro Request.
// -----------------------------------------------------------------------------

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Metadata — Stories sollen nicht dauerhaft indexiert werden (ephemer!).
// Darum `robots: noindex`. Social-Previews funktionieren trotzdem — Crawler
// wie WhatsApp/Telegram fetchen die OG-Tags unabhängig vom noindex.
// -----------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storyId: string }>;
}): Promise<Metadata> {
  const { storyId } = await params;
  const story = await getStory(storyId);

  if (!story) {
    return {
      title: 'Story nicht verfügbar',
      robots: { index: false, follow: false },
    };
  }

  const authorName = story.author.display_name ?? `@${story.author.username}`;

  const storyTitle = `Story von ${authorName}`;
  const storyDesc = 'Ephemer — nur 24 Stunden sichtbar.';
  const thumbnail = story.media_type === 'image' ? story.media_url : undefined;

  return {
    title: storyTitle,
    description: `Eine Story von ${authorName} auf Serlo. ${storyDesc}`,
    robots: { index: false, follow: true }, // noindex, aber Links dürfen gefolgt werden.
    openGraph: {
      type: 'article',
      title: storyTitle,
      description: storyDesc,
      siteName: 'Serlo',
      images: thumbnail ? [{ url: thumbnail }] : undefined,
    },
    twitter: {
      card: thumbnail ? 'summary_large_image' : 'summary',
      title: storyTitle,
      description: storyDesc,
      images: thumbnail ? [thumbnail] : undefined,
    },
  };
}

// -----------------------------------------------------------------------------
// "Läuft ab in X" — zeigt Countdown von expires_at.
// Berechnung Server-side → keine Rehydration-Mismatch.
// -----------------------------------------------------------------------------

function formatRemaining(expiresAtIso: string): string {
  const remainingMs = new Date(expiresAtIso).getTime() - Date.now();
  if (remainingMs <= 0) return 'läuft jetzt ab';

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `läuft in ${hours} Std ${minutes} Min ab`;
  return `läuft in ${minutes} Min ab`;
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default async function StoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const [story, user] = await Promise.all([getStory(storyId), getUser()]);

  if (!story) notFound();

  const authorName = story.author.display_name ?? `@${story.author.username}`;
  const remaining = formatRemaining(story.expires_at);

  // v1.w.UI.178 — Viewer list only visible to the story's own author.
  const isSelf = !!user && user.id === story.author.id;
  const viewers = isSelf ? await getStoryViewers(storyId) : [];

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      {/* Autor-Header (floating above media) */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/u/${story.author.username}`}
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-10 w-10 ring-2 ring-brand-gold ring-offset-2 ring-offset-background">
            <AvatarImage src={story.author.avatar_url ?? undefined} alt={authorName} />
            <AvatarFallback>
              {(story.author.display_name ?? story.author.username).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold">{authorName}</span>
              {story.author.verified && (
                <BadgeCheck
                  className="h-3.5 w-3.5 shrink-0 fill-brand-gold text-background"
                  aria-label="Verifiziert"
                />
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" aria-hidden />
              <time dateTime={story.expires_at}>{remaining}</time>
            </div>
          </div>
        </Link>
      </div>

      {/* Media — 9:16, gleiche Proportionen wie Native-App Story-Canvas */}
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        {story.media_type === 'video' ? (
          <VideoPlayer
            src={story.media_url}
            autoPlay
            loop={false}
            muted
            aspect="9/16"
          />
        ) : (
          <div className="relative aspect-[9/16] w-full bg-black">
            <Image
              src={story.media_url}
              alt={`Story von ${authorName}`}
              fill
              sizes="(min-width: 768px) 400px, 100vw"
              className="object-contain"
              priority
            />
          </div>
        )}
      </div>

      {/* Stats + Share */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {story.view_count.toLocaleString('de-DE')} Aufrufe
        </span>
        <ShareButtons
          url={`/s/${story.id}`}
          title={`Story von ${authorName}`}
          text="Ephemer — nur 24 Stunden sichtbar auf Serlo."
        />
      </div>

      {/* v1.w.UI.161: Interactive poll widget — only rendered when story has a poll. */}
      {story.poll && (
        <StoryPollWidget
          storyId={story.id}
          poll={story.poll}
          pollVotes={story.poll_votes ?? story.poll.options.map(() => 0)}
          myVote={story.my_vote ?? null}
          isAuthenticated={!!user}
        />
      )}

      {/* v1.w.UI.178: Viewer list — only visible to the story author. */}
      {isSelf && viewers.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Zuschauer · {viewers.length.toLocaleString('de-DE')}
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {viewers.map((v) => {
              const name = v.display_name ?? v.username ?? 'Unbekannt';
              const initials = name.slice(0, 2).toUpperCase();
              const href = v.username ? `/u/${v.username}` : undefined;
              const viewedDate = new Date(v.viewed_at);
              const timeLabel = viewedDate.toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <li key={v.user_id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={v.avatar_url ?? undefined} alt={name} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link
                        href={href}
                        className="truncate text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium">{name}</span>
                    )}
                    {v.username && (
                      <p className="truncate text-xs text-muted-foreground">@{v.username}</p>
                    )}
                  </div>
                  <time
                    dateTime={v.viewed_at}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {timeLabel}
                  </time>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}

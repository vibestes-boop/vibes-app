import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Share2 as ShareIcon,
  Eye,
  Music2,
  CalendarDays,
} from 'lucide-react';

import { getPost, getPostComments } from '@/lib/data/public';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VideoPlayer } from '@/components/video/video-player';
import { ShareButtons } from '@/components/share/share-buttons';
import { PostComments } from '@/components/post/post-comments';

// -----------------------------------------------------------------------------
// /p/[postId] — public post detail.
//
// ISR: 60s — identisches Reasoning wie Profile, view_count/like_count ticken
// zwar hoch, aber 60s stale ist für einen Share-Link absolut okay.
// -----------------------------------------------------------------------------

export const revalidate = 60;
export const dynamicParams = true;

// -----------------------------------------------------------------------------
// Metadata — Social-Previews + Twitter-Card mit "player"-Type für Inline-Video.
// -----------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPost(postId);

  if (!post) {
    return {
      title: 'Video nicht gefunden',
      robots: { index: false, follow: false },
    };
  }

  const authorName = post.author.display_name ?? `@${post.author.username}`;
  const caption = post.caption?.trim();
  const title = caption
    ? `${caption.slice(0, 70)}${caption.length > 70 ? '…' : ''} — ${authorName}`
    : `Video von ${authorName}`;

  const description =
    caption?.slice(0, 160) ??
    `${authorName} auf Serlo · ${post.view_count.toLocaleString('de-DE')} Aufrufe.`;

  return {
    title,
    description,
    alternates: { canonical: `/p/${post.id}` },
    openGraph: {
      type: 'video.other',
      title,
      description,
      url: `/p/${post.id}`,
      siteName: 'Serlo',
      videos: [{ url: post.video_url, type: post.video_url.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/mp4' }],
      images: post.thumbnail_url ? [{ url: post.thumbnail_url }] : undefined,
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: post.thumbnail_url ?? undefined,
      players: {
        playerUrl: `/p/${post.id}`, // Twitter-Card-Player zeigt auf unsere Page selbst.
        streamUrl: post.video_url,
        width: 1080,
        height: 1920,
      },
    },
  };
}

// -----------------------------------------------------------------------------
// Helper — Stat-Zeile unterhalb des Players.
// -----------------------------------------------------------------------------

function StatLine({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" aria-hidden />
      <span className="tabular-nums text-foreground">{value.toLocaleString('de-DE')}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  const post = await getPost(postId);
  if (!post) notFound();

  // Kommentare parallel laden (nur wenn erlaubt — spart ein DB-Roundtrip).
  const comments = post.allow_comments ? await getPostComments(post.id, 20) : [];

  const authorName = post.author.display_name ?? `@${post.author.username}`;
  const created = new Date(post.created_at);

  // JSON-LD VideoObject — Google Video-Rich-Result.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: post.caption?.slice(0, 100) ?? `Video von ${authorName}`,
    description: post.caption ?? `${authorName} auf Serlo`,
    thumbnailUrl: post.thumbnail_url ? [post.thumbnail_url] : undefined,
    uploadDate: post.created_at,
    duration: post.duration_secs ? `PT${Math.round(post.duration_secs)}S` : undefined,
    contentUrl: post.video_url,
    embedUrl: `/p/${post.id}`,
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'WatchAction' },
        userInteractionCount: post.view_count,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'LikeAction' },
        userInteractionCount: post.like_count,
      },
    ],
    author: {
      '@type': 'Person',
      name: authorName,
      url: `/u/${post.author.username}`,
    },
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ───── Player ───── */}
        <div>
          <VideoPlayer
            src={post.video_url}
            poster={post.thumbnail_url}
            autoPlay={false}
            loop={false}
            muted={false}
          />

          {/* Stats-Zeile */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <StatLine icon={Eye}           value={post.view_count}    label="Aufrufe" />
            <StatLine icon={Heart}         value={post.like_count}    label="Likes" />
            <StatLine icon={MessageCircle} value={post.comment_count} label="Kommentare" />
            <StatLine icon={ShareIcon}     value={post.share_count}   label="Shares" />
          </div>
        </div>

        {/* ───── Sidebar: Autor + Caption + Share ───── */}
        <aside className="space-y-5">
          {/* Autor-Karte */}
          <div className="rounded-xl border border-border bg-card p-4">
            <Link
              href={`/u/${post.author.username}`}
              className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <Avatar className="h-11 w-11">
                <AvatarImage src={post.author.avatar_url ?? undefined} alt={authorName} />
                <AvatarFallback>
                  {(post.author.display_name ?? post.author.username).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate font-semibold">{authorName}</span>
                  {post.author.verified && (
                    <BadgeCheck
                      className="h-4 w-4 shrink-0 fill-brand-gold text-background"
                      aria-label="Verifiziert"
                    />
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  @{post.author.username}
                </div>
              </div>
            </Link>
          </div>

          {/* Caption + Hashtags */}
          {(post.caption || post.hashtags.length > 0) && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-4">
              {post.caption && (
                <p className="whitespace-pre-line break-words text-sm leading-relaxed">
                  {post.caption}
                </p>
              )}
              {post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {post.hashtags.map((tag) => (
                    // Hashtag-Detail-Routes kommen Phase 3 (/t/[tag]). Bis dahin
                    // rendern wir nur die Pill — sieht identisch aus, ist aber kein Link.
                    <span
                      key={tag}
                      className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground/80"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  <time dateTime={post.created_at}>
                    {created.toLocaleDateString('de-DE', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                </span>
                {post.music_id && (
                  <span className="inline-flex items-center gap-1">
                    <Music2 className="h-3 w-3" />
                    Sound
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Share */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">Video teilen</div>
            <ShareButtons
              url={`/p/${post.id}`}
              title={authorName + ' auf Serlo'}
              text={post.caption?.slice(0, 100) ?? ''}
            />
          </div>
        </aside>
      </div>

      {/* ───── Kommentare (volle Breite) ───── */}
      <PostComments
        comments={comments}
        allowComments={post.allow_comments}
        totalCount={post.comment_count}
      />
    </main>
  );
}

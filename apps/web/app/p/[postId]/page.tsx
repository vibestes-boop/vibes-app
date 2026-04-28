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

import { getPost, getPostComments, getPostInteractionState, isFollowing, getProfilePosts } from '@/lib/data/public';
import { getUser } from '@/lib/auth/session';
import { ExploreVideoCard } from '@/components/explore/explore-video-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VideoPlayer } from '@/components/video/video-player';
import { ShareButtons } from '@/components/share/share-buttons';
import { PostComments } from '@/components/post/post-comments';
import { PostActionsBar } from '@/components/post/post-actions-bar';
import { CommentForm } from '@/components/post/comment-form';
import { FollowButton } from '@/components/profile/follow-button';
import { PostAuthorMenu } from '@/components/post/post-author-menu';
import { PostViewerMenu } from '@/components/post/post-viewer-menu';
import { PostDwellTracker } from '@/components/post/post-dwell-tracker';
import { PostViewTracker } from '@/components/post/post-view-tracker';
import { linkify } from '@/lib/linkify';

// -----------------------------------------------------------------------------
// /p/[postId] — public post detail.
//
// force-dynamic: Seite enthält Auth-abhängigen State (liked_by_me, saved_by_me).
// ISR war vorher 60s — aber weil wir jetzt per-User-State rendern, ist
// force-dynamic korrekt. Statische Teile (Video, Caption) sind trotzdem schnell
// da Supabase-Queries intern gecacht sind (React.cache per Request).
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
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
  const isImage = post.media_type === 'image';
  const kindLabel = isImage ? 'Beitrag' : 'Video';
  const title = caption
    ? `${caption.slice(0, 70)}${caption.length > 70 ? '…' : ''} — ${authorName}`
    : `${kindLabel} von ${authorName}`;

  const description =
    caption?.slice(0, 160) ??
    `${authorName} auf Serlo · ${post.view_count.toLocaleString('de-DE')} Aufrufe.`;

  // Für Image-Posts kein video.other-OG-Type + kein Twitter-Player —
  // das würde Scraper dazu bringen, eine nicht existierende Video-URL
  // einzubetten.
  const ogImages = post.thumbnail_url
    ? [{ url: post.thumbnail_url }]
    : post.video_url && isImage
      ? [{ url: post.video_url }]
      : undefined;

  if (isImage) {
    return {
      title,
      description,
      alternates: { canonical: `/p/${post.id}` },
      openGraph: {
        type: 'article',
        title,
        description,
        url: `/p/${post.id}`,
        siteName: 'Serlo',
        images: ogImages,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: post.thumbnail_url ?? post.video_url ?? undefined,
      },
    };
  }

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
      videos: post.video_url
        ? [{ url: post.video_url, type: post.video_url.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/mp4' }]
        : undefined,
      images: ogImages,
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: post.thumbnail_url ?? undefined,
      players: post.video_url
        ? {
            playerUrl: `/p/${post.id}`, // Twitter-Card-Player zeigt auf unsere Page selbst.
            streamUrl: post.video_url,
            width: 1080,
            height: 1920,
          }
        : undefined,
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

  // Kommentare + Interaction-State + Viewer parallel laden.
  // Viewer zuerst auflösen damit getPostComments liked_by_me befüllen kann.
  const viewer = await getUser();
  const [comments, interaction, authorPosts] = await Promise.all([
    post.allow_comments ? getPostComments(post.id, 20, viewer?.id ?? null) : Promise.resolve([]),
    getPostInteractionState(post.id),
    // v1.w.UI.62: "Mehr von @author" — bis zu 7 holen, aktuellen Post rausfiltern → max 6
    getProfilePosts(post.author.id, 7),
  ]);

  // Aktuellen Post aus der "Mehr von"-Liste herausfiltern.
  const morePosts = authorPosts.filter((p) => p.id !== post.id).slice(0, 6);

  const isSelf = viewer?.id === post.author.id;
  const followingAuthor = !isSelf && viewer ? await isFollowing(post.author.id) : false;

  const authorName = post.author.display_name ?? `@${post.author.username}`;
  const created = new Date(post.created_at);
  const isImage = post.media_type === 'image';
  const isLandscape = post.aspect_ratio === 'landscape';
  const isSquare = post.aspect_ratio === 'square';
  // VideoPlayer aspect prop
  const videoAspect: '9/16' | '16/9' | '1/1' = isLandscape ? '16/9' : isSquare ? '1/1' : '9/16';

  // JSON-LD — für Video-Posts VideoObject, für Image-Posts ImageObject/SocialMediaPosting.
  // Google rendert dann den passenden Rich-Result (Video-Carousel vs. Image-Preview).
  const jsonLd: Record<string, unknown> = isImage
    ? {
        '@context': 'https://schema.org',
        '@type': 'SocialMediaPosting',
        headline: post.caption?.slice(0, 100) ?? `Beitrag von ${authorName}`,
        articleBody: post.caption ?? undefined,
        datePublished: post.created_at,
        image: post.video_url || post.thumbnail_url || undefined,
        author: {
          '@type': 'Person',
          name: authorName,
          url: `/u/${post.author.username}`,
        },
        interactionStatistic: [
          {
            '@type': 'InteractionCounter',
            interactionType: { '@type': 'LikeAction' },
            userInteractionCount: post.like_count,
          },
        ],
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: post.caption?.slice(0, 100) ?? `Video von ${authorName}`,
        description: post.caption ?? `${authorName} auf Serlo`,
        thumbnailUrl: post.thumbnail_url ? [post.thumbnail_url] : undefined,
        uploadDate: post.created_at,
        duration: post.duration_secs ? `PT${Math.round(post.duration_secs)}S` : undefined,
        contentUrl: post.video_url || undefined,
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
    <main className={`mx-auto px-4 py-6 sm:px-6 lg:py-10 ${isLandscape ? 'max-w-6xl' : 'max-w-5xl'}`}>
      {/* v1.w.UI.53: Dwell-time tracking for algorithm scoring. */}
      <PostDwellTracker postId={post.id} isAuthenticated={!!viewer} />
      {/* v1.w.UI.138: View-count increment — mirrors mobile increment_post_view RPC. */}
      <PostViewTracker postId={post.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Wiederverwendbare Sidebar-Blöcke als JSX-Variablen ─────────────── */}
      {(() => {
        // Autor-Karte
        const authorCard = (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/u/${post.author.username}`}
                className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={post.author.avatar_url ?? undefined} alt={authorName} />
                  <AvatarFallback>
                    {(post.author.display_name ?? post.author.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <Link href={`/u/${post.author.username}`} className="min-w-0 flex-1">
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
              </Link>
              {isSelf ? (
                <PostAuthorMenu
                  postId={post.id}
                  authorUsername={post.author.username}
                  caption={post.caption ?? null}
                  privacy={post.privacy}
                  allowComments={post.allow_comments}
                  allowDownload={post.allow_download}
                  allowDuet={post.allow_duet}
                  womenOnly={post.women_only}
                  aspectRatio={post.aspect_ratio}
                  initialTags={post.hashtags}
                  isPinned={post.is_pinned ?? false}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <FollowButton
                    isAuthenticated={!!viewer}
                    isFollowing={followingAuthor}
                    isSelf={isSelf}
                    username={post.author.username}
                    targetUserId={post.author.id}
                  />
                  <PostViewerMenu
                    postId={post.id}
                    targetUserId={post.author.id}
                    targetUsername={post.author.username}
                    isAuthenticated={!!viewer}
                  />
                </div>
              )}
            </div>
          </div>
        );

        // Caption + Hashtags
        const captionCard = (post.caption || post.hashtags.length > 0) ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            {post.caption && (
              <p className="whitespace-pre-line break-words text-sm leading-relaxed">
                {linkify(post.caption)}
              </p>
            )}
            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {post.hashtags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/t/${encodeURIComponent(tag)}` as import('next').Route}
                    className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground/80 transition-colors hover:bg-muted/70 hover:text-primary"
                  >
                    #{tag}
                  </Link>
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
              {(post.music_id || post.audio_url) && (
                <span className="inline-flex items-center gap-1">
                  <Music2 className="h-3 w-3" />
                  {post.audio_url ? 'Musik' : 'Sound'}
                </span>
              )}
            </div>
          </div>
        ) : null;

        // Share-Karte
        const shareCard = (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">
              {isImage ? 'Beitrag teilen' : 'Video teilen'}
            </div>
            <ShareButtons
              url={`/p/${post.id}`}
              title={authorName + ' auf Serlo'}
              text={post.caption?.slice(0, 100) ?? ''}
              dmPost={viewer ? {
                id: post.id,
                thumbnail_url: post.thumbnail_url ?? null,
                caption: post.caption ?? null,
                author: {
                  username: post.author.username,
                  display_name: post.author.display_name ?? null,
                  avatar_url: post.author.avatar_url ?? null,
                },
              } : undefined}
            />
          </div>
        );

        // Kommentar-Sektion (layout-aware, wird in beide Layouts eingebaut)
        const commentsSection = (
          <>
            <PostComments
              comments={comments}
              allowComments={post.allow_comments}
              totalCount={post.comment_count}
              isAuthenticated={!!viewer}
              postId={post.id}
              postPath={`/p/${post.id}`}
              viewerId={viewer?.id ?? null}
            />
            {post.allow_comments && (
              <CommentForm
                postId={post.id}
                isAuthenticated={!!viewer}
                postPath={`/p/${post.id}`}
              />
            )}
          </>
        );

        // Mehr von @author
        const moreCard = morePosts.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">
                Mehr von{' '}
                <Link
                  href={`/u/${post.author.username}`}
                  className="text-primary hover:underline underline-offset-2"
                >
                  @{post.author.username}
                </Link>
              </span>
              <Link
                href={`/u/${post.author.username}`}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Alle ansehen
              </Link>
            </div>
            <ul className={`grid gap-1.5 ${isLandscape ? 'grid-cols-6' : 'grid-cols-3'}`}>
              {morePosts.map((p) => {
                const fallbackInitial = (post.author.display_name ?? post.author.username ?? '?')
                  .slice(0, 1)
                  .toUpperCase();
                return (
                  <li key={p.id}>
                    <ExploreVideoCard
                      id={p.id}
                      videoUrl={p.video_url}
                      thumbnailUrl={p.thumbnail_url}
                      caption={p.caption}
                      authorUsername={post.author.username}
                      viewCount={p.view_count}
                      fallbackInitial={fallbackInitial}
                      womenOnly={p.women_only}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null;

        // Stats-Zeile
        const statsBar = (
          <div className="mt-4 space-y-3">
            {/* v1.w.UI.169 — WOZ badge: only visible to RLS-verified members */}
            {post.women_only && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-600 dark:text-pink-400">
                🌸 Women-Only Zone
              </span>
            )}
          <div className="flex flex-wrap items-center gap-4">
            <StatLine icon={Eye}           value={post.view_count}    label="Aufrufe" />
            <PostActionsBar
              postId={post.id}
              initialLiked={interaction.liked}
              initialSaved={interaction.saved}
              likeCount={post.like_count}
              isAuthenticated={!!viewer}
              viewerId={viewer?.id ?? null}
              videoUrl={post.video_url || undefined}
              allowDownload={post.allow_download}
            />
            <StatLine icon={MessageCircle} value={post.comment_count} label="Kommentare" />
            <StatLine icon={ShareIcon}     value={post.share_count}   label="Shares" />
          </div>
          </div>
        );

        // Image-Container: aspect abhängig vom Format
        const imageAspectClass = isLandscape ? 'aspect-video' : isSquare ? 'aspect-square' : 'aspect-[9/16]';
        const mediaBlock = isImage ? (
          <div className={`relative overflow-hidden rounded-lg bg-black ${imageAspectClass}`}>
            {post.video_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={post.video_url}
                alt={post.caption ?? `Beitrag von ${authorName}`}
                className="h-full w-full object-contain"
                loading="eager"
              />
            ) : post.thumbnail_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={post.thumbnail_url}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/60">
                Kein Bild hinterlegt.
              </div>
            )}
          </div>
        ) : (
          <VideoPlayer
            src={post.video_url}
            poster={post.thumbnail_url}
            autoPlay={false}
            loop={false}
            muted={false}
            aspect={videoAspect}
          />
        );

        // ── Landscape-Layout: Video oben, dann 2-Spalten (Author+Kommentare | Share), More ganz unten ──
        if (isLandscape) {
          return (
            <>
              {/* Video volle Breite */}
              <div>
                {mediaBlock}
                {statsBar}
              </div>

              {/* Info-Zeile: Autor + Caption + Kommentare links | Share rechts */}
              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                  {authorCard}
                  {captionCard}
                  {commentsSection}
                </div>
                <aside className="space-y-4">
                  {shareCard}
                </aside>
              </div>

              {/* Mehr von — volle Breite mit 6-Spalten-Grid, ganz unten */}
              {moreCard && <div className="mt-5">{moreCard}</div>}
            </>
          );
        }

        // ── Portrait / Square-Layout: Media links | Sidebar rechts ─────────
        // Kommentare in der Sidebar direkt unter Caption — TikTok-Web-Pattern.
        // Mehr von @author ganz am Ende der Sidebar.
        return (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              {mediaBlock}
              {statsBar}
            </div>
            <aside className="space-y-5">
              {authorCard}
              {captionCard}
              {commentsSection}
              {shareCard}
              {moreCard}
            </aside>
          </div>
        );
      })()}
    </main>
  );
}

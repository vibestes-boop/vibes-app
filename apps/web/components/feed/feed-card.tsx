'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Heart, MessageCircle, Bookmark, Share2, Music, Volume2, VolumeX, Play, BadgeCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useTogglePostLike,
  useTogglePostSave,
  useToggleFollow,
} from '@/hooks/use-engagement';
import type { FeedPost } from '@/lib/data/feed';
import { CommentSheet } from './comment-sheet';

// -----------------------------------------------------------------------------
// FeedCard — eine 9:16-Video-Karte im vertikalen Feed.
// Auto-Play via IntersectionObserver (≥60% sichtbar → play, sonst pause).
// Muted-Default (Autoplay-Policy); globaler Mute-State kommt vom Parent.
// -----------------------------------------------------------------------------

export interface FeedCardProps {
  post: FeedPost;
  viewerId: string | null;
  isActive: boolean;
  muted: boolean;
  onMuteToggle: () => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toString();
}

export function FeedCard({ post, viewerId, isActive, muted, onMuteToggle }: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const likeMut = useTogglePostLike();
  const saveMut = useTogglePostSave();
  const followMut = useToggleFollow();

  const isSelf = viewerId === post.author.id;

  // Auto-Play / Pause je nach `isActive`
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !isPaused) {
      v.muted = muted;
      void v.play().catch(() => {
        /* Browser hat Autoplay blockiert — muss User-Geste abwarten */
      });
    } else {
      v.pause();
    }
  }, [isActive, isPaused, muted]);

  const handleVideoTap = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setIsPaused(false);
    } else {
      v.pause();
      setIsPaused(true);
    }
  };

  const handleShare = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${post.id}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ url, title: post.caption ?? 'Serlo' });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* User-Cancel ignorieren */
    }
  };

  return (
    <article
      className="relative mx-auto flex aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-2xl bg-black"
      data-post-id={post.id}
    >
      {/* Video-Ebene */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Video pausieren / abspielen"
        onClick={handleVideoTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleVideoTap();
          }
        }}
        className="absolute inset-0 cursor-pointer"
      >
        <video
          ref={videoRef}
          src={post.video_url}
          poster={post.thumbnail_url ?? undefined}
          loop
          muted={muted}
          playsInline
          preload="metadata"
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
          }}
          className="h-full w-full object-contain"
        />

        {/* Play-Overlay wenn pausiert */}
        {isPaused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30" aria-hidden="true">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
              <Play className="h-10 w-10 fill-white text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Overlay-Ebene: Gradient unten + Text */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Text-Overlay unten links */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 pb-6 pr-20 text-white">
        <div className="flex items-center gap-2">
          <Link
            href={`/u/${post.author.username}` as Route}
            className="flex items-center gap-2"
          >
            <Avatar className="h-9 w-9 border border-white/40">
              <AvatarImage src={post.author.avatar_url ?? undefined} />
              <AvatarFallback className="bg-neutral-800 text-xs text-white">
                {(post.author.display_name ?? post.author.username).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex items-center gap-1 text-sm font-semibold">
              @{post.author.username}
              {post.author.verified && <BadgeCheck className="h-4 w-4 text-brand-gold" />}
            </span>
          </Link>
          {!isSelf && !post.following_author && viewerId && (
            <Button
              size="sm"
              variant="secondary"
              className="pointer-events-auto h-7 bg-white/15 px-3 text-xs text-white hover:bg-white/25"
              disabled={followMut.isPending}
              onClick={() =>
                followMut.mutate({ userId: post.author.id, following: post.following_author })
              }
            >
              Folgen
            </Button>
          )}
        </div>

        {post.caption && (
          <p className="line-clamp-3 text-sm leading-snug text-white/95">{post.caption}</p>
        )}

        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-white/80">
            {post.hashtags.slice(0, 4).map((tag) => (
              <span key={tag}>#{tag.replace(/^#/, '')}</span>
            ))}
          </div>
        )}

        {post.music_id && (
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <Music className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Original-Sound</span>
          </div>
        )}
      </div>

      {/* Action-Rail rechts */}
      <div className="pointer-events-auto absolute bottom-6 right-3 z-10 flex flex-col items-center gap-5 text-white">
        <ActionButton
          icon={<Heart className={cn('h-7 w-7', post.liked_by_me && 'fill-red-500 text-red-500')} aria-hidden="true" />}
          label={formatCount(post.like_count)}
          ariaLabel={`${post.liked_by_me ? 'Like entfernen' : 'Liken'} — ${post.like_count} Likes`}
          disabled={!viewerId || likeMut.isPending}
          onClick={() =>
            viewerId && likeMut.mutate({ postId: post.id, liked: post.liked_by_me })
          }
        />
        <ActionButton
          icon={<MessageCircle className="h-7 w-7" aria-hidden="true" />}
          label={formatCount(post.comment_count)}
          ariaLabel={`Kommentare öffnen — ${post.comment_count} Kommentare`}
          onClick={() => setCommentsOpen(true)}
        />
        <ActionButton
          icon={
            <Bookmark
              className={cn(
                'h-7 w-7',
                post.saved_by_me && 'fill-brand-gold text-brand-gold',
              )}
              aria-hidden="true"
            />
          }
          label={post.saved_by_me ? 'Gespeichert' : 'Merken'}
          ariaLabel={post.saved_by_me ? 'Aus Merkliste entfernen' : 'Zur Merkliste hinzufügen'}
          disabled={!viewerId || saveMut.isPending}
          onClick={() =>
            viewerId && saveMut.mutate({ postId: post.id, saved: post.saved_by_me })
          }
        />
        <ActionButton
          icon={<Share2 className="h-7 w-7" aria-hidden="true" />}
          label={formatCount(post.share_count)}
          ariaLabel={`Teilen — ${post.share_count} mal geteilt`}
          onClick={handleShare}
        />
        <ActionButton
          icon={muted ? <VolumeX className="h-6 w-6" aria-hidden="true" /> : <Volume2 className="h-6 w-6" aria-hidden="true" />}
          label={muted ? 'Stumm' : 'Laut'}
          ariaLabel={muted ? 'Ton einschalten' : 'Stummschalten'}
          onClick={onMuteToggle}
        />
      </div>

      {/* Progress-Bar */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/10">
        <div
          className="h-full bg-brand-gold transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* CommentSheet */}
      <CommentSheet
        postId={post.id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        allowComments={post.allow_comments}
        viewerId={viewerId}
      />
    </article>
  );
}

// -----------------------------------------------------------------------------
// ActionButton — Rail-Item mit Icon + Label.
// -----------------------------------------------------------------------------

function ActionButton({
  icon,
  label,
  ariaLabel,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  /**
   * Screenreader-Ansage. Wenn nicht gesetzt, fällt auf `label` zurück —
   * aber Call-Sites mit reinen Count-Labels ("12K") sollten `ariaLabel`
   * setzen, damit die Aktion (Like/Comment/Share) hörbar ist.
   */
  ariaLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className="flex flex-col items-center gap-1 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-md"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20">
        {icon}
      </span>
      <span aria-hidden="true" className="text-[11px] font-medium tabular-nums">{label}</span>
    </button>
  );
}

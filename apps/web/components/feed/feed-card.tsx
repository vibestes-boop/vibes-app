'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Heart, MessageCircle, Bookmark, Share2, Music, Volume2, VolumeX, Play, BadgeCheck, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  useTogglePostLike,
  useTogglePostSave,
  useToggleFollow,
} from '@/hooks/use-engagement';
import type { FeedPost } from '@/lib/data/feed';
import { LikeButton } from './like-button';
import { useFeedInteraction } from './feed-interaction-context';
import { linkify } from '@/lib/linkify';

// Feed-Captions liegen auf dunkler Video-Overlay — default `text-primary`
// würde gegen Schwarz/Video-Content zu blass werden. Weißer Link mit
// Underline-On-Hover ist analog zum TikTok-Feed-Stil.
const FEED_LINK_CLASS = 'font-semibold text-white underline-offset-2 hover:underline';

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

// Character-Threshold ab dem das Caption-„mehr"-Affordance greift (A6).
// 120 entspricht 2.5 Zeilen bei line-clamp-3 / text-sm — knapp über der
// sichtbaren Clamp-Grenze damit der Button nicht für triviale Längen
// erscheint.
const CAPTION_CLAMP_CHARS = 120;

export function FeedCard({ post, viewerId, isActive, muted, onMuteToggle }: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  // v1.w.UI.11 Phase C — Kommentar-Open-State lebt nicht mehr lokal in der
  // Karte, sondern im zentralen FeedInteractionContext. Grund: Auf xl+ soll
  // das Öffnen eines Comment-Panels die rechte Sidebar des HomeFeedShell
  // ersetzen (TikTok-Parity-Push statt Overlay). Die Shell ist State-Owner,
  // die Karte ist nur Dispatcher. Ohne Provider (z.B. Isolated-Karten-Tests)
  // liefert der Hook einen no-op-Fallback, FeedCard rendert weiterhin
  // fehlerfrei.
  const { openCommentsFor } = useFeedInteraction();
  // Caption-Expand (A6) — sobald der User „mehr" drückt, zeigen wir den
  // vollen Text. Beim Post-Wechsel (neuer post.id) auf kollabiert resetten.
  const [captionExpanded, setCaptionExpanded] = useState(false);
  useEffect(() => setCaptionExpanded(false), [post.id]);
  // Double-Tap-Heart-Overlay (A5) — monotoner Key, damit dieselbe Animation
  // zuverlässig re-triggert wenn der User schnell mehrfach doppelklickt.
  const [heartOverlayKey, setHeartOverlayKey] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const heartKeyCounterRef = useRef(0);

  const likeMut = useTogglePostLike();
  const saveMut = useTogglePostSave();
  const followMut = useToggleFollow();

  const handleLikeClick = useCallback(() => {
    if (!viewerId) return;
    likeMut.mutate({ postId: post.id, liked: post.liked_by_me });
  }, [viewerId, likeMut, post.id, post.liked_by_me]);

  // Double-Tap / Double-Click = like + großer Heart-Overlay.
  // Touch-Devices: iOS/Android Safari liefern zwar `dblclick`, aber nicht
  // konsistent auf Video-Elementen — deshalb zusätzlich Timer-basiertes
  // „zweimal-Touch-unter-300ms"-Muster.
  const triggerDoubleTapLike = useCallback(() => {
    // Overlay immer zeigen, auch wenn schon geliked (sonst fühlt sich der
    // zweite Doppel-Tap „tot" an).
    heartKeyCounterRef.current += 1;
    setHeartOverlayKey(heartKeyCounterRef.current);
    if (!viewerId) return;
    if (!post.liked_by_me) {
      likeMut.mutate({ postId: post.id, liked: false });
    }
  }, [viewerId, post.id, post.liked_by_me, likeMut]);

  const isSelf = viewerId === post.author.id;
  // Legacy-Rows (pre-media_type-Einführung) waren alle Videos — deshalb
  // defaulten wir auf 'video'. Explicit 'image' schaltet in den Bild-Render-
  // Pfad (Instagram-style Standbild mit Video-ähnlichem Overlay).
  const isImage = post.media_type === 'image';

  // Auto-Play / Pause je nach `isActive` — nur für Videos relevant.
  useEffect(() => {
    if (isImage) return;
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
  }, [isActive, isPaused, muted, isImage]);

  // Single-Click = Play/Pause-Toggle. Aber: wenn innerhalb 300ms ein
  // zweiter Klick kommt, überspringen wir das Toggle (der dblclick-Handler
  // übernimmt) — sonst pausiert das Video zuerst und startet dann wieder,
  // was visuell als Zuck wahrgenommen wird.
  const handleVideoTap = () => {
    if (isImage) return;
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;
    if (delta < 300) {
      // Double-Tap — Heart-Overlay + Like
      triggerDoubleTapLike();
      return;
    }
    // Single-Tap — Play/Pause. Wir warten NICHT auf den 300ms-Timeout
    // (das würde sich schwammig anfühlen). Wenn danach doch noch ein
    // Double-Tap kommt, pausiert das Video kurz — akzeptabler Trade-off,
    // weil 300ms-Delay auf jeden Single-Tap spürbarer wäre.
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
      className="group/card relative mx-auto flex aspect-[9/16] h-full max-h-full w-auto max-w-full overflow-hidden rounded-2xl bg-black"
      data-post-id={post.id}
    >
      {/* Media-Ebene: Video bei media_type='video', Bild bei 'image' */}
      {isImage ? (
        <div className="absolute inset-0">
          {/* Unscharfer Hintergrund-Fill für Nicht-9:16-Bilder — verhindert
              schwarze Balken links/rechts ohne das Motiv zu beschneiden. */}
          <img
            src={post.thumbnail_url ?? post.video_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
          />
          <img
            src={post.thumbnail_url ?? post.video_url}
            alt={post.caption ?? ''}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>
      ) : (
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

          {/* Play-Overlay wenn pausiert — TikTok-Größe 96px statt vorher 80 */}
          {isPaused && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30" aria-hidden="true">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                <Play className="h-12 w-12 fill-white text-white" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Double-Tap-Heart-Overlay (A5). Re-mountet mit jedem Doppel-Tap via
          `key`, damit die 800ms-Animation zuverlässig neu startet. Nach der
          Animation bleibt das Element am DOM (opacity 0) bis der nächste
          Tap re-mountet. Pointer-events-none damit es den Tap-Path nicht
          blockiert. */}
      {heartOverlayKey !== null && (
        <div
          key={`heart-overlay-${heartOverlayKey}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        >
          <Heart className="h-36 w-36 animate-heart-overlay fill-red-500 text-red-500 drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]" />
        </div>
      )}

      {/* Overlay-Ebene: Gradient unten + Text */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Text-Overlay unten links (A2: Avatar wandert in den Rail rechts,
          deshalb hier nur noch Username + Follow-Button in einer Zeile). */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 pb-6 pr-20 text-white">
        <div className="flex items-center gap-2">
          <Link
            href={`/u/${post.author.username}` as Route}
            className="flex items-center gap-1 text-sm font-semibold"
          >
            @{post.author.username}
            {post.author.verified && <BadgeCheck className="h-4 w-4 text-brand-gold" />}
          </Link>
          {!isSelf && !post.following_author && viewerId && (
            <button
              type="button"
              className="pointer-events-auto inline-flex h-7 items-center rounded-full bg-white/15 px-3 text-xs font-semibold text-white backdrop-blur-sm transition-colors duration-fast ease-out-expo hover:bg-white/25 disabled:opacity-60"
              disabled={followMut.isPending}
              onClick={() =>
                followMut.mutate({ userId: post.author.id, following: post.following_author })
              }
            >
              Folgen
            </button>
          )}
        </div>

        {/* Caption mit „mehr"-Affordance (A6). Unter CAPTION_CLAMP_CHARS
            unverändert. Darüber: kollabiert (line-clamp-3) + Button; nach
            Expand: voller Text + „weniger"-Button. */}
        {post.caption &&
          (post.caption.length > CAPTION_CLAMP_CHARS ? (
            <div className="pointer-events-auto text-sm leading-snug text-white/95">
              <p className={cn(!captionExpanded && 'line-clamp-3')}>
                {linkify(post.caption, { linkClassName: FEED_LINK_CLASS })}
              </p>
              <button
                type="button"
                onClick={() => setCaptionExpanded((v) => !v)}
                className="mt-0.5 text-xs font-semibold text-white/80 underline-offset-2 hover:underline"
                aria-expanded={captionExpanded}
              >
                {captionExpanded ? 'weniger' : 'mehr'}
              </button>
            </div>
          ) : (
            <p className="text-sm leading-snug text-white/95">
              {linkify(post.caption, { linkClassName: FEED_LINK_CLASS })}
            </p>
          ))}

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

      {/* Action-Rail rechts (A2 — Hierarchy + Avatar-Head).
          Größen-Skala nach TikTok-Pattern:
            - Avatar 56px (h-14 w-14) mit Follow-Plus-Badge (−bottom-1.5)
            - Like / Comment / Bookmark 48px (h-12 w-12) — Primary-Engagement
            - Share 44px (h-11 w-11), Mute 40px (h-10 w-10) — Secondary-Tools
          Icon-Größen korrespondieren (7/6/5), damit das Icon-to-Circle-Ratio
          konstant bleibt und die Hierarchie auch „blind" lesbar ist. */}
      <div className="pointer-events-auto absolute bottom-6 right-3 z-10 flex flex-col items-center gap-5 text-white">
        {/* Avatar mit optionalem Follow-Plus (TikTok-Signature-Slot). */}
        <Link
          href={`/u/${post.author.username}` as Route}
          className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label={`Profil von @${post.author.username} öffnen`}
        >
          <Avatar className="h-14 w-14 border-2 border-white/80">
            <AvatarImage src={post.author.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-neutral-800 text-sm text-white">
              {(post.author.display_name ?? post.author.username).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!isSelf && !post.following_author && viewerId && (
            <button
              type="button"
              onClick={(e) => {
                // Link-Navigation verhindern — nur Follow-Action triggern.
                e.preventDefault();
                e.stopPropagation();
                if (followMut.isPending) return;
                followMut.mutate({ userId: post.author.id, following: post.following_author });
              }}
              aria-label="Folgen"
              className="absolute -bottom-1.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-elevation-1 ring-2 ring-black/40 transition-transform duration-fast ease-out-expo hover:scale-110 disabled:opacity-60"
              disabled={followMut.isPending}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </Link>

        {/* Like (A3: eigene Komponente mit Burst) — 48px */}
        <LikeButton
          liked={post.liked_by_me}
          countLabel={formatCount(post.like_count)}
          rawCount={post.like_count}
          disabled={!viewerId || likeMut.isPending}
          onClick={handleLikeClick}
          iconClassName="h-7 w-7"
          circleClassName="h-12 w-12"
        />

        {/* Comment — 48px */}
        <ActionButton
          icon={<MessageCircle className="h-7 w-7" aria-hidden="true" />}
          label={formatCount(post.comment_count)}
          ariaLabel={`Kommentare öffnen — ${post.comment_count} Kommentare`}
          onClick={() => openCommentsFor(post.id)}
          circleClassName="h-12 w-12"
        />

        {/* Bookmark — 48px */}
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
          circleClassName="h-12 w-12"
        />

        {/* Share — 44px (Secondary-Tool, kleiner) */}
        <ActionButton
          icon={<Share2 className="h-6 w-6" aria-hidden="true" />}
          label={formatCount(post.share_count)}
          ariaLabel={`Teilen — ${post.share_count} mal geteilt`}
          onClick={handleShare}
          circleClassName="h-11 w-11"
        />

        {/* Mute — 40px (ambient Control, am kleinsten) */}
        {!isImage && (
          <ActionButton
            icon={muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
            label={muted ? 'Stumm' : 'Laut'}
            ariaLabel={muted ? 'Ton einschalten' : 'Stummschalten'}
            onClick={onMuteToggle}
            circleClassName="h-10 w-10"
          />
        )}
      </div>

      {/* Progress-Bar (A4) — idle 3px, hover auf dem gesamten Video 6px.
          Die Bar hat keinen eigenen Hover (zu schmales Hit-Target), also
          triggert der Hover der `article` via `group-hover`. Das heißt:
          sobald die Maus über dem Video schwebt, ist die Bar fett und
          lesbar. Auf Touch-Devices sind beide Zustände identisch
          (kein Hover), was okay ist — man sieht sie eh nur beim Scrollen. */}
      {!isImage && (
        <div className="absolute inset-x-0 bottom-0 z-20 h-[3px] bg-white/10 transition-[height] duration-base ease-out-expo group-hover/card:h-[6px]">
          <div
            className="h-full bg-brand-gold transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* CommentSheet / CommentPanel wird seit v1.w.UI.11 Phase C vom
          HomeFeedShell gerendert (State-Owner-Lift), damit das Öffnen auf
          xl+ die rechte Sidebar durch den Panel ersetzen kann. FeedCard
          triggert nur noch via `openCommentsFor(post.id)` aus dem
          FeedInteractionContext. */}
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
  circleClassName,
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
  /**
   * Größen-Klassen des Icon-Circle. Default 44px — für die A2-Hierarchy
   * setzen Call-Sites explizit `h-12 w-12` (Primary) oder `h-10 w-10`
   * (Ambient). Text-Label bleibt in allen Größen gleich (text-xs),
   * damit Zahlen gut lesbar bleiben.
   */
  circleClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className="group/action flex flex-col items-center gap-1 rounded-md outline-none transition-opacity duration-fast ease-out-expo focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-60"
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-colors duration-base ease-out-expo group-hover/action:bg-white/20',
          circleClassName ?? 'h-11 w-11',
        )}
      >
        {icon}
      </span>
      <span aria-hidden="true" className="text-xs font-semibold tabular-nums">{label}</span>
    </button>
  );
}

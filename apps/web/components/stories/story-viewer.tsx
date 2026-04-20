'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Pause, Play, Trash2, X } from 'lucide-react';

import type { StoryGroup, StoryItem } from '@/lib/data/stories';
import { deleteStory, markStoryViewed } from '@/app/actions/stories';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// <StoryViewer /> — Fullscreen Story-Viewer mit Timer-Progress, Tap-to-advance,
// Long-press-to-pause, Keyboard-Arrows und Carousel-Nav zwischen User-Gruppen.
//
// UX:
//  - Klick linke Hälfte oder ArrowLeft → vorherige Story (oder Gruppe davor)
//  - Klick rechte Hälfte oder ArrowRight → nächste Story (oder Gruppe danach)
//  - Long-press / Space / Play-Button → Pausieren
//  - Esc oder X → zurück zu /
//
// Timings:
//  - Image: 5s default
//  - Video: native duration (MVP: 10s cap, Videos kommen via <video> tag)
//
// Mark-as-viewed: sobald eine Story länger als 1s sichtbar war (Anti-Skim-
// Schutz). Async Fire-and-forget, optimistisch ohne revalidation.
// -----------------------------------------------------------------------------

const IMAGE_DURATION_MS = 5_000;
const VIDEO_DURATION_CAP_MS = 10_000;
const MIN_VIEW_MS = 1_000;

interface StoryViewerProps {
  group: StoryGroup;
  prevUserId: string | null;
  nextUserId: string | null;
  viewerUserId: string;
}

export function StoryViewer({
  group,
  prevUserId,
  nextUserId,
  viewerUserId,
}: StoryViewerProps) {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 für aktive Story
  const [, startTransition] = useTransition();

  const active: StoryItem | undefined = group.stories[activeIdx];
  const isOwn = group.userId === viewerUserId;

  // Tick-Timer-Ref
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(0); // ms die VOR dem letzten Pause-Reset gelaufen sind
  const viewedRef = useRef<Set<string>>(new Set());

  const storyDurationMs = active?.media_type === 'video' ? VIDEO_DURATION_CAP_MS : IMAGE_DURATION_MS;

  // ── Navigation ──
  const gotoPrev = () => {
    if (activeIdx > 0) {
      setActiveIdx((i) => i - 1);
    } else if (prevUserId) {
      router.push(`/stories/${prevUserId}` as Route);
    }
  };

  const gotoNext = () => {
    if (activeIdx < group.stories.length - 1) {
      setActiveIdx((i) => i + 1);
    } else if (nextUserId) {
      router.push(`/stories/${nextUserId}` as Route);
    } else {
      router.push('/' as Route);
    }
  };

  const close = () => router.push('/' as Route);

  // ── Reset Timer auf Story-Wechsel ──
  useEffect(() => {
    accumulatedRef.current = 0;
    startedAtRef.current = null;
    setProgress(0);
    setPaused(false);
  }, [activeIdx, group.userId]);

  // ── Timer-Loop ──
  useEffect(() => {
    if (!active) return;
    if (paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // akkumulierte Zeit updaten
      if (startedAtRef.current != null) {
        accumulatedRef.current += Date.now() - startedAtRef.current;
        startedAtRef.current = null;
      }
      return;
    }

    startedAtRef.current = Date.now();

    const tick = () => {
      if (startedAtRef.current == null) return;
      const elapsed = accumulatedRef.current + (Date.now() - startedAtRef.current);
      const p = Math.min(1, elapsed / storyDurationMs);
      setProgress(p);

      // Mark-as-viewed nach MIN_VIEW_MS
      if (elapsed >= MIN_VIEW_MS && active && !viewedRef.current.has(active.id)) {
        viewedRef.current.add(active.id);
        // Fire-and-forget
        startTransition(() => {
          void markStoryViewed(active.id);
        });
      }

      if (p >= 1) {
        gotoNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, activeIdx, group.userId, storyDurationMs, active?.id]);

  // ── Keyboard-Shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gotoPrev();
      else if (e.key === 'ArrowRight') gotoNext();
      else if (e.key === 'Escape') close();
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, prevUserId, nextUserId]);

  // ── Delete (nur für eigene Stories) ──
  const handleDelete = () => {
    if (!active || !isOwn) return;
    if (!window.confirm('Diese Story wirklich löschen?')) return;
    startTransition(async () => {
      const res = await deleteStory(active.id);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      // Wenn das die letzte Story dieser Gruppe war, zur nächsten navigieren
      if (group.stories.length <= 1) {
        if (nextUserId) router.push(`/stories/${nextUserId}` as Route);
        else router.push('/' as Route);
      } else {
        router.refresh();
      }
    });
  };

  if (!active) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-black text-white">
        <p>Keine Stories verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* ── Progress-Bars ──────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex gap-1 p-3">
        {group.stories.map((s, i) => (
          <div
            key={s.id}
            className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
          >
            <div
              className="h-full bg-white transition-[width]"
              style={{
                width:
                  i < activeIdx
                    ? '100%'
                    : i === activeIdx
                      ? `${Math.round(progress * 100)}%`
                      : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Header (Avatar + Close) ────────────────────────────── */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-6">
        <Link
          href={group.username ? (`/u/${group.username}` as Route) : '#'}
          className="pointer-events-auto flex items-center gap-2"
        >
          <Avatar className="h-9 w-9 border border-white/30">
            <AvatarImage src={group.avatar_url ?? undefined} alt="" />
            <AvatarFallback>
              {(group.username ?? '?').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-white">
            <p className="text-sm font-semibold">@{group.username ?? '…'}</p>
            <p className="text-[10px] opacity-70">{timeAgo(active.created_at)}</p>
          </div>
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Weiter' : 'Pausieren'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          {isOwn && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Story löschen"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-rose-500/60"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Schließen"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Media ──────────────────────────────────────────────── */}
      <div className="relative flex h-dvh w-full max-w-[500px] items-center justify-center">
        <div className="relative aspect-[9/16] w-full overflow-hidden bg-black sm:rounded-2xl">
          {active.media_type === 'video' ? (
            <VideoEl
              src={active.media_url}
              paused={paused}
              onEnded={gotoNext}
            />
          ) : (
            <Image
              src={active.media_url}
              alt=""
              fill
              sizes="(min-width: 640px) 500px, 100vw"
              className="object-cover"
              priority
            />
          )}

          {/* Poll-Overlay (display-only, Voting ist Roadmap) */}
          {active.interactive?.type === 'poll' && (
            <div className="absolute bottom-20 left-4 right-4 rounded-xl bg-black/60 p-3 backdrop-blur-md">
              <p className="mb-2 text-center text-sm font-semibold text-white">
                {active.interactive.question}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {active.interactive.options.map((opt, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-center text-sm text-white"
                  >
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tap-zones */}
          <button
            type="button"
            onClick={gotoPrev}
            aria-label="Vorherige Story"
            className="absolute inset-y-0 left-0 w-1/3 focus:outline-none"
          />
          <button
            type="button"
            onClick={gotoNext}
            aria-label="Nächste Story"
            className="absolute inset-y-0 right-0 w-1/3 focus:outline-none"
          />
        </div>

        {/* Desktop Prev/Next außerhalb der Canvas */}
        <button
          type="button"
          onClick={gotoPrev}
          aria-label="Vorherige Story"
          className={cn(
            'absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 sm:flex',
            activeIdx === 0 && !prevUserId && 'opacity-30',
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={gotoNext}
          aria-label="Nächste Story"
          className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 sm:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ─── Video-Wrapper (Pause-Sync) ─────────────────────────────────────────

function VideoEl({
  src,
  paused,
  onEnded,
}: {
  src: string;
  paused: boolean;
  onEnded: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }, [paused]);

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      playsInline
      onEnded={onEnded}
      className="h-full w-full object-cover"
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'gerade';
  if (mins < 60) return `vor ${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `vor ${hrs}h`;
}

'use client';

// -----------------------------------------------------------------------------
// ProfileHighlightsRow — v1.w.UI.235
//
// Horizontal scroll row of story-highlight bubbles below the profile bio.
// Parity mit native components/profile/ProfileHighlightsRow.tsx.
//
// Features:
//  • 66×66 circular bubbles with cover image + gradient + title
//  • Click → HighlightViewerDialog (lightbox for that highlight's media)
//  • Own profile: hover/focus reveals × delete button (via deleteHighlight action)
//  • Hidden when no highlights (no empty-state clutter on other people's profiles)
// -----------------------------------------------------------------------------

import { useState, useTransition, useEffect } from 'react';
import Image from 'next/image';
import { X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deleteHighlight } from '@/app/actions/highlights';
import { toast } from 'sonner';
import type { StoryHighlight } from '@/lib/data/story-highlights';

// ─── HighlightBubble ──────────────────────────────────────────────────────────

function HighlightBubble({
  highlight,
  isOwn,
  active,
  onClick,
  onDelete,
}: {
  highlight: StoryHighlight;
  isOwn: boolean;
  active: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      onDelete(highlight.id);
    });
  };

  const cover = highlight.thumbnail_url ?? highlight.media_url;

  return (
    <div className="group relative flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'relative h-[66px] w-[66px] overflow-hidden rounded-full ring-2 ring-offset-2 transition-all',
          active
            ? 'ring-primary ring-offset-background'
            : 'ring-border ring-offset-background hover:ring-primary/60',
        )}
        aria-label={`Highlight: ${highlight.title}`}
      >
        {/* Background gradient fallback */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-600" />

        {/* Cover image */}
        {cover ? (
          <Image
            src={cover}
            alt={highlight.title}
            fill
            className="object-cover"
            sizes="66px"
          />
        ) : null}

        {/* Bottom gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </button>

      {/* Delete button (own profile only) */}
      {isOwn && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Highlight ${highlight.title} löschen`}
          className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-background shadow ring-1 ring-border transition-colors hover:bg-destructive hover:text-destructive-foreground group-hover:flex group-focus-within:flex"
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </button>
      )}

      <span className="max-w-[66px] truncate text-center text-[11px] leading-tight text-foreground/80">
        {highlight.title}
      </span>
    </div>
  );
}

// ─── HighlightViewerDialog ────────────────────────────────────────────────────

function HighlightViewerDialog({
  highlights,
  startIndex,
  onClose,
}: {
  highlights: StoryHighlight[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const item = highlights[current];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(0, c - 1));
      if (e.key === 'ArrowRight') setCurrent((c) => Math.min(highlights.length - 1, c + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, highlights.length]);

  if (!item) return null;

  const media = item.media_url;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Highlight: ${item.title}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90dvh] max-w-[420px] w-full flex-col overflow-hidden rounded-2xl bg-black"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-white">{item.title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress dots */}
        {highlights.length > 1 && (
          <div className="flex gap-1 px-4 pb-2">
            {highlights.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all',
                  i === current ? 'bg-white' : 'bg-white/30',
                )}
                aria-label={`Highlight ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Media */}
        <div className="relative aspect-[9/16] w-full bg-zinc-900">
          {media ? (
            item.media_type === 'video' ? (
              <video
                key={media}
                src={media}
                autoPlay
                loop
                playsInline
                muted={false}
                className="h-full w-full object-contain"
              />
            ) : (
              <Image
                src={media}
                alt={item.title}
                fill
                className="object-contain"
                sizes="420px"
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-800">
              <span className="text-4xl">✨</span>
            </div>
          )}
        </div>

        {/* Prev / Next */}
        {highlights.length > 1 && (
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-white/50">
              {current + 1} / {highlights.length}
            </span>
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.min(highlights.length - 1, c + 1))}
              disabled={current === highlights.length - 1}
              className="grid h-8 w-8 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProfileHighlightsRow ─────────────────────────────────────────────────────

export function ProfileHighlightsRow({
  initialHighlights,
  isOwn,
  username,
}: {
  initialHighlights: StoryHighlight[];
  isOwn: boolean;
  username: string;
}) {
  const [highlights, setHighlights] = useState<StoryHighlight[]>(initialHighlights);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (highlights.length === 0) return null;

  const handleDelete = async (id: string) => {
    // Optimistic remove
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    const res = await deleteHighlight(id, username);
    if (!res.ok) {
      // Rollback
      setHighlights(initialHighlights);
      toast.error(res.error ?? 'Löschen fehlgeschlagen.');
    }
  };

  return (
    <>
      <div className="w-full overflow-x-auto scrollbar-none">
        <div className="flex gap-4 px-4 py-3 sm:px-6">
          {highlights.map((h, i) => (
            <HighlightBubble
              key={h.id}
              highlight={h}
              isOwn={isOwn}
              active={viewerIndex === i}
              onClick={() => setViewerIndex(i)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {viewerIndex !== null && (
        <HighlightViewerDialog
          highlights={highlights}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}

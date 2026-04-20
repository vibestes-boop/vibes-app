'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FeedCard } from './feed-card';
import { useTogglePostLike } from '@/hooks/use-engagement';
import type { FeedPost } from '@/lib/data/feed';
import { ArrowDown, ArrowUp, KeyboardIcon } from 'lucide-react';

// -----------------------------------------------------------------------------
// FeedList — vertikaler Snap-Scroll-Container, ein Post pro Viewport-Höhe.
// - Snap auf Segment-Basis (`scroll-snap-type: y mandatory`)
// - IntersectionObserver bestimmt, welcher Post "active" ist (= spielt)
// - Keyboard: J/↓ next, K/↑ prev, L like, M mute, Space pause
// - Initial-Liste kommt per SSR-Prefetch (Query-Hydration), dieser Client-Query
//   liest dann bloß aus dem Cache. Wenn initialData nicht da ist, ist die
//   Liste halt leer und der Parent-Screen zeigt einen eigenen Empty-State.
// -----------------------------------------------------------------------------

export interface FeedListProps {
  initialPosts: FeedPost[];
  viewerId: string | null;
  /** Key segment für den TanStack-Query-Cache — z.B. 'foryou' oder 'following'. */
  feedKey?: string;
  /** Optionaler Header-Slot, z.B. Tabs/Filter auf Mobile. */
  header?: React.ReactNode;
}

export function FeedList({ initialPosts, viewerId, feedKey = 'foryou', header }: FeedListProps) {
  // TanStack-Cache für den Feed — gemeinsamer Key mit `use-engagement` Mutations.
  const qc = useQueryClient();
  useEffect(() => {
    // Initial-Seed, damit Optimistic-Updates greifen.
    qc.setQueryData<FeedPost[]>(['feed'], initialPosts);
    qc.setQueryData<FeedPost[]>(['feed', feedKey], initialPosts);
  }, [initialPosts, feedKey, qc]);

  const { data: posts } = useQuery<FeedPost[]>({
    queryKey: ['feed'],
    queryFn: () => initialPosts,
    initialData: initialPosts,
    staleTime: Infinity,
  });

  const list = posts ?? initialPosts;

  // Aktiver Post: der mit höchstem Intersection-Ratio in der Liste.
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [showHint, setShowHint] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  const setCardRef = useCallback((el: HTMLElement | null, idx: number) => {
    cardRefs.current[idx] = el;
  }, []);

  // IntersectionObserver — wir beobachten jede Karte, der mit dem größten
  // `intersectionRatio` gewinnt. Threshold-Liste für feinere Übergänge.
  useEffect(() => {
    if (list.length === 0) return;
    const root = containerRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Best-Candidate: höchster intersectionRatio über alle Entries der Karten.
        let best = { idx: activeIdx, ratio: 0 };
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute('data-feed-idx'));
          if (Number.isNaN(idx)) continue;
          if (entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best.ratio > 0.6 && best.idx !== activeIdx) {
          setActiveIdx(best.idx);
        }
      },
      {
        root,
        threshold: [0, 0.25, 0.5, 0.6, 0.75, 1],
      },
    );

    for (const el of cardRefs.current) {
      if (el) io.observe(el);
    }

    return () => io.disconnect();
  }, [list.length, activeIdx]);

  // Navigation
  const scrollTo = useCallback(
    (nextIdx: number) => {
      if (list.length === 0) return;
      const clamped = Math.max(0, Math.min(list.length - 1, nextIdx));
      const target = cardRefs.current[clamped];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [list.length],
  );

  // Keyboard shortcuts — global, solange der Container gemountet ist und
  // der Fokus nicht gerade in einem Textfeld liegt.
  const likeMut = useTogglePostLike();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore wenn fokus in input/textarea/contenteditable liegt.
      const tgt = e.target as HTMLElement | null;
      if (tgt) {
        const tag = tgt.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tgt.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const active = list[activeIdx];
      switch (e.key) {
        case 'j':
        case 'J':
        case 'ArrowDown':
          e.preventDefault();
          scrollTo(activeIdx + 1);
          break;
        case 'k':
        case 'K':
        case 'ArrowUp':
          e.preventDefault();
          scrollTo(activeIdx - 1);
          break;
        case 'l':
        case 'L':
          if (active && viewerId) {
            e.preventDefault();
            likeMut.mutate({ postId: active.id, liked: active.liked_by_me });
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setMuted((m) => !m);
          break;
        case ' ':
          // Space pausiert — wir simulieren das, indem wir das active <video>
          // via data-Attribut finden und toggle-n.
          if (active) {
            e.preventDefault();
            const video = document
              .querySelector<HTMLElement>(`[data-post-id="${active.id}"]`)
              ?.querySelector('video');
            if (video) {
              if (video.paused) void video.play();
              else video.pause();
            }
          }
          break;
        case '?':
          setShowHint((s) => !s);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIdx, list, scrollTo, likeMut, viewerId]);

  // Hint-Pop ein-mal pro Session anzeigen.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!sessionStorage.getItem('serlo.feed.hintShown')) {
        setShowHint(true);
        sessionStorage.setItem('serlo.feed.hintShown', '1');
        const t = setTimeout(() => setShowHint(false), 5000);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onMuteToggle = useCallback(() => setMuted((m) => !m), []);

  const empty = useMemo(() => list.length === 0, [list.length]);

  return (
    <div className="relative h-full w-full">
      {header && <div className="absolute inset-x-0 top-0 z-20 mx-auto max-w-[420px]">{header}</div>}

      <div
        ref={containerRef}
        className="no-scrollbar h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {empty && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <span>Noch nichts in deinem Feed.</span>
            <span className="text-xs">Folge jemandem oder schau in /explore rein.</span>
          </div>
        )}

        {list.map((post, idx) => (
          <section
            key={post.id}
            data-feed-idx={idx}
            ref={(el) => setCardRef(el, idx)}
            className="flex h-full w-full snap-start items-center justify-center py-2"
          >
            <FeedCard
              post={post}
              viewerId={viewerId}
              isActive={idx === activeIdx}
              muted={muted}
              onMuteToggle={onMuteToggle}
            />
          </section>
        ))}
      </div>

      {/* Desktop-Navigation (nur ≥ md) */}
      <div className="pointer-events-none absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 md:flex">
        <button
          type="button"
          onClick={() => scrollTo(activeIdx - 1)}
          disabled={activeIdx === 0}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur hover:bg-background disabled:opacity-40"
          aria-label="Vorheriges Video (K)"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollTo(activeIdx + 1)}
          disabled={activeIdx >= list.length - 1}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur hover:bg-background disabled:opacity-40"
          aria-label="Nächstes Video (J)"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowHint((s) => !s)}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur hover:bg-background"
          aria-label="Tastaturkürzel anzeigen"
        >
          <KeyboardIcon className="h-5 w-5" />
        </button>
      </div>

      {showHint && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-background/95 px-4 py-3 text-xs shadow-lg backdrop-blur">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">J / ↓</kbd>
            <span>Nächstes</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">K / ↑</kbd>
            <span>Vorheriges</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">L</kbd>
            <span>Like</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">M</kbd>
            <span>Stumm</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Space</kbd>
            <span>Pause</span>
          </div>
        </div>
      )}
    </div>
  );
}

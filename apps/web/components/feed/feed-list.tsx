'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FeedCard } from './feed-card';
import { useFeedInteraction } from './feed-interaction-context';
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
  // TanStack-Cache für den Feed — feed-key-scoped, damit For-You und Following
  // jeweils ihren eigenen Cache-Slot haben und sich nicht gegenseitig überschreiben.
  // Mutations in `use-engagement` nutzen `setQueriesData({ queryKey: ['feed'] }, …)`
  // mit Partial-Match, so werden BEIDE Caches bei Like/Save/Follow/Comment synchron
  // gehalten (ein Post kann in For-You UND Following gleichzeitig auftauchen).
  const qc = useQueryClient();
  useEffect(() => {
    qc.setQueryData<FeedPost[]>(['feed', feedKey], initialPosts);
  }, [initialPosts, feedKey, qc]);

  const { data: posts } = useQuery<FeedPost[]>({
    queryKey: ['feed', feedKey],
    queryFn: () => initialPosts,
    initialData: initialPosts,
    staleTime: Infinity,
  });

  const list = posts ?? initialPosts;

  // Aktiver Post: der mit höchstem Intersection-Ratio in der Liste.
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [showHint, setShowHint] = useState(false);

  // Kommentar-Panel-Sync (v1.w.UI.11 Phase C Follow-up): wenn der Panel
  // auf xl+ offen ist und der User weiterscrollt, soll der Panel automatisch
  // auf den neuen aktiven Post umschwenken. Ohne diesen Sync würde der Panel
  // Kommentare für einen Post zeigen, der gar nicht mehr im Viewport ist.
  //
  // Wichtig: der Effect triggert NUR solange der Panel bereits offen ist
  // (`commentsOpenForPostId` truthy). Beim Panel-Schließen oder beim reinen
  // Scrollen ohne offenen Panel macht er nichts. Kein Auto-Open via Scroll.
  //
  // No-op-Fallback via `useFeedInteraction()` (ohne Provider → beide Felder
  // sind Null/no-op) hält die FeedList isoliert testbar, sowie auf Routen
  // die keinen HomeFeedShell wrappen.
  const { commentsOpenForPostId, openCommentsFor } = useFeedInteraction();

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

  // Panel-Sync (s. Kommentar oben beim Hook-Destructure). Feuert bei jedem
  // `activeIdx`-Change UND jedem Panel-Open/Close-Edge.
  //
  // Loop-Prävention (wichtig!):
  // (1) Wir lesen `list` via Ref, NICHT via Dep — sonst triggert jede Query-
  //     Cache-Mutation (Like/Comment-Count-Bump) einen neuen Effect-Run.
  // (2) `lastSyncedIdRef` merkt sich die zuletzt dispatchte PostID. Zwischen
  //     dispatch und dem nachfolgenden Render hat `commentsOpenForPostId`
  //     noch den alten Wert — ohne diesen Ref würde der Effect nochmal feuern
  //     bevor der neue State angekommen ist (Layout-Shift vom Grid-Col-Switch
  //     lässt IO in der Zeit `activeIdx` oszillieren und das reicht).
  // (3) Reset des Refs beim Panel-Close, damit ein späteres Re-Open auf
  //     demselben Post wieder greift.
  const listRef = useRef(list);
  useEffect(() => {
    listRef.current = list;
  }, [list]);

  const lastSyncedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!commentsOpenForPostId) {
      lastSyncedIdRef.current = null;
      return;
    }
    const activePost = listRef.current[activeIdx];
    if (!activePost) return;
    if (activePost.id === commentsOpenForPostId) return;
    if (lastSyncedIdRef.current === activePost.id) return;
    lastSyncedIdRef.current = activePost.id;
    openCommentsFor(activePost.id);
  }, [activeIdx, commentsOpenForPostId, openCommentsFor]);

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

  // Hint-Pop ein-mal pro Session — beim ersten Keyboard-Input (nicht beim Mount).
  // Rationale: Mount-Hints sind visueller Noise für User, die eh nie die Tastatur
  // nutzen (Mobile, Touch). Wer eine Taste drückt, ist ein Discovery-Signal —
  // zeig den Hint genau dann, 3s lang, dann weg.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem('serlo.feed.hintShown')) return;
    } catch {
      /* ignore storage errors, fall through */
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const onFirstKey = (e: KeyboardEvent) => {
      // Nur echte Nav-Tasten triggern den Hint — Modifier-only-Presses (Shift, Ctrl)
      // oder Tippen im Input-Feld sollen nicht zählen.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // e.target kann auch window/document sein (z.B. wenn der Listener auf
      // window lauscht und kein Element Focus hat — bei Tests via
      // fireEvent.keyDown(window, …) der Standardfall). Ohne instanceof-Guard
      // würde getAttribute unten einen TypeError werfen. Element-Check vor
      // jeglichem Property-Access.
      const t = e.target;
      if (t instanceof Element) {
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        // In JSDOM greift weder `isContentEditable` (computed getter) noch
        // `getAttribute('contenteditable')` verläßlich, wenn das Attribut via
        // IDL-Property-Setter (`el.contentEditable = 'true'`) statt via
        // setAttribute gesetzt wurde — die Reflection ist in JSDOM unvollständig.
        // Triple-Check: IDL-Property direkt (die der Test-Setter immer schreibt)
        // + computed Getter (echter Browser) + Attribut (setAttribute-Fall).
        const el = t as HTMLElement;
        const ceProp = el.contentEditable;
        if (ceProp === 'true' || ceProp === 'plaintext-only' || ceProp === '') return;
        if (el.isContentEditable) return;
        const ce = t.getAttribute('contenteditable');
        if (ce === 'true' || ce === '' || ce === 'plaintext-only') return;
      }
      if (cancelled) return;

      cancelled = true;
      window.removeEventListener('keydown', onFirstKey);
      setShowHint(true);
      try {
        sessionStorage.setItem('serlo.feed.hintShown', '1');
      } catch {
        /* ignore */
      }
      timeoutId = setTimeout(() => setShowHint(false), 3000);
    };

    window.addEventListener('keydown', onFirstKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onFirstKey);
      if (timeoutId) clearTimeout(timeoutId);
    };
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
            className="flex h-full w-full snap-start items-center justify-center"
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

      {/* Desktop-Navigation (nur ≥ md).
          v1.w.UI.24: Position von `top-1/2` auf `top-4` verlegt. Vorher saßen
          die Buttons in der vertikalen Spaltenmitte und kollidierten bei
          Landscape-Karten mit der Action-Rail des FeedCard (die vom Karten-
          Boden nach oben wächst und bei breiten Karten denselben rechten
          Lane belegt — z.B. Like/Bookmark zwischen Up- und Down-Pfeil).
          Mit `top-4` sitzen sie jetzt am oberen Spaltenrand, getrennt von
          der Action-Rail (die typischerweise im unteren Drittel beginnt).
          Funktional unverändert — Tasten J/K/↑/↓ + Scroll bleiben primäre
          Navigation. */}
      <div className="pointer-events-none absolute right-4 top-4 z-30 hidden flex-col gap-2 md:flex">
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

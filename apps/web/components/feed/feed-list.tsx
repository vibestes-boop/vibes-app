'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FeedCard } from './feed-card';
import { WebLiveFeedCard, type LiveFeedSession } from './web-live-feed-card';
import { useFeedInteraction } from './feed-interaction-context';
import { useTogglePostLike } from '@/hooks/use-engagement';
import { recordPostView } from '@/app/actions/engagement';
import type { FeedPost } from '@/lib/data/feed';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Compass, KeyboardIcon, RefreshCw } from 'lucide-react';

// ── DisplayRow: interleaved Posts + Live-Cards ───────────────────────────────
type DisplayRow =
  | { kind: 'post'; post: FeedPost }
  | { kind: 'live'; session: LiveFeedSession; rowKey: string };

// -----------------------------------------------------------------------------
// FeedList — vertikaler Snap-Scroll-Container, ein Post pro Viewport-Höhe.
// - Snap auf Segment-Basis (`scroll-snap-type: y mandatory`)
// - IntersectionObserver bestimmt, welcher Post "active" ist (= spielt)
// - Keyboard: J/↓ next, K/↑ prev, L like, M mute, Space pause
// - Initial-Liste kommt per SSR-Prefetch (Query-Hydration), dieser Client-Query
//   liest dann bloß aus dem Cache. Wenn initialData nicht da ist, ist die
//   Liste halt leer und der Parent-Screen zeigt einen eigenen Empty-State.
// - Infinite Scroll (v1.w.UI.45): Sentinel am Listenende triggert Nachladen
//   via /api/feed/[feedKey]?before=<cursor>. TQ-Cache wird mit append
//   mitgepflegt, damit Like/Save-Mutations auf nachgeladenen Posts greifen.
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
  // v1.w.UI.67 — Mute-Präferenz persistieren. Default: true (stumm) für
  // Autoplay-Compliance, aber User-Wahl wird in localStorage gemerkt damit
  // er nicht nach jedem Reload erneut den Ton einschalten muss.
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('serlo.feed.muted');
      if (stored !== null) setMuted(stored === 'true');
    } catch {
      /* localStorage blockiert (Privacy-Mode) → Default true bleibt */
    }
  }, []);
  const [showHint, setShowHint] = useState(false);

  // ── v1.w.UI.68 — "Neue Posts" Refresh-Pill ───────────────────────────────
  // Einmal nach 90s den Einzel-Head-Request auf /api/feed/[feedKey]?limit=1
  // abfeuern. Falls der zurückgegebene Post neuer ist als der neueste im
  // aktuellen Snapshot, erscheint ein floating Pill "⬆ Neue Posts" oben.
  // Klick → router.refresh() + scroll to top. Nur für 'foryou' (Following
  // ist weniger volatil; würde dort eher verwirren).
  const router = useRouter();
  const [showNewPostsPill, setShowNewPostsPill] = useState(false);

  // ── Live-Sessions für Feed-Injection (v1.w.UI.229) ────────────────────────
  // Einmalig beim Mount gefetcht — wir wollen keine Realtime-Volatilität im Feed.
  // Limit 6, gecycled falls weniger Sessions als 6-Post-Blöcke vorhanden.
  const [liveSessions, setLiveSessions] = useState<LiveFeedSession[]>([]);
  useEffect(() => {
    // Nur im For-You-Feed und nur wenn initiale Posts vorhanden sind (sonst
    // gibt es nichts, in das wir Live-Cards injizieren könnten).
    if (feedKey !== 'foryou' || initialPosts.length === 0) return;
    const controller = new AbortController();
    let cancelled = false;

    fetch('/api/feed/live', { cache: 'no-store', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: LiveFeedSession[]) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setLiveSessions(data);
        }
      })
      .catch(() => { /* silent — kein Live bedeutet einfach keine Injection */ });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [feedKey, initialPosts.length]);

  // ── DisplayRows: Posts interleaved mit Live-Cards alle 6 Posts ────────────
  const displayRows = useMemo((): DisplayRow[] => {
    if (liveSessions.length === 0) {
      // Kein Live → plain Post-Rows
      return list.map((post) => ({ kind: 'post', post }));
    }
    const rows: DisplayRow[] = [];
    list.forEach((post, postIdx) => {
      rows.push({ kind: 'post', post });
      // Nach jedem 6. Post (0-basiert: Index 5, 11, 17, …) eine Live-Card
      if ((postIdx + 1) % 6 === 0) {
        const liveIdx = Math.floor(postIdx / 6) % liveSessions.length;
        const session = liveSessions[liveIdx];
        if (session) {
          rows.push({ kind: 'live', session, rowKey: `live-${session.id}-after-${postIdx}` });
        }
      }
    });
    return rows;
  }, [list, liveSessions]);
  const newestCreatedAt = useMemo(
    () => (list.length > 0 ? list[0].created_at : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // bewusst nur beim ersten Render — wir wollen den initialen Snapshot
  );
  useEffect(() => {
    if (feedKey !== 'foryou' || !newestCreatedAt) return;
    const tid = setTimeout(async () => {
      try {
        const res = await fetch(`/api/feed/foryou?limit=1`, { cache: 'no-store' });
        if (!res.ok) return;
        const data: FeedPost[] = await res.json();
        if (data.length > 0 && data[0].created_at > newestCreatedAt) {
          setShowNewPostsPill(true);
        }
      } catch { /* non-fatal */ }
    }, 90_000); // 90 Sekunden
    return () => clearTimeout(tid);
  }, [feedKey, newestCreatedAt]);

  const handleNewPostsPill = useCallback(() => {
    setShowNewPostsPill(false);
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    // Kurze Verzögerung damit der Scroll-Animation Zeit hat bevor Refresh
    setTimeout(() => router.refresh(), 400);
  }, [router]);

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

  // ── Infinite Scroll ──────────────────────────────────────────────────────
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (isFetchingMore || !hasMore) return;
    const current = qc.getQueryData<FeedPost[]>(['feed', feedKey]) ?? initialPosts;
    const last = current[current.length - 1];
    if (!last) return;

    setIsFetchingMore(true);
    try {
      const url = `/api/feed/${feedKey}?before=${encodeURIComponent(last.created_at)}&limit=10`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const newPosts: FeedPost[] = await res.json();
      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        // Doppelte Posts vermeiden (race condition bei schnellem Scroll)
        const seenIds = new Set(current.map((p) => p.id));
        const deduped = newPosts.filter((p) => !seenIds.has(p.id));
        if (deduped.length > 0) {
          qc.setQueryData<FeedPost[]>(['feed', feedKey], [...current, ...deduped]);
        }
        if (newPosts.length < 10) setHasMore(false);
      }
    } catch {
      // silent — nächster Scroll-Trigger versucht es erneut
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore, feedKey, initialPosts, qc]);

  // Sentinel-Observer — triggert loadMore wenn der Sentinel sichtbar wird.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [loadMore]);
  // ─────────────────────────────────────────────────────────────────────────

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  const setCardRef = useCallback((el: HTMLElement | null, idx: number) => {
    cardRefs.current[idx] = el;
  }, []);

  // IntersectionObserver — wir beobachten jede Karte, der mit dem größten
  // `intersectionRatio` gewinnt. Threshold-Liste für feinere Übergänge.
  useEffect(() => {
    if (displayRows.length === 0) return;
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
  }, [displayRows.length, activeIdx]);

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
  const displayRowsRef = useRef(displayRows);
  useEffect(() => {
    displayRowsRef.current = displayRows;
  }, [displayRows]);

  const lastSyncedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!commentsOpenForPostId) {
      lastSyncedIdRef.current = null;
      return;
    }
    const activeRow = displayRowsRef.current[activeIdx];
    const activePost = activeRow?.kind === 'post' ? activeRow.post : null;
    if (!activePost) return;
    if (activePost.id === commentsOpenForPostId) return;
    if (lastSyncedIdRef.current === activePost.id) return;
    lastSyncedIdRef.current = activePost.id;
    openCommentsFor(activePost.id);
  }, [activeIdx, commentsOpenForPostId, openCommentsFor]);

  // ── v1.w.UI.138 — View-Count Tracking ────────────────────────────────────
  // Fires increment_post_view after 1.5 s dwell — mirrors mobile app behaviour.
  // Session-dedup via Set (RPC also deduplicates server-side via post_views table).
  // Skipped for unauthenticated users — RPC is REVOKE'd from anon anyway.
  const viewedInSessionRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!viewerId) return;
    const activeRow = displayRowsRef.current[activeIdx];
    const post = activeRow?.kind === 'post' ? activeRow.post : null;
    if (!post || viewedInSessionRef.current.has(post.id)) return;
    const timer = setTimeout(() => {
      const row = displayRowsRef.current[activeIdx];
      const p = row?.kind === 'post' ? row.post : null;
      if (!p || viewedInSessionRef.current.has(p.id)) return;
      viewedInSessionRef.current.add(p.id);
      void recordPostView(p.id).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeIdx, viewerId]);
  // ─────────────────────────────────────────────────────────────────────────

  // Navigation
  const scrollTo = useCallback(
    (nextIdx: number) => {
      if (displayRows.length === 0) return;
      const clamped = Math.max(0, Math.min(displayRows.length - 1, nextIdx));
      const target = cardRefs.current[clamped];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [displayRows.length],
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

      const activeRow = displayRows[activeIdx];
      const active = activeRow?.kind === 'post' ? activeRow.post : null;
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
  }, [activeIdx, displayRows, scrollTo, likeMut, viewerId]);

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

  const onMuteToggle = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem('serlo.feed.muted', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const empty = useMemo(() => list.length === 0, [list.length]);

  return (
    <div className="relative h-full w-full">
      {/* ── Neue-Posts-Pill (v1.w.UI.68) ───────────────────────────────── */}
      {showNewPostsPill && (
        <button
          type="button"
          onClick={handleNewPostsPill}
          className="absolute inset-x-0 top-4 z-30 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Neue Posts
        </button>
      )}

      {header && <div className="absolute inset-x-0 top-0 z-20 mx-auto max-w-[420px]">{header}</div>}

      <div
        ref={containerRef}
        className="no-scrollbar h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {empty && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Compass className="h-10 w-10 opacity-30" strokeWidth={1.5} />
            <p className="text-sm font-medium">Noch keine Posts hier.</p>
            <p className="text-xs opacity-70">Schau in /explore rein oder folge neuen Accounts.</p>
          </div>
        )}

        {displayRows.map((row, idx) => {
          const distanceFromActive = Math.abs(idx - activeIdx);
          const shouldMountInteractiveCard = distanceFromActive <= 2;

          return (
            <section
              key={row.kind === 'post' ? row.post.id : row.rowKey}
              data-feed-idx={idx}
              ref={(el) => setCardRef(el, idx)}
              // v1.w.UI.29 / v1.w.UI.31 / v1.w.UI.32 (Hard Containment + Spacing):
              // - `overflow-hidden` + `max-h-[100dvh]`: harter Cap auf Viewport-
              //   Höhe, garantiert dass kein Content in nächste Section läuft
              // - `py-4`: 16px oben + 16px unten = 32px sichtbarer Gap zwischen
              //   aufeinanderfolgenden Posts. py-2 (16px gesamt) war bei Hoch-
              //   format-Posts kaum sichtbar weil Article fast volle Höhe
              //   ausfüllt — py-4 macht es deutlich. Section-Höhe bleibt 100dvh,
              //   Content-Area ist 100dvh - 32px.
              className="flex h-full max-h-[100dvh] w-full snap-start items-center justify-center overflow-hidden py-4"
            >
              {row.kind === 'post' ? (
                shouldMountInteractiveCard ? (
                  <FeedCard
                    post={row.post}
                    viewerId={viewerId}
                    isActive={idx === activeIdx}
                    shouldLoadMedia={distanceFromActive <= 1}
                    muted={muted}
                    onMuteToggle={onMuteToggle}
                  />
                ) : (
                  <FeedPostPlaceholder post={row.post} />
                )
              ) : (
                <WebLiveFeedCard session={row.session} />
              )}
            </section>
          );
        })}

        {/* Infinite-Scroll-Sentinel — wenn er sichtbar wird, triggert der
            IntersectionObserver oben `loadMore()`. snap-start damit der
            Scroller nicht über den Sentinel hinausschießt. */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex h-16 items-center justify-center snap-start"
          >
            {isFetchingMore && (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
            )}
          </div>
        )}
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
          disabled={activeIdx >= displayRows.length - 1}
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

function FeedPostPlaceholder({ post }: { post: FeedPost }) {
  const mediaSource = post.thumbnail_url || (post.media_type === 'image' ? post.video_url : '');
  const aspectRatio =
    post.aspect_ratio === 'landscape'
      ? 16 / 9
      : post.aspect_ratio === 'square'
        ? 1
        : 9 / 16;
  const isWide = aspectRatio > 1;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex h-full max-h-[100dvh] w-full max-w-full items-center justify-center overflow-hidden opacity-95"
    >
      <div
        className={cn(
          'flex w-full max-h-full max-w-full items-end justify-center gap-3',
          isWide ? '' : 'h-full',
        )}
      >
        <article
          style={{ aspectRatio, maxHeight: '100dvh' }}
          className={cn(
            'relative flex max-h-full overflow-hidden rounded-2xl bg-black',
            isWide ? 'min-w-0 flex-1 h-auto' : 'h-full w-auto shrink-0',
          )}
        >
          {mediaSource ? (
            <NextImage
              src={mediaSource}
              alt=""
              fill
              sizes="1px"
              className="object-contain opacity-80"
            />
          ) : (
            <div className="h-full w-full bg-black" />
          )}
        </article>
        <aside className="flex shrink-0 flex-col items-center gap-5 pb-2">
          <div className="h-14 w-14 rounded-full bg-foreground/10" />
          <div className="h-12 w-12 rounded-full bg-foreground/10" />
          <div className="h-12 w-12 rounded-full bg-foreground/10" />
          <div className="h-12 w-12 rounded-full bg-foreground/10" />
          <div className="h-11 w-11 rounded-full bg-foreground/10" />
        </aside>
      </div>
    </div>
  );
}

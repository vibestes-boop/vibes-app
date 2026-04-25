'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Music,
  Volume2,
  VolumeX,
  Play,
  BadgeCheck,
  Plus,
  MoreHorizontal,
  Settings,
  Captions,
  EyeOff,
  Flag,
} from 'lucide-react';
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
// FeedCard — eine Video-Karte im vertikalen Feed.
// Auto-Play via IntersectionObserver (≥60% sichtbar → play, sonst pause).
// Muted-Default (Autoplay-Policy); globaler Mute-State kommt vom Parent.
//
// Aspect-Ratio-Verhalten (v1.w.UI.23 — TikTok-Parity für Querformat):
// Standard ist 9:16 (Hochformat-Phone-Video). Sobald `onLoadedMetadata`
// des `<video>`-Elements feuert, kennen wir die echten Pixel-Dimensionen
// und passen den Container dynamisch an:
//   - Ratio < 1 (Portrait): bleibt height-bound (aspect-[9/16] h-full),
//     wie bisher. Schwarze Letterbox links/rechts nur wenn Video schmaler
//     als 9:16 ist (selten).
//   - Ratio >= 1 (Landscape, z.B. 16:9 oder 1:1): wird width-bound
//     (w-full h-auto) mit dynamischem aspectRatio per inline-style.
//     Container wird breit + niedriger, KEIN Letterbox oben/unten.
// Bilder verwenden weiterhin den 9:16-Frame mit Blur-Fill (Insta-Style),
// weil Image-Posts oft bewusst quadratisch komponiert sind und in einem
// Portrait-Frame mit Blur-Border besser wirken als beschnitten.
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
  const { commentsOpenForPostId, openCommentsFor, closeComments } = useFeedInteraction();
  const isCommentsOpenForThisPost = commentsOpenForPostId === post.id;
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

  // Detected media aspect-ratio (width/height). null = noch nicht geladen,
  // dann verwenden wir 9:16 als sicheren Default. Wird bei post.id-Wechsel
  // resettet, damit das nächste Video nicht mit dem Ratio des vorigen rendert.
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number | null>(null);
  useEffect(() => setMediaAspectRatio(null), [post.id]);

  // Robuste Aspect-Detection (v1.w.UI.25 — Iteration 3):
  // Pure JSX-Event-Props (`onLoadedMetadata` / `onLoad`) haben in Production
  // nicht zuverlässig gefeuert (User-bestätigt: Querformat-Videos blieben
  // im 9:16-Frame mit Letterbox). Vermutete Gründe: gecachte Medien haben
  // Metadata bereits beim Mount geladen, das Event feuert nie nochmal; oder
  // das Event feuert auf einem unmounted Element bei React-Re-Mounts.
  // Robuster Path:
  //   - Video: Direkt-Check beim Mount via `readyState >= 1` (HAVE_METADATA)
  //     für cached Videos + Listener auf `loadedmetadata` UND `loadeddata`.
  //   - Bild: separates `Image()`-Objekt im Effect — `naturalWidth/Height`
  //     ist nach `complete=true` verfügbar, decoded() falls noch nicht.
  useEffect(() => {
    if (isImage) {
      // Image-Pfad: eigenständiges Image-Object lädt die URL und meldet
      // Dimensionen. Funktioniert auch wenn das im JSX gerenderte <img>
      // bereits aus dem Browser-Cache kommt.
      const url = post.thumbnail_url ?? post.video_url;
      if (!url) return;
      const img = new Image();
      let cancelled = false;
      const update = () => {
        if (cancelled) return;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setMediaAspectRatio(img.naturalWidth / img.naturalHeight);
        }
      };
      img.onload = update;
      img.src = url;
      // Wenn `complete` direkt true ist (cached), feuert `onload` evtl. nicht
      // mehr — direkt prüfen.
      if (img.complete) update();
      return () => { cancelled = true; };
    }
    // Video-Pfad
    const v = videoRef.current;
    if (!v) return;
    const update = () => {
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        setMediaAspectRatio(v.videoWidth / v.videoHeight);
      }
    };
    if (v.readyState >= 1) update();
    v.addEventListener('loadedmetadata', update);
    v.addEventListener('loadeddata', update);
    return () => {
      v.removeEventListener('loadedmetadata', update);
      v.removeEventListener('loadeddata', update);
    };
  }, [post.video_url, post.thumbnail_url, isImage]);
  // Container folgt IMMER dem detektierten Ratio (Default 9/16 während Loading).
  // Sizing-Strategie hängt davon ab, ob das Medium breiter als 9:16 ist:
  //   - Ratio > 9/16 → width-bound (`w-full h-auto`) — Karte füllt die Spalte
  //     in der Breite, Höhe ergibt sich aus aspectRatio. Kein Letterbox bei
  //     16:9, 4:5, 9:14, 1:1, …
  //   - Ratio ≤ 9/16 → height-bound (`h-full w-auto`) — Karte füllt die Höhe,
  //     Breite ergibt sich. Für strikte 9:16 oder noch elongiertere Hochformate.
  // Loading-Default (9/16 exakt) → height-bound, also wie bisher solange
  // metadata noch nicht da.
  // -------------------------------------------------------------------------
  // v1.w.UI.33 (TikTok-Player-Features): Volume-Slider, Scrubbing, More-Menu.
  //
  // Volume: separater Float (0-1) zusätzlich zum bestehenden mute-Toggle.
  //   - Wenn user am Slider zieht, wird volume gesetzt UND falls volume>0
  //     der Mute-State ausgeschaltet (oder umgekehrt). So bleiben die zwei
  //     Konzepte konsistent (TikTok-Verhalten).
  // Scrubbing: isSeeking flag während mousedown auf der Progress-Bar.
  //   - Während aktivem Drag pausieren wir das Video nicht (TikTok-Style:
  //     scrubbing zeigt den jeweils gezielten Frame, video pausiert nicht
  //     visuell). Sobald mouseup feuert, springen wir zur finalen Position.
  // More-Menu: einfaches Dropdown-Toggle. Outside-Click schließt es.
  // -------------------------------------------------------------------------
  const [volume, setVolume] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Volume sync mit Video-Element
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
  }, [volume]);

  // Outside-Click schließt das More-Menu
  useEffect(() => {
    if (!showMoreMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showMoreMenu]);

  // Seek-Handler: konvertiert Maus-X-Position zu Video-Time
  const seekToClientX = useCallback((clientX: number, rect: DOMRect) => {
    const v = videoRef.current;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
    setProgress(ratio * 100);
  }, []);

  // Window-level mousemove/mouseup während aktivem Drag — damit der User
  // auch außerhalb der Progress-Bar weiterscrubben kann ohne den Drag zu
  // verlieren (TikTok-Verhalten).
  useEffect(() => {
    if (!isSeeking) return;
    const progressBar = document.querySelector<HTMLElement>(
      `[data-post-id="${post.id}"] [data-progress-bar]`,
    );
    if (!progressBar) return;
    const onMove = (e: MouseEvent) => {
      seekToClientX(e.clientX, progressBar.getBoundingClientRect());
    };
    const onUp = () => setIsSeeking(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isSeeking, post.id, seekToClientX]);

  const PORTRAIT_RATIO = 9 / 16;
  const appliedRatio = mediaAspectRatio ?? PORTRAIT_RATIO;
  // v1.w.UI.30: Threshold von > 9/16 auf > 1 (Square) verschoben.
  // Begründung: Portrait-ähnliche Bilder (4:5, 9:14, 0.8) waren mit dem
  // alten 9/16-Threshold als "wider than portrait" eingestuft → width-bound
  // Sizing → Article-Höhe rechnerisch > 100dvh → max-h clamp → Aspect-Ratio
  // bricht → bg-black wird links/rechts vom Bild sichtbar (User-bestätigt
  // beim Chechen-Renaissance-Post).
  // Mit Threshold > 1 werden nur echte Landscape-Medien (16:9, 4:3) width-
  // bound. Portrait UND Portrait-ish (alles ≤ 1) bleibt height-bound →
  // Card-Höhe = Section-Höhe, Breite ergibt sich, Bild fills perfekt ohne
  // Letterbox.
  const isWiderThanPortrait = appliedRatio > 1;

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
    // v1.w.UI.25 / v1.w.UI.28 (TikTok-Parity Iteration 6 — Stabilisierung):
    // Flache Wrapper-Struktur: `h-full + items-end`. Card+Rail bottom-aligned
    // an Section-Bottom für ALLE Orientierungen.
    //
    // Warum flat statt nested (wie Iteration 5 versucht hat):
    // Iteration 5 hatte einen nested Outer (h-full items-center) + Inner
    // (h-auto items-end für Landscape). Problem: max-h-full auf der Article
    // braucht eine ELTERN mit DEFINIERTER Höhe — wenn Inner h-auto hat,
    // resolved max-h-full im child auf 'undefined/auto', die Article kann
    // ihre per-Aspect-Ratio berechnete Höhe nicht clampen und überläuft
    // die Section in den nächsten Post (User-bestätigt).
    //
    // Trade-off: Landscape-Cards sitzen am unteren Section-Rand statt
    // mittig zentriert wie auf TikTok. Empty space oben ist akzeptabel,
    // overflow nach unten ist es nicht. Centering kann später via
    // JS-Measurement (ResizeObserver + explicit width/height) nachgeholt
    // werden — das ist die einzige bulletproof CSS-freie Variante für
    // gleichzeitig (a) Card centered, (b) Rail bottom-aligned mit Card,
    // (c) Snap-Scroll konsistent, (d) keine overflow.
    <div
      // v1.w.UI.31 — Nested Wrapper für TikTok-Style-Centering bei Landscape:
      //   - OUTER (`h-full items-center`): Card+Rail-Gruppe vertikal zentriert
      //     in der Section-Content-Area. Bei Portrait ist Inner-Höhe = section
      //     content area (h-full vererbt), centering ist no-op. Bei Landscape
      //     ist Inner content-sized → Outer zentriert es vertikal → TikTok.
      //   - INNER (`items-end`): Card und Rail bottom-aligned ZUEINANDER. Egal
      //     ob in Portrait (= section bottom) oder Landscape (= card bottom
      //     im zentrierten Inner). Rail-Mute klebt immer am Card-Boden.
      //
      // Nested ging in Iteration 5 schief weil max-h-full auf article ohne
      // Eltern mit definite height nicht clampte → overflow in nächste section.
      // Jetzt mit Hard Containment (overflow-hidden + max-h-[100dvh] auf
      // section UND outer + maxHeight inline auf article) kann das nicht mehr
      // passieren — Containment ist garantiert, Centering kann sicher rein.
      className="flex h-full max-h-[100dvh] w-full max-w-full items-center justify-center overflow-hidden"
      data-post-id={post.id}
      data-aspect-ratio={appliedRatio.toFixed(3)}
      data-orientation={isWiderThanPortrait ? 'wide' : 'portrait'}
    >
    <div
      className={cn(
        // INNER: w-full kritisch (sonst kollabiert flex-1 article auf 0).
        // justify-center zentriert Article+Aside horizontal in Inner. Outer's
        // justify-center alleine reicht nicht — Inner ist w-full (= same width
        // as Outer), sodass Outer's justify-center keine sichtbare Wirkung
        // hat. Daher MUSS Inner selbst justify-center haben für Portrait/Square
        // Cards (Landscape mit flex-1 füllt eh komplett, dort no-op).
        // items-end: card + rail bottom-aligned zueinander.
        // Portrait: h-full → inner = full section content area, card fills.
        // Landscape: kein h-full → inner content-sized, outer items-center
        //   zentriert das Group vertikal.
        'flex w-full max-h-full max-w-full items-end justify-center gap-3',
        isWiderThanPortrait ? '' : 'h-full',
      )}
    >
    <article
      // Container folgt immer dem detektierten Aspect-Ratio (inline-style
      // schlägt jede class-level aspect-Klasse). Sizing:
      //   - Portrait: `h-full w-auto shrink-0` — Card nimmt volle Wrapper-
      //     Höhe, Breite ergibt sich aus Ratio. shrink-0 verhindert dass
      //     der flex-Layout die Card kompromittiert (Rail ist auch shrink-0).
      //   - Landscape: `min-w-0 flex-1 h-auto` — Card grow auf restliche
      //     Wrapper-Breite (= 100% minus Rail minus gap), Höhe ergibt sich
      //     aus Ratio. min-w-0 erlaubt dem Flex-Item zu schrumpfen wenn
      //     der Wrapper enger wird (Mobile).
      // v1.w.UI.29 (Hard Containment Layer 3): maxHeight via inline-style mit
      // viewport-units (100dvh) ist ABSOLUT — unabhängig vom Eltern-Element.
      // Anders als `max-h-full` (CSS percentage, braucht Eltern mit definite
      // height), funktioniert das auch wenn irgendwo im Eltern-Tree ein
      // `h-auto` schlummert. Garantierter Cap auf Viewport-Höhe.
      style={{ aspectRatio: appliedRatio, maxHeight: '100dvh' }}
      className={cn(
        'group/card relative flex max-h-full overflow-hidden rounded-2xl bg-black',
        isWiderThanPortrait ? 'min-w-0 flex-1 h-auto' : 'h-full w-auto shrink-0',
      )}
    >
      {/* v1.w.UI.33: Volume-Control top-left + More-Menu top-right.
          Beide nur für Videos (Images haben weder Audio noch Quality-Optionen).
          Beide z-30 damit über der Caption + Action-Rail visible bleiben.
          Auf TikTok-Style sind sie semi-transparent + backdrop-blur, damit
          sie dezent über dem Video-Content schweben. */}
      {!isImage && (
        <>
          {/* Volume Button + Hover-Slider — top-left */}
          <div
            className="absolute left-3 top-3 z-30 flex items-center gap-2"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMuteToggle();
              }}
              aria-label={muted ? 'Ton einschalten' : 'Stummschalten'}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {/* Slider-Pill nur sichtbar on hover. Range-Input ist a11y-friendly
                (Tastatur + Screenreader) UND hat einfaches Drag-Handling. */}
            {showVolumeSlider && (
              <div
                className="flex items-center rounded-full bg-black/40 px-3 py-2 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const newVol = parseFloat(e.target.value);
                    setVolume(newVol);
                    // volume>0 + currently muted → unmute. volume=0 + not muted → mute.
                    if (newVol > 0 && muted) onMuteToggle();
                    else if (newVol === 0 && !muted) onMuteToggle();
                  }}
                  aria-label="Lautstärke"
                  className="h-1 w-24 cursor-pointer accent-white"
                />
              </div>
            )}
          </div>

          {/* 3-Punkte-Menü — top-right */}
          <div className="absolute right-3 top-3 z-30" ref={moreMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMoreMenu((v) => !v);
              }}
              aria-label="Weitere Optionen"
              aria-expanded={showMoreMenu}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {showMoreMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl bg-zinc-900/95 text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreMenuItem
                  icon={<Settings className="h-4 w-4" />}
                  label="Qualität"
                  rightLabel="Automatisch"
                  onClick={() => setShowMoreMenu(false)}
                />
                <MoreMenuItem
                  icon={<Captions className="h-4 w-4" />}
                  label="Untertitel"
                  onClick={() => setShowMoreMenu(false)}
                />
                <MoreMenuItem
                  icon={<EyeOff className="h-4 w-4" />}
                  label="Kein Interesse"
                  onClick={() => setShowMoreMenu(false)}
                />
                <MoreMenuItem
                  icon={<Flag className="h-4 w-4" />}
                  label="Melden"
                  onClick={() => setShowMoreMenu(false)}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Media-Ebene: Video bei media_type='video', Bild bei 'image' */}
      {isImage ? (
        <div className="absolute inset-0">
          {/* Unscharfer Hintergrund-Fill für Nicht-9:16-Bilder — verhindert
              schwarze Balken links/rechts ohne das Motiv zu beschneiden.
              Nur sichtbar als „Vorschau" während das echte Bild lädt; sobald
              `onLoad` feuert und der Container die echte Aspect-Ratio
              annimmt, deckt das Foreground-Img den Background komplett ab. */}
          <img
            src={post.thumbnail_url ?? post.video_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
          />
          <img
            src={post.thumbnail_url ?? post.video_url}
            alt={post.caption ?? ''}
            onLoad={(e) => {
              // Echte Pixel-Dimensionen → Container kann auf Querformat-
              // Bilder (4:3, 16:9, etc.) reagieren statt sie in einen
              // 9:16-Frame zu zwängen.
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setMediaAspectRatio(img.naturalWidth / img.naturalHeight);
              }
            }}
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
            // Aspect-Ratio-Detection lebt im useEffect oben (nicht hier als
            // JSX-Prop), weil das Event bei gecachten Videos nicht zuverlässig
            // feuert.
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
          deshalb hier nur noch Username + Follow-Button in einer Zeile).
          v1.w.UI.25: `pr-20` entfernt — Rail liegt nicht mehr über der Card,
          Caption darf jetzt die volle Breite nutzen. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4 pb-6 text-white">
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

      {/* Interactive Progress-Bar (A4 + v1.w.UI.33 Scrubbing).
          - Idle: dünne 3px Bar, hover auf der Card macht sie fett (6px).
          - Klickbar/draggable: mousedown startet Scrub-Mode, mousemove
            (window-level via Effect) seekt das Video.
          - Auf hover sichtbarer Thumb-Knopf am Progress-Ende. */}
      {!isImage && (
        <div
          // Wrapper mit größerem Hit-Target (py-2) damit die schmale Bar
          // einfacher zu treffen ist mit der Maus. group/progress-Hover
          // triggert den Thumb.
          className="group/progress absolute inset-x-0 bottom-0 z-20 cursor-pointer py-2"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsSeeking(true);
            const bar = e.currentTarget.querySelector<HTMLElement>('[data-progress-bar]');
            if (bar) seekToClientX(e.clientX, bar.getBoundingClientRect());
          }}
          onMouseMove={(e) => {
            const bar = e.currentTarget.querySelector<HTMLElement>('[data-progress-bar]');
            if (bar) {
              const rect = bar.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setHoverProgress(ratio * 100);
            }
          }}
          onMouseLeave={() => setHoverProgress(null)}
        >
          <div
            data-progress-bar
            className="relative h-[3px] w-full bg-white/20 transition-[height] duration-base ease-out-expo group-hover/card:h-[6px] group-hover/progress:h-[6px]"
          >
            {/* Hover-Position-Indikator (TikTok zeigt eine helle Linie wo
                gerade gehovered wird, vor dem eigentlichen Klick). */}
            {hoverProgress !== null && hoverProgress > progress && (
              <div
                className="absolute inset-y-0 left-0 bg-white/30"
                style={{ width: `${hoverProgress}%` }}
              />
            )}
            <div
              className="relative h-full bg-brand-gold transition-[width]"
              style={{ width: `${progress}%` }}
            >
              {/* Thumb (Drag-Indikator) — sichtbar on hover oder während
                  active scrubbing. */}
              <div
                className={cn(
                  'absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-md transition-opacity duration-fast',
                  'opacity-0 group-hover/progress:opacity-100',
                  isSeeking && 'opacity-100',
                )}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      )}
    </article>

    {/* Action-Rail (TikTok-Style — außerhalb der Card, nicht overlaid).
        Größen-Skala bleibt wie zuvor (Avatar 56, Like/Comment/Bookmark 48,
        Share 44, Mute 40). Styles sind aber theme-aware: bg-foreground/10
        statt bg-white/10, text-foreground statt text-white. So passt der
        Rail in beiden Themes auf den Page-Background.
        Avatar-Border + Plus-Ring nutzen `border-background`/`ring-background`
        damit der Avatar visuell vom Rail-Hintergrund abgesetzt ist (nicht
        auf einer dunklen Video-Letterbox wie zuvor). */}
    <aside className="pointer-events-auto flex shrink-0 flex-col items-center gap-5 pb-2 text-foreground">
      {/* Avatar mit optionalem Follow-Plus (TikTok-Signature-Slot). */}
      <Link
        href={`/u/${post.author.username}` as Route}
        className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Profil von @${post.author.username} öffnen`}
      >
        <Avatar className="h-14 w-14 border-2 border-background shadow-elevation-1">
          <AvatarImage src={post.author.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-muted text-sm text-foreground">
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
            className="absolute -bottom-1.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-elevation-1 ring-2 ring-background transition-transform duration-fast ease-out-expo hover:scale-110 disabled:opacity-60"
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

      {/* Comment — 48px. Toggle-Verhalten (v1.w.UI.11 Phase C Follow-up):
          - Panel geschlossen → öffnet für diesen Post.
          - Panel offen für DIESEN Post → schließt.
          - Panel offen für einen ANDEREN Post → wechselt das Target. */}
      <ActionButton
        icon={
          <MessageCircle
            className={cn('h-7 w-7', isCommentsOpenForThisPost && 'fill-brand-gold text-brand-gold')}
            aria-hidden="true"
          />
        }
        label={formatCount(post.comment_count)}
        ariaLabel={
          isCommentsOpenForThisPost
            ? 'Kommentare schließen'
            : `Kommentare öffnen — ${post.comment_count} Kommentare`
        }
        onClick={() => {
          if (isCommentsOpenForThisPost) closeComments();
          else openCommentsFor(post.id);
        }}
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
    </aside>

    {/* CommentSheet / CommentPanel wird seit v1.w.UI.11 Phase C vom
        HomeFeedShell gerendert (State-Owner-Lift). FeedCard triggert nur
        noch via `openCommentsFor(post.id)` aus dem FeedInteractionContext. */}
    </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MoreMenuItem — Eintrag im 3-Punkte-Dropdown (TikTok-Style).
// Aktuell sind die meisten Items Stubs (Qualität, Untertitel, Kein Interesse,
// Melden) — nur das visuelle Pattern ist da. Echte Implementierung kommt in
// späteren Slices wenn die Backend-Endpunkte (z.B. report_post RPC) bereit
// sind.
// -----------------------------------------------------------------------------

function MoreMenuItem({
  icon,
  label,
  rightLabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  rightLabel?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/10 focus:bg-white/10 focus:outline-none"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-white/80">
        {icon}
      </span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {rightLabel && (
        <span className="shrink-0 text-xs text-white/60">{rightLabel}</span>
      )}
    </button>
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
      className="group/action flex flex-col items-center gap-1 rounded-md outline-none transition-opacity duration-fast ease-out-expo focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
    >
      <span
        className={cn(
          // Theme-aware: bg-foreground/10 ist im Light dunkles Grau, im Dark
          // helles Grau — sichtbar auf Page-Background. (v1.w.UI.25)
          'flex items-center justify-center rounded-full bg-foreground/10 transition-colors duration-base ease-out-expo group-hover/action:bg-foreground/20',
          circleClassName ?? 'h-11 w-11',
        )}
      >
        {icon}
      </span>
      <span aria-hidden="true" className="text-xs font-semibold tabular-nums">{label}</span>
    </button>
  );
}

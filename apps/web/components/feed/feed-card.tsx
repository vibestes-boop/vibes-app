'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import NextImage from 'next/image';
import type { Route } from 'next';
import {
  Heart,
  MessageCircle,
  MessageCircleOff,
  Bookmark,
  Share2,
  Repeat2,
  Music,
  Volume2,
  VolumeX,
  Play,
  BadgeCheck,
  Plus,
  MoreHorizontal,
  EyeOff,
  Flag,
  Link as LinkIcon,
  PictureInPicture2,
  Trash2,
  Download,
  Pencil,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { reportPost, markPostNotInteresting } from '@/app/actions/report';
import { deletePost, patchPostCaption } from '@/app/actions/posts';
import { recordDwell } from '@/app/actions/engagement';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  useTogglePostLike,
  useTogglePostSave,
  useToggleFollow,
  useToggleRepost,
} from '@/hooks/use-engagement';
import type { FeedPost } from '@/lib/data/feed';
import { LikeButton } from './like-button';
import { useFeedInteraction } from './feed-interaction-context';
import { linkify } from '@/lib/linkify';
import {
  FEED_ACTION_AVATAR_QUALITY,
  FEED_ACTION_AVATAR_WIDTH,
  FEED_VIDEO_POSTER_WIDTH,
  getOptimizedImageUrl,
} from '@/lib/media/optimized-image-url';

// Feed-Captions liegen auf dunkler Video-Overlay — default `text-primary`
// würde gegen Schwarz/Video-Content zu blass werden. Weißer Link mit
// Underline-On-Hover ist analog zum TikTok-Feed-Stil.
const FEED_LINK_CLASS = 'font-semibold text-white underline-offset-2 hover:underline';

const LazyPostShareDmSheet = dynamic(
  () => import('./post-share-dm-sheet').then((mod) => mod.PostShareDmSheet),
  { ssr: false },
);

const LazyPostLikersDialog = dynamic(
  () => import('@/components/post/post-likers-dialog').then((mod) => mod.PostLikersDialog),
  { ssr: false },
);

const LazyVoiceReaderControl = dynamic(
  () => import('./voice-reader-control').then((mod) => mod.VoiceReaderControl),
  { ssr: false },
);

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
  shouldLoadMedia?: boolean;
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

export function FeedCard({
  post,
  viewerId,
  isActive,
  shouldLoadMedia = isActive,
  muted,
  onMuteToggle,
}: FeedCardProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
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

  // v1.w.UI.53: Dwell-Tracking — View-Count nach 3s Playback erhöhen.
  // dwellFiredRef verhindert Doppel-Call wenn das Video kurz pausiert/resumet.
  // Wird bei post.id-Wechsel resettet damit das neue Video zählt.
  const dwellFiredRef = useRef(false);
  const playStartRef = useRef<number | null>(null);
  useEffect(() => { dwellFiredRef.current = false; playStartRef.current = null; }, [post.id]);

  const likeMut = useTogglePostLike();
  const saveMut = useTogglePostSave();
  const followMut = useToggleFollow();
  const repostMut = useToggleRepost();

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

  const [shareDmOpen, setShareDmOpen] = useState(false);
  // v1.w.UI.236 — likers dialog state
  const [likersOpen, setLikersOpen] = useState(false);
  // v1.w.UI.146 — inline caption-edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editPending, startEditTransition] = useTransition();

  const isSelf = viewerId === post.author.id;
  // Legacy-Rows (pre-media_type-Einführung) waren alle Videos — deshalb
  // defaulten wir auf 'video'. Explicit 'image' schaltet in den Bild-Render-
  // Pfad (Instagram-style Standbild mit Video-ähnlichem Overlay).
  const isImage = post.media_type === 'image';

  const caption = post.caption ?? '';
  const mediaSource = post.thumbnail_url || post.video_url || '';
  const optimizedPosterUrl = getOptimizedImageUrl(post.thumbnail_url, FEED_VIDEO_POSTER_WIDTH);
  const optimizedAuthorAvatarUrl = getOptimizedImageUrl(
    post.author.avatar_url,
    FEED_ACTION_AVATAR_WIDTH,
    FEED_ACTION_AVATAR_QUALITY,
  );
  const [voiceReaderMounted, setVoiceReaderMounted] = useState(false);
  useEffect(() => setVoiceReaderMounted(false), [post.id]);

  // Detected media aspect-ratio (width/height). null = noch nicht geladen,
  // dann verwenden wir 9:16 als sicheren Default. Wird bei post.id-Wechsel
  // resettet, damit das nächste Video nicht mit dem Ratio des vorigen rendert.
  //
  // v1.w.UI.175 — CLS-fix: statt blind null (→ 9:16-Flash) initialisieren wir
  // mit dem gespeicherten aspect_ratio-Wert aus der DB. Landscape- und Square-
  // Posts rendern dann vom ersten Paint an mit dem korrekten Rahmen, ohne zu
  // 9:16 zu springen und dann aufzureißen. Metadata-Detection überschreibt den
  // Wert sobald echte Dimensionen vorliegen (für edge-cases wo DB-Wert falsch ist).
  // Portrait bleibt null → gleicher Pfad wie bisher (default 9/16).
  const storedRatio = post.aspect_ratio === 'landscape'
    ? 16 / 9
    : post.aspect_ratio === 'square'
      ? 1
      : null; // portrait → null, detektiert via metadata (default = 9/16)
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number | null>(storedRatio);
  useEffect(() => setMediaAspectRatio(storedRatio), [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const canLoadMedia = shouldLoadMedia || isActive;
  useEffect(() => {
    if (!canLoadMedia) return;
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
  }, [post.video_url, post.thumbnail_url, isImage, canLoadMedia]);
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

  // v1.w.UI.211 — Audio-Track Play/Pause (parallel zu Video, parity mit Mobile).
  // audio_url = vom Creator im Musik-Picker gewählter Track. Browser-Autoplay-
  // Policy: <audio> startet nur wenn das Video selbst bereits durch eine
  // User-Geste gespielt wurde (isActive=true nach erster Interaktion).
  // Mute-Sync: selbe `muted`-State wie Video — User sieht einen Lautstärke-Toggle.
  const audioUrl = post.audio_url ?? null;
  const audioVolume = typeof post.audio_volume === 'number'
    ? Math.max(0, Math.min(1, post.audio_volume))
    : 0.8;

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    if (isActive && !isPaused) {
      a.volume = muted ? 0 : audioVolume;
      void a.play().catch(() => { /* Autoplay-Policy — silent */ });
    } else {
      a.pause();
    }
  }, [isActive, isPaused, muted, audioUrl, audioVolume]);

  // Reset audio when post changes (new track URL).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    a.currentTime = 0;
  }, [post.id, audioUrl]);

  // Mute/Unmute the audio track live — mirrors the video mute toggle.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    a.volume = muted ? 0 : audioVolume;
  }, [muted, audioVolume, audioUrl]);

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

  const handleShare = () => {
    if (viewerId) {
      // Eingeloggte User: DM-Share-Sheet öffnen (mit "Link kopieren"-Footer
      // als Secondary-Aktion).
      setShareDmOpen(true);
    } else {
      // Gäste: direkt nativer Share oder Clipboard-Fallback.
      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${post.id}`;
      void (async () => {
        try {
          if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share({ url, title: post.caption ?? 'Serlo' });
          } else {
            await navigator.clipboard.writeText(url);
          }
        } catch {
          /* User-Cancel ignorieren */
        }
      })();
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
                {/* v1.w.UI.34 — alle Items mit echter Funktionalität.
                    v1.w.UI.46 — Delete für eigene Posts + kein Report/NotInterested
                    auf eigene Posts (ergibt keinen Sinn). */}
                {isSelf ? (
                  <>
                    {/* v1.w.UI.146 — Author: Bearbeiten + Löschen */}
                    <MoreMenuItem
                      icon={<Pencil className="h-4 w-4" />}
                      label="Bearbeiten"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setEditCaption(post.caption ?? '');
                        setEditOpen(true);
                      }}
                    />
                    <MoreMenuItem
                      icon={<Trash2 className="h-4 w-4" />}
                      label="Post löschen"
                      destructive
                      onClick={async () => {
                        setShowMoreMenu(false);
                        if (!confirm('Post wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
                        const res = await deletePost(post.id);
                        if (res.ok) {
                          toast('Post gelöscht.');
                          router.refresh();
                        } else {
                          toast.error(res.error ?? 'Löschen fehlgeschlagen.');
                        }
                      }}
                    />
                  </>
                ) : (
                  <>
                    <MoreMenuItem
                      icon={<EyeOff className="h-4 w-4" />}
                      label="Kein Interesse"
                      onClick={async () => {
                        setShowMoreMenu(false);
                        if (!viewerId) {
                          toast('Bitte zuerst anmelden.');
                          return;
                        }
                        const res = await markPostNotInteresting(post.id);
                        if (res.ok) {
                          toast('Wir zeigen dir weniger davon.');
                          router.refresh();
                        } else {
                          toast.error(res.error);
                        }
                      }}
                    />
                    <MoreMenuItem
                      icon={<Flag className="h-4 w-4" />}
                      label="Melden"
                      onClick={async () => {
                        setShowMoreMenu(false);
                        if (!viewerId) {
                          toast('Bitte zuerst anmelden.');
                          return;
                        }
                        const res = await reportPost(post.id);
                        if (res.ok) {
                          toast('Danke für deine Meldung. Unser Team prüft das.');
                        } else {
                          toast.error(res.error);
                        }
                      }}
                    />
                  </>
                )}
                <MoreMenuItem
                  icon={<LinkIcon className="h-4 w-4" />}
                  label="Link kopieren"
                  onClick={async () => {
                    setShowMoreMenu(false);
                    const url = `${window.location.origin}/p/${post.id}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      toast('Link kopiert.');
                    } catch {
                      toast.error('Kopieren fehlgeschlagen.');
                    }
                  }}
                />
                {/* v1.w.UI.142 — Download: nur für Videos wenn Autor download erlaubt hat */}
                {post.allow_download && post.media_type !== 'image' && post.video_url && (
                  <MoreMenuItem
                    icon={<Download className="h-4 w-4" />}
                    label="Video herunterladen"
                    onClick={() => {
                      setShowMoreMenu(false);
                      const a = document.createElement('a');
                      a.href = post.video_url!;
                      a.download = `video-${post.id}.mp4`;
                      a.target = '_blank';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                  />
                )}
                <MoreMenuItem
                  icon={<PictureInPicture2 className="h-4 w-4" />}
                  label="Schwebender Player"
                  onClick={async () => {
                    setShowMoreMenu(false);
                    const v = videoRef.current;
                    if (!v) return;
                    try {
                      // PIP-API kapseln: typed wenn unterstützt, sonst toast.
                      const doc = document as Document & {
                        pictureInPictureElement?: Element | null;
                        exitPictureInPicture?: () => Promise<void>;
                      };
                      if (doc.pictureInPictureElement) {
                        await doc.exitPictureInPicture?.();
                      } else {
                        const reqPip = (v as HTMLVideoElement & {
                          requestPictureInPicture?: () => Promise<unknown>;
                        }).requestPictureInPicture;
                        if (typeof reqPip === 'function') {
                          await reqPip.call(v);
                        } else {
                          toast('Dein Browser unterstützt das nicht.');
                        }
                      }
                    } catch {
                      toast.error('Schwebender Player nicht verfügbar.');
                    }
                  }}
                />
                {/* Comment-Anchor: weiter unten könnten User-Aktionen wie
                    „Blockieren" / „Folgen ausblenden" rein, sobald die
                    Backend-RPCs dafür stehen. */}
              </div>
            )}
          </div>
        </>
      )}

      {/* Media-Ebene: Video bei media_type='video', Bild bei 'image' */}
      {isImage ? (
        <div className="absolute inset-0">
          {mediaSource ? (
            <>
              {/* Unscharfer Hintergrund-Fill für Nicht-9:16-Bilder — verhindert
                  schwarze Balken links/rechts ohne das Motiv zu beschneiden.
                  Nur sichtbar als „Vorschau" während das echte Bild lädt; sobald
                  `onLoad` feuert und der Container die echte Aspect-Ratio
                  annimmt, deckt das Foreground-Img den Background komplett ab. */}
              <NextImage
                src={mediaSource}
                alt=""
                aria-hidden="true"
                fill
                sizes={isActive ? '(max-width: 1279px) 100vw, 55vw' : '1px'}
                priority={isActive}
                className="scale-110 object-cover opacity-60 blur-2xl"
              />
              <NextImage
                src={mediaSource}
                alt={post.caption ?? ''}
                fill
                sizes="(max-width: 1279px) 100vw, 55vw"
                priority={isActive}
                onLoad={(e) => {
                  // Echte Pixel-Dimensionen → Container kann auf Querformat-
                  // Bilder (4:3, 16:9, etc.) reagieren statt sie in einen
                  // 9:16-Frame zu zwängen.
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setMediaAspectRatio(img.naturalWidth / img.naturalHeight);
                  }
                }}
                className="object-contain"
              />
            </>
          ) : (
            <div className="h-full w-full bg-black" aria-hidden="true" />
          )}
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
          {canLoadMedia ? (
            <video
              {...(isActive ? { fetchpriority: 'high' } : {})}
              ref={videoRef}
              src={post.video_url}
              poster={optimizedPosterUrl}
              loop
              muted={muted}
              playsInline
              preload={isActive ? 'metadata' : 'none'}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
                // v1.w.UI.53: View-Count nach 3s echtem Playback erhöhen.
                // currentTime >= 3 bedeutet 3s des Videos tatsächlich abgespielt
                // (nicht Scrub-Artefakte). dwellFiredRef verhindert Mehrfach-Calls.
                if (!dwellFiredRef.current && viewerId && v.currentTime >= 3) {
                  dwellFiredRef.current = true;
                  void recordDwell(post.id, Math.round(v.currentTime * 1000));
                }
              }}
              // Aspect-Ratio-Detection lebt im useEffect oben (nicht hier als
              // JSX-Prop), weil das Event bei gecachten Videos nicht zuverlässig
              // feuert.
              className="h-full w-full object-contain"
            />
          ) : post.thumbnail_url ? (
            <NextImage
              src={post.thumbnail_url}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 1279px) 100vw, 55vw"
              className="object-contain"
            />
          ) : (
            <div className="h-full w-full bg-black" aria-hidden="true" />
          )}

          {/* v1.w.UI.211 — Hidden <audio> for background music track. Browser plays
              it in sync with the video when isActive. Volume is synced to the
              video mute-state so the single mute-button controls both streams. */}
          {canLoadMedia && audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              loop
              preload="none"
              aria-hidden="true"
              className="hidden"
            />
          )}

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
        {/* v1.w.UI.169 — WOZ badge: only visible to verified members (RLS-enforced) */}
        {post.women_only && (
          <span className="pointer-events-none inline-flex w-fit items-center gap-1 rounded-full bg-pink-500/25 px-2.5 py-0.5 text-[11px] font-semibold text-pink-200 ring-1 ring-pink-400/40 backdrop-blur-sm">
            🌸 Women Only
          </span>
        )}
        {/* v1.w.UI.172 — audience badge: shown only on restricted posts so author
            (who sees own friends/private posts) gets a visual reminder */}
        {post.privacy === 'friends' && (
          <span className="pointer-events-none inline-flex w-fit items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
            👥 Freunde
          </span>
        )}
        {post.privacy === 'private' && (
          <span className="pointer-events-none inline-flex w-fit items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
            🔒 Nur ich
          </span>
        )}
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

        {/* v1.w.UI.170 — hashtag chips are clickable links to /t/[tag] */}
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-white/80">
            {post.hashtags.slice(0, 4).map((tag) => {
              const clean = tag.replace(/^#/, '');
              return (
                <Link
                  key={tag}
                  href={`/t/${clean}` as Route}
                  className="hover:text-white hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  #{clean}
                </Link>
              );
            })}
          </div>
        )}

        {/* v1.w.UI.211 — Audio-Track-Badge: animated spinning vinyl pill.
            Shown when creator added a music track. Mirrors MusicVinylBadge
            from mobile FeedItem. `music_id` = no-URL legacy, `audio_url` = new. */}
        {(post.music_id || post.audio_url) && (
          <div className="flex items-center gap-1.5 text-xs text-white/80">
            <span
              className={cn(
                'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25',
                isActive && !isPaused && 'animate-spin',
              )}
              style={{ animationDuration: '3s' }}
              aria-hidden="true"
            >
              <Music className="h-3 w-3" />
            </span>
            <span className="truncate max-w-[140px]">
              {post.audio_url ? 'Musik' : 'Original-Sound'}
            </span>
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
          <AvatarImage src={optimizedAuthorAvatarUrl} alt="" />
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
        onCountClick={post.like_count > 0 ? () => setLikersOpen(true) : undefined}
        iconClassName="h-7 w-7"
        circleClassName="h-12 w-12"
      />

      {/* Comment — 48px. Toggle-Verhalten (v1.w.UI.11 Phase C Follow-up):
          - Panel geschlossen → öffnet für diesen Post.
          - Panel offen für DIESEN Post → schließt.
          - Panel offen für einen ANDEREN Post → wechselt das Target.
          v1.w.UI.177 — wenn allow_comments=false: Icon wird zum MessageCircleOff,
          Button bleibt klickbar (öffnet Panel mit Hinweistext) aber das Icon
          signalisiert visuell dass Kommentare deaktiviert sind. */}
      <ActionButton
        icon={
          post.allow_comments ? (
            <MessageCircle
              className={cn('h-7 w-7', isCommentsOpenForThisPost && 'fill-brand-gold text-brand-gold')}
              aria-hidden="true"
            />
          ) : (
            <MessageCircleOff
              className="h-7 w-7 text-muted-foreground/60"
              aria-hidden="true"
            />
          )
        }
        label={post.allow_comments ? formatCount(post.comment_count) : '—'}
        ariaLabel={
          !post.allow_comments
            ? 'Kommentare deaktiviert'
            : isCommentsOpenForThisPost
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

      {/* Repost — nur für fremde Posts, analog Mobile-Verhalten (v1.w.UI.151) */}
      {!isSelf && viewerId && (
        <ActionButton
          icon={
            <Repeat2
              className={cn('h-6 w-6', post.reposted_by_me && 'text-emerald-400')}
              aria-hidden="true"
            />
          }
          label={post.reposted_by_me ? 'Repostet' : 'Reposten'}
          ariaLabel={post.reposted_by_me ? 'Repost entfernen' : 'Post reposten'}
          disabled={repostMut.isPending}
          onClick={() =>
            repostMut.mutate({ postId: post.id, reposted: post.reposted_by_me })
          }
          circleClassName="h-11 w-11"
        />
      )}

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

      {/* v1.w.UI.218 — Chatterbox TTS: Caption laut vorlesen (Creator-Stimme
          wenn voice_sample_url gesetzt, sonst speechSynthesis-Fallback).
          Nur anzeigen wenn Caption vorhanden. */}
      {caption.length > 0 && (
        voiceReaderMounted ? (
          <LazyVoiceReaderControl
            postId={post.id}
            authorId={post.author.id}
            caption={caption}
            autoStart
          />
        ) : (
          <ActionButton
            icon={<Volume2 className="h-5 w-5 text-foreground/70" aria-hidden="true" />}
            label="Vorlesen"
            ariaLabel="Caption vorlesen"
            onClick={() => setVoiceReaderMounted(true)}
            circleClassName="h-10 w-10"
          />
        )
      )}
    </aside>

    {/* CommentSheet / CommentPanel wird seit v1.w.UI.11 Phase C vom
        HomeFeedShell gerendert (State-Owner-Lift). FeedCard triggert nur
        noch via `openCommentsFor(post.id)` aus dem FeedInteractionContext. */}

    {/* v1.w.UI.236 — Likers Dialog: tap like count → see who liked */}
    {likersOpen && (
      <LazyPostLikersDialog
        postId={post.id}
        likeCount={post.like_count}
        viewerId={viewerId}
        onClose={() => setLikersOpen(false)}
      />
    )}

    {/* v1.w.UI.74 — Post-Share-DM-Sheet (nur wenn eingeloggt + Share geklickt) */}
    {shareDmOpen && (
      <LazyPostShareDmSheet
        post={{
          id: post.id,
          thumbnail_url: post.thumbnail_url,
          caption: post.caption ?? null,
          author: {
            username: post.author.username,
            display_name: post.author.display_name ?? null,
            avatar_url: post.author.avatar_url ?? null,
          },
        }}
        onClose={() => setShareDmOpen(false)}
      />
    )}

    {/* v1.w.UI.146 — Inline Caption-Edit Modal */}
    {editOpen && (
      <div
        className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
        onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/60" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-card border border-border p-5 shadow-xl">
          <h3 className="mb-3 text-sm font-semibold">Caption bearbeiten</h3>
          <textarea
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value.slice(0, 2000))}
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="Was möchtest du teilen?"
            disabled={editPending}
            autoFocus
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {editCaption.length}/2000
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={editPending}
              className="flex-1 rounded-full border border-border py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={editPending}
              onClick={() => {
                startEditTransition(async () => {
                  const res = await patchPostCaption(post.id, editCaption);
                  if (res.ok) {
                    toast('Caption aktualisiert.');
                    setEditOpen(false);
                    router.refresh();
                  } else {
                    toast.error(res.error ?? 'Speichern fehlgeschlagen.');
                  }
                });
              }}
              className="flex-1 rounded-full bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editPending ? 'Speichere…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    )}
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
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  rightLabel?: string;
  /** Wenn true: Text + Icon in Rot (für destruktive Aktionen wie Löschen). */
  destructive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors focus:outline-none',
        destructive
          ? 'text-red-400 hover:bg-red-500/10 focus:bg-red-500/10'
          : 'hover:bg-white/10 focus:bg-white/10',
      )}
    >
      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center', destructive ? 'text-red-400' : 'text-white/80')}>
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

'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

// -----------------------------------------------------------------------------
// VideoPlayer — HLS-first mit dynamic-import von hls.js (nur wenn wirklich
// gebraucht, spart ~70KB Bundle für Safari + iOS die HLS nativ supporten).
// MP4 läuft direkt über das native <video>-Element.
// -----------------------------------------------------------------------------

type VideoState = 'loading' | 'playing' | 'error';

export function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  loop = true,
  muted: initialMuted = true, // Autoplay-Policy: nur muted startet ohne User-Geste.
  aspect = '9/16',
  className,
  onEnded,
}: {
  src: string;
  poster?: string | null;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  aspect?: '9/16' | '16/9' | '1/1';
  className?: string;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<VideoState>('loading');
  const [error, setError] = useState<string | null>(null);

  // Early-Guard: Leerer oder nur-Whitespace-src ist kein Fehler, sondern
  // „kein Video hinterlegt". Dann sparen wir uns den nativen <video>-onError
  // („Das Video konnte nicht geladen werden."), der für den User wie ein
  // Bug aussieht — und rendern einen ruhigen Empty-State mit Poster-Fallback.
  const hasSrc = typeof src === 'string' && src.trim().length > 0;

  useEffect(() => {
    if (!hasSrc) return;
    const video = videoRef.current;
    if (!video) return;

    const isHls = src.endsWith('.m3u8') || src.includes('.m3u8?');
    let hlsInstance: { destroy: () => void } | null = null;
    let cancelled = false;

    async function attach() {
      if (!video) return;
      try {
        if (!isHls) {
          // MP4 / WebM — einfach Source setzen, kein JS-Player nötig.
          video.src = src;
          return;
        }

        // Safari / iOS können HLS nativ → kein hls.js laden.
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src;
          return;
        }

        // Chrome / Firefox / Edge → dynamisch hls.js laden.
        const Hls = (await import('hls.js')).default;
        if (cancelled) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            // Low-Latency-Mode aus — ist für VOD-Posts eh irrelevant und spart CPU.
            lowLatencyMode: false,
            // Kleineres ABR-Fenster — Web-Publikum switched Netzwerk seltener als Mobile.
            maxBufferLength: 20,
          });
          hlsInstance = hls;
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal: boolean; type: string; details: string }) => {
            if (data.fatal) {
              setState('error');
              setError(`Wiedergabe-Fehler (${data.type}/${data.details})`);
            }
          });
        } else {
          setState('error');
          setError('Dein Browser unterstützt dieses Video-Format nicht.');
        }
      } catch (err) {
        if (!cancelled) {
          setState('error');
          setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
        }
      }
    }

    attach();

    return () => {
      cancelled = true;
      if (hlsInstance) hlsInstance.destroy();
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [src, hasSrc]);

  const aspectClass =
    aspect === '16/9' ? 'aspect-video' : aspect === '1/1' ? 'aspect-square' : 'aspect-[9/16]';

  // Empty-State: kein src hinterlegt → Poster (falls vorhanden) mit dezenter
  // Info-Zeile, anstatt ein <video> mit leerem src zu mounten (das feuert
  // native onError und zeigt die rote „nicht geladen"-Karte).
  if (!hasSrc) {
    return (
      <div className={`relative overflow-hidden rounded-lg bg-black ${aspectClass} ${className ?? ''}`}>
        {poster ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={poster} alt="" className="h-full w-full object-contain" />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center text-xs text-white/80">
          Kein Video hinterlegt.
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-black ${aspectClass} ${className ?? ''}`}>
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        loop={loop}
        muted={initialMuted}
        playsInline
        controls
        preload="metadata"
        // Explizit kein `controlsList="nodownload"` — Download ist legitim, keine DRM-Ansprüche.
        onPlaying={() => setState('playing')}
        onWaiting={() => setState('loading')}
        onError={() => {
          setState('error');
          setError('Das Video konnte nicht geladen werden.');
        }}
        onEnded={onEnded}
        className="h-full w-full object-contain"
      />

      {state === 'loading' && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}

      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="max-w-xs text-sm">{error ?? 'Video nicht abspielbar.'}</p>
        </div>
      )}
    </div>
  );
}

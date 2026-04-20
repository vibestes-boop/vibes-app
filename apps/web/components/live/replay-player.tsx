'use client';

import { useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import type { ClipMarker } from '@/lib/data/live';

// -----------------------------------------------------------------------------
// ReplayPlayer — nativer <video>-Player + Clip-Marker als Seek-Chips.
// Kein HLS.js weil wir erstmal auf mp4-VOD setzen (LiveKit Egress liefert mp4).
// Bei späterem HLS-Support → conditional import von hls.js.
// -----------------------------------------------------------------------------

export interface ReplayPlayerProps {
  src: string;
  poster?: string;
  clipMarkers: ClipMarker[];
}

export function ReplayPlayer({ src, poster, clipMarkers }: ReplayPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const seekTo = (positionSecs: number, markerId: string) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = positionSecs;
    video.play().catch(() => {});
    setActiveMarker(markerId);
    window.setTimeout(() => setActiveMarker((m) => (m === markerId ? null : m)), 1500);
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        className="h-full w-full object-contain"
      />

      {/* Clip-Marker-Chips — unten am Player als Absolute-Layer */}
      {clipMarkers.length > 0 && (
        <div className="pointer-events-none absolute bottom-14 left-0 right-0 z-10 flex flex-wrap gap-1.5 px-3 lg:bottom-16">
          {clipMarkers.slice(0, 10).map((marker) => (
            <button
              key={marker.id}
              type="button"
              onClick={() => seekTo(marker.position_secs, marker.id)}
              className={`pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur transition-transform hover:scale-105 ${
                activeMarker === marker.id ? 'ring-2 ring-primary' : ''
              }`}
              title={marker.label ?? `Clip bei ${marker.position_secs}s`}
            >
              <Scissors className="h-2.5 w-2.5" />
              {formatTime(marker.position_secs)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

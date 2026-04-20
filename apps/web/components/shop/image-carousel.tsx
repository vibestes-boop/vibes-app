'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// ImageCarousel für Produkt-Detail.
// - Blur-Fill-Hintergrund analog zur Native-App
// - Horizontal-Snap-Scroll
// - Thumbnails unter dem Hero als Tap-Shortcut
// - Previous/Next Chevrons auf Hover (desktop)
// -----------------------------------------------------------------------------

export function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollTo = (idx: number) => {
    const c = containerRef.current;
    if (!c) return;
    const width = c.clientWidth;
    c.scrollTo({ left: width * idx, behavior: 'smooth' });
  };

  const onScroll = () => {
    const c = containerRef.current;
    if (!c) return;
    const idx = Math.round(c.scrollLeft / c.clientWidth);
    if (idx !== active) setActive(idx);
  };

  useEffect(() => {
    // Einmal beim Mount für den initialen Frame
    onScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-6xl">
        📦
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Hero */}
      <div className="group relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="scrollbar-hide flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {images.map((src, i) => (
            <div key={`${src}-${i}`} className="relative h-full w-full flex-none snap-center">
              {/* Layer 1: Blur-BG */}
              <Image
                src={src}
                alt=""
                fill
                className="scale-110 object-cover blur-2xl"
                sizes="(max-width: 1024px) 100vw, 600px"
                aria-hidden
                priority={i === 0}
              />
              <div className="absolute inset-0 bg-black/25" />
              {/* Layer 2: Contain */}
              <Image
                src={src}
                alt={alt}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 600px"
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        {/* Image-Counter oben rechts */}
        {images.length > 1 && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <Camera className="h-3 w-3" />
            {active + 1} / {images.length}
          </div>
        )}

        {/* Chevrons (nur auf Hover/Desktop) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollTo(Math.max(0, active - 1))}
              disabled={active === 0}
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0',
              )}
              aria-label="Vorheriges Bild"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo(Math.min(images.length - 1, active + 1))}
              disabled={active === images.length - 1}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0',
              )}
              aria-label="Nächstes Bild"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {images.map((src, i) => {
            const on = i === active;
            return (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                className={cn(
                  'relative h-16 w-16 flex-none overflow-hidden rounded-md border-2 transition-opacity',
                  on ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100',
                )}
              >
                <Image src={src} alt="" fill className="object-cover" sizes="64px" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

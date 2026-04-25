'use client';

import { useCallback, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// LikeButton (v1.w.UI.4, A3 — Like-Burst-Animation)
//
// Ersetzt den generischen ActionButton für den Like-Slot im Feed-Rail.
// Eigenes Bauteil, weil der Like drei Dinge gleichzeitig macht:
//   1. Mutation (Like-Toggle via TanStack-Hook vom Parent).
//   2. Scale-Pop des Heart-Icons (keyframe `heart-pop`, 400ms).
//   3. Partikel-Burst — 8 kleine Herzen fliegen in einem Kreismuster aus
//      dem Zentrum (keyframe `heart-particle` mit per-Partikel berechneten
//      `--dx`/`--dy` CSS-Variablen).
//
// Warum die Partikel-Deltas als CSS-Custom-Properties und nicht als
// eigene Keyframes pro Winkel:
//   - 8 eigene Keyframes hätten das Tailwind-Config massiv aufgebläht.
//   - CSS-Vars erlauben dieselbe Keyframe für alle 8 Winkel wiederzu-
//     verwenden, mit Variablen-Werten die pro Partikel via `style`-Prop
//     gesetzt werden. Compute-Cost ist Null (reiner Präsentations-State).
//
// Trigger-Semantik:
//   - Burst läuft NUR beim Like-Anlegen, nicht beim Entfernen — sonst
//     fühlt sich das Unlike-Drücken „zu viel Feedback für zu wenig
//     Interaktion" an.
//   - Hat der User unmittelbar vor der Animation auf-und-wieder-ab-geliked,
//     starten wir die Animation mit einem frischen Key (→ React remount)
//     damit sie zuverlässig erneut triggert.
// -----------------------------------------------------------------------------

// 8 gleichverteilte Winkel, leicht zufällig verschoben pro Invocation
// damit zwei aufeinanderfolgende Bursts nicht identisch aussehen.
const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
// Distanz vom Zentrum in px — groß genug um außerhalb des Icons zu floaten
const PARTICLE_RADIUS = 42;

export interface LikeButtonProps {
  /** Aktueller Like-State (optimistischer Wert vom Hook). */
  liked: boolean;
  /** Aktuelle Like-Count (formatierter String, z.B. "12K"). */
  countLabel: string;
  /** Raw count für aria-label — für Screenreader lesbarer. */
  rawCount: number;
  /** Disabled wenn Mutation läuft oder kein Viewer eingeloggt ist. */
  disabled?: boolean;
  /** Click-Handler, ruft den Mutate vom Parent auf. */
  onClick: () => void;
  /** Icon-Größe in Tailwind-Klasse (Default: 'h-7 w-7'). */
  iconClassName?: string;
  /**
   * Visueller Button-Kreis-Größe — Tailwind-Klassen. Für A2 wird
   * der Like-Slot größer (48px), Share/Mute kleiner (44px) — deshalb
   * ist die Größe per Prop steuerbar, damit die Rail-Hierarchy stimmt.
   */
  circleClassName?: string;
}

export function LikeButton({
  liked,
  countLabel,
  rawCount,
  disabled,
  onClick,
  iconClassName,
  circleClassName,
}: LikeButtonProps) {
  // Monotonic-Key für den Partikel-Container — jeder Burst bekommt einen
  // frischen Key und wird damit neu gemountet, womit die Keyframes
  // zuverlässig neu starten (ein reiner className-Toggle würde in Chrome
  // nicht retriggern wenn die Klasse während des Laufs re-gesetzt wird).
  const [burstKey, setBurstKey] = useState<number | null>(null);
  // Separater Scale-Pop-Key — gleiche Logik aber für das Icon selbst.
  const [popKey, setPopKey] = useState<number | null>(null);
  const nextKeyRef = useRef(0);

  const handleClick = useCallback(() => {
    if (disabled) return;
    const wasLiked = liked;
    onClick();
    // Nur beim Like-Anlegen animieren, nicht beim Un-Liken.
    if (!wasLiked) {
      const k = ++nextKeyRef.current;
      setBurstKey(k);
      setPopKey(k);
    }
  }, [disabled, liked, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={`${liked ? 'Like entfernen' : 'Liken'} — ${rawCount} Likes`}
      className="group/like flex flex-col items-center gap-1 rounded-md outline-none transition-opacity duration-fast ease-out-expo focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
    >
      <span
        className={cn(
          // Theme-aware Background (v1.w.UI.25 — Rail moved out of dark video):
          // bg-foreground/10 ist im Light dunkles Grau, im Dark helles Grau.
          // Backdrop-blur entfernt — wir sind nicht mehr über transparentem
          // Video-Content, also unnötig + minimaler Performance-Gewinn.
          'relative flex items-center justify-center rounded-full bg-foreground/10 transition-colors duration-base ease-out-expo group-hover/like:bg-foreground/20',
          circleClassName ?? 'h-12 w-12',
        )}
      >
        {/* Scale-Pop Container — re-mountet mit popKey bei jedem Like. */}
        <span
          key={`pop-${popKey}`}
          className={cn(
            'flex items-center justify-center',
            popKey !== null && 'animate-heart-pop',
          )}
        >
          <Heart
            aria-hidden="true"
            className={cn(
              iconClassName ?? 'h-7 w-7',
              // Default: erbe Farbe vom Parent (text-foreground im Rail).
              // Liked: rot überall.
              'text-foreground transition-colors duration-fast ease-out-expo',
              liked && 'fill-red-500 text-red-500',
            )}
          />
        </span>

        {/* Partikel-Burst — 8 kleine Herzen. Nur gerendert wenn burstKey
            gesetzt ist. Pointer-events-none, damit die Partikel den
            Click-Path nicht blockieren. */}
        {burstKey !== null && (
          <span
            key={`burst-${burstKey}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            {PARTICLE_ANGLES.map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              // Leichter Jitter pro Partikel damit nicht alle exakt am
              // gleichen Radius sitzen — wirkt „lebendiger".
              const r = PARTICLE_RADIUS + (i % 2 === 0 ? 6 : -4);
              const dx = Math.cos(rad) * r;
              const dy = Math.sin(rad) * r;
              return (
                <Heart
                  key={deg}
                  aria-hidden="true"
                  className="absolute h-3 w-3 animate-heart-particle fill-red-500 text-red-500"
                  style={{
                    // Animation liest diese Custom-Properties (siehe
                    // tailwind.config `heart-particle`-Keyframe).
                    ['--dx' as string]: `${dx}px`,
                    ['--dy' as string]: `${dy}px`,
                  }}
                />
              );
            })}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="text-xs font-semibold tabular-nums">
        {countLabel}
      </span>
    </button>
  );
}

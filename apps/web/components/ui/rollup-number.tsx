'use client';

/**
 * RollupNumber (Web) — Belohnungs-Zahl die HOCHZÄHLT statt zu springen.
 * Design-Gesetz §1 („Hochs lauter machen"): jeder Erfolgs-Peak zeigt einen
 * Number-Rollup — nie den fertigen Wert, sondern das Hochzählen dorthin.
 *
 * Reiner <span>-Drop-in: eased rAF-Tween, kein Layout-/Format-Drama.
 *
 * Maßhalten (Design-Gesetz §3):
 *  • Default: animiert NUR bei Wert-Änderung — NICHT beim ersten Render.
 *  • Für Werte die beim Erscheinen schon feststehen (Kauf-Success, Stream-End-
 *    Zusammenfassung): `animateOnMount` → zählt von `from` (Default 0) hoch.
 *    Web-Peaks werden i.d.R. konditional gemountet (`{ended && …}`), feuern also
 *    pro Erscheinen einmal — kein Remount-Key nötig.
 */
import { useEffect, useRef, useState } from 'react';

type Props = {
  value: number;
  className?: string;
  /** Dauer in ms (Default 800). */
  durationMs?: number;
  /** Beim ersten Render von `from` → `value` hochzählen (Default false). */
  animateOnMount?: boolean;
  /** Startwert wenn `animateOnMount` (Default 0). */
  from?: number;
  /** Eigene Formatierung; bekommt eine gerundete Ganzzahl. Default: dt. Tausenderpunkte. */
  format?: (n: number) => string;
};

const formatDE = (n: number) => n.toLocaleString('de-DE');
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function RollupNumber({
  value,
  className,
  durationMs = 800,
  animateOnMount = false,
  from = 0,
  format = formatDE,
}: Props) {
  const initial = animateOnMount ? from : value;
  const [display, setDisplay] = useState<number>(initial);
  const displayRef = useRef<number>(initial);
  const rafRef = useRef<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const setBoth = (n: number) => {
      displayRef.current = n;
      setDisplay(n);
    };

    if (!mounted.current) {
      mounted.current = true;
      if (!animateOnMount) {
        setBoth(value);
        return;
      }
    }

    const start = displayRef.current;
    const end = value;
    if (start === end) {
      setBoth(end);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      if (p >= 1) {
        setBoth(end);
        rafRef.current = null;
      } else {
        setBoth(start + (end - start) * easeOutCubic(p));
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // durationMs/animateOnMount sind stabil; nur Wert-Änderungen lösen neu aus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{format(Math.round(display))}</span>;
}

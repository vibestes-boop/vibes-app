/**
 * components/ui/RollupNumber.tsx
 *
 * Belohnungs-Zahl die HOCHZÄHLT statt zu springen.
 * Design-Gesetz §1 („Hochs lauter machen"): jeder Erfolgs-Peak zeigt einen
 * Number-Rollup — nie den fertigen Wert, sondern das Hochzählen dorthin.
 *
 * Reiner <Text>-Drop-in: der angezeigte Wert wird über eine eased rAF-Tween
 * getrieben, damit Layout & Styles 1:1 wie beim ersetzten <Text> bleiben
 * (kein TextInput-Padding-/Breiten-Drama). Kein Reanimated nötig — das
 * Hochzählen ist eine kurze Einmal-Tween, kein Dauer-Worklet.
 *
 * Verhalten (bewusst Maßhalten, Design-Gesetz §3):
 *  • Default: animiert NUR bei Wert-Änderung (z. B. Coins nach Kauf
 *    gutgeschrieben) — NICHT beim ersten Render, sonst feiert jedes bloße
 *    Screen-Öffnen.
 *  • Für Werte die beim Erscheinen schon feststehen (z. B. Stream-Earnings in
 *    der End-Zusammenfassung): `animateOnMount` setzen → zählt von `from` hoch.
 *    Sitzt das Ziel in einem stets-gemounteten Container (RN-<Modal>), den
 *    Aufrufer mit einem wechselnden `key` neu mounten lassen, damit es pro
 *    Erscheinen erneut feuert.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

type Props = {
  value: number;
  style?: StyleProp<TextStyle>;
  /** Animations-Dauer in ms (Default 800). */
  duration?: number;
  /** Beim ersten Render von `from` → `value` hochzählen (Default false). */
  animateOnMount?: boolean;
  /** Startwert wenn `animateOnMount` (Default 0). */
  from?: number;
  /** Eigene Formatierung; bekommt eine gerundete Ganzzahl. Default: dt. Tausenderpunkte. */
  format?: (n: number) => string;
  numberOfLines?: number;
};

const formatDE = (n: number) => n.toLocaleString('de-DE');
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function RollupNumber({
  value,
  style,
  duration = 800,
  animateOnMount = false,
  from = 0,
  format = formatDE,
  numberOfLines,
}: Props) {
  const initial = animateOnMount ? from : value;
  const [display, setDisplay] = useState<number>(initial);
  const displayRef = useRef<number>(initial);
  const rafRef = useRef<number | null>(null);
  const mounted = useRef(false);

  const setBoth = (n: number) => {
    displayRef.current = n;
    setDisplay(n);
  };

  useEffect(() => {
    // Erster Render ohne animateOnMount → direkt setzen, nicht animieren.
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

    const t0 = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = easeOutCubic(p);
      if (p >= 1) {
        setBoth(end);
        rafRef.current = null;
      } else {
        setBoth(start + (end - start) * eased);
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
    // duration/animateOnMount sind stabil; nur Wert-Änderungen lösen neu aus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {format(Math.round(display))}
    </Text>
  );
}

// Belohnungszahlen zählen hoch, sie erscheinen nie fertig.
// Hausregel aus dem Serlo-Designgesetz: Hochs lauter machen — Auge und Hand
// zusammen (hier das Auge, die Haptik sitzt im Button).

import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { formatEuro } from '../lib/useAuction';

const DURATION_MS = 450;

export function RollupNumber({ cents, style }: { cents: number; style?: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(cents);
  const fromRef = useRef(cents);

  useEffect(() => {
    const start = fromRef.current;
    const delta = cents - start;
    if (delta === 0) return;

    const startedAt = Date.now();
    let frame: number;

    const step = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / DURATION_MS);
      // ease-out cubic: schnell los, weich ankommen
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(start + delta * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = cents;
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [cents]);

  return <Text style={style}>{formatEuro(shown)}</Text>;
}

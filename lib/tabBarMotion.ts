import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Easing, makeMutable, withTiming } from 'react-native-reanimated';

// Untere Leiste wie bei Instagram: Beim Runterscrollen wird sie kompakter, beim
// Hochscrollen oder ganz oben wieder voll. 0 = voll, 1 = kompakt. Der Wert lebt
// auf dem UI-Thread; Listen melden nur Richtungswechsel, die Animation läuft nativ.
export const tabBarCompact = makeMutable(0);

let target = 0;

export function setTabBarCompact(compact: boolean) {
  const next = compact ? 1 : 0;
  if (next === target) return;
  target = next;
  tabBarCompact.value = withTiming(next, { duration: 280, easing: Easing.out(Easing.cubic) });
}

// So weit oben bleibt die Leiste immer voll (auch beim Ziehen zum Aktualisieren)
const TOP_ZONE = 24;
// So viele Punkte Bewegung, bis eine Richtung zählt (gegen Zittern)
const STEP = 8;

/** onScroll für die Listen der Tabs. Das Nachfedern am Listenende zählt nicht. */
export function useTabBarScroll() {
  const last = useRef(0);
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    if (y <= TOP_ZONE) {
      setTabBarCompact(false);
      last.current = y;
      return;
    }
    if (y > contentSize.height - layoutMeasurement.height) return;
    const dy = y - last.current;
    if (dy > STEP) setTabBarCompact(true);
    else if (dy < -STEP) setTabBarCompact(false);
    else return;
    last.current = y;
  }, []);
}

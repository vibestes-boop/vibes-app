import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Mindesthöhe des Listeninhalts, damit ein Reiterwechsel die Seite nicht
 * verschiebt: Kopf + sichtbare Fläche. So lässt sich der Kopf samt Reitern
 * immer bis ganz nach oben schieben, und eine kurze Liste (drei Gespeicherte)
 * zwingt iOS nicht, die Seite nach oben zu ziehen.
 */
export function scrollHoldMinHeight(headerHeight: number, listHeight: number): number | undefined {
  return headerHeight > 0 && listHeight > 0 ? headerHeight + listHeight : undefined;
}

/**
 * Misst Kopf und Liste und liefert die Mindesthöhe für contentContainerStyle.
 * `onListLayout` an eine View UM die Liste hängen, nicht an `FlatList.onLayout`:
 * VirtualizedList meldet dort auch die Höhe des Leer-Platzhalters (z. B. 204 pt
 * bei einem leeren Reiter), und die Mindesthöhe schrumpfte genau beim Wechsel.
 */
export function useTabSwitchScrollHold() {
  const [headerHeight, setHeaderHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setHeaderHeight((old) => (old === h ? old : h));
  }, []);
  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setListHeight((old) => (old === h ? old : h));
  }, []);
  return { onHeaderLayout, onListLayout, minHeight: scrollHoldMinHeight(headerHeight, listHeight) };
}

/**
 * Lage der schwebenden Tab-Leiste. Eine Quelle für die Leiste selbst und alles,
 * was darüber sitzt (Fortschrittsbalken im Feed, Bildtext, Aktionsspalte).
 * Vorher standen die Abstände an jeder Stelle einzeln als feste Zahl.
 */
export const TAB_BAR_ITEM_H = 52;
export const TAB_BAR_PAD = 4;
export const TAB_BAR_HEIGHT = TAB_BAR_ITEM_H + TAB_BAR_PAD * 2;

/**
 * Abstand der Leiste zum unteren Bildschirmrand: knapp über dem Home-Balken.
 * Vorher 28 pt auf iPhones mit Face ID (Zaur, 01.11.2026: „zu weit oben").
 */
export function tabBarBottomGap(insetBottom: number): number {
  return Math.max(insetBottom - 20, 8);
}

/** Oberkante der Leiste, vom unteren Bildschirmrand aus gemessen */
export function tabBarTop(insetBottom: number): number {
  return tabBarBottomGap(insetBottom) + TAB_BAR_HEIGHT;
}

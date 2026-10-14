export const NAV_FEATURES = ['guild', 'messages', 'shop', 'explore', 'notifications', 'live', 'women_only'] as const;
export type NavFeature = typeof NAV_FEATURES[number];
export type NavSlots = { slot2: NavFeature; slot4: NavFeature };
const valid = (v: unknown): v is NavFeature => typeof v === 'string' && (NAV_FEATURES as readonly string[]).includes(v);
export function normalizeNavSlots(left: unknown, right: unknown): NavSlots {
  const slot2 = valid(left) ? left : 'guild';
  const slot4 = valid(right) && right !== slot2 ? right : slot2 === 'shop' ? 'guild' : 'shop';
  return { slot2, slot4 };
}
/** Selecting an occupied destination swaps the slots atomically. */
export function selectNavSlot(slots: NavSlots, slot: 2 | 4, value: NavFeature): NavSlots {
  if (slot === 2) return { slot2: value, slot4: slots.slot4 === value ? slots.slot2 : slots.slot4 };
  return { slot2: slots.slot2 === value ? slots.slot4 : slots.slot2, slot4: value };
}

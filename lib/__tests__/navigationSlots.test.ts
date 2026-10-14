import { normalizeNavSlots, selectNavSlot } from '../navigationSlots';
describe('navigation preferences', () => {
  it('repairs duplicated destinations from storage', () => {
    expect(normalizeNavSlots('shop', 'shop')).toEqual({ slot2: 'shop', slot4: 'guild' });
  });
  it('uses defaults for a new profile instead of inheriting another account', () => {
    expect(normalizeNavSlots(null, undefined)).toEqual({ slot2: 'guild', slot4: 'shop' });
    expect(normalizeNavSlots('removed-feature', 'messages')).toEqual({ slot2: 'guild', slot4: 'messages' });
  });
  it('swaps occupied destinations atomically in either direction', () => {
    const initial = { slot2: 'guild', slot4: 'shop' } as const;
    expect(selectNavSlot(initial, 2, 'shop')).toEqual({ slot2: 'shop', slot4: 'guild' });
    expect(selectNavSlot(initial, 4, 'guild')).toEqual({ slot2: 'shop', slot4: 'guild' });
  });
  it('preserves the other destination when selecting a new one', () => {
    expect(selectNavSlot({ slot2: 'guild', slot4: 'shop' }, 2, 'live')).toEqual({ slot2: 'live', slot4: 'shop' });
  });
});

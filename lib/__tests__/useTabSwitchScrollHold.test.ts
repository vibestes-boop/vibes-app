import { scrollHoldMinHeight } from '../useTabSwitchScrollHold';

describe('Seite bleibt beim Reiterwechsel stehen', () => {
  it('macht den Inhalt mindestens so hoch wie Kopf plus sichtbare Fläche', () => {
    expect(scrollHoldMinHeight(620, 780)).toBe(1400);
  });
  it('setzt nichts, solange noch nicht gemessen ist', () => {
    expect(scrollHoldMinHeight(0, 780)).toBeUndefined();
    expect(scrollHoldMinHeight(620, 0)).toBeUndefined();
  });
});

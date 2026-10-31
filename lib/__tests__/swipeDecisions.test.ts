import { panelShouldClose, panelShouldOpen, peekImageUri, postSwipeTarget, type PostPeek } from '../swipeDecisions';

const W = 400;
const H = 900;

describe('Profil-Panel', () => {
  it('öffnet ab gut einem Drittel der Breite nach links', () => {
    expect(panelShouldOpen(-0.36 * W, 0, W)).toBe(true);
    expect(panelShouldOpen(-0.3 * W, 0, W)).toBe(false);
  });
  it('öffnet bei einem schnellen Wisch auch mit kurzem Weg', () => {
    expect(panelShouldOpen(-40, -600, W)).toBe(true);
    expect(panelShouldOpen(-40, -300, W)).toBe(false);
  });
  it('schließt spiegelbildlich nach rechts', () => {
    expect(panelShouldClose(0.36 * W, 0, W)).toBe(true);
    expect(panelShouldClose(0.3 * W, 0, W)).toBe(false);
    expect(panelShouldClose(30, 700, W)).toBe(true);
    expect(panelShouldClose(-200, 0, W)).toBe(false);
  });
});

describe('Nächster / voriger Beitrag', () => {
  it('wechselt nach oben ab einem Fünftel der Höhe, wenn es einen nächsten gibt', () => {
    expect(postSwipeTarget(-0.21 * H, 0, H, true, true)).toBe('next');
    expect(postSwipeTarget(-0.18 * H, 0, H, true, true)).toBeNull();
    expect(postSwipeTarget(-0.5 * H, 0, H, false, true)).toBeNull();
  });
  it('wechselt nach unten zum vorigen', () => {
    expect(postSwipeTarget(0.25 * H, 0, H, true, true)).toBe('prev');
    expect(postSwipeTarget(0.25 * H, 0, H, true, false)).toBeNull();
  });
  it('reagiert auf schnelle Wische, aber nicht auf ein Zucken', () => {
    expect(postSwipeTarget(-40, -1200, H, true, false)).toBe('next');
    expect(postSwipeTarget(-10, -1200, H, true, false)).toBeNull();
    expect(postSwipeTarget(40, 1200, H, false, true)).toBe('prev');
  });
});

describe('Vorschaubild des Nachbarn', () => {
  const base: PostPeek = { id: 'p', media_url: 'https://x/full.jpg', media_type: 'image', thumbnail_url: 'https://x/720.jpg', caption: null };
  it('nimmt bei Fotos das Vorschaubild, sonst das Original', () => {
    expect(peekImageUri(base)).toBe('https://x/720.jpg');
    expect(peekImageUri({ ...base, thumbnail_url: null })).toBe('https://x/full.jpg');
  });
  it('nimmt bei Videos nur das Standbild, nie die MP4', () => {
    expect(peekImageUri({ ...base, media_type: 'video', media_url: 'https://x/clip.mp4', thumbnail_url: 'https://x/still.jpg' })).toBe('https://x/still.jpg');
    expect(peekImageUri({ ...base, media_type: 'video', media_url: 'https://x/clip.mp4', thumbnail_url: null })).toBeNull();
  });
  it('ohne Vorschau nichts', () => {
    expect(peekImageUri(undefined)).toBeNull();
  });
});

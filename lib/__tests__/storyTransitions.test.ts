import { nextStillUris, storyStillUri } from '../storyTransitions';

const img = (name: string) => ({ media_url: `https://x/${name}.jpg`, media_type: 'image', thumbnail_url: null });
const vid = (name: string, still: string | null) => ({ media_url: `https://x/${name}.mp4`, media_type: 'video', thumbnail_url: still });

describe('Standbild einer Story', () => {
  it('nimmt bei Fotos das Foto', () => {
    expect(storyStillUri(img('a'))).toBe('https://x/a.jpg');
  });
  it('nimmt bei Videos nur das Standbild, nie die MP4', () => {
    expect(storyStillUri(vid('v', 'https://x/v.jpg'))).toBe('https://x/v.jpg');
    expect(storyStillUri(vid('v', null))).toBeNull();
  });
  it('ohne Story nichts', () => {
    expect(storyStillUri(undefined)).toBeNull();
  });
});

describe('Was vorab laden soll', () => {
  const parfum = { userId: 'h1', stories: [img('parfum')] };
  const reise = { userId: 'h2', stories: [img('reise1'), img('reise2')] };
  const clip = { userId: 'h3', stories: [vid('clip', 'https://x/clip-still.jpg')] };
  const groups = [parfum, reise, clip];

  it('nimmt die nächste Story derselben Gruppe', () => {
    expect(nextStillUris(reise, 0, groups)).toEqual(['https://x/reise2.jpg']);
  });
  it('nimmt am Ende der Gruppe die erste des nächsten Highlights', () => {
    expect(nextStillUris(parfum, 0, groups)).toEqual(['https://x/reise1.jpg']);
    expect(nextStillUris(reise, 1, groups)).toEqual(['https://x/clip-still.jpg']);
  });
  it('am Ende des letzten Highlights nichts', () => {
    expect(nextStillUris(clip, 0, groups)).toEqual([]);
  });
});

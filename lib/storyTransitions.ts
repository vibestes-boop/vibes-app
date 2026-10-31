import type { Story } from './useStories';

type StillStory = Pick<Story, 'media_url' | 'media_type' | 'thumbnail_url'>;
type StillGroup = { userId: string; stories: StillStory[] };

/**
 * Bild, das eine Story ohne Wartezeit zeigen kann: bei Fotos das Foto, bei
 * Videos das Standbild (die MP4 selbst kann expo-image nicht vorladen).
 */
export function storyStillUri(story: StillStory | undefined): string | null {
  if (!story) return null;
  if (story.media_type === 'video') return story.thumbnail_url || null;
  return story.media_url || null;
}

/**
 * Was als Nächstes erscheint und schon vorab laden sollte: die nächste Story der
 * Gruppe, am Ende der Gruppe die erste des nächsten Highlights bzw. Nutzers.
 * Vorher wurde nur innerhalb der Gruppe vorgeladen, beim Wechsel zum nächsten
 * Highlight stand darum erst einmal ein schwarzer Bildschirm.
 */
export function nextStillUris(group: StillGroup, storyIndex: number, groups: StillGroup[]): string[] {
  const inGroup = group.stories[storyIndex + 1];
  if (inGroup) {
    const uri = storyStillUri(inGroup);
    return uri ? [uri] : [];
  }
  const at = groups.findIndex((g) => g.userId === group.userId);
  const uri = at >= 0 ? storyStillUri(groups[at + 1]?.stories[0]) : null;
  return uri ? [uri] : [];
}

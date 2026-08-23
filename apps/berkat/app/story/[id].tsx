// Der Vollbild-Betrachter für Stories.
//
// Die Fläche selbst steht in `components/StoryStage.tsx` — sie ist mit dem
// Highlight-Betrachter identisch und liegt deshalb an EINER Stelle (Begründung
// im Kopf jener Datei). Hier steht nur, WAS gezeigt wird und was der
// Papierkorb bedeutet.
//
// Der Parameter ist die VERKÄUFER-Kennung, nicht die einer Story: Man öffnet
// im Ring eine Person und sieht dann alles, was sie heute gezeigt hat.

import { useCallback, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { StoryStage } from '../../components/StoryStage';
import { useSession } from '../../lib/session';
import { goBack } from '../../lib/nav';
import { useBerkatStories, useDeleteStory, useMarkStoryViewed } from '../../lib/useStories';

export default function StoryViewer() {
  const { id: sellerId } = useLocalSearchParams<{ id: string }>();
  const myUserId = useSession((s) => s.userId);

  const { data: groups = [], isLoading } = useBerkatStories();
  const markViewed = useMarkStoryViewed();
  const del = useDeleteStory();

  const group = useMemo(
    () => groups.find((g) => g.userId === sellerId) ?? null,
    [groups, sellerId],
  );

  const items = useMemo(
    () => (group?.stories ?? []).map((st) => ({ id: st.id, media_url: st.media_url })),
    [group],
  );

  const schliessen = useCallback(() => goBack('/(tabs)/'), []);
  const eigene = myUserId != null && myUserId === sellerId;

  return (
    <StoryStage
      items={items}
      who={group ? { username: group.username, avatarUrl: group.avatarUrl } : null}
      loading={isLoading}
      // Der Vermerk darf scheitern, ohne das Ansehen zu unterbrechen —
      // Begründung am Hook.
      onSeen={(storyId) => markViewed.mutate(storyId)}
      // ⚠️ Löscht GENAU DAS sichtbare Bild, nicht den ganzen Tag. Beim
      // Highlight ist es umgekehrt, und das ist der einzige Unterschied
      // zwischen den beiden Bildschirmen.
      onDelete={eigene ? (storyId) => del.mutate(storyId, { onSuccess: schliessen }) : undefined}
      deleteLabel="Story löschen"
      // `replace`, nicht `push`: Sonst liegt die Story im Rückweg und man
      // landet vom Profil aus wieder in einem Bild, das man gerade gesehen hat.
      onOpenProfile={() => router.replace(`/seller/${sellerId}`)}
      onClose={schliessen}
    />
  );
}

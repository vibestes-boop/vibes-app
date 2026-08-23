// Der Vollbild-Betrachter für ein Highlight.
//
// Dieselbe Bühne wie die Story (`components/StoryStage.tsx`), zwei Unterschiede:
//
//   1. Der Papierkorb löscht das GANZE Highlight, nicht das sichtbare Bild.
//      Ein Highlight ist eine Zusammenstellung — ein einzelnes Foto daraus zu
//      entfernen hiesse, sie zu bearbeiten, und dafür gibt es hier keinen Ort.
//      Wer etwas ändern will, legt sie neu an; bei drei bis zwölf Bildern ist
//      das schneller als jede Bearbeitungsoberfläche, die dafür nötig wäre.
//   2. Kein Sicht-Vermerk. Ein Highlight ist dauerhaft, es gibt kein „schon
//      gesehen" — die Scheibe auf dem Profil hat deshalb auch keinen Ring.

import { useCallback, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { StoryStage } from '../../components/StoryStage';
import { useSession } from '../../lib/session';
import { goBack } from '../../lib/nav';
import { useDeleteHighlight, useHighlight } from '../../lib/useHighlights';

export default function HighlightViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myUserId = useSession((s) => s.userId);

  const { data, isLoading } = useHighlight(id);
  const del = useDeleteHighlight();

  const sellerId = data?.highlight.user_id ?? null;
  const eigenes = myUserId != null && sellerId != null && myUserId === sellerId;

  // ⚠️ Die Bilder eines Highlights haben keine eigene Kennung — sie stehen als
  // JSON in einer Zeile. Die Bild-Adresse ist damit der einzige stabile Griff,
  // und sie taugt dafür: Innerhalb einer Sammlung dasselbe Foto zweimal ist
  // kein Fall, den jemand herstellen will (das Blatt lässt ihn auch nicht zu).
  const items = useMemo(
    () => (data?.highlight.items ?? []).map((it) => ({ id: it.media_url, media_url: it.media_url })),
    [data],
  );

  const schliessen = useCallback(() => goBack('/(tabs)/'), []);

  return (
    <StoryStage
      items={items}
      who={data ? { username: data.username, avatarUrl: data.avatarUrl } : null}
      caption={data?.highlight.title ?? null}
      loading={isLoading}
      onDelete={
        eigenes && id
          ? () => del.mutate(id, { onSuccess: schliessen })
          : undefined
      }
      deleteLabel="Highlight löschen"
      onOpenProfile={() => (sellerId ? router.replace(`/seller/${sellerId}`) : schliessen())}
      onClose={schliessen}
    />
  );
}

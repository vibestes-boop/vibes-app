// lib/swipeDecisions.ts — reine Entscheidungen der Wisch-Gesten (laufen als
// Worklet auf dem UI-Thread; hier ohne Abhängigkeiten, damit sie testbar sind).

/** Profil-Panel aufziehen: mehr als ein Drittel der Breite oder ein schneller Wisch nach links. */
export function panelShouldOpen(translationX: number, velocityX: number, width: number) {
  'worklet';
  return translationX < -width * 0.35 || velocityX < -500;
}

/** Profil-Panel zuschieben: mehr als ein Drittel der Breite oder ein schneller Wisch nach rechts. */
export function panelShouldClose(translationX: number, velocityX: number, width: number) {
  'worklet';
  return translationX > width * 0.35 || velocityX > 500;
}

/**
 * Wohin führt ein senkrechtes Wischen im Beitrag? Ein Fünftel der Höhe oder ein
 * schneller Wisch genügt (wie im Feed). Ohne Ziel in der Richtung bleibt es beim
 * Beitrag.
 */
export function postSwipeTarget(
  translationY: number,
  velocityY: number,
  height: number,
  hasNext: boolean,
  hasPrev: boolean,
): 'next' | 'prev' | null {
  'worklet';
  if (hasNext && (translationY < -height * 0.2 || (velocityY < -800 && translationY < -24))) return 'next';
  if (hasPrev && (translationY > height * 0.2 || (velocityY > 800 && translationY > 24))) return 'prev';
  return null;
}

export type PostPeek = {
  id: string;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  caption: string | null;
};

/** Bild, das beim Wischen für den Nachbarbeitrag mitgleitet (Vorschaubild zuerst). */
export function peekImageUri(peek: PostPeek | undefined): string | null {
  if (!peek) return null;
  if (peek.media_type === 'video') return peek.thumbnail_url;
  return peek.thumbnail_url ?? peek.media_url;
}

/** Für Fotos das Original: Der neue Bildschirm zeigt genau dieses Bild, damit der
 * Wechsel am Ende nicht springt (das Vorschaubild ist nur Platzhalter). */
export function peekFullUri(peek: PostPeek | undefined): string | null {
  if (!peek || peek.media_type === 'video') return null;
  return peek.media_url;
}

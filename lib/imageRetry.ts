/** Wartezeit vor dem ersten und zweiten stillen Neuversuch eines Fotos (ms) */
export const IMAGE_RETRY_DELAYS = [800, 2500] as const;

/**
 * Adresse für einen Neuversuch. Der Zähler in der Abfrage umgeht einen im
 * Bild-Cache gemerkten Fehlschlag; R2 und Supabase Storage ignorieren ihn.
 */
export function retryUri(uri: string, attempt: number): string {
  if (attempt <= 0) return uri;
  return `${uri}${uri.includes('?') ? '&' : '?'}retry=${attempt}`;
}

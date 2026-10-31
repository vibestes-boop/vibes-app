import { useCallback, useMemo, useState } from 'react';

type GridMedia = { media_url?: string | null; thumbnail_url?: string | null };

/**
 * Bildquelle für Raster und kleine Vorschauen: erst das Vorschaubild (720 px
 * breit, rund 100 KB), dann das Original (Fotos bis über 20 MB). Lädt eine
 * Quelle nicht, kommt die nächste; ist keine mehr übrig, ist `uri` null.
 * Für Videos nur das Vorschaubild: eine MP4 gehört nicht in den Bild-Decoder.
 */
export function useGridImage(media: GridMedia, isVideo = false) {
  const candidates = useMemo(() => {
    const list = isVideo ? [media.thumbnail_url] : [media.thumbnail_url, media.media_url];
    return list.filter((u, i, all): u is string => !!u && all.indexOf(u) === i);
  }, [media.thumbnail_url, media.media_url, isVideo]);
  // Adressen sind je Beitrag eindeutig: Wird die Zelle für einen anderen Beitrag
  // wiederverwendet, treffen alte Einträge nichts.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const uri = candidates.find((u) => !failed.includes(u)) ?? null;
  const onError = useCallback(() => {
    if (uri) setFailed((f) => (f.includes(uri) ? f : [...f, uri]));
  }, [uri]);
  return { uri, onError };
}

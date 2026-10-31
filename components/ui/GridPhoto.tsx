import { Image, type ImageProps } from 'expo-image';
import { useGridImage } from '@/lib/useGridImage';

type GridPhotoProps = Omit<ImageProps, 'source' | 'onError'> & {
  media: { media_url?: string | null; thumbnail_url?: string | null };
  isVideo?: boolean;
};

/** Bild für Raster und kleine Vorschauen: Vorschaubild zuerst, das Original nur
 * als Ersatz (siehe useGridImage). Ohne ladbare Quelle bleibt die Fläche leer. */
export function GridPhoto({ media, isVideo = false, contentFit = 'cover', ...rest }: GridPhotoProps) {
  const { uri, onError } = useGridImage(media, isVideo);
  if (!uri) return null;
  return <Image {...rest} source={{ uri }} contentFit={contentFit} onError={onError} />;
}

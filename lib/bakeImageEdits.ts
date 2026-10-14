/** Renders filters, adjustments and rotation into a photo; null signals failure or no edits. */
import * as FileSystem from 'expo-file-system/legacy';
import { hasImageAdjustments, NEUTRAL_ADJUSTMENTS, normalizedImageMatrix, type ImageAdjustments } from './imageAdjustments';
import type { ColorFilterId } from '@/lib/cameraFilters';
import { Skia, SKIA_READY } from '@/lib/skiaLoader';

export async function bakeImageEdits(
  uri: string,
  edits: { filterId: ColorFilterId | null; rotation: number; flipH: boolean; adjustments?: ImageAdjustments },
): Promise<string | null> {
  const hasFilter = !!edits.filterId && edits.filterId !== 'none';
  const rot = (((edits.rotation ?? 0) % 360) + 360) % 360;
  const hasTransform = rot !== 0 || !!edits.flipH;
  const hasAdjustments = hasImageAdjustments(edits.adjustments ?? NEUTRAL_ADJUSTMENTS);
  if (!hasFilter && !hasTransform && !hasAdjustments) return null;     // nichts zu backen → rohes Bild nutzen
  if (!SKIA_READY || !Skia) return null;

  try {
    const data = await Skia.Data.fromURI(uri);
    const img = Skia.Image.MakeImageFromEncoded(data);
    if (!img) return null;

    const w = img.width();
    const h = img.height();
    const swap = rot === 90 || rot === 270;
    const outW = swap ? h : w;
    const outH = swap ? w : h;

    const surface = Skia.Surface.MakeOffscreen(outW, outH);
    if (!surface) return null;
    const canvas = surface.getCanvas();

    const paint = Skia.Paint();
    if (hasFilter || hasAdjustments) {
      const skia20 = normalizedImageMatrix(edits.filterId, edits.adjustments);
      paint.setColorFilter(Skia.ColorFilter.MakeMatrix(skia20));
    }

    const src = Skia.XYWHRect(0, 0, w, h);
    const dst = Skia.XYWHRect(-w / 2, -h / 2, w, h);
    canvas.save();
    canvas.translate(outW / 2, outH / 2);
    if (rot !== 0) canvas.rotate(rot, 0, 0);
    if (edits.flipH) canvas.scale(-1, 1);
    // drawImageRect (das der Crop nachweislich nutzt) statt drawImage — das
    // einfache drawImage wendete den ColorFilter nicht an (Drehen ging, Filter nicht).
    canvas.drawImageRect(img, src, dst, paint);
    canvas.restore();
    surface.flush();

    const snapshot = surface.makeImageSnapshot();
    const out = `${FileSystem.cacheDirectory}baked-${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(out, snapshot.encodeToBase64(3 /* JPEG */, 92), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return out;
  } catch {
    return null;
  }
}

/**
 * bakeImageEdits — brennt Filter + Drehen/Spiegeln pixel-genau ins Bild ein.
 *
 * Hintergrund: Der Editor lädt sonst das ROHE Bild hoch — Filter/Drehen waren reine
 * Vorschau und kamen nie im Post an. Diese Helper rendert das Bild mit dem aktiven
 * Farb-Filter (gleiche Matrix wie die Vorschau-SkiaFilteredImage) + Rotation/Flip
 * über eine Skia-Offscreen-Surface in eine neue JPEG-Datei.
 *
 * Bewusst NUR Filter + Rotation/Flip (reine, verlustfreie Bild-Transformationen, die
 * exakt der Vorschau entsprechen). Anpassen (Helligkeit etc.) bleibt außen vor — die
 * Vorschau nutzt dort nur ein grobes Overlay, kein echter Matrix-Effekt.
 *
 * Defensiv: bei jedem Fehler/Skia-nicht-bereit → null → Aufrufer lädt das rohe Bild
 * hoch (Verhalten wie bisher, kein Regress). Text/Sticker brauchen view-shot (separat).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { COLOR_FILTERS } from '@/lib/cameraFilters';
import type { ColorFilterId } from '@/lib/cameraFilters';
import { Skia, SKIA_READY } from '@/lib/skiaLoader';

export async function bakeImageEdits(
  uri: string,
  edits: { filterId: ColorFilterId | null; rotation: number; flipH: boolean },
): Promise<string | null> {
  const hasFilter = !!edits.filterId && edits.filterId !== 'none';
  const rot = (((edits.rotation ?? 0) % 360) + 360) % 360;
  const hasTransform = rot !== 0 || !!edits.flipH;
  if (!hasFilter && !hasTransform) return null;     // nichts zu backen → rohes Bild nutzen
  if (!SKIA_READY || !Skia) return null;

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const data = Skia.Data.fromBase64(base64);
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
    if (hasFilter && edits.filterId) {
      // Gleiche Umrechnung wie SkiaFilteredImage: Bias-Spalte (jede 5.) /255.
      const m = COLOR_FILTERS[edits.filterId];
      const skia20 = m.map((v: number, i: number) => ((i + 1) % 5 === 0 ? v / 255 : v));
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

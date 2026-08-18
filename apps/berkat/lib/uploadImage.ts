// Bild auswählen und nach R2 laden.
//
// Nutzt dieselbe Edge Function wie Serlo (`r2-sign`) und dieselben erlaubten
// Präfixe — deshalb war am Backend nichts zu ändern. Die Function prüft:
// der Schlüssel muss `<präfix>/<eigene-user-id>/…` lauten, sonst signiert sie
// nicht. Fremde Bilder überschreiben ist damit ausgeschlossen.
//
// Bewusst schlanker als lib/uploadMedia.ts in Serlo: hier gibt es nur Bilder,
// keine Videos, also keine Fast-Start-Prüfung und keine Komprimierung.

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/**
 * WO das Bild liegt. `products/images` und `thumbnails` sind in r2-sign als
 * Bild-Präfixe erlaubt.
 *
 * ⚠️ Sagt NICHTS über den Zuschnitt — dafür gibt es `CropShape`. Die beiden
 * waren bis zum 16.08.2026 dasselbe Feld, und das war der Fehler: `'cover'`
 * bedeutete gleichzeitig „liegt unter thumbnails/" UND „wird 3:4 hochkant
 * zugeschnitten". Unter `thumbnails/` liegen aber drei völlig verschiedene
 * Flächen — Show-Cover (quadratisch angezeigt), Termin-Bild (quadratisch) und
 * das Profil-Banner (Höhe 116 auf voller Breite, also rund 3:1). Der hochkant-
 * Zuschnitt passte zu keiner einzigen davon.
 */
export type ImageKind = 'article' | 'cover';

/**
 * WIE zugeschnitten wird. Das ist eine Frage der ANZEIGE, nicht des Speicherorts.
 *
 * Faustregel: Die Form hier muss der Form entsprechen, in der das Bild später
 * gezeichnet wird. Sonst schneidet der Verkäufer sorgfältig zu und sieht danach
 * einen anderen Ausschnitt — bei quadratischer Anzeige eines 3:4-Bildes fällt
 * ein Viertel der Höhe weg, und zwar oben und unten.
 */
export type CropShape = 'square' | 'portrait' | 'wide';

const PREFIX: Record<ImageKind, string> = {
  article: 'products/images',
  cover: 'thumbnails',
};

const MAX_BYTES = 8 * 1024 * 1024;
const CACHE = 'public, max-age=31536000, immutable';

type SignResult = {
  uploadUrl: string;
  publicUrl: string;
  uploadHeaders?: Record<string, string>;
};

export type PickedImage = { uri: string; mimeType: string; extension: string };

function extensionFor(mimeType: string, uri: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic') || mimeType.includes('heif')) return 'heic';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  const fromUri = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return fromUri && /^[a-z0-9]{3,4}$/.test(fromUri) ? fromUri : 'jpg';
}

/** Woher das Bild kommt. */
export type ImageSource = 'camera' | 'library';

/**
 * Fragt, ob fotografiert oder ausgewählt werden soll.
 *
 * ⚠️ WARUM DIE KAMERA ÜBERHAUPT DAZUKOMMT
 * Bis zum 17.08.2026 rief die App ausschließlich die Mediathek auf — man konnte
 * ein vorhandenes Foto wählen, aber keines MACHEN. Für jemanden, der heute in
 * einer WhatsApp-Gruppe verkauft, ist das der erste Handgriff überhaupt: Artikel
 * hinlegen, abfotografieren, einstellen. Wer dafür erst die Kamera-App
 * verlassen, zurückwechseln und dann suchen muss, stellt seltener ein.
 *
 * `Alert.alert` statt eines eigenen Blattes: Es ist auf beiden Plattformen
 * nativ und braucht kein Modul. (`Alert.prompt` wäre iOS-only — das hier nicht.)
 */
export function askImageSource(): Promise<ImageSource | null> {
  return new Promise((resolve) => {
    Alert.alert('Bild hinzufügen', undefined, [
      { text: 'Foto aufnehmen', onPress: () => resolve('camera') },
      { text: 'Aus der Mediathek', onPress: () => resolve('library') },
      // `onDismiss` deckt das Wegtippen daneben auf Android ab; ohne das
      // bliebe das Versprechen offen und der Aufrufer wartete ewig.
      { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(null) },
    ], { onDismiss: () => resolve(null) });
  });
}

/**
 * Öffnet Kamera oder Fotoauswahl. Gibt null zurück, wenn abgebrochen wurde oder
 * die Erlaubnis fehlt — beides ist kein Fehler, sondern eine Entscheidung.
 */
export async function pickImage(
  shape: CropShape,
  source: ImageSource = 'library',
): Promise<PickedImage | null> {
  // Zwei verschiedene Berechtigungen. Die Kamera-Erlaubnis steht in der
  // app.json bereits für LiveKit (`NSCameraUsageDescription`) — deshalb kostet
  // die Kamera hier keinen neuen Build.
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const launch =
    source === 'camera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

  const result = await launch({
    mediaTypes: ['images'],
    // ⚠️ `aspect` wirkt NUR auf Android. Auf iOS ist der Zuschnitt-Rahmen bei
    // `allowsEditing` immer quadratisch, egal was hier steht — das ist so
    // dokumentiert und nicht abstellbar.
    //
    // Daraus folgt die Aufteilung: Für eine quadratische Fläche ist
    // `allowsEditing` genau richtig und liefert auf BEIDEN Plattformen
    // dasselbe. Für jede andere Form wäre ein Zuschnitt-Rahmen ein
    // Versprechen, das iOS nicht halten kann — der Verkäufer zöge ein Quadrat
    // und bekäme einen breiten Streifen daraus. Deshalb dort gar kein
    // Zuschnitt: Das ganze Bild wird geladen, und `contentFit="cover"` wählt
    // beim Zeichnen den Ausschnitt. Gleiches Ergebnis auf iOS und Android.
    //
    // `portrait` (seit 18.08.2026, Kartenformat 4:5) fällt aus demselben Grund
    // in dieselbe Gruppe wie `wide`. Das ist hier sogar der gutmütige Fall: Ein
    // Handyfoto im Hochformat hat 3:4, also fast genau die Kartenform — es
    // verliert beim Zeichnen wenige Prozent oben und unten. Ein quadratischer
    // Rahmen hätte dagegen zuerst ein Viertel der Höhe weggeschnitten und die
    // Karte hätte davon nochmal seitlich genommen.
    allowsEditing: shape === 'square',
    aspect: [1, 1],
    // Gilt auch ohne Zuschnitt-Rahmen: Das Bild wird neu kodiert. Ein
    // ungeschnittenes Handyfoto liegt damit über den 250–330 KB, die am
    // 16.08.2026 für zugeschnittene gemessen wurden, aber deutlich unter der
    // 8-MB-Grenze weiter unten.
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType?.trim() || 'image/jpeg';
  return { uri: asset.uri, mimeType, extension: extensionFor(mimeType, asset.uri) };
}

/** Lädt ein ausgewähltes Bild hoch und gibt die öffentliche URL zurück. */
export async function uploadImage(image: PickedImage, kind: ImageKind): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Nicht angemeldet.');

  const fileResponse = await fetch(image.uri);
  if (!fileResponse.ok) throw new Error('Das Bild konnte nicht gelesen werden.');
  const buffer = await fileResponse.arrayBuffer();

  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Das Bild ist ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB groß — höchstens 8 MB.`,
    );
  }

  // Ein Zeitstempel plus Zufallsteil reicht: der Schlüssel muss nur innerhalb
  // des eigenen Ordners eindeutig sein.
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const key = `${PREFIX[kind]}/${userId}/${unique}.${image.extension}`;

  const { data, error } = await supabase.functions.invoke('r2-sign', {
    body: {
      key,
      contentType: image.mimeType,
      cacheControl: CACHE,
      contentLength: buffer.byteLength,
    },
  });
  if (error || !(data as SignResult | null)?.uploadUrl) {
    throw new Error('Der Upload konnte nicht vorbereitet werden.');
  }
  const signed = data as SignResult;

  // Content-Type MUSS exakt dem entsprechen, was signiert wurde — sonst
  // verwirft R2 die Signatur.
  const headers: Record<string, string> = { 'Content-Type': image.mimeType };
  const signedCache = Object.entries(signed.uploadHeaders ?? {}).find(
    ([name]) => name.toLowerCase() === 'cache-control',
  );
  if (signedCache) headers['Cache-Control'] = signedCache[1];

  const put = await fetch(signed.uploadUrl, { method: 'PUT', headers, body: buffer });
  if (!put.ok) {
    throw new Error(`Der Upload ist fehlgeschlagen (${put.status}).`);
  }

  return signed.publicUrl;
}

/**
 * Auswählen und hochladen in einem Schritt. Null = abgebrochen.
 *
 * `shape` ist bewusst ein eigener, PFLICHT-Parameter und wird nicht aus `kind`
 * abgeleitet. Jede Aufrufstelle weiß, in welcher Form sie das Bild später
 * zeichnet — und nur sie weiß es. Eine Voreinstellung hier hätte genau den
 * Fehler zurückgebracht, den die Trennung behebt.
 */
export async function pickAndUpload(
  kind: ImageKind,
  shape: CropShape,
): Promise<string | null> {
  const source = await askImageSource();
  if (!source) return null;
  const picked = await pickImage(shape, source);
  if (!picked) return null;
  return uploadImage(picked, kind);
}

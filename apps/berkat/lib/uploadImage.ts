// Bild auswählen und nach R2 laden.
//
// Nutzt dieselbe Edge Function wie Serlo (`r2-sign`) und dieselben erlaubten
// Präfixe — deshalb war am Backend nichts zu ändern. Die Function prüft:
// der Schlüssel muss `<präfix>/<eigene-user-id>/…` lauten, sonst signiert sie
// nicht. Fremde Bilder überschreiben ist damit ausgeschlossen.
//
// Bewusst schlanker als lib/uploadMedia.ts in Serlo: hier gibt es nur Bilder,
// keine Videos, also keine Fast-Start-Prüfung und keine Komprimierung.

import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

/** `products/images` und `thumbnails` sind in r2-sign als Bild-Präfixe erlaubt. */
export type ImageKind = 'article' | 'cover';

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

/**
 * Öffnet die Fotoauswahl. Gibt null zurück, wenn abgebrochen wurde oder die
 * Erlaubnis fehlt — beides ist kein Fehler, sondern eine Entscheidung.
 */
export async function pickImage(square: boolean): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: square ? [1, 1] : [3, 4],
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

/** Auswählen und hochladen in einem Schritt. Null = abgebrochen. */
export async function pickAndUpload(kind: ImageKind): Promise<string | null> {
  const picked = await pickImage(kind === 'article');
  if (!picked) return null;
  return uploadImage(picked, kind);
}

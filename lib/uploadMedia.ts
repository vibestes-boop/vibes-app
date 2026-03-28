import { supabase } from './supabase';
import { useAuthStore } from './authStore';

type UploadResult = {
  url: string;
  path: string;
};

function mimeToExt(mimeType: string): string {
  if (mimeType.includes('png'))       return 'png';
  if (mimeType.includes('webp'))      return 'webp';
  if (mimeType.includes('gif'))       return 'gif';
  if (mimeType.includes('mp4'))       return 'mp4';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('mov'))       return 'mov';
  if (mimeType.includes('video'))     return 'mp4';
  return 'jpg';
}

/**
 * iOS-Fix: fetch('file://...').blob() liefert in React Native 0-byte Blobs.
 * Lösung: FormData mit dem lokalen URI direkt — React Native's multipart-Handler
 * liest file:// URIs korrekt und sendet echte Daten.
 * Upload geht per direktem REST-Call (kein Supabase-Client), Auth-Token aus authStore.
 */
async function uploadToStorage(
  bucket: string,
  filePath: string,
  localUri: string,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  onProgress?.(5);

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: mimeType,
    name: filePath.split('/').pop() ?? 'upload',
  } as unknown as Blob);

  onProgress?.(20);

  // Auth-Token synchron aus Store holen — kein Supabase-Client-Hang
  const session = useAuthStore.getState().session;
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Nicht eingeloggt — kein Auth-Token vorhanden.');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  // Simulierter Upload-Fortschritt
  let simPct = 20;
  const simInterval = setInterval(() => {
    simPct = Math.min(simPct + 10, 90);
    onProgress?.(simPct);
  }, 500);

  // Content-Type NICHT manuell setzen — React Native setzt die Multipart-Boundary automatisch
  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`,
    {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    },
  );

  clearInterval(simInterval);
  onProgress?.(100);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload fehlgeschlagen (${res.status}): ${text.substring(0, 200)}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { url: urlData.publicUrl, path: filePath };
}

/** Post-Medien (Bilder + Videos) → Bucket "posts" */
export async function uploadPostMedia(
  userId: string,
  localUri: string,
  mimeType: string = 'image/jpeg',
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const ext = mimeToExt(mimeType);
  const filePath = `${userId}/${Date.now()}.${ext}`;
  return uploadToStorage('posts', filePath, localUri, mimeType, onProgress);
}

/** Profilbild → Bucket "avatars" */
export async function uploadAvatar(
  userId: string,
  localUri: string,
): Promise<UploadResult> {
  const filePath = `${userId}/avatar.jpg`;

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: 'image/jpeg',
    name: 'avatar.jpg',
  } as unknown as Blob);

  const session = useAuthStore.getState().session;
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Nicht eingeloggt.');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  // upsert=true via query param
  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/avatars/${filePath}?upsert=true`,
    {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Avatar-Upload fehlgeschlagen (${res.status}): ${text.substring(0, 100)}`);
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return { url: urlData.publicUrl, path: filePath };
}

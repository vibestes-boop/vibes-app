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

function isVideo(mimeType: string): boolean {
  return mimeType.includes('video') || mimeType.includes('mp4') || mimeType.includes('mov') || mimeType.includes('quicktime');
}

/**
 * Videos → Cloudflare R2 (0€ Egress-Kosten)
 * Bilder → Supabase Storage (klein, günstig)
 *
 * Flow für Videos:
 * 1. Supabase Edge Function `r2-sign` gibt Presigned PUT URL zurück
 * 2. App lädt Video direkt zu R2 hoch (kein Secret im Client)
 * 3. Öffentliche R2-URL wird in posts.media_url gespeichert
 */
async function uploadVideoToR2(
  userId: string,
  localUri: string,
  mimeType: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  onProgress?.(5);

  const ext = mimeToExt(mimeType);
  const key = `${userId}/${Date.now()}.${ext}`;

  // 1) Presigned URL von Edge Function holen
  const session = useAuthStore.getState().session;
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Nicht eingeloggt.');

  const { data: signData, error: signError } = await supabase.functions.invoke('r2-sign', {
    body: { key, contentType: mimeType },
  });

  if (signError || !signData?.uploadUrl) {
    throw new Error(`R2 Sign-Fehler: ${signError?.message ?? 'Keine uploadUrl'}`);
  }

  const { uploadUrl, publicUrl } = signData as { uploadUrl: string; publicUrl: string };
  onProgress?.(15);

  // 2) Bug 2 Fix: Presigned PUT erwartet raw binary body, KEIN FormData.
  //    FormData ändert den Content-Type auf multipart/form-data → R2 SignatureDoesNotMatch.
  //    Lösung: Datei als Blob laden und direkt als body übergeben.
  const fileRes = await fetch(localUri);
  const fileBlob = await fileRes.blob();
  onProgress?.(20);

  // Simulierter Fortschritt während Upload
  let simPct = 20;
  const simInterval = setInterval(() => {
    simPct = Math.min(simPct + 8, 90);
    onProgress?.(simPct);
  }, 600);

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: fileBlob,
  });

  clearInterval(simInterval);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 Upload fehlgeschlagen (${res.status}): ${text.substring(0, 200)}`);
  }

  onProgress?.(100);
  return { url: publicUrl, path: key };
}

/**
 * Bilder → Supabase Storage (original, bewährt)
 */
async function uploadImageToSupabase(
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

  const session = useAuthStore.getState().session;
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Nicht eingeloggt.');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  let simPct = 20;
  const simInterval = setInterval(() => {
    simPct = Math.min(simPct + 10, 90);
    onProgress?.(simPct);
  }, 500);

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

/** Post-Medien: Videos → R2, Bilder → Supabase */
export async function uploadPostMedia(
  userId: string,
  localUri: string,
  mimeType: string = 'image/jpeg',
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  if (isVideo(mimeType)) {
    return uploadVideoToR2(userId, localUri, mimeType, onProgress);
  }
  const ext = mimeToExt(mimeType);
  const filePath = `${userId}/${Date.now()}.${ext}`;
  return uploadImageToSupabase('posts', filePath, localUri, mimeType, onProgress);
}

/** Profilbild → Supabase Storage (Avatare sind klein, kein Traffic-Problem) */
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

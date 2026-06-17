// lib/bunny.ts — Bunny Stream HLS-Helfer.
//
// Library 685822, CDN-Host vz-6857f4f1-6d5.b-cdn.net. Aus einer Bunny-Video-guid
// die HLS-Playlist-URL bauen. Der Player probiert HLS und fällt bei Fehler
// (noch nicht transkodiert / kaputt) auf die R2-URL zurück.
export const BUNNY_CDN_HOST = 'vz-6857f4f1-6d5.b-cdn.net';

export function bunnyHlsUrl(guid: string | null | undefined): string | null {
  if (!guid) return null;
  return `https://${BUNNY_CDN_HOST}/${guid}/playlist.m3u8`;
}

// lib/bunny.ts — Bunny Stream HLS-Helfer.
//
// Library 685822, CDN-Host vz-6857f4f1-6d5.b-cdn.net. Aus einer Bunny-Video-guid
// die HLS-Playlist-URL bauen. Der Player probiert HLS und fällt bei Fehler
// (noch nicht transkodiert / kaputt) auf die R2-URL zurück.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUNNY_STREAM_ENABLED } from './bunnyConfig';

// Schalter und Begründung: lib/bunnyConfig.ts (Bunny ist seit 31.10.2026 aus)
export { BUNNY_STREAM_ENABLED };

export const BUNNY_CDN_HOST = 'vz-6857f4f1-6d5.b-cdn.net';

// Intern veränderlich nur für Tests (__resetBunnyHealth)
let streamEnabled = BUNNY_STREAM_ENABLED;

export function bunnyHlsUrl(guid: string | null | undefined): string | null {
  if (!guid) return null;
  return `https://${BUNNY_CDN_HOST}/${guid}/playlist.m3u8`;
}

// ── Ist Bunny erreichbar? ────────────────────────────────────────────────────
// Ist die ganze Pull-Zone gesperrt (Oktober 2026: „Domain suspended", HTTP 403),
// scheitert jeder HLS-Versuch erst nach einer Netzrunde, und der Player baut
// sich danach mit der R2-Datei neu auf. Das kostete jedes Video Startzeit.
// Darum schaltet ein 403 HLS für eine halbe Stunde ab (über Neustarts gemerkt).
// Danach prüft eine einzelne Abfrage, ob Bunny wieder da ist; erst wenn sie
// gelingt, spielen neue Videos wieder HLS. Ein Konto-Problem bei Bunny braucht
// so kein App-Update, weder beim Ausfall noch bei der Rückkehr.
const DOWN_KEY = 'bunny-hls-down-until-v1';
export const BUNNY_DOWN_FOR_MS = 30 * 60 * 1000;
// Fehler einzelner Videos (z. B. noch nicht fertig umgewandelt) nicht bei jedem
// Video neu prüfen
const RECHECK_GAP_MS = 60 * 1000;

let downUntil = 0;
let probing: Promise<void> | null = null;
let lastProbeAt = 0;

AsyncStorage.getItem(DOWN_KEY)
  .then((v) => {
    const until = Number(v);
    if (until > downUntil) downUntil = until;
  })
  .catch(() => { /* ohne gespeicherten Stand: HLS versuchen */ });

/** Darf ein neu startendes Video HLS nehmen? */
export function bunnyHlsAllowed(): boolean {
  return streamEnabled && bunnyZoneHealthy();
}

/** Antwortet die Pull-Zone (kein 403 in der letzten halben Stunde)? */
export function bunnyZoneHealthy(): boolean {
  return downUntil === 0;
}

function markDown() {
  downUntil = Date.now() + BUNNY_DOWN_FOR_MS;
  AsyncStorage.setItem(DOWN_KEY, String(downUntil)).catch(() => {});
}

function markUp() {
  if (downUntil === 0) return;
  downUntil = 0;
  AsyncStorage.removeItem(DOWN_KEY).catch(() => {});
}

/** Fragt eine Playlist direkt ab und entscheidet für die ganze Zone. */
export function probeBunny(guid: string): Promise<void> {
  const url = bunnyHlsUrl(guid);
  if (!url) return Promise.resolve();
  if (probing) return probing;
  lastProbeAt = Date.now();
  probing = fetch(url)
    .then((res) => {
      // 403 = Zone gesperrt oder Direktzugriff verboten → betrifft alle Videos.
      // 404 & Co. betreffen nur dieses eine Video und ändern nichts.
      if (res.status === 403) markDown();
      else if (res.ok) markUp();
    })
    .catch(() => { /* offline: nichts entscheiden */ })
    .finally(() => { probing = null; });
  return probing;
}

/** Vom Player, wenn HLS scheitert: einmal prüfen, ob die ganze Zone hängt. */
export function reportBunnyHlsError(guid: string): void {
  if (!streamEnabled) return;
  if (Date.now() - lastProbeAt < RECHECK_GAP_MS) return;
  void probeBunny(guid);
}

/** Ist die Sperrzeit um, im Hintergrund nachsehen, ob Bunny wieder läuft. */
export function recheckBunnyIfDue(guid: string): void {
  if (!streamEnabled) return;
  if (downUntil !== 0 && Date.now() >= downUntil) void probeBunny(guid);
}

/** Nur für Tests */
export function __resetBunnyHealth(opts: { enabled?: boolean } = {}): void {
  downUntil = 0;
  probing = null;
  lastProbeAt = 0;
  streamEnabled = opts.enabled ?? BUNNY_STREAM_ENABLED;
}

// lib/bunnyConfig.ts — der Schalter allein, ohne AsyncStorage-Import, damit
// Feed- und Erstellen-Code ihn ohne Nebenwirkung lesen können.
// Bunny ist AUS (Entscheidung Zaur, 31.10.2026): Es war nur ein Gratis-Test, der
// am 01.07.2026 endete; das Konto ist gesperrt, der Speicher gelöscht. Videos
// kommen direkt von R2 (auf dem Handy auf 720p komprimiert). Solange aus: kein
// HLS-Versuch, keine Abfrage der guids, kein Hochladen zu Bunny.
// Wieder an: Konto bezahlen (Auto-Recharge an), alle Videos neu einspielen
// (scripts/backfill-bunny.mjs, die alten guids zeigen ins Leere), hier true, OTA.
export const BUNNY_STREAM_ENABLED = false;

// -----------------------------------------------------------------------------
// Pre-environment Polyfills für Jest (apps/web).
//
// Läuft via `setupFiles` BEVOR jsdom und Jest-Framework geladen werden.
// Hier kommen Web-APIs rein die jsdom nicht liefert aber Next.js-Module
// (next/server, @supabase/ssr, etc.) beim Modul-Load benötigen.
//
// Bewusst minimal gehalten — nur das, was uns beim Test-Run konkret beißt.
// Weitere Polyfills (crypto.subtle, ReadableStream) kommen lazy wenn Tests
// sie brauchen.
// -----------------------------------------------------------------------------

import { TextDecoder, TextEncoder } from 'node:util';

// TextEncoder/TextDecoder: jsdom liefert sie in Node 18+ eigentlich schon,
// aber die Instanzen matchen manchmal nicht die Signatur die @supabase/ssr
// erwartet (Uint8Array vs ArrayBuffer). Expliziter Overwrite vermeidet
// undurchsichtige "TextEncoder is not defined"-Fehler.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}

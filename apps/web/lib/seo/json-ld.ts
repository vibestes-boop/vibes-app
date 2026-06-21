// Sichere JSON-LD-Serialisierung für <script type="application/ld+json">.
//
// `JSON.stringify` escaped `<`/`>`/`&` NICHT. Steckt User-Content (Produkt-
// Titel/Beschreibung, Username, Bio, Caption) im JSON-LD, könnte ein Angreifer
// mit `</script><script>…` aus dem Script-Tag ausbrechen → Stored XSS.
//
// Escapen zu Unicode-Sequenzen bleibt valides JSON (Browser parsen `<`
// als `<`), verhindert aber jeden `</script>`- bzw. `<!--`-Breakout.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

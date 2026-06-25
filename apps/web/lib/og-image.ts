// -----------------------------------------------------------------------------
// Helfer für dynamische OG-Bilder (next/og, edge runtime).
//
// Zwei Fallstricke von Satori/@vercel/og, die zu 0-Byte-OG-Bildern führten
// (WhatsApp/Telegram „Bild lädt nicht"):
//   1. Satori kann WebP-<img> NICHT einbetten — unsere R2-Cover/Avatare sind WebP.
//   2. Verlässt man sich auf Satoris internen Remote-Fetch und der hängt/fehlt,
//      bricht der Render mitten im Stream ab → leerer Body (HTTP 200, 0 Byte).
//
// Lösung: Bild VORAB über den Bild-Proxy images.weserv.nl nach JPEG holen (mit
// Timeout) und als data:-URI einbetten. Schlägt das fehl (Proxy down, Timeout,
// kein Bild), gibt die Funktion `null` zurück → der Aufrufer rendert die Karte
// OHNE Foto (Platzhalter), aber NIE ein leeres Bild.
// -----------------------------------------------------------------------------

const PROXY = 'https://images.weserv.nl';

/** weserv-URL, die ein beliebiges (auch WebP-)Bild nach JPEG konvertiert. */
export function weservJpeg(url: string, w: number, h: number): string {
  const bare = url.replace(/^https?:\/\//, '');
  return `${PROXY}/?url=${encodeURIComponent(bare)}&w=${w}&h=${h}&fit=cover&output=jpg`;
}

/**
 * Lädt ein Bild vorab als JPEG-data-URI (Satori-sicher). Gibt `null` zurück,
 * wenn keine URL, Timeout, Proxy-Fehler o.ä. — Aufrufer rendert dann ohne Foto.
 */
export async function loadImageDataUri(
  url: string | null | undefined,
  w = 600,
  h = 900,
  timeoutMs = 4000,
): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(weservJpeg(url, w, h), { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // base64 ohne Node-Buffer (edge runtime) — in Blöcken, um den Call-Stack
    // bei String.fromCharCode.apply nicht zu sprengen.
    let binary = '';
    const CHUNK = 0x2000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(
        ...(bytes.subarray(i, i + CHUNK) as unknown as number[]),
      );
    }
    return `data:image/jpeg;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

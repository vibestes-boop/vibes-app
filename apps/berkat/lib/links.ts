// Wo Berkat im Netz steht.
//
// Eine einzige Stelle, weil sich das noch ändern wird: Aktuell läuft die Seite
// unter der kostenlosen Adresse von Cloudflare Pages. Kommt später eine eigene
// Domain dazu, ist es hier eine Zeile — plus die zwei Variablen der
// Bezahl-Function, siehe `apps/berkat-web/README.md`.
//
// Vorher stand hier `berkat.app`. Diese Domain gehört jemand anderem: am
// 19.06.2026 über Cloudflare registriert, ebenso `berkat.store` am 05.08.2026,
// und `berkat.pages.dev` ist auch schon vergeben. Da baut jemand parallel unter
// demselben Namen. Jeder geteilte Link schickte Empfänger also auf eine fremde
// Seite — heute leer, morgen vielleicht nicht. Deshalb raus damit.

export const SITE_URL = 'https://berkat-live.pages.dev';

/** Adresse, unter der eine laufende Show geteilt wird. */
export function showLink(sessionId: string): string {
  return `${SITE_URL}/live/${sessionId}`;
}

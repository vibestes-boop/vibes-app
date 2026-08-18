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

/**
 * Adresse, unter der eine laufende Show geteilt wird.
 *
 * Die Kennung steht als Parameter, nicht im Pfad. Cloudflare Pages räumt
 * Adressen auf und macht aus `/live.html` die saubere Form `/live` — statt
 * still umzuschreiben schickt es eine echte Weiterleitung, und die wirft den
 * Pfadteil mit der Kennung weg. Am 14.08. auf der veröffentlichten Seite
 * nachgemessen: `/live/<id>` antwortete mit 308 auf `/live`, ohne Kennung.
 */
export function showLink(sessionId: string): string {
  return `${SITE_URL}/live?id=${encodeURIComponent(sessionId)}`;
}

/**
 * Adresse, unter der ein Angebot geteilt wird.
 *
 * Derselbe Grund für den Parameter statt des Pfads wie bei `showLink` —
 * Cloudflare Pages wirft bei der Weiterleitung den Pfadteil weg.
 *
 * Das ist der Kanal, über den diese Community heute tatsächlich handelt:
 * WhatsApp-Gruppen. Ein Verkäufer, der sein Angebot nicht in seine Gruppe
 * werfen kann, stellt es dort ein statt hier.
 */
export function listingLink(auctionId: string): string {
  return `${SITE_URL}/listing?id=${encodeURIComponent(auctionId)}`;
}

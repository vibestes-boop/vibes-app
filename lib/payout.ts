/**
 * lib/payout.ts — Creator-Auszahlung: Geld-Mathe als getestete pure Funktionen.
 *
 * Extrahiert aus app/creator/payout-request.tsx, damit die Diamanten→Euro-Umrechnung
 * (hier verlässt echtes Geld das System) unit-testbar ist und nicht im Screen vergraben
 * liegt. Wert-identisch zur vorherigen Inline-Logik (RATE 0.02, Min 2500).
 */

/** Wechselkurs: 1 Diamant = 2 Cent. */
export const DIAMOND_RATE_EUR = 0.02;

/** Mindest-Guthaben für eine Auszahlung (2500 Diamanten = 50,00 €). */
export const MIN_PAYOUT_DIAMONDS = 2500;

/**
 * Auszahlbetrag in Euro, auf 2 Nachkommastellen gerundet — exakt der Wert, der als
 * `euro_amount` in `payout_requests` geschrieben wird. `toFixed` fängt Float-Drift ab
 * (z. B. 7 × 0,02 = 0.14000000000000001 → 0.14).
 */
export function payoutEuroAmount(diamonds: number): number {
  return parseFloat((diamonds * DIAMOND_RATE_EUR).toFixed(2));
}

/** Anzeige-String im de-DE-Format, z. B. "50,00 €". */
export function formatPayoutEuro(diamonds: number): string {
  return (
    (diamonds * DIAMOND_RATE_EUR).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'
  );
}

/** Auszahlbar, sobald das Guthaben den Mindestbetrag erreicht. */
export function isPayoutEligible(diamonds: number): boolean {
  return diamonds >= MIN_PAYOUT_DIAMONDS;
}

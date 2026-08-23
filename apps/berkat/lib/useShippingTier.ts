/**
 * Versandstufen — was ein Artikel für den Weg zum Käufer braucht
 * ============================================================================
 *
 * Bis zum 23.08.2026 kannte Berkat EINE Pauschale je Zone (DE 4,90 €). Bei
 * 6-€-Secondhand ist das der halbe Kaufpreis — zwischen 1,19 € Brief und einer
 * Paketpauschale liegt bei einem Kopftuch der Unterschied zwischen kaufbar und
 * unverkäuflich.
 *
 * ⚠️ DIE STUFE IST EINE ANGABE DES VERKÄUFERS, KEINE WAHL DES KÄUFERS.
 *
 * Zwei Gründe, und der zweite ist hart:
 *   • Nur der Verkäufer weiss, was er in der Hand hält.
 *   • **Stripe Checkout erlaubt höchstens FÜNF Versandoptionen.** Drei Länder
 *     mal vier Stufen wären zwölf — die Kasse würde beim Öffnen scheitern.
 *     Die Kasse zeigt deshalb weiter drei Optionen (eine je Land), nur ist ihr
 *     Betrag jetzt von der Ware abhängig.
 *
 * Die Stufe eines KORBS ist die höchste seiner Artikel: Ein Kopftuch und ein
 * Paar Schuhe gehen zusammen in ein Paket. Gerechnet wird das serverseitig in
 * `get_cart_shipping_options` (`20260823140000`) — hier steht nur die
 * Beschriftung.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

export type ShippingTier = 1 | 2 | 3 | 4;

/**
 * ⚠️ BESCHRIFTET ALS GEGENSTAND, NICHT ALS GRAMM.
 *
 * Das ist Whatnots eigentliche Erfindung an dieser Stelle (Analyse 9), nicht
 * die Staffelung selbst: „bis 500 g" muss ein Verkäufer erst schätzen — und
 * schätzt falsch. „Tuch, Shirt" muss er nur wiedererkennen.
 *
 * Die Beträge stehen NICHT hier, sondern in `berkat_shipping_rates`. Ein Preis
 * an zwei Orten ist ein Preis, der auseinanderläuft — und der Verkäufer kann
 * eigene Sätze hinterlegen, die diese Vorgaben schlagen.
 */
export const SHIPPING_TIERS: { tier: ShippingTier; label: string; examples: string }[] = [
  { tier: 1, label: 'Brief',       examples: 'Kopftuch, Schmuck, Kleinteil' },
  { tier: 2, label: 'Großbrief',   examples: 'Tuch, Shirt, dünne Kleidung' },
  { tier: 3, label: 'Paket',       examples: 'Schuhe, Buch, Parfüm' },
  { tier: 4, label: 'Paket groß',  examples: 'Abaya, Mantel, mehrere Teile' },
];

export function tierLabel(tier: number | null | undefined): string | null {
  if (tier == null) return null;
  return SHIPPING_TIERS.find((t) => t.tier === tier)?.label ?? null;
}

/**
 * Setzt die Stufe an einem Angebot.
 *
 * ⚠️ EIGENE RPC, KEIN PARAMETER AN `create_standing_listing`. Die Funktion
 * wird seit dem 21.08. aus TestFlight gerufen; ein zusätzlicher Parameter wäre
 * eine Signatur-Änderung, und zwei Überladungen machen PostgREST mehrdeutig
 * (HTTP 300, Übergabe 63). Der Composer ruft sie nach dem Anlegen — dasselbe
 * Muster wie `move_listing_to_show`.
 *
 * Schlägt der zweite Ruf fehl, liegt das Angebot mit `shipping_tier = NULL`
 * im Regal und wird als grosses Paket abgerechnet. Der harmlose Ausgang: im
 * Zweifel teurer für den Käufer statt draufzahlen für den Verkäufer.
 */
export function useSetShippingTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ auctionId, tier }: { auctionId: string; tier: ShippingTier | null }) => {
      const { error } = await supabase.rpc('set_listing_shipping_tier', {
        p_auction_id: auctionId,
        p_tier: tier,
      });
      if (error) throw new Error(shippingTierError(error.message));
    },
    onSuccess: () => {
      // Die Stufe steht an der Karte und auf der Artikelseite — beide Flächen
      // lesen `['berkat','listing']` bzw. die Regal-Abfragen.
      void qc.invalidateQueries({ queryKey: ['berkat', 'listing'] });
      void qc.invalidateQueries({ queryKey: ['berkat', 'standing'] });
      void qc.invalidateQueries({ queryKey: ['berkat', 'shop'] });
    },
  });
}

export function shippingTierError(raw: string): string {
  if (raw.includes('listing_not_found')) return 'Dieses Angebot gibt es nicht mehr.';
  if (raw.includes('listing_closed')) return 'Das Angebot ist schon verkauft — der Versand steht fest.';
  if (raw.includes('bad_tier')) return 'Diese Versandart kennen wir nicht.';
  if (raw.includes('not_authenticated')) return 'Melde dich an, um das zu ändern.';
  return 'Die Versandart ließ sich nicht speichern.';
}

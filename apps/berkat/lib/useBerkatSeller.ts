// Privat oder gewerblich — der Anbietertyp eines Verkäufers.
//
// WARUM DAS KEIN EINSTELLUNGS-DETAIL IST
// Ein Privatverkauf hat kein Widerrufsrecht und die Gewährleistung ist
// ausschließbar; ein gewerblicher hat beides und dazu Impressumspflicht.
// Art. 246d § 1 EGBGB verlangt, dass der Käufer VOR seiner Vertragserklärung
// erfährt, mit wem er es zu tun hat. Die Angabe gehört deshalb an jedes Angebot,
// nicht in eine Einstellung, die niemand findet.
//
// ⚠️ WAS DIE APP DABEI NICHT TUT
// Sie stellt KEINEN Gewährleistungsausschluss bereit. Ein von der Plattform
// vorformulierter Standardsatz wäre eine AGB im Sinne der §§ 305 ff. BGB — auch
// zwischen Privatleuten. Ein pauschaler Ausschluss erfasst in kundenfeindlichster
// Auslegung auch Körperschäden und grobe Fahrlässigkeit und ist damit nach
// § 309 Nr. 7 BGB unwirksam; eine geltungserhaltende Reduktion gibt es nicht,
// der Ausschluss fiele VOLLSTÄNDIG weg. Der Privatverkäufer stünde am Ende
// schlechter da als ohne unsere „Hilfe".
//
// Berkat kennzeichnet deshalb nur, WER verkauft, und sagt, was daraus folgt.
// Den Text stellt der Verkäufer selbst.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type SellerKind = 'private' | 'business';

export type BerkatSeller = {
  user_id: string;
  kind: SellerKind;
  legal_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  contact_email: string | null;
  vat_id: string | null;
  lucid_id: string | null;
  /**
   * Darf über die Kasse verkaufen.
   *
   * ⚠️ Kein Formularfeld und kein Parameter der RPC. Läuft das Geld eines
   * fremden Verkäufers über das Stripe-Konto des Betreibers, ist das nach ZAG
   * erlaubnispflichtig — wer darüber verkaufen darf, entscheidet der Betreiber
   * nach einer Prüfung, nicht der Verkäufer über ein Häkchen.
   */
  checkout_enabled: boolean;
};

const COLUMNS =
  'user_id, kind, legal_name, street, postal_code, city, country, ' +
  'contact_email, vat_id, lucid_id, checkout_enabled';

/**
 * Der Anbietertyp eines beliebigen Verkäufers — für die Kennzeichnung am
 * Angebot und den Impressumsblock auf dem Profil.
 *
 * Die Tabelle ist offen lesbar, und das ist richtig: Bei einem gewerblichen
 * Verkäufer sind Name und Anschrift gesetzlich öffentlich, bei einem privaten
 * steht außer `kind` nichts drin.
 */
export function useBerkatSeller(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['berkat', 'seller-kind', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<BerkatSeller | null> => {
      const { data, error } = await supabase
        .from('berkat_sellers')
        .select(COLUMNS)
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as BerkatSeller) ?? null;
    },
  });
}

export type SellerDeclaration = {
  kind: SellerKind;
  legalName?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  contactEmail?: string | null;
  vatId?: string | null;
  lucidId?: string | null;
};

/**
 * Den eigenen Anbietertyp erklären.
 *
 * Der Server zieht dabei alle noch OFFENEN eigenen Angebote nach — verkaufte
 * nie. Ein geschlossener Kauf behält den Stand vom Vertragsschluss, sonst
 * änderte eine spätere Umstufung rückwirkend die Rechtslage abgeschlossener
 * Geschäfte.
 */
export function useDeclareSellerKind(userId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'seller-kind', userId] });
    // Der Anbietertyp steht am Angebot. Wer ihn ändert, ändert damit jede
    // Fläche, auf der Angebote liegen — dieselbe Drei-Orte-Regel wie beim
    // zurückgezogenen Dauerangebot (Übergabe Abschnitt 18).
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'standing'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'category-listings'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'shop'] });
  }, [queryClient, userId]);

  return useMutation({
    mutationFn: async (input: SellerDeclaration): Promise<void> => {
      const { error } = await supabase.rpc('set_berkat_seller_kind', {
        p_kind: input.kind,
        p_legal_name: input.legalName ?? null,
        p_street: input.street ?? null,
        p_postal_code: input.postalCode ?? null,
        p_city: input.city ?? null,
        p_country: input.country ?? null,
        p_contact_email: input.contactEmail ?? null,
        p_vat_id: input.vatId ?? null,
        p_lucid_id: input.lucidId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/**
 * Was ein gewerblicher Verkäufer noch nachtragen muss.
 *
 * Bewusst hier und nicht als CHECK in der Datenbank: Eine Datenbank, die einen
 * Verkäufer wegen eines fehlenden Feldes abweist, sperrt ihn aus, statt ihn zu
 * fragen. Die App zeigt stattdessen einen Hinweis — der Riegel gehört in die
 * Oberfläche, wo man ihn erklären kann.
 */
export function missingBusinessFields(seller: BerkatSeller | null): string[] {
  if (!seller || seller.kind !== 'business') return [];
  const fehlt: string[] = [];
  if (!seller.legal_name) fehlt.push('Name oder Firma');
  if (!seller.street) fehlt.push('Straße');
  if (!seller.postal_code) fehlt.push('Postleitzahl');
  if (!seller.city) fehlt.push('Ort');
  if (!seller.contact_email) fehlt.push('E-Mail');
  return fehlt;
}

/** Die sechs Zustände, in der Reihenfolge, in der Kleinanzeigen sie zeigt. */
export const CONDITIONS = [
  { slug: 'neu-mit-etikett', label: 'Neu mit Etikett' },
  { slug: 'neu', label: 'Neu' },
  { slug: 'sehr-gut', label: 'Sehr gut' },
  { slug: 'gut', label: 'Gut' },
  { slug: 'in-ordnung', label: 'In Ordnung' },
  { slug: 'defekt', label: 'Defekt' },
] as const;

/**
 * ⚠️ Slug ist nicht Anzeigename.
 *
 * Sobald ein Wert eine gepflegte Liste bekommt, hört er auf, sein eigener
 * Anzeigename zu sein — genau der Bruch, der am 16.08.2026 die Kategorie-Leiste
 * Slugs anzeigen ließ („beauty" statt „Beauty & Duft").
 */
export function conditionLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return CONDITIONS.find((c) => c.slug === slug)?.label ?? null;
}

/**
 * Der Satz, der am Angebot steht. Kurz, weil ihn sonst niemand liest — und
 * ohne vorformulierten Ausschluss, siehe Kopf dieser Datei.
 */
export function sellerKindNote(kind: SellerKind | null | undefined): string | null {
  if (kind === 'business') return 'Gewerblich · Widerrufsrecht und Gewährleistung';
  if (kind === 'private') return 'Privatverkauf · kein Widerrufsrecht';
  return null;
}

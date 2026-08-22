// Ein Angebot — der Zeilentyp und alle vier Wege, ihn zu holen.
//
// WARUM DIESE DATEI EXISTIERT
// Bis zum 17.08.2026 gab es dieselbe Tabellenzeile in zwei Fassungen:
//
//   `StandingListing` (useStanding.ts)  trug die Beschreibung, aber keine `seller_id`
//   `CategoryListing` (useCategories.ts) trug die `seller_id`, aber keine Beschreibung
//
// Beide unvollständig, und zwar an verschiedenen Stellen. Die Folge war keine
// Theorie: Das Regal auf dem Profil konnte nicht auf ein Angebot verlinken, weil
// ihm die Kennung des Verkäufers fehlte — und die Kategorie-Seite konnte die
// Beschreibung nicht zeigen, weil sie die Spalte nie holte. Ein Verkäufer tippte
// also einen Text, den kein Bildschirm je anzeigte.
//
// Der Kopf des alten `useShop.ts` beschrieb die Gefahr sogar ausdrücklich („wer
// hier eine Spalte ergänzt, muss sie dort mit ergänzen"), statt sie abzuschaffen.
// Eine Warnung ist kein Riegel. Jetzt gilt: **ein Typ, eine Spaltenliste, vier
// Abfragen darauf.** Wer eine Spalte braucht, ergänzt sie an genau einer Stelle,
// und alle vier Flächen haben sie.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { SEARCH_MIN, useDebounced } from './useSellerSearch';

/**
 * Ein Dauerangebot ist keine eigene Tabelle, sondern eine `live_auctions`-Zeile
 * ohne Session (Migration 20260815210000). `cancelled` heißt zurückgezogen,
 * `sold` verkauft — beide bleiben lesbar, siehe `useListing` unten.
 */
export type ListingStatus = 'listed' | 'sold' | 'cancelled';

export type Listing = {
  id: string;
  seller_id: string;
  title: string;
  image_url: string | null;
  /** Der Festpreis. Bei einem Dauerangebot immer gesetzt. */
  buy_now_cents: number;
  /**
   * ALLE Bilder in Reihenfolge (seit 20260817140000, max. 8). `image_url`
   * bleibt das Cover und ist immer `image_urls[0]` — die RPCs halten beide
   * synchron. Karten lesen weiter nur das Cover, die Artikelseite blättert.
   */
  image_urls: string[];
  women_only: boolean;
  /** Nimmt Preisvorschläge an (seit 20260818120000). Vorgabe `false`. */
  accepts_offers: boolean;
  created_at: string;
  status: ListingStatus;
  /**
   * Slug aus `berkat_categories`, NULL = ohne Kategorie. Muss im Typ stehen,
   * seit das Bearbeiten Vollersatz-Semantik hat: Ein Formular, das die
   * Kategorie nicht KENNT, würde sie beim Speichern LÖSCHEN.
   */
  category: string | null;
  /**
   * Seit 20260816210000, alle vier freiwillig.
   *
   * Für ein Angebot ohne Sendung ist die Beschreibung die einzige, die es je
   * geben wird: In einer Show erzählt der Verkäufer, hier steht nur, was er
   * getippt hat. Sie gehört deshalb auf die Artikelseite und nicht in eine
   * Zeile, die nach zwei Wörtern abschneidet.
   */
  description: string | null;
  /** Slug aus `CONDITIONS` in `useBerkatSeller.ts` — nicht der Anzeigename. */
  condition: string | null;
  /**
   * Größe als FREITEXT (seit 20260819100000, max. 24 Zeichen): „42", „M", „74",
   * „One Size", „38/40".
   *
   * Bewusst keine gepflegte Liste und ausdrücklich KEIN Varianten-System:
   * `live_auctions` hat kein `stock`, ein Angebot ist genau ein Stück. Varianten
   * setzen Mengenführung samt atomarem Dekrement voraus, sonst verkauft man
   * Größe M zweimal — und der Markt ist Secondhand, wo es jedes Stück einmal
   * gibt. Begründung: HANDOFF 41, Migration 20260819100000.
   *
   * Vorher stand die Größe bei neun von 36 Artikeln IM TITEL. Das war nicht
   * filterbar, nicht vergleichbar, und es fraß den Platz, den der Titel für die
   * Sache selbst braucht.
   */
  size: string | null;
  postal_code: string | null;
  city: string | null;
  /**
   * Anbietertyp zum Zeitpunkt des Einstellens. NULL = noch nicht erklärt.
   *
   * Art. 246d § 1 EGBGB verlangt die Angabe, BEVOR der Käufer seine
   * Vertragserklärung abgibt. Seit dem 17.08.2026 ist das genau ein Ort: die
   * Artikelseite. Vorher lag der Kaufknopf im Stöber-Raster, wo für den ganzen
   * Satz kein Platz war — die Karte zeigte deshalb nur ein Etikett ohne
   * Rechtsfolge, und die stand nirgends.
   */
  seller_kind: 'private' | 'business' | null;
};

/**
 * ⚠️ Die eine Spaltenliste. Sie steht mit dem Typ oben in genau einer Datei,
 * damit beide nicht auseinanderlaufen können — am 16.08.2026 ist genau diese
 * Doppelung zweimal schiefgegangen (ein Bild wurde geholt und weggeworfen,
 * weil der Zeilentyp es nicht trug).
 */
const LISTING_COLUMNS =
  'id, seller_id, title, image_url, image_urls, buy_now_cents, women_only, accepts_offers, ' +
  'created_at, status, category, description, condition, size, postal_code, city, seller_kind';

/**
 * Die Regal-Grenze, in jeder Listen-Abfrage dieselbe.
 *
 * `session_id is null` trennt Regal von Show: Ohne den Filter kämen
 * Show-Artikel mit, sobald sie denselben Status trügen.
 */
function shelfQuery() {
  return supabase
    .from('live_auctions')
    .select(LISTING_COLUMNS)
    .is('session_id', null)
    .eq('status', 'listed');
}

/** supabase-js bildet die lange Spaltenliste nicht mehr auf einen Zeilentyp ab. */
function asListings(data: unknown): Listing[] {
  return (data ?? []) as unknown as Listing[];
}

/**
 * Alles Kaufbare über alle Verkäufer — die Marktplatz-Ansicht.
 *
 * Kein Realtime-Abo: Eine Übersicht mit vielen Zeilen darf keine dauerhafte
 * Verbindung je Zeile aufmachen (Kostenhygiene). Nachgeladen wird beim Fokus,
 * wie überall sonst — die Stack-Falle aus HANDOFF 3 gilt hier genauso.
 */
export function useShopListings(limit = 60, enabled = true) {
  return useQuery({
    queryKey: ['berkat', 'shop', limit],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<Listing[]> => {
      const { data, error } = await shelfQuery()
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return asListings(data);
    },
  });
}

/**
 * Wie viele Angebote es überhaupt gibt — die Zahl für den Leerzustand der
 * Startseite.
 *
 * Eine eigene, winzige Abfrage statt `useShopListings().length`: Die Startseite
 * ist der Bildschirm, den jeder als Ersten sieht, und sie soll nicht sechzig
 * Zeilen laden, um einen Satz zu formulieren. `head: true` überträgt keine
 * einzige Zeile — dasselbe Muster wie beim Bestell-Abzeichen am Verkaufen-Reiter.
 *
 * Fehler schlucken statt werfen: Ein fehlender Hinweis ist ärgerlich, eine
 * kaputte Startseite wäre schlimmer.
 */
export function useShopCount() {
  return useQuery({
    queryKey: ['berkat', 'shop-count'],
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('live_auctions')
        .select('id', { count: 'exact', head: true })
        .is('session_id', null)
        .eq('status', 'listed');
      if (error) {
        if (__DEV__) console.warn('[Berkat] Angebote zählen:', error.message);
        return 0;
      }
      return count ?? 0;
    },
  });
}

/**
 * Was in einer Kategorie liegt.
 *
 * `slugs` ist eine Liste und kein einzelner Wert: Wer eine Oberkategorie
 * öffnet, will auch sehen, was in ihren Kindern liegt — sonst wäre „Mode" leer,
 * während unter „Abaya" drei Artikel hängen.
 */
export function useCategoryListings(slugs: string[]) {
  // Stabiler Schlüssel: Ohne das Sortieren käme bei jeder Neuberechnung des
  // Aufrufers eine andere Reihenfolge und damit ein anderer Query-Key heraus —
  // die Abfrage liefe bei jedem Render neu.
  const key = useMemo(() => [...slugs].sort().join(','), [slugs]);

  return useQuery({
    queryKey: ['berkat', 'category-listings', key],
    enabled: slugs.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Listing[]> => {
      const { data, error } = await shelfQuery()
        .in('category', slugs)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return asListings(data);
    },
  });
}

/** Was dieser Verkäufer gerade dauerhaft anbietet — sein Regal. */
export function useSellerListings(sellerId: string | undefined) {
  return useQuery({
    // Der Schlüssel heißt weiter `standing`: `useStandingActions.invalidate()`
    // setzt ihn zurück, und ein Umbenennen wäre eine stille Regression an genau
    // der Stelle, die am 16.08. schon einmal falsch war.
    queryKey: ['berkat', 'standing', sellerId],
    enabled: Boolean(sellerId),
    staleTime: 30_000,
    queryFn: async (): Promise<Listing[]> => {
      const { data, error } = await shelfQuery()
        .eq('seller_id', sellerId!)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return asListings(data);
    },
  });
}

/**
 * Ein einzelnes Angebot — die Artikelseite.
 *
 * ⚠️ Hier steht bewusst **kein** `status`-Filter. Die Lese-Policy
 * `live_auctions_select_standing` erlaubt jede Zeile ohne Session, nicht nur
 * die offenen — und das ist die Voraussetzung dafür, dass ein verkaufter oder
 * zurückgezogener Artikel „schon weg" sagen kann statt „gibt es nicht".
 *
 * Der Unterschied zählt: Wer aus einer Nachricht auf einen Artikel kommt, den
 * jemand vor zehn Minuten gekauft hat, soll das erfahren — und nicht auf einer
 * Fehlerseite landen, die aussieht, als sei die App kaputt.
 *
 * Frauen-Only bleibt trotzdem geschützt: Die Policy verlangt zusätzlich
 * `women_only = false OR seller_id = auth.uid() OR is_women_only_verified()`.
 * Ein geschützter Artikel kommt hier als `null` zurück, also als „gibt es
 * nicht" — dieselbe Sprache, die auch `buy_now_live_auction` seit
 * 20260816210000 spricht, damit die Existenz nicht über die Antwort durchsickert.
 */
export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'listing', id],
    enabled: Boolean(id),
    staleTime: 15_000,
    queryFn: async (): Promise<Listing | null> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select(LISTING_COLUMNS)
        .eq('id', id!)
        .is('session_id', null)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Listing) ?? null;
    },
  });
}

/**
 * Mehrere Angebote auf einmal — für die Produktkarten in einem Chat-Verlauf.
 *
 * ⚠️ EINE Abfrage für die ganze Unterhaltung, nicht eine je Nachricht. In der
 * Regel ist es genau ein Artikel; bei einem Menschen, der über Wochen nach
 * fünf Sachen fragt, sind es fünf. Ein `useListing()` je Blase wären so viele
 * Abfragen wie Nachrichten — die Kostenhygiene-Sünde aus HANDOFF 4.
 *
 * `session_id IS NULL` wie überall im Regal-Pfad: Ein Artikel, der inzwischen
 * in einer Show liegt, gehört dort und nicht in eine Chat-Karte.
 *
 * Ein geschütztes (Frauen-Only) oder gelöschtes Angebot fehlt in der Antwort
 * einfach — die Karte rendert dann nichts, der Text der Nachricht bleibt.
 */
export function useListingsByIds(ids: string[]) {
  const key = [...new Set(ids)].sort().join(',');
  return useQuery({
    queryKey: ['berkat', 'listings-by-ids', key],
    enabled: key.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, Listing>> => {
      const unique = key.split(',');
      const { data, error } = await supabase
        .from('live_auctions')
        .select(LISTING_COLUMNS)
        .in('id', unique)
        .is('session_id', null);
      // Fällt sie aus, fehlen Karten — der Verlauf bleibt vollständig.
      if (error) return new Map();
      const map = new Map<string, Listing>();
      for (const row of (data ?? []) as unknown as Listing[]) map.set(row.id, row);
      return map;
    },
  });
}

/**
 * Die Bild-Liste eines Angebots — mit Netz für Zeilen von vor dem Backfill.
 * Eine leere Liste heißt wirklich „kein Bild", nie „Liste vergessen".
 */
export function listingImages(l: Pick<Listing, 'image_url' | 'image_urls'>): string[] {
  if (l.image_urls?.length) return l.image_urls;
  return l.image_url ? [l.image_url] : [];
}

/**
 * Artikel per Titel suchen — die zweite Hälfte des Suchfelds.
 *
 * `search_berkat_sellers` findet Menschen; das hier findet Ware. Bewusst KEINE
 * RPC: Die Regal-Zeilen sind für jeden lesbar (auch ohne Anmeldung — anders
 * als die Verkäufer-Suche, die für `anon` gesperrt ist), also reicht ein
 * `ilike` über die bestehende RLS. Ein Trigram-Index kommt, wenn die
 * Angebotszahl ihn je verlangt.
 *
 * `%` und `_` werden escaped — sonst wäre „100%" ein Joker statt einer Suche.
 */
export function useListingSearch(query: string) {
  const settled = useDebounced(query.trim());
  const q = settled.replace(/[\\%_]/g, (m) => `\\${m}`);

  return useQuery({
    queryKey: ['berkat', 'listing-search', settled],
    enabled: settled.length >= SEARCH_MIN,
    staleTime: 30_000,
    queryFn: async (): Promise<Listing[]> => {
      const { data, error } = await shelfQuery()
        .ilike('title', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return asListings(data);
    },
  });
}

/**
 * Angebote zu einer ID-Liste — für die Merkliste.
 *
 * Bewusst OHNE Status-Filter: Ein gemerkter Artikel, der verkauft wurde, ist
 * genau die Auskunft, für die man eine Merkliste hat. Frauen-Only filtert die
 * RLS; eine gemerkte ID, deren Artikel unsichtbar wurde, fällt still raus.
 */
export async function fetchListingsByIds(ids: string[]): Promise<Listing[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('live_auctions')
    .select(LISTING_COLUMNS)
    .in('id', ids)
    .is('session_id', null);
  if (error) throw error;
  return asListings(data);
}

/**
 * „m" → „M", „xl" → „XL" — „One Size" bleibt „One Size".
 *
 * Konfektionsgrößen schreibt man groß, und niemand greift für einen einzelnen
 * Buchstaben zur Umschalttaste. Die Grenze bei drei Zeichen ist der Punkt, an
 * dem das sicher ist: XS, S, M, L, XL, XXL sind alles, was es an
 * Buchstabengrößen gibt. Ab vier Zeichen ist es ein Wort — und ein Wort zu
 * schreien ist keine Normalisierung. Zahlen bleiben unberührt.
 *
 * ⚠️ Der erste Versuch war `autoCapitalize="characters"` am Eingabefeld. Am
 * Simulator sofort sichtbar geworden, warum das falsch ist: Aus „One Size" wurde
 * „ONE SIZE", und das stünde danach auf jeder Karte. Die Tastatur ist der
 * falsche Ort für eine Regel, die nur für kurze Werte gilt.
 *
 * ⚠️ Steht HIER und nicht in einem der Formulare: Eine Größe entsteht an ZWEI
 * Stellen — im `StandingComposer` (Regal) und im `PrepareSheet` (Show). Zwei
 * Abschriften würden dieselbe Eingabe verschieden speichern, und die
 * Filtergruppe im Regal hätte danach „M" und „m" als zwei Größen.
 */
export function tidySize(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  return /^[a-zA-Z]{1,3}$/.test(v) ? v.toUpperCase() : v;
}

/**
 * Größe, Zustand und Ort als eine Zeile — oder nichts.
 *
 * Die Größe steht VORNE, und das ist keine Geschmacksfrage: Bei Kleidung und
 * Schuhen entscheidet sie zuerst. Ein Artikel in der falschen Größe ist für den
 * Leser erledigt, egal wie gut sein Zustand und wie nah sein Ort ist.
 *
 * „Gr." davor, weil eine nackte „42" neben einem Preis wie eine zweite Zahl
 * aussieht. Bei „One Size" oder „M" wäre das Kürzel überflüssig — es steht
 * trotzdem, weil eine Zeile, die mal so und mal so aussieht, schwerer zu lesen
 * ist als eine gleichförmige.
 */
export function listingMeta(
  listing: Pick<Listing, 'condition' | 'size' | 'postal_code' | 'city'>,
  conditionText: string | null,
): string | null {
  const teile = [
    listing.size ? `Gr. ${listing.size}` : null,
    conditionText,
    [listing.postal_code, listing.city].filter(Boolean).join(' ') || null,
  ].filter(Boolean);
  return teile.length ? teile.join(' · ') : null;
}

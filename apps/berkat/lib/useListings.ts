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
 *
 * `scheduled` ist der vierte Fall und seit dem 25.08.2026 hier drin: ein für
 * einen Abend **vorbereiteter** Artikel (`usePrepared.ts`). Er lag bis dahin
 * ausserhalb dieses Typs, weil keine Stöber-Abfrage ihn je holte — genau das
 * war der Fehler, siehe `browseQuery()`.
 */
export type ListingStatus = 'listed' | 'scheduled' | 'sold' | 'cancelled';

export type Listing = {
  id: string;
  seller_id: string;
  title: string;
  image_url: string | null;
  /**
   * Der Festpreis.
   *
   * ⚠️ **NULLBAR, seit Show-Ware in denselben Typ fällt (25.08.2026).** Die
   * Spalte war das immer (`buy_now_cents int CHECK (… > start_price_cents)`,
   * `20260813150000`) — der Typ log nur nicht, solange hier ausschliesslich
   * Dauerangebote ankamen, und die haben per RPC immer einen Preis. Ein für
   * einen Abend vorbereiteter Artikel braucht keinen: Dort ist der Sofortkauf
   * freiwillig.
   *
   * `number` stehen zu lassen wäre die bequeme Wahl gewesen und genau die
   * Sorte Lüge, die dieses Projekt schon zweimal Geld gekostet hat — ein Typ,
   * der etwas verspricht, das die Datenbank nicht garantiert.
   *
   * ⚠️ Nie direkt anzeigen. `listingPrice()` unten liefert Betrag und Vorsatz
   * („ab") passend zum Zustand.
   */
  buy_now_cents: number | null;
  /**
   * Startpreis der Auktion. Für Regal-Ware ohne Bedeutung, für Show-Ware die
   * einzige Zahl, die es vor dem Abend gibt.
   */
  start_price_cents: number;
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
  /**
   * Versandstufe (1 Brief … 4 grosses Paket), NULL = nicht angegeben.
   * Serverseitig wird NULL als 4 gerechnet — siehe `20260823140000`.
   */
  shipping_tier: number | null;
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
  /**
   * Der Termin, für den dieser Artikel vorbereitet ist. NULL = Regal-Ware.
   *
   * `ON DELETE SET NULL` — bleibt nach dem Live-Gehen als Herkunft stehen,
   * siehe `20260819110000`.
   */
  planned_for: string | null;
  /**
   * Der Termin selbst, per Embed mitgeholt.
   *
   * ⚠️ **NULL heisst hier nicht „kein Termin", sondern „kein SICHTBARER".**
   * `scheduled_lives_select_public` (`20260822180000`) gibt nur `scheduled`,
   * `reminded` und `live` heraus — ein abgesagter oder abgelaufener Abend ist
   * für den Leser gar nicht da. Genau darauf stützt sich `browseQuery()`: Ein
   * vorbereiteter Artikel ohne sichtbaren Abend wird nicht angezeigt, weil
   * „irgendwann in einer Show" keine Auskunft ist.
   */
  show: { scheduled_at: string; title: string; status: string } | null;
};

/**
 * ⚠️ Die eine Spaltenliste. Sie steht mit dem Typ oben in genau einer Datei,
 * damit beide nicht auseinanderlaufen können — am 16.08.2026 ist genau diese
 * Doppelung zweimal schiefgegangen (ein Bild wurde geholt und weggeworfen,
 * weil der Zeilentyp es nicht trug).
 */
const LISTING_COLUMNS =
  'id, seller_id, title, image_url, image_urls, buy_now_cents, start_price_cents, women_only, ' +
  'accepts_offers, created_at, status, category, description, condition, size, postal_code, ' +
  'city, seller_kind, shipping_tier, planned_for, ' +
  // Der Termin per Embed statt als zweite Abfrage: `planned_for` hat einen
  // echten Fremdschlüssel auf `scheduled_lives`, PostgREST löst ihn also auf.
  // Am 25.08.2026 von aussen gegengeprüft (kein PGRST200) — die Falle aus der
  // Serlo-Notiz „Embed ohne FK liefert still []" greift hier nicht.
  'show:scheduled_lives!planned_for(scheduled_at, title, status)';

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

/**
 * Die **Stöber**-Grenze: Regal-Ware UND was für einen Abend vorbereitet ist.
 *
 * ── ⚠️ WARUM ES SIE GEBEN MUSS (25.08.2026) ─────────────────────────────────
 *
 * Bis hierher filterte jede Stöber-Abfrage auf `status = 'listed'`. Ein für
 * Freitag vorbereiteter Artikel stand damit in **keiner** Suche, in keiner
 * Kategorie, in keinem Raster — er war nur zu finden, wenn man den Verkäufer
 * schon kannte und seinen Termin öffnete. Bei Whatnot ist Show-Ware ganz
 * normal auffindbar, mit Datum an der Zeile, und das ist kein Detail: **Es ist
 * ihr Hauptmechanismus, eine Sendung mit Publikum zu füllen.** Man sucht eine
 * Tasche, findet eine, die Freitag drankommt, und merkt sich den Abend.
 *
 * ⚠️ **Getrennt von `shelfQuery()` und nicht statt dessen.** Der naheliegende
 * Weg wäre gewesen, den Status-Filter dort zu erweitern — er hätte fünf
 * Aufrufer auf einmal getroffen, darunter zwei, für die es falsch ist:
 *
 *   `useSellerListings`  → das Verkäufer-Profil zeigt den Termin samt Aufgebot
 *                          bereits als eigenen Block. Show-Ware zusätzlich ins
 *                          Regal zu legen wären zwei Zahlen über dieselben
 *                          Dinge — der Fehler aus Übergabe 86.
 *   `ShelfPickSheet`     → „Aus dem Regal holen" böte sonst Artikel an, die
 *                          schon für einen Abend vorbereitet sind.
 *
 * Deshalb zwei Grenzen mit je einem Zweck, nicht eine mit einem Schalter.
 */
function browseQuery() {
  return supabase
    .from('live_auctions')
    .select(LISTING_COLUMNS)
    .is('session_id', null)
    .or(BROWSABLE);
}

/**
 * Wer im Stöbern erscheinen darf — als PostgREST-Bedingung, nicht als Filter
 * im Client.
 *
 * ```
 * (status = 'listed' AND buy_now_cents IS NOT NULL)  OR  status = 'scheduled'
 * ```
 *
 * ⚠️ **Die Preis-Bedingung ist am 25.08.2026 dazugekommen, und sie ist keine
 * Kosmetik.** `release_prepared_on_plan_end` (`20260824180000`) legt
 * vorbereitete Ware bei abgesagtem Termin zurück ins Regal, **ohne einen Preis
 * zu setzen** — ein vorbereiteter Artikel braucht keinen, ein Regal-Artikel
 * schon. Solche Zeilen standen danach öffentlich im Regal, in der Suche und in
 * ihrer Kategorie, und jeder Kaufweg endete an einem fehlenden Betrag.
 *
 * Der Riegel steht im STÖBERN, nicht an der Zeile: Der Verkäufer sieht seinen
 * Artikel weiterhin im eigenen Regal (`shelfQuery`), auf der Artikelseite
 * (`useListing`) und in seiner Merkliste — und kann dort per „Bearbeiten" den
 * Preis nachtragen. Der Weg zurück existiert also, er ist nur nicht
 * ausgeschildert. Das ist bewusst so entschieden (Übergabe 88, Nachtrag) und
 * bleibt der offene Rest: **Wer unsichtbar wird, erfährt es nicht.**
 *
 * ⚠️ Für `scheduled` gilt die Preisregel NICHT — dort ist der Sofortkauf
 * freiwillig, und der Startpreis trägt die Anzeige („ab X €").
 *
 * Steht als Zeichenkette an EINER Stelle, weil `useShopCount` dieselbe
 * Bedingung braucht: Ein Zähler, der eine andere Menge misst als die Liste
 * darunter, verspricht auf seinem Knopf eine falsche Zahl.
 */
const BROWSABLE =
  'and(status.eq.listed,buy_now_cents.not.is.null),status.eq.scheduled';

/**
 * Vorbereitete Artikel ohne **sichtbaren** Abend aussortieren.
 *
 * Der Auslöser aus `20260824180000` legt sie zurück ins Regal, sobald ein
 * Termin abgesagt oder abgelaufen ist. Das ist die eigentliche Reparatur; das
 * hier ist das Netz darunter — für das Fenster zwischen beidem und für den
 * Fall, dass der Termin per `ON DELETE SET NULL` ganz verschwunden ist.
 *
 * ⚠️ Ohne das stünde eine Karte da, die „in einer Show" sagt und auf die Frage
 * „in welcher?" keine Antwort hat.
 */
function withVisibleShow(rows: Listing[]): Listing[] {
  return rows.filter((l) => l.status !== 'scheduled' || l.show !== null);
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
      const { data, error } = await browseQuery()
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return withVisibleShow(asListings(data));
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
      // ⚠️ DIESELBE Bedingung wie `browseQuery()`, und das ist Pflicht: Die
      // Zahl steht auf einem Knopf („Alle 38 Angebote ansehen"). Zählte sie nur
      // das Regal, verspräche der Knopf weniger, als dahinter liegt — und der
      // Leerzustand der Startseite schickte jemanden weg, obwohl für Freitag
      // zehn Artikel bereitliegen. Zählte sie preislose Zeilen mit, verspräche
      // er mehr.
      //
      // Der Rest-Fehler ist bekannt und klein: Ein vorbereiteter Artikel, dessen
      // Abend nicht mehr sichtbar ist, wird hier mitgezählt und in der Liste
      // dann von `withVisibleShow()` entfernt. `20260824180000` räumt genau die
      // ab; ein `head`-Zähler kann keinen Embed prüfen.
      const { count, error } = await supabase
        .from('live_auctions')
        .select('id', { count: 'exact', head: true })
        .is('session_id', null)
        .or(BROWSABLE);
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
      const { data, error } = await browseQuery()
        .in('category', slugs)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return withVisibleShow(asListings(data));
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
 * Kommt dieser Artikel erst an einem Abend dran, statt jetzt im Regal zu liegen?
 *
 * Die eine Frage, an der die halbe Anzeige hängt — Preisvorsatz, Datumszeile,
 * Kaufknopf. Sie steht hier und nicht als `status === 'scheduled'` an fünf
 * Stellen, damit sie nicht an vieren stimmt und an der fünften nicht.
 */
export function isShowItem(l: Pick<Listing, 'status'>): boolean {
  return l.status === 'scheduled';
}

/**
 * Der Betrag, den die Karte zeigt — und ob ein „ab" davor gehört.
 *
 * ⚠️ Ein Festpreis und ein Startpreis sind **nicht dieselbe Aussage**. „25 €"
 * heisst „dafür gehört es dir", „ab 1 €" heisst „dort fängt das Bieten an".
 * Beide gleich zu setzen wäre die schlimmere Sorte Fehler: Sie sieht nach
 * einem Schnäppchen aus und ist eine Auktion.
 *
 * Bei Show-Ware bleibt der Sofortkauf-Preis bewusst aussen vor. Er ist dort
 * freiwillig, oft 0, und er gehört auf die Artikelseite neben die
 * Rechtsfolge — nicht in ein Stöber-Raster.
 */
export function listingPrice(l: Pick<Listing, 'status' | 'buy_now_cents' | 'start_price_cents'>): {
  /** `null` = es gibt keinen. `formatEuro(null)` schreibt dafür „—". */
  cents: number | null;
  from: boolean;
} {
  // ⚠️ HIER STAND „kein Festpreis → dann eben der Startpreis", und das war
  // falsch — am 25.08.2026 im Screenshot aufgeflogen: Ein Regal-Artikel stand
  // mit „ab 5 €" da. Ein Regal-Artikel ist KEINE Auktion; auf ihn kann niemand
  // bieten. Das „ab" hat einen Weg behauptet, den es nicht gibt.
  //
  // Der Fall ist auch nicht theoretisch, wie ich zuerst geschrieben hatte:
  // `release_prepared_on_plan_end` (`20260824180000`) legt vorbereitete Artikel
  // bei abgesagtem Termin ins Regal, OHNE einen Preis zu setzen — ein
  // vorbereiteter Artikel braucht keinen, ein Regal-Artikel schon. Solche
  // Zeilen sind nicht kaufbar; siehe Übergabe 88, Nachtrag.
  //
  // `null` durchreichen statt raten: „—" sagt „hier steht kein Preis", und das
  // ist die Wahrheit. Jede erfundene Zahl wäre eine Aussage über Geld.
  if (isShowItem(l)) return { cents: l.start_price_cents, from: true };
  return { cents: l.buy_now_cents, from: false };
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
      const { data, error } = await browseQuery()
        .ilike('title', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return withVisibleShow(asListings(data));
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

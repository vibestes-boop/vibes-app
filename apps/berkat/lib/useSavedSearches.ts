// Gespeicherte Suchen — „sag mir Bescheid, wenn so etwas kommt".
//
// WOZU
// Eine erfolglose Suche ist sonst verloren. Wer „Abaya 42" tippt und nichts
// findet, geht — und erfährt nie, dass zwei Tage später genau das eingestellt
// wird. Aus der neunten Whatnot-Analyse (21.08.2026, Korb A); dort merkt
// dieselbe Geste dreierlei: eine Sendung, ein Angebot ODER eine Suche.
//
// ⚠️ Der Wert steigt, je LEERER das Regal ist. Bei Whatnots vollem Bestand ist
// eine gespeicherte Suche Komfort; bei Berkats dünnem ist sie der einzige
// Mechanismus, der einen erfolglosen Besuch in einen späteren verwandelt.
//
// Die Meldung entsteht serverseitig per Trigger (`notify_saved_searches`,
// Migration `20260821120000`) — nicht hier. Der Client legt nur an und löscht.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * Die Filter, die eine gespeicherte Suche mitnimmt — seit 21.09.2026.
 *
 * ⚠️ NICHT dabei: „In einer Show" und die Sortierung.
 *   * Sortieren ordnet, es waehlt nicht aus — es kann keinen Treffer erzeugen
 *     oder verhindern.
 *   * „In einer Show" waere schlimmer als nutzlos: Der Trigger feuert nur auf
 *     REGAL-Ware. Eine Suche mit diesem Haken koennte nie ausloesen, und ein
 *     Filter, der die Benachrichtigung garantiert verstummen laesst, gehoert
 *     nicht in eine Benachrichtigung. Begruendung in `20260921230000`.
 */
export type SavedSearchFilters = {
  category: string | null;
  condition: string | null;
  color: string | null;
  brand: string | null;
  size: string | null;
  city: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
};

export const NO_SAVED_FILTERS: SavedSearchFilters = {
  category: null, condition: null, color: null, brand: null,
  size: null, city: null, minPriceCents: null, maxPriceCents: null,
};

export type SavedSearch = {
  id: string;
  query: string;
  created_at: string;
  last_notified_at: string | null;
} & SavedSearchFilters;

/** Leeres Feld heisst „nicht gesetzt", nicht „auf Leerstring gesetzt". */
function tidy(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/**
 * Wie die Datenbank vergleicht: `lower(btrim(...))`.
 *
 * ⚠️ Muss zum eindeutigen Index in `20260921230000` passen. Rechnet der Client
 * anders, sagt er „noch nicht gespeichert", das INSERT scheitert mit 23505,
 * und der Nutzer liest „hast du schon" direkt nach „speichern" — dieselbe
 * Falle, gegen die `normalizeQuery` oben geschrieben wurde.
 */
function key(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Ist DIESE gespeicherte Zeile genau diese Suche?
 *
 * ⚠️ Text ALLEIN reicht seit den Filtern nicht mehr. Vorher verglich
 * `shop.tsx` nur den Begriff; mit Filtern haette das Lesezeichen bei „Abaya"
 * als gesetzt gegolten, obwohl gespeichert „Abaya in Groesse 38" war — und
 * ein Tipp darauf haette die falsche Zeile geloescht.
 */
export function sameSavedSearch(
  row: SavedSearch, query: string, filters: SavedSearchFilters,
): boolean {
  return key(row.query) === key(query)
    && key(row.category) === key(filters.category)
    && key(row.condition) === key(filters.condition)
    && key(row.color) === key(filters.color)
    && key(row.brand) === key(filters.brand)
    && key(row.size) === key(filters.size)
    && key(row.city) === key(filters.city)
    && (row.minPriceCents ?? null) === (filters.minPriceCents ?? null)
    && (row.maxPriceCents ?? null) === (filters.maxPriceCents ?? null);
}

/** Wie viele Filter diese Zeile traegt — fuer „Abaya · 2 Filter". */
export function savedFilterCount(filters: SavedSearchFilters): number {
  return [
    filters.category, filters.condition, filters.color, filters.brand,
    filters.size, filters.city,
    filters.minPriceCents !== null || filters.maxPriceCents !== null ? 'preis' : null,
  ].filter((v) => v !== null && v !== '').length;
}

/**
 * Die Suche als Adresse — damit ein Tipp in der Merkliste sie samt Filtern
 * wieder aufmacht.
 *
 * ⚠️ Das ist der Weg, den die PUSH-Meldung nicht geht: Sie traegt nur den
 * Begriff (`/shop?q=…`), weil ihre Nutzlast in einer Funktion entsteht, die
 * Serlo mitgehoert. In der App gibt es diese Grenze nicht.
 */
export function savedSearchHref(row: SavedSearch): string {
  const parts: string[] = [`q=${encodeURIComponent(row.query)}`];
  const add = (name: string, value: string | null) => {
    const v = tidy(value);
    if (v) parts.push(`${name}=${encodeURIComponent(v)}`);
  };
  add('cat', row.category);
  add('cond', row.condition);
  add('color', row.color);
  add('brand', row.brand);
  add('size', row.size);
  add('city', row.city);
  if (row.minPriceCents !== null) parts.push(`min=${row.minPriceCents}`);
  if (row.maxPriceCents !== null) parts.push(`max=${row.maxPriceCents}`);
  return `/shop?${parts.join('&')}`;
}

/** Ein Parameter der Adresszeile kann mehrfach vorkommen; der erste gilt. */
type Param = string | string[] | undefined;

/** Die Gegenrichtung — was `shop.tsx` aus seinen Parametern liest. */
export function savedFiltersFromParams(params: {
  cat?: Param; cond?: Param; color?: Param; brand?: Param;
  size?: Param; city?: Param; min?: Param; max?: Param;
}): SavedSearchFilters {
  const one = (raw: Param): string | null => tidy(Array.isArray(raw) ? raw[0] : raw);
  // ⚠️ Nur ganze, nicht-negative Zahlen mit hoechstens neun Stellen. Ein
  // Parameter aus einer Adresszeile ist Fremdeingabe, auch wenn wir ihn
  // selbst geschrieben haben — und die Spalte ist `integer`.
  const cents = (raw: Param): number | null => {
    const value = one(raw);
    return value !== null && /^\d{1,9}$/.test(value) ? Number(value) : null;
  };
  return {
    category: one(params.cat), condition: one(params.cond), color: one(params.color),
    brand: one(params.brand), size: one(params.size), city: one(params.city),
    minPriceCents: cents(params.min), maxPriceCents: cents(params.max),
  };
}

const KEY = ['berkat', 'saved-searches'] as const;

/**
 * Normalisiert wie der eindeutige Index in der Datenbank
 * (`lower(btrim(query))`). Ohne dasselbe Rechnen im Client sähe „ Abaya" wie
 * eine neue Suche aus, und das Anlegen scheiterte am Index statt freundlich
 * „hast du schon" zu sagen — dieselbe Lehre wie bei `tidySize()`
 * (Abschnitt 47): **Eine Schreibregel gehört dorthin, wo der Wert entsteht.**
 */
export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function useSavedSearches(userId: string | null) {
  return useQuery({
    queryKey: [...KEY, userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<SavedSearch[]> => {
      const { data, error } = await supabase
        .from('berkat_saved_searches')
        .select('id, query, created_at, last_notified_at, category, condition, color, brand, size, city, min_price_cents, max_price_cents')
        .order('created_at', { ascending: false })
        // Eine Obergrenze, damit niemand sich hundert Suchen anlegt und
        // anschließend hundert Pushes bekommt. Die Zahl ist großzügig; sie
        // steht hier als Netz, nicht als Regel.
        .limit(50);
      if (error) throw error;
      // Spaltennamen sind Schlangenschrift, der Typ ist Kamelschrift — die
      // Uebersetzung steht an EINER Stelle, damit nicht jeder Aufrufer
      // `min_price_cents` kennen muss.
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        query: row.query as string,
        created_at: row.created_at as string,
        last_notified_at: (row.last_notified_at as string | null) ?? null,
        category: (row.category as string | null) ?? null,
        condition: (row.condition as string | null) ?? null,
        color: (row.color as string | null) ?? null,
        brand: (row.brand as string | null) ?? null,
        size: (row.size as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        minPriceCents: (row.min_price_cents as number | null) ?? null,
        maxPriceCents: (row.max_price_cents as number | null) ?? null,
      }));
    },
  });
}

export function useSavedSearchActions(userId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const save = useMutation({
    mutationFn: async (input: { query: string; filters?: SavedSearchFilters }) => {
      const query = normalizeQuery(input.query);
      const filters = input.filters ?? NO_SAVED_FILTERS;
      if (!userId) throw new Error('not_signed_in');
      if (query.length < 2) throw new Error('too_short');
      const { error } = await supabase
        .from('berkat_saved_searches')
        .insert({
          user_id: userId,
          query,
          category: tidy(filters.category),
          condition: tidy(filters.condition),
          color: tidy(filters.color),
          brand: tidy(filters.brand),
          size: tidy(filters.size),
          city: tidy(filters.city),
          min_price_cents: filters.minPriceCents,
          max_price_cents: filters.maxPriceCents,
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('berkat_saved_searches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}

/**
 * Der Text für den Fehlschlag. Wie überall in Berkat: warm, knapp, und er sagt,
 * was zu tun ist (Design-Gesetz 2).
 *
 * `23505` ist der eindeutige Index — „schon gespeichert" ist kein Fehler,
 * sondern eine Auskunft.
 */
export function savedSearchError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  const message = (err as { message?: string } | null)?.message;
  if (code === '23505') return 'Die hast du schon gespeichert 🙂';
  if (message === 'not_signed_in') return 'Melde dich an, dann merken wir uns die Suche.';
  if (message === 'too_short') return 'Zwei Zeichen brauchen wir mindestens.';
  if (code === '42501') return 'Melde dich an, dann merken wir uns die Suche.';
  return 'Das hat gerade nicht geklappt — probier es gleich noch einmal.';
}

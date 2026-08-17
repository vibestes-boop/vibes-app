// Kategorien — der Baum und was gerade darin liegt.
//
// Zwei Ebenen seit dem 16.08.2026 (Migration 20260816150000). Vorher waren es
// elf flache Kacheln, mit der Begründung „mehr wirken bei fünf Verkäufern
// leer". Das war die falsche Sorge: Whatnot hat nicht dreißig Kacheln, sondern
// dreißig ELTERN mit je fünf bis zehn Kindern. Eine flache Liste zwingt in eine
// Entscheidung, die es nicht gibt — wenige grobe Kacheln (niemand findet etwas)
// oder achtzig feine (niemand scrollt so weit).
//
// Bis zum 16.08. war die Leiste auf der Startseite ohnehin eine Attrappe:
// `useStudio.ts` schrieb bei jeder Show `category: 'shopping'` fest ein.
//
// Die Zähler kommen aus EINEM Aufruf. Eltern rollen ihre Kinder auf — sonst
// stünde auf „Mode" eine Null, während unter „Abaya" drei Shows laufen.
// `get_berkat_category_counts` ist bewusst `SECURITY INVOKER`: Als DEFINER
// würde sie RLS umgehen und Frauen-Only-Shows in den Zählern jedes Fremden
// mitzählen. Schon die Zahl wäre eine Auskunft über einen geschützten Raum.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Category = {
  slug: string;
  name: string;
  /** null = Oberkategorie. Genau zwei Ebenen, der Server erzwingt es. */
  parent_slug: string | null;
  sort_index: number;
  /** Laufende Shows, inklusive Unterkategorien. */
  live_count: number;
  /**
   * Zuschauer, inklusive Unterkategorien.
   *
   * Die Kachel zeigt diese Zahl und nicht `live_count`: „1901 Zuschauer" liest
   * sich als *hier ist was los*, „2 Shows" liest sich als leer.
   */
  viewer_count: number;
  /** Dauerangebote, inklusive Unterkategorien. */
  listing_count: number;
};

export type CategoryNode = Category & { children: Category[] };

function toNumbers(rows: Category[]): Category[] {
  // Die Zähler kommen als bigint und damit je nach Treiber als Zeichenkette.
  return rows.map((c) => ({
    ...c,
    sort_index: Number(c.sort_index ?? 0),
    live_count: Number(c.live_count ?? 0),
    viewer_count: Number(c.viewer_count ?? 0),
    listing_count: Number(c.listing_count ?? 0),
  }));
}

/** Alle aktiven Kategorien, flach, mit Zählern. */
export function useCategories() {
  return useQuery({
    queryKey: ['berkat', 'categories'],
    // Die Liste selbst ändert sich fast nie, die Zähler schon. Eine halbe
    // Minute ist der Kompromiss: frisch genug, dass „3 live" stimmt, ruhig
    // genug, dass ein Reiterwechsel keine Abfrage kostet.
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.rpc('get_berkat_category_counts');
      if (error) {
        if (__DEV__) console.warn('[Berkat] Kategorien laden:', error.message);
        throw error;
      }
      return toNumbers((data ?? []) as Category[]);
    },
  });
}

/**
 * Derselbe Abruf, als Baum — Oberkategorien mit ihren Kindern.
 *
 * Gebaut aus dem Ergebnis von `useCategories`, nicht als zweite Abfrage: Es ist
 * dieselbe Antwort, nur anders sortiert. React Query gibt beiden Aufrufern
 * denselben Zwischenspeicher.
 */
export function useCategoryTree() {
  const query = useCategories();
  const rows = query.data;

  const tree = useMemo((): CategoryNode[] => {
    const all = rows ?? [];
    const byParent = new Map<string, Category[]>();
    for (const row of all) {
      if (!row.parent_slug) continue;
      const list = byParent.get(row.parent_slug);
      if (list) list.push(row);
      else byParent.set(row.parent_slug, [row]);
    }
    return all
      .filter((row) => !row.parent_slug)
      .map((parent) => ({
        ...parent,
        children: (byParent.get(parent.slug) ?? []).sort(
          (a, b) => a.sort_index - b.sort_index || a.name.localeCompare(b.name, 'de'),
        ),
      }));
  }, [rows]);

  return { ...query, tree };
}

/**
 * Für die Auswahl beim Einstellen. Ohne Zähler, ohne Takt — wer einen Artikel
 * einträgt, interessiert sich nicht dafür, wie voll eine Kategorie ist.
 */
export function useCategoryOptions() {
  const query = useQuery({
    queryKey: ['berkat', 'category-options'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Pick<Category, 'slug' | 'name' | 'parent_slug' | 'sort_index'>[]> => {
      const { data, error } = await supabase
        .from('berkat_categories')
        .select('slug, name, parent_slug, sort_index')
        .eq('active', true)
        .order('sort_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Pick<Category, 'slug' | 'name' | 'parent_slug' | 'sort_index'>[];
    },
  });

  const rows = query.data;
  const groups = useMemo(() => {
    const all = rows ?? [];
    const parents = all.filter((row) => !row.parent_slug);
    return parents.map((parent) => ({
      ...parent,
      children: all.filter((row) => row.parent_slug === parent.slug),
    }));
  }, [rows]);

  return { ...query, groups };
}

export type CategoryShow = {
  id: string;
  host_id: string;
  title: string | null;
  viewer_count: number | null;
  thumbnail_url: string | null;
  women_only: boolean;
};

export type CategoryListing = {
  id: string;
  seller_id: string;
  title: string;
  image_url: string | null;
  buy_now_cents: number;
  women_only: boolean;
  created_at: string;
  /**
   * ⚠️ Diese vier stehen im Typ UND in der `.select()`-Kette. Dieselbe
   * Doppelung, die am 16.08.2026 zweimal ein Bild verschluckt hat.
   *
   * `seller_kind` ist dabei nicht optional im Sinne von „nice to have":
   * Art. 246d § 1 EGBGB verlangt die Anbieterkennzeichnung an JEDEM Angebot,
   * also auch hier und nicht nur auf dem Verkäuferprofil.
   */
  condition: string | null;
  postal_code: string | null;
  city: string | null;
  seller_kind: 'private' | 'business' | null;
};

/** Einmal, damit Typ und Abfrage nicht auseinanderlaufen. */
const CATEGORY_LISTING_COLUMNS =
  'id, seller_id, title, image_url, buy_now_cents, women_only, created_at, ' +
  'condition, postal_code, city, seller_kind';

/**
 * Was in einer Kategorie liegt: laufende Shows UND Dauerangebote.
 *
 * `slugs` ist bewusst eine Liste und kein einzelner Wert: Wer eine
 * Oberkategorie öffnet, will auch sehen, was in ihren Kindern liegt — sonst
 * wäre „Mode" leer, während unter „Abaya" drei Artikel hängen.
 *
 * Zwei Abfragen, weil es zwei Regale sind — und weil genau das der Grund für
 * diesen Reiter ist: Ohne die Dauerangebote wäre eine Kategorie 94 % der Zeit
 * leer. Frauen-Only filtert in beiden Fällen die RLS selbst; hier steht bewusst
 * kein zweiter Filter, sonst gäbe es zwei Wahrheiten über dieselbe Grenze.
 */
export function useCategoryContent(slugs: string[]) {
  // Stabiler Schlüssel: Ohne das Sortieren käme bei jeder Neuberechnung des
  // Aufrufers eine andere Reihenfolge und damit ein anderer Query-Key heraus —
  // die Abfrage liefe bei jedem Render neu.
  const key = useMemo(() => [...slugs].sort().join(','), [slugs]);
  const enabled = slugs.length > 0;

  const shows = useQuery({
    queryKey: ['berkat', 'category-shows', key],
    enabled,
    refetchInterval: 20_000,
    queryFn: async (): Promise<CategoryShow[]> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, host_id, title, viewer_count, thumbnail_url, women_only')
        .eq('status', 'active')
        .eq('app', 'berkat')
        .in('category', slugs)
        .order('viewer_count', { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as CategoryShow[];
    },
  });

  const listings = useQuery({
    queryKey: ['berkat', 'category-listings', key],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<CategoryListing[]> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select(CATEGORY_LISTING_COLUMNS)
        .is('session_id', null)
        .eq('status', 'listed')
        .in('category', slugs)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      // Doppelte Umleitung über `unknown` — supabase-js bildet die lange
      // Spaltenliste nicht mehr auf den Zeilentyp ab.
      return (data ?? []) as unknown as CategoryListing[];
    },
  });

  return { shows, listings };
}

/**
 * lib/useGiftCatalog.ts
 *
 * v1.18.0 — DB-backed Gift-Katalog.
 *
 * Vor v1.18 hat der GiftPicker aus lib/gifts.ts gelesen → neu geseedete
 * Gifts (z.B. ramadan_moon) waren unsichtbar bis zum nächsten App-Release.
 *
 * Neue Strategie:
 *   • DB `gift_catalog` ist Source-of-Truth für: rarity, season_tag,
 *     available_from, available_until, sort_order, diamond_value, coin_cost.
 *   • Lokales GIFT_CATALOG liefert Assets (Lottie/PNG/Video) die nicht
 *     über das Netz ausgeliefert werden können (require-bundled).
 *   • useGiftCatalog() merged beide: id-Match → lokale Assets bleiben,
 *     DB-Metadaten (Rarity/Season/Window) überschreiben.
 *   • Unbekannte DB-Gifts (nur Server, noch keine App-Assets) fallen auf
 *     Emoji-Only-Render zurück.
 *
 * Als Seiteneffekt wird das globale GIFT_BY_ID-Lookup beim Fetch
 * hydratisiert, damit `useGiftStream` (receiver-side) auch neue Gifts
 * erkennen kann ohne App-Update.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from './supabase';
import {
  GIFT_CATALOG,
  GIFT_BY_ID,
  rarityFromCost,
  isGiftActive,
  type GiftItem,
  type GiftRarity,
} from './gifts';

// ─── DB Row Shape ────────────────────────────────────────────────────────────

interface GiftCatalogRow {
  id:              string;
  name:            string;
  emoji:           string;
  coin_cost:       number;
  diamond_value:   number;
  color:           string | null;
  lottie_url:      string | null;
  sort_order:      number | null;
  rarity:          GiftRarity | null;
  season_tag:      string | null;
  available_from:  string | null;
  available_until: string | null;
}

// ─── Mapping DB → GiftItem (+ lokale Assets mergen) ──────────────────────────

function rowToGift(row: GiftCatalogRow): GiftItem {
  const local = GIFT_CATALOG.find((g) => g.id === row.id);

  // Rarity: DB-Wert bevorzugen, sonst Heuristik aus coin_cost
  const rarity: GiftRarity = row.rarity ?? rarityFromCost(row.coin_cost);

  // Fallback-Burst: wenn kein lokales Gift → Emoji + ✨ als Mini-Kaskade
  const burstEmojis = local?.burstEmojis ?? [row.emoji, '✨'];

  return {
    id:             row.id,
    name:           row.name,
    emoji:          row.emoji,
    coinCost:       row.coin_cost,
    diamondValue:   row.diamond_value,
    color:          row.color ?? local?.color ?? '#f59e0b',
    // Assets bleiben lokal (require-bundled) — DB darf nicht drüberschreiben
    lottieAsset:    local?.lottieAsset,
    imageAsset:     local?.imageAsset,
    videoAsset:     local?.videoAsset,
    videoUrl:       local?.videoUrl,
    lottieUrl:      row.lottie_url ?? local?.lottieUrl,
    burstEmojis,
    rarity,
    seasonTag:      row.season_tag ?? local?.seasonTag,
    availableFrom:  row.available_from ?? local?.availableFrom ?? null,
    availableUntil: row.available_until ?? local?.availableUntil ?? null,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Liefert den aktuellen Gift-Katalog aus der DB (mit Assets aus lokalem
 * GIFT_CATALOG gemerged). Saison-Filter `isGiftActive()` wird client-seitig
 * angewandt, damit verfrüht geseedete Gifts nicht auftauchen.
 *
 * Als Seiteneffekt wird GIFT_BY_ID mit neuen Einträgen erweitert, damit
 * eingehende Gift-Broadcasts von anderen Clients sofort korrekt aufgelöst
 * werden (auch wenn das Gift nicht im lokalen Bundle ist).
 */
export function useGiftCatalog() {
  const query = useQuery<GiftItem[]>({
    queryKey:  ['gift-catalog'],
    // 5 Min cache — neue Gifts erscheinen nach spätestens 5 Min ohne App-Restart
    staleTime: 5 * 60_000,
    gcTime:    30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_catalog')
        .select('id, name, emoji, coin_cost, diamond_value, color, lottie_url, sort_order, rarity, season_tag, available_from, available_until')
        .order('sort_order', { ascending: true });

      if (error) {
        __DEV__ && console.warn('[useGiftCatalog] fetch error — fallback to local:', error.message);
        // Netzfehler → lokalen Katalog nutzen, damit App nicht unbenutzbar ist
        return [...GIFT_CATALOG];
      }

      const merged = (data ?? []).map(rowToGift);

      // GIFT_BY_ID hydratisieren (receiver-side lookup in useGiftStream)
      for (const g of merged) {
        GIFT_BY_ID[g.id] = g;
      }

      // Lokale Gifts die NICHT in der DB sind (sehr alter Client, neuer Server
      // hat manche entfernt) trotzdem behalten — Sender schickt möglicherweise
      // noch diese IDs und Receiver brauchen das Lookup.
      for (const g of GIFT_CATALOG) {
        if (!GIFT_BY_ID[g.id]) GIFT_BY_ID[g.id] = g;
      }

      return merged;
    },
  });

  // Saison-Fenster client-seitig filtern + nach Rarity/Cost sortieren
  const activeCatalog = useMemo<GiftItem[]>(() => {
    const source = query.data ?? GIFT_CATALOG;
    const order: Record<GiftRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
    return source
      .filter((g) => isGiftActive(g))
      .sort((a, b) => {
        const ra = order[a.rarity ?? 'common'];
        const rb = order[b.rarity ?? 'common'];
        if (ra !== rb) return ra - rb;
        return a.coinCost - b.coinCost;
      });
  }, [query.data]);

  return {
    catalog:       activeCatalog,
    fullCatalog:   query.data ?? GIFT_CATALOG,
    isLoading:     query.isLoading,
    error:         query.error as Error | null,
    refetch:       query.refetch,
  };
}

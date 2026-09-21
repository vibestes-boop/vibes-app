/**
 * Die Filterzeile und ihr Blatt — für jede Fläche, die Angebote zeigt.
 *
 * ⚠️ WARUM ES DAS GIBT (21.09.2026)
 * Zaur fragte, was der App fehlt. Meine erste Antwort war falsch: Ich sagte
 * „es gibt keinen einzigen Filter" und hatte nur in `search.tsx` nachgesehen.
 * In `shop.tsx` stand längst einer — Kategorie, Zustand, Größe, Ort, Preis,
 * Sortierung, gespeicherte Suchen.
 *
 * Der echte Befund war ein anderer und ein schlimmerer: **Die Maschine stand
 * an genau EINER von drei Flächen.** Wer über die Kategorie-Kachel „Mode"
 * einstieg oder über die Lupe suchte, bekam eine Liste ohne jeden Griff.
 *
 * Deshalb liegt sie jetzt hier und nicht mehr in einem Bildschirm. Eine zweite
 * Abschrift für die Kategorie-Seite wäre der Fehler gewesen, gegen den in
 * diesem Verzeichnis schon `ListingCard` und `ChoiceSheet` stehen: Zwei Blätter
 * über dieselbe Sache laufen auseinander, und zwar immer an dem Tag, an dem
 * jemand nur eins von beiden anfasst.
 *
 * ⚠️ `sort` überlebt „Zurücksetzen". Sortieren ist kein Filter — es nimmt
 * nichts weg, es ordnet nur. Wer die Filter leert, will nicht auch noch seine
 * Reihenfolge verlieren.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarClock, SlidersHorizontal, X } from 'lucide-react-native';

import { formatEuro } from '../lib/useAuction';
import { CONDITIONS, conditionLabel } from '../lib/useBerkatSeller';
import { useCategoryOptions } from '../lib/useCategories';
import { LISTING_COLORS } from '../lib/useListings';
import type { BrowseSort } from '../lib/useBrowseListingPages';
import { useReducedMotion } from '../lib/useReducedMotion';
import { radius, space, ui } from '../theme/tokens';
import { FormInput } from './FormInput';

export type ListingFilterValues = {
  /** Oberkategorie-Slug. Auf der Kategorie-Seite ungenutzt — dort ist sie fest. */
  cat: string | null;
  cond: string | null;
  color: string | null;
  brand: string | null;
  size: string | null;
  city: string | null;
  maxPrice: number | null;
  onlyShow: boolean;
  sort: BrowseSort;
};

export const EMPTY_FILTERS: ListingFilterValues = {
  cat: null, cond: null, color: null, brand: null,
  size: null, city: null, maxPrice: null, onlyShow: false, sort: 'neu',
};

const PRICE_STEPS = [2500, 5000, 10000, 25000];
const SORTS: { key: BrowseSort; label: string }[] = [
  { key: 'neu', label: 'Neueste' },
  { key: 'guenstig', label: 'Günstigste' },
  { key: 'teuer', label: 'Teuerste' },
];

/**
 * Oberkategorie plus ihre Kinder — die Liste, die `useBrowseListingPages`
 * erwartet.
 *
 * ⚠️ Ohne die Kinder wäre „Mode" leer, während unter „Abaya" drei Artikel
 * hängen. Stand bis zum 21.09.2026 als eigene Rechnung in `shop.tsx`; die
 * Suche hätte sie abschreiben müssen, um dasselbe zu können.
 */
export function useCategorySlugs(cat: string | null): string[] | undefined {
  const { groups } = useCategoryOptions();
  return useMemo(() => {
    if (!cat) return undefined;
    const group = groups.find((entry) => entry.slug === cat);
    return [cat, ...(group?.children.map((child) => child.slug) ?? [])];
  }, [cat, groups]);
}

export function useListingFilters(initial?: Partial<ListingFilterValues>) {
  const [values, setValues] = useState<ListingFilterValues>({ ...EMPTY_FILTERS, ...initial });
  const patch = useCallback(
    (next: Partial<ListingFilterValues>) => setValues((v) => ({ ...v, ...next })),
    [],
  );
  // ⚠️ Die Sortierung bleibt stehen, siehe Kopf.
  const reset = useCallback(() => setValues((v) => ({ ...EMPTY_FILTERS, sort: v.sort })), []);

  const activeCount = [
    values.cat, values.cond, values.color,
    values.brand?.trim() || null, values.size?.trim() || null, values.city?.trim() || null,
    values.maxPrice,
  ].filter((v) => v !== null).length;

  return { values, patch, reset, activeCount, narrowed: activeCount > 0 || values.onlyShow };
}

export function ListingFilterBar({
  values,
  patch,
  reset,
  activeCount,
  sidePadding = space.md,
  withCategory = false,
}: {
  values: ListingFilterValues;
  patch: (next: Partial<ListingFilterValues>) => void;
  reset: () => void;
  activeCount: number;
  /**
   * Seitenabstand der scrollenden Zeilen. Muss zum Listenrand der Fläche
   * passen, sonst beginnen Chips und Karten an verschiedenen Kanten.
   */
  sidePadding?: number;
  /**
   * Kategorie-Auswahl im Blatt. Aus auf der Kategorie-Seite: Dort IST die
   * Kategorie der Bildschirm, und ein Feld, mit dem man ihn verlassen kann,
   * ohne dass die Überschrift sich ändert, wäre eine Falle.
   */
  withCategory?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const categories = useCategoryOptions();
  const groups = categories.groups;

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const parent of groups) {
      map.set(parent.slug, parent.name);
      for (const child of parent.children) map.set(child.slug, child.name);
    }
    return map;
  }, [groups]);

  const chips = [
    withCategory && values.cat
      ? { key: 'cat', label: categoryNames.get(values.cat) ?? values.cat, clear: () => patch({ cat: null }) } : null,
    values.size ? { key: 'size', label: `Gr. ${values.size}`, clear: () => patch({ size: null }) } : null,
    values.color ? { key: 'color', label: values.color, clear: () => patch({ color: null }) } : null,
    values.cond ? { key: 'cond', label: conditionLabel(values.cond) ?? values.cond, clear: () => patch({ cond: null }) } : null,
    values.brand ? { key: 'brand', label: values.brand, clear: () => patch({ brand: null }) } : null,
    values.city ? { key: 'city', label: values.city, clear: () => patch({ city: null }) } : null,
    values.maxPrice !== null ? { key: 'price', label: `bis ${formatEuro(values.maxPrice)}`, clear: () => patch({ maxPrice: null }) } : null,
    values.onlyShow ? { key: 'show', label: 'In einer Show', clear: () => patch({ onlyShow: false }) } : null,
  ].filter((chip) => chip !== null);

  return (
    <>
      <ScrollView key={`sorts-${fontScale}`} horizontal showsHorizontalScrollIndicator={false}
        style={s.rail} contentContainerStyle={[s.sortRow, { paddingHorizontal: sidePadding }]}>
        <Pressable
          onPress={() => setOpen(true)}
          style={[s.chip, s.filterChip, activeCount > 0 && s.chipOn]}
          accessibilityRole="button"
          accessibilityLabel={activeCount > 0 ? `Filter, ${activeCount} aktiv` : 'Filter'}
        >
          <SlidersHorizontal size={14} color={activeCount > 0 ? ui.bg : ui.text} />
          <Text style={[s.chipText, activeCount > 0 && s.chipTextOn]}>
            {activeCount > 0 ? `Filter · ${activeCount}` : 'Filter'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => patch({ onlyShow: !values.onlyShow })}
          style={[s.chip, s.filterChip, values.onlyShow && s.chipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: values.onlyShow }}
          accessibilityLabel={values.onlyShow ? 'Alle Angebote zeigen' : 'Nur Artikel aus kommenden Sendungen'}
        >
          <CalendarClock size={14} color={values.onlyShow ? ui.bg : ui.text} />
          <Text style={[s.chipText, values.onlyShow && s.chipTextOn]}>In einer Show</Text>
        </Pressable>
        {SORTS.map((option) => {
          const on = option.key === values.sort;
          return (
            <Pressable
              key={option.key}
              onPress={() => patch({ sort: option.key })}
              style={[s.chip, on && s.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {chips.length > 0 ? (
        <ScrollView key={`active-${fontScale}`} horizontal showsHorizontalScrollIndicator={false}
          style={s.rail} contentContainerStyle={[s.activeRow, { paddingHorizontal: sidePadding }]}>
          {chips.map((chip) => (
            <Pressable key={chip.key} onPress={chip.clear} style={s.activeChip}
              accessibilityRole="button" accessibilityLabel={`Filter ${chip.label} entfernen`}>
              <Text style={s.activeText}>{chip.label}</Text><X size={14} color={ui.brand} />
            </Pressable>
          ))}
          <Pressable onPress={reset} style={s.resetAll} accessibilityRole="button">
            <Text style={s.activeText}>Alle zurücksetzen</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <Modal
        visible={open}
        animationType={reducedMotion ? 'none' : 'slide'}
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView key={fontScale} style={s.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Filter</Text>
            <Pressable style={s.close} onPress={() => setOpen(false)}
              accessibilityRole="button" accessibilityLabel="Schließen">
              <X size={22} color={ui.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
            {withCategory ? (
              <>
                <FilterGroup label="Kategorie" options={groups.map((group) => group.slug)}
                  value={values.cat} onChange={(cat) => patch({ cat })}
                  display={(slug) => categoryNames.get(slug) ?? slug} />
                {categories.isError && !categories.data ? (
                  <Pressable onPress={() => void categories.refetch({ cancelRefetch: false })}
                    style={s.clearCta} accessibilityRole="button">
                    <Text style={s.clearCtaText}>Kategorien erneut laden</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            <Text style={s.groupLabel}>Größe</Text>
            <FormInput value={values.size ?? ''} onChangeText={(size) => patch({ size: size || null })} maxLength={24}
              placeholder="Zum Beispiel M, 38 oder One Size" accessibilityLabel="Nach Größe filtern"
              placeholderTextColor={ui.textMuted} autoCorrect={false} style={s.filterInput} />

            {/* ⚠️ Dieselben dreizehn wie im Einstell-Formular, und genau dafür
                gibt es sie dort als feste Auswahl: Ohne sie zerfiele „Schwarz"
                in fünf Schreibweisen, und dieser Filter fände nichts. */}
            <FilterGroup label="Farbe" options={[...LISTING_COLORS]}
              value={values.color} onChange={(color) => patch({ color })} display={(name) => name} />

            <FilterGroup label="Zustand" options={CONDITIONS.map((condition) => condition.slug)}
              value={values.cond} onChange={(cond) => patch({ cond })}
              display={(slug) => conditionLabel(slug) ?? slug} />

            {/* Marke bleibt Freitext. Eine gepflegte Markenliste wäre eine
                zweite Wahrheit, die jemand bei jeder neuen Marke nachziehen
                müsste — und bei Secondhand ist die nächste Marke immer neu. */}
            <Text style={s.groupLabel}>Marke</Text>
            <FormInput value={values.brand ?? ''} onChangeText={(brand) => patch({ brand: brand || null })} maxLength={40}
              placeholder="Zum Beispiel Nike" accessibilityLabel="Nach Marke filtern"
              placeholderTextColor={ui.textMuted} autoCorrect={false} style={s.filterInput} />

            <Text style={s.groupLabel}>Ort</Text>
            <FormInput value={values.city ?? ''} onChangeText={(city) => patch({ city: city || null })} maxLength={80}
              placeholder="Stadt eingeben" accessibilityLabel="Nach Ort filtern"
              placeholderTextColor={ui.textMuted} autoCorrect={false} style={s.filterInput} />

            <Text style={s.groupLabel}>Preis</Text>
            <View style={s.groupRow}>
              {PRICE_STEPS.map((cents) => {
                const on = values.maxPrice === cents;
                return (
                  <Pressable key={cents} onPress={() => patch({ maxPrice: on ? null : cents })}
                    style={[s.opt, on && s.optOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <Text style={[s.optText, on && s.optTextOn]}>bis {formatEuro(cents)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={[s.sheetFoot, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
            {activeCount > 0 ? (
              <Pressable style={({ pressed }) => [s.footGhost, pressed && { opacity: 0.7 }]}
                onPress={reset} accessibilityRole="button">
                <Text style={s.footGhostText}>Zurücksetzen</Text>
              </Pressable>
            ) : null}
            <Pressable style={({ pressed }) => [s.footPrimary, pressed && { opacity: 0.85 }]}
              onPress={() => setOpen(false)} accessibilityRole="button">
              <Text style={s.footPrimaryText}>Auswahl anzeigen</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
  display,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  display: (key: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <>
      <Text style={s.groupLabel}>{label}</Text>
      <View style={s.groupRow}>
        {options.map((key) => {
          const on = value === key;
          return (
            <Pressable
              key={key}
              // Ein zweiter Tipp auf die gewählte Kachel wählt ab. Ohne das
              // käme man aus einer Gruppe ohne „egal"-Kachel nie wieder heraus.
              onPress={() => onChange(on ? null : key)}
              style={[s.opt, on && s.optOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={display(key)}
            >
              <Text style={[s.optText, on && s.optTextOn]}>{display(key)}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  /* ⚠️ `flexGrow: 0` UND `alignItems: 'center'` — beide gegen denselben
     Fehler, an zwei Stellen. Auf der Suche ist diese Zeile ein Flex-Kind
     einer Spalte ohne Höhenvorgabe: Ohne `flexGrow: 0` dehnt sich die
     Fläche über den ganzen Rest, ohne `alignItems` dehnen sich die Chips
     DARIN mit. Im Shop fiel es nicht auf, weil dort ein Elternteil mit
     eigener Höhe darüber lag — ein Bauteil darf sich nicht darauf
     verlassen, wo es hängt. Am 21.09.2026 im Simulator gesehen, nachdem
     TypeScript und 423 Tests grün waren. */
  rail: { flexGrow: 0, flexShrink: 0 },
  sortRow: { gap: space.sm, alignItems: 'center' },
  chip: {
    paddingHorizontal: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  chipOn: { backgroundColor: ui.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: ui.text },
  chipTextOn: { color: ui.bg },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeRow: { gap: space.sm, alignItems: 'center' },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.line,
  },
  activeText: { fontSize: 12, fontWeight: '600', color: ui.brand },
  resetAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: ui.bg },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: ui.text },
  sheetBody: { padding: space.lg, paddingBottom: space.xl },
  groupLabel: { fontSize: 12, color: ui.textMuted, marginTop: space.lg, marginBottom: space.sm },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  opt: {
    paddingHorizontal: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  optOn: { backgroundColor: ui.brand },
  optText: { fontSize: 13, fontWeight: '600', color: ui.text },
  optTextOn: { color: ui.bg },
  filterInput: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, fontSize: 15, color: ui.text },
  clearCta: {
    marginTop: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  clearCtaText: { fontSize: 14, fontWeight: '700', color: ui.text },
  sheetFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  footGhost: {
    minHeight: 48,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  footGhostText: { fontSize: 15, fontWeight: '700', color: ui.text },
  footPrimary: {
    flexGrow: 1,
    flexBasis: 170,
    minHeight: 48,
    paddingVertical: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
  },
  footPrimaryText: { textAlign: 'center', flexShrink: 1, fontSize: 15, fontWeight: '700', color: ui.goldInk },
});

// Kategorien — Whatnots zweiter von fünf Reitern, mit zwei Ebenen.
//
// Warum er auch dann steht, wenn wenig darin liegt: Die Startseite beantwortet
// „was läuft JETZT". Bei fünf Verkäufern mit je zwei Stunden pro Woche ist die
// Antwort 94 % der Zeit „nichts" (HANDOFF 17). Dieser Reiter beantwortet die
// andere Frage — „was gibt es hier überhaupt" — und die hat immer eine Antwort,
// solange Dauerangebote existieren.
//
// AUFBAU, abgeschaut am 16.08.2026 von Whatnot:
//   • Zwei Spalten geben den freigestellten Motiven ausreichend Fläche (06.09.2026).
//   • Ein Tipp auf eine Kachel klappt ihre Unterkategorien VERTIKAL unter der
//     Zeile auf, ein zweiter schließt sie. Erst dadurch trägt die Seite
//     zweiundsiebzig Kategorien, ohne zur Wand zu werden.
//   • Zuschauer statt Shows als Zahl auf der Kachel.
//
// EINE STELLE, AN DER BERKAT ES BESSER KANN: Whatnots Kachel zeigt nur
// Zuschauer, weil dort immer welche sind. Hier ist eine Kategorie oft „0 live,
// aber 12 kaufbar" — dann steht genau das da statt einer toten Null. Whatnot
// kann das strukturell nicht, die haben kein Dauerregal je Kategorie.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Search, ShoppingBag, X } from 'lucide-react-native';
import { Image } from 'expo-image';

import { useCategoryTree, type Category, type CategoryNode } from '../../lib/useCategories';
import { BerkatMark } from '../../components/BerkatMark';
import { categoryArt } from '../../theme/categoryArt';
import { radius, space, ui } from '../../theme/tokens';
import { PressFeedback } from '../../components/PressFeedback';
import { useReducedMotion } from '../../lib/useReducedMotion';

// Auf Android muss die Layout-Animation einmalig freigeschaltet werden. Unter
// der neuen Architektur gibt es die Methode nicht mehr — deshalb die Prüfung
// statt eines blinden Aufrufs, der dort werfen würde.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLUMNS = 2;

// ⚠️ SYMBOL, FARBTON UND FOTO KOMMEN AUS `theme/categoryArt.ts` — EINE STELLE.
//
// Bis zum 22.08.2026 stand hier eine ZWEITE Zuordnung: eine eigene
// `ICONS`-Tabelle, die weder den Farbton noch das Foto kannte. Der Kopf von
// `categoryArt.ts` versprach derweil wörtlich „wer die Fotos einsetzt, ändert
// nur diese Datei" — das stimmte für die Entdeckungs-Leiste auf der Startseite
// und war für dieses Raster falsch. Zaurs zwölf freigestellte Bilder wären
// also ausgerechnet auf der Fläche nicht angekommen, auf der sie am meisten
// fehlen: Der Kategorien-Reiter besteht fast nur aus diesen Kacheln.
//
// Dieselbe Familie wie die viermal abgeschriebene Angebots-Karte (HANDOFF 21):
// Zwei Quellen für dieselbe Auskunft laufen auseinander, und man merkt es erst
// in dem Moment, in dem eine von beiden gepflegt wird.

type SortMode = 'empfohlen' | 'beliebt' | 'az';

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'empfohlen', label: 'Empfohlen' },
  { key: 'beliebt', label: 'Beliebt' },
  { key: 'az', label: 'A–Z' },
];

/** Was unter dem Namen steht — oder nichts. */
function countLine(c: Category): { text: string | null; live: boolean } {
  if (c.live_count > 0) {
    // Zuschauer, nicht Shows. Und wenn eine Show läuft, aber noch niemand
    // zuschaut, ist „1 live" ehrlicher als „0 Zuschauer".
    return c.viewer_count > 0
      ? { text: `${c.viewer_count} Zuschauer`, live: true }
      : { text: `${c.live_count} live`, live: true };
  }
  if (c.listing_count > 0) return { text: `${c.listing_count} kaufbar`, live: false };
  // Bewusst NICHTS statt „0". Eine Null ist kein Stand, sondern eine
  // Enttäuschung in Zahlenform.
  return { text: null, live: false };
}

function hasActivity(c: Category): boolean {
  return c.live_count > 0 || c.listing_count > 0;
}

export default function CategoriesScreen() {
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { tree, isLoading, refetch } = useCategoryTree(isFocused);

  const [sort, setSort] = useState<SortMode>('empfohlen');
  const [open, setOpen] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  // Reiter bleiben in Expo Router dauerhaft aufgebaut — ohne das hier stünden
  // beim Zurückwechseln die Zähler von vorhin da (HANDOFF 3, Reiter-Falle).
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'categories'] }, { cancelRefetch: false });
    }, [queryClient]),
  );

  const toggle = useCallback((slug: string, hasChildren: boolean) => {
    if (!hasChildren) {
      router.push(`/category/${slug}`);
      return;
    }
    // Die Animation wird VOR der Zustandsänderung angemeldet — sie beschreibt
    // den nächsten Layout-Durchlauf, nicht den vergangenen.
    if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((current) => (current === slug ? null : slug));
  }, [router, reducedMotion]);

  const sorted = useMemo((): CategoryNode[] => {
    const list = [...tree];
    switch (sort) {
      case 'beliebt':
        return list.sort(
          (a, b) =>
            b.viewer_count - a.viewer_count ||
            b.live_count - a.live_count ||
            b.listing_count - a.listing_count ||
            a.sort_index - b.sort_index,
        );
      case 'az':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      default:
        // „Empfohlen" ist die redaktionelle Reihenfolge — aber Kategorien, in
        // denen etwas los ist, kommen davor. Genau das würde ein Mensch tun,
        // der die Seite kuratiert, und ohne das öffnet sie bei fünf Verkäufern
        // auf eine Wand aus leeren Kacheln.
        return list.sort(
          (a, b) =>
            Number(hasActivity(b)) - Number(hasActivity(a)) || a.sort_index - b.sort_index,
        );
    }
  }, [tree, sort]);

  // In Zeilen zu zweit zerlegen, statt `numColumns` zu benutzen: Die
  // Aufklapp-Liste muss zwischen zwei Zeilen liegen, und dafür muss die Zeile
  // selbst das Listenelement sein.
  const rows = useMemo(() => {
    const out: { key: string; tiles: CategoryNode[] }[] = [];
    for (let i = 0; i < sorted.length; i += COLUMNS) {
      const tiles = sorted.slice(i, i + COLUMNS);
      out.push({ key: tiles.map((t) => t.slug).join('-'), tiles });
    }
    return out;
  }, [sorted]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Kategorien</Text>
        <Text style={styles.subtitle}>Stöbern, auch wenn gerade niemand sendet</Text>
      </View>

      {/* ── ⚠️ DAS SUCHFELD GEHÖRT HIERHER (24.08.2026) ────────────────────────
          Von Zaur beim Vergleich mit Whatnot bemerkt: Deren zweiter Reiter heisst
          „Categories", trägt eine Lupe und IST die Suche — Stöbern und Suchen sind
          eine Tür. Bei uns waren es drei: die Suche auf der Startseite, die
          Kacheln hier, die Filter in `shop.tsx`. Wer etwas Bestimmtes wollte,
          musste erst wissen, WO man das tut.

          Bewusst kein zweites Such-Werk: Das Feld reicht die Eingabe an
          `shop.tsx` weiter (`?q=`, dort seit jeher entgegengenommen). Dort liegen
          Filter, Sortierung und die gespeicherten Suchen. Eine eigene
          Ergebnisliste hier wäre eine zweite Wahrheit über denselben Bestand.

          ⚠️ Die Beschriftung sagt „Artikel", nicht „Suchen": `shop.tsx` sucht in
          Angebots-Titeln. Verkäufer findet man auf der Startseite. Ein Feld, das
          mehr verspricht, als es einlöst, ist schlimmer als ein enges. */}
      <View style={styles.searchRow}>
        <Search size={17} color={ui.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Artikel suchen"
          placeholderTextColor={ui.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          onSubmitEditing={() => {
            const q = query.trim();
            router.push(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
          }}
          accessibilityLabel="Artikel suchen"
        />
        {query.length > 0 ? (
          <PressFeedback
            hitSlop={10}
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Suche leeren"
          >
            <X size={16} color={ui.textMuted} />
          </PressFeedback>
        ) : null}
      </View>

      {/* Kein sechster Reiter: Unten liegen schon fünf, und „Kategorien" ist
          dort das längste Wort. Der Einstieg gehört hierher, weil dieser
          Bildschirm ohnehin die Frage „was gibt es hier überhaupt" beantwortet —
          „Alles ansehen" ist nur die Antwort ohne Umweg über eine Kachel.

          Wichtig für die Auffindbarkeit: Die Kategorie ist beim Einstellen
          FREIWILLIG. Ein Angebot ohne Kategorie lag bis hierher in keiner Kachel
          und war damit für jeden unauffindbar, der den Verkäufer nicht kennt. */}
      <PressFeedback
        style={styles.allRow}
        onPress={() => router.push('/shop')}
        accessibilityRole="button"
        accessibilityLabel="Alle Angebote ansehen"
      >
        <ShoppingBag size={17} color={ui.text} />
        <Text style={styles.allText}>Alles ansehen</Text>
        <ChevronRight size={17} color={ui.textMuted} />
      </PressFeedback>

      <View style={styles.sortRow}>
        {SORTS.map((option) => {
          const on = option.key === sort;
          return (
            <PressFeedback
              key={option.key}
              onPress={() => setSort(option.key)}
              style={[styles.sortChip, on && styles.sortChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.sortText, on && styles.sortTextOn]}>{option.label}</Text>
            </PressFeedback>
          );
        })}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        refreshing={pulling}
        onRefresh={onPull}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <BerkatMark size={38} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Keine Kategorien</Text>
              <Text style={styles.emptyBody}>
                Die Liste kommt aus der Datenbank. Fehlt sie, ist die Migration noch nicht
                eingespielt.
              </Text>
            </View>
          )
        }
        renderItem={({ item: row }) => {
          const expanded = row.tiles.find((tile) => tile.slug === open);
          return (
            <View>
              <View style={styles.row}>
                {row.tiles.map((tile) => {
                  const art = categoryArt(tile.slug);
                  const Icon = art.icon;
                  const { text, live } = countLine(tile);
                  const isOpen = tile.slug === open;
                  const children = tile.children.length;
                  return (
                    <PressFeedback kind="card"
                      key={tile.slug}
                      style={[styles.tile]}
                      onPress={() => toggle(tile.slug, children > 0)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      accessibilityLabel={
                        children > 0
                          ? `${tile.name}, ${children} Unterkategorien${text ? `, ${text}` : ''}`
                          : `${tile.name}${text ? `, ${text}` : ''}`
                      }
                    >
                      <View
                        style={[
                          styles.tileArt,
                          { backgroundColor: art.tint },
                          isOpen && styles.tileOpen,
                        ]}
                      >
                        {art.photo ? (
                          <Image
                            source={art.photo}
                            style={styles.tilePhoto}
                            contentFit="contain"
                            transition={0}
                          />
                        ) : (
                          <Icon size={52} color={ui.brand} />
                        )}
                      </View>

                      <Text style={[styles.tileName, isOpen && styles.tileNameOpen]}>
                        {tile.name}
                      </Text>

                      {text ? (
                        <View style={styles.countRow}>
                          {live ? <View style={styles.liveDot} /> : null}
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.tileCount,
                              live && styles.tileCountLive,
                            ]}
                          >
                            {text}
                          </Text>
                        </View>
                      ) : (
                        // Hält die Kachelhöhe konstant, auch ohne Zahl —
                        // sonst springt das Raster zeilenweise.
                        <View style={styles.countSpacer} />
                      )}
                    </PressFeedback>
                  );
                })}

                {/* Füllt die letzte Zeile auf, damit eine einzelne Kategorie
                    dieselbe Breite wie die übrigen behält. */}
                {row.tiles.length < COLUMNS
                  ? Array.from({ length: COLUMNS - row.tiles.length }, (_, i) => (
                      <View key={`spacer-${i}`} style={styles.spacer} />
                    ))
                  : null}
              </View>

              {expanded ? (
                <View style={styles.panel}>
                  {/* Zuerst „Alles" — wer eine Oberkategorie antippt, will oft
                      genau sie und nicht eines ihrer Kinder. Whatnot macht es
                      genauso („Alle Männermode"). */}
                  <PressFeedback
                    style={({ pressed }) => [styles.panelRow, pressed && styles.panelRowPressed]}
                    onPress={() => router.push(`/category/${expanded.slug}`)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.panelName, styles.panelNameAll]}>
                      Alles in {expanded.name}
                    </Text>
                    <PanelCount category={expanded} />
                    <ChevronRight size={16} color={ui.textMuted} />
                  </PressFeedback>

                  {expanded.children.map((child) => (
                    <PressFeedback
                      key={child.slug}
                      style={({ pressed }) => [
                        styles.panelRow,
                        styles.panelRowSplit,
                        pressed && styles.panelRowPressed,
                      ]}
                      onPress={() => router.push(`/category/${child.slug}`)}
                      accessibilityRole="button"
                      accessibilityLabel={child.name}
                    >
                      <Text style={styles.panelName}>
                        {child.name}
                      </Text>
                      <PanelCount category={child} />
                      <ChevronRight size={16} color={ui.textMuted} />
                    </PressFeedback>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

/** Die Zahl rechts in der Aufklapp-Liste — oder nichts. */
function PanelCount({ category }: { category: Category }) {
  const { text, live } = countLine(category);
  if (!text) return null;
  return (
    <View style={styles.panelCountRow}>
      {live ? <View style={styles.liveDot} /> : null}
      <Text style={[styles.panelCount, live && styles.tileCountLive]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Ein Feld, keine Kachel: Es soll aussehen wie etwas, in das man tippt.
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  searchInput: { flex: 1, fontSize: 15, color: ui.text, padding: 0 },

  screen: { flex: 1, backgroundColor: ui.bg },

  header: { paddingHorizontal: space.md, paddingTop: space.sm },
  title: { fontSize: 26, fontWeight: '700', color: ui.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: ui.textMuted, marginTop: 2 },

  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.line,
  },
  allText: { flex: 1, fontSize: 15, fontWeight: '600', color: ui.text },

  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  sortChip: {
    paddingHorizontal: space.lg,
    minHeight: 34,
    paddingVertical: space.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  sortChipOn: { backgroundColor: ui.brand },
  sortText: { fontSize: 13, fontWeight: '600', color: ui.text },
  sortTextOn: { color: ui.bg },

  row: { flexDirection: 'row', gap: space.md, marginBottom: space.xl },
  spacer: { flex: 1 },
  tile: { flex: 1, minWidth: 0, gap: 6 },
  // Eine Bildfläche; Name und Bestand stehen direkt auf dem Seitenhintergrund.
  tileArt: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tilePhoto: { width: '90%', height: '90%' },
  tileOpen: { borderColor: ui.brand },
  tileName: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: ui.text },
  tileNameOpen: { color: ui.brand },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countSpacer: { height: 17 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ui.live },
  tileCount: { flex: 1, fontSize: 12, lineHeight: 17, color: ui.textMuted },
  tileCountLive: { color: ui.live, fontWeight: '700' },

  panel: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 13,
  },
  panelRowSplit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  panelRowPressed: { opacity: 0.55 },
  panelName: { flex: 1, fontSize: 14, fontWeight: '600', color: ui.text },
  panelNameAll: { fontWeight: '700' },
  panelCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  panelCount: { fontSize: 12, color: ui.textMuted },

  empty: { alignItems: 'center', paddingTop: 80, gap: space.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  emptyBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.xl,
    lineHeight: 20,
  },
});

// Kategorien — Whatnots zweiter von fünf Reitern, mit zwei Ebenen.
//
// Warum er auch dann steht, wenn wenig darin liegt: Die Startseite beantwortet
// „was läuft JETZT". Bei fünf Verkäufern mit je zwei Stunden pro Woche ist die
// Antwort 94 % der Zeit „nichts" (HANDOFF 17). Dieser Reiter beantwortet die
// andere Frage — „was gibt es hier überhaupt" — und die hat immer eine Antwort,
// solange Dauerangebote existieren.
//
// AUFBAU, abgeschaut am 16.08.2026 von Whatnot:
//   • Drei Spalten statt zwei — halbiert die Scrollhöhe bei kurzen Namen.
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
import { useQueryClient } from '@tanstack/react-query';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Baby,
  BookOpen,
  ChevronRight,
  Coins,
  Gem,
  House,
  Moon,
  Package,
  Shirt,
  ShoppingBag,
  Sparkles,
  Watch,
  type LucideIcon,
} from 'lucide-react-native';

import { useCategoryTree, type Category, type CategoryNode } from '../../lib/useCategories';
import { BerkatMark } from '../../components/BerkatMark';
import { radius, space, ui } from '../../theme/tokens';

// Auf Android muss die Layout-Animation einmalig freigeschaltet werden. Unter
// der neuen Architektur gibt es die Methode nicht mehr — deshalb die Prüfung
// statt eines blinden Aufrufs, der dort werfen würde.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLUMNS = 3;

// Ein Symbol je Oberkategorie, groß in der Bildfläche der Kachel.
//
// ÜBERGANGSZUSTAND, bewusst so: Whatnot trägt dort je Kategorie ein gerendertes
// 3D-Objekt. Zaur erzeugt die noch; bis dahin steht an genau derselben Stelle
// das Symbol. Kommen die Bilder, wird nur der Inhalt von `tileArt` getauscht —
// Kachelgröße, Raster und Textanordnung bleiben, wie sie sind.
//
// Zwischenzeitlich stand hier das neueste Produktfoto der Kategorie. Das ist
// wieder raus: Ein echtes Foto neben einem 3D-Objekt hätte zwei Bildsprachen
// auf derselben Fläche gemischt, sobald die ersten Renderings da sind.
const ICONS: Record<string, LucideIcon> = {
  mode: Shirt,
  schuhe: Package,
  taschen: ShoppingBag,
  schmuck: Gem,
  beauty: Sparkles,
  uhren: Watch,
  haus: House,
  islamica: Moon,
  buecher: BookOpen,
  kinder: Baby,
  sammeln: Coins,
  sonstiges: Package,
};

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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tree, isLoading, refetch } = useCategoryTree();

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
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'categories'] });
    }, [queryClient]),
  );

  const toggle = useCallback((slug: string, hasChildren: boolean) => {
    if (!hasChildren) {
      router.push(`/category/${slug}`);
      return;
    }
    // Die Animation wird VOR der Zustandsänderung angemeldet — sie beschreibt
    // den nächsten Layout-Durchlauf, nicht den vergangenen.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((current) => (current === slug ? null : slug));
  }, [router]);

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

  // In Zeilen zu dritt zerlegen, statt `numColumns` zu benutzen: Die
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

      {/* Kein sechster Reiter: Unten liegen schon fünf, und „Kategorien" ist
          dort das längste Wort. Der Einstieg gehört hierher, weil dieser
          Bildschirm ohnehin die Frage „was gibt es hier überhaupt" beantwortet —
          „Alles ansehen" ist nur die Antwort ohne Umweg über eine Kachel.

          Wichtig für die Auffindbarkeit: Die Kategorie ist beim Einstellen
          FREIWILLIG. Ein Angebot ohne Kategorie lag bis hierher in keiner Kachel
          und war damit für jeden unauffindbar, der den Verkäufer nicht kennt. */}
      <Pressable
        style={styles.allRow}
        onPress={() => router.push('/shop')}
        accessibilityRole="button"
        accessibilityLabel="Alle Angebote ansehen"
      >
        <ShoppingBag size={17} color={ui.text} />
        <Text style={styles.allText}>Alles ansehen</Text>
        <ChevronRight size={17} color={ui.textMuted} />
      </Pressable>

      <View style={styles.sortRow}>
        {SORTS.map((option) => {
          const on = option.key === sort;
          return (
            <Pressable
              key={option.key}
              onPress={() => setSort(option.key)}
              style={[styles.sortChip, on && styles.sortChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.sortText, on && styles.sortTextOn]}>{option.label}</Text>
            </Pressable>
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
                  const Icon = ICONS[tile.slug] ?? Package;
                  const { text, live } = countLine(tile);
                  const isOpen = tile.slug === open;
                  const children = tile.children.length;
                  return (
                    <Pressable
                      key={tile.slug}
                      style={[styles.tile, isOpen && styles.tileOpen]}
                      onPress={() => toggle(tile.slug, children > 0)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      accessibilityLabel={
                        children > 0
                          ? `${tile.name}, ${children} Unterkategorien${text ? `, ${text}` : ''}`
                          : `${tile.name}${text ? `, ${text}` : ''}`
                      }
                    >
                      {/* Name OBEN, Bildfläche darunter — dieselbe Anordnung
                          wie bei Whatnot. Dort sitzt in der Mitte ein
                          gerendertes 3D-Objekt; hier steht vorerst das Symbol
                          groß an genau dieser Stelle. Kommen die Bilder, wird
                          nur der Inhalt von `tileArt` getauscht, das Raster
                          bleibt wie es ist. */}
                      <Text
                        numberOfLines={2}
                        style={[styles.tileName, isOpen && styles.tileNameOpen]}
                      >
                        {tile.name}
                      </Text>

                      <View style={styles.tileArt}>
                        <Icon size={44} color={isOpen ? ui.goldInk : ui.brand} />
                      </View>

                      {text ? (
                        <View style={styles.countRow}>
                          {live ? <View style={styles.liveDot} /> : null}
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.tileCount,
                              live && styles.tileCountLive,
                              isOpen && styles.tileCountOpen,
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
                    </Pressable>
                  );
                })}

                {/* Füllt die letzte Zeile auf, damit zwei Kacheln nicht auf
                    Drittelbreite gestreckt werden. */}
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
                  <Pressable
                    style={({ pressed }) => [styles.panelRow, pressed && styles.panelRowPressed]}
                    onPress={() => router.push(`/category/${expanded.slug}`)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.panelName, styles.panelNameAll]}>
                      Alles in {expanded.name}
                    </Text>
                    <PanelCount category={expanded} />
                    <ChevronRight size={16} color={ui.textMuted} />
                  </Pressable>

                  {expanded.children.map((child) => (
                    <Pressable
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
                      <Text numberOfLines={1} style={styles.panelName}>
                        {child.name}
                      </Text>
                      <PanelCount category={child} />
                      <ChevronRight size={16} color={ui.textMuted} />
                    </Pressable>
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
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  sortChip: {
    paddingHorizontal: space.lg,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  sortChipOn: { backgroundColor: ui.brand },
  sortText: { fontSize: 13, fontWeight: '600', color: ui.text },
  sortTextOn: { color: ui.bg },

  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  spacer: { flex: 1 },

  tile: {
    flex: 1,
    // War 104. Das Bild braucht Platz, sonst ist es wieder nur ein Symbol mit
    // anderem Inhalt — bei Whatnot füllt die Illustration rund 60 % der Kachel.
    minHeight: 152,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.line,
    padding: space.sm,
    gap: 5,
  },
  // Die Fläche fürs Bild. Vorerst trägt sie das Symbol groß und mittig;
  // sobald es 3D-Bilder je Kategorie gibt, kommen sie genau hierher — ohne
  // dass sich am Raster etwas ändert. Deshalb hat sie schon jetzt keine
  // eigene Farbe: Ein grauer Kasten hinter einem Symbol sähe aus wie ein
  // Bild, das nicht geladen hat.
  tileArt: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Gold ist in Berkat der Kauf — hier ist es das Äquivalent zu Whatnots
  // gelber Kachel: der eine Ort, an dem man gerade steht.
  tileOpen: { backgroundColor: ui.gold, borderColor: ui.brand },
  tileName: { fontSize: 13, fontWeight: '700', color: ui.text },
  tileNameOpen: { color: ui.goldInk },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countSpacer: { height: 15 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ui.live },
  tileCount: { flex: 1, fontSize: 11, color: ui.textMuted },
  tileCountLive: { color: ui.live, fontWeight: '700' },
  tileCountOpen: { color: ui.goldInk, opacity: 0.8 },

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

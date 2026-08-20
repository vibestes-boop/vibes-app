// Alles, was gerade kaufbar ist — über alle Verkäufer und Kategorien.
//
// Der Bildschirm, der aus einer Auktions-App einen Marktplatz macht: Bis hierher
// war ein Dauerangebot nur über das Profil seines Verkäufers oder über eine
// Kategorie erreichbar — und die Kategorie ist beim Einstellen freiwillig. Wer
// ohne sie einstellte, legte seinen Artikel für die Allgemeinheit unauffindbar
// ab.
//
// FILTER, SUCHE UND ORT — vollständig seit dem 18.08.2026 (nachts).
// Nachdem 36 Testartikel im Regal lagen, war die alte Zurückhaltung nicht mehr
// zu halten: 38 Artikel über 31 Unterkategorien, von 14 € bis 249 €, in zwölf
// Städten. Ohne Filter findet dort niemand etwas.
//
// ⚠️ „Umkreis" heißt hier ORT, nicht Radius. Ein echter Umkreis („20 km um
// 13353") braucht Geokoordinaten je Postleitzahl; die Tabelle trägt nur `city`
// und `postal_code` als Text. Eine Ortsliste beantwortet dieselbe Frage für
// den Fall, der zählt („ist das bei mir in der Nähe / kann ich es abholen"),
// ohne eine Genauigkeit zu behaupten, die die Daten nicht hergeben.
//
// SUCHE UND SORTIERUNG — AB EINER SCHWELLE (seit 18.08.2026).
// Hier stand bis dahin „bewusst ohne Filter und Suche", und die Begründung war
// richtig: Eine Filterleiste über zwei Artikel ist keine Hilfe, sondern
// Beschäftigung. Sie ist es aber immer noch, sobald fünfzig Artikel im Regal
// liegen — dann ist ihr Fehlen das Problem (fünfte Whatnot-Analyse: deren
// Shop-Liste hat Suche und Chips, und zwar seit sie Bestand haben).
//
// Aufgelöst über eine SCHWELLE statt eines Entweder-Oder: Unter `TOOLS_FROM`
// Artikeln ist die Leiste nicht da, darüber schon. Damit gilt die alte
// Begründung weiter, ohne die neue Anforderung zu blockieren.
//
// ⚠️ Gefiltert und sortiert wird IM CLIENT, über die geladenen Zeilen. Das ist
// bei `useShopListings()` (Grenze 60) richtig und wird falsch, sobald das Regal
// darüber hinauswächst: Dann sucht die Leiste in den ersten sechzig und
// behauptet, das sei alles. Wer die Grenze anhebt, muss Suche und Sortierung
// in dieselbe Abfrage schieben.
//
// Ein Stack-Bildschirm, kein sechster Reiter: Unten liegen schon fünf, und
// „Kategorien" musste dafür bereits auf 10 pt verkleinert werden.
//
// Seit dem 17.08.2026 führt jede Karte auf `/listing/<id>` statt auf das Profil
// des Verkäufers, und der Kaufknopf ist aus dem Raster verschwunden. Begründung
// im Kopf von `components/ListingCard.tsx`.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search, SlidersHorizontal, X } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { formatEuro, useProfiles } from '../lib/useAuction';
import { useShopListings, type Listing } from '../lib/useListings';
import { useSavedIds, useToggleSaved } from '../lib/useSaved';
import { useCategoryOptions } from '../lib/useCategories';
import { conditionLabel } from '../lib/useBerkatSeller';
import { ListingCard } from '../components/ListingCard';
import { BerkatMark } from '../components/BerkatMark';
import { radius, space, ui } from '../theme/tokens';

const COLS = 2;

/**
 * Ab wie vielen Artikeln Suche und Sortierung erscheinen.
 *
 * Acht ist eine volle Rasterseite: Darunter sieht man ohnehin alles auf einmal,
 * und ein Werkzeug für etwas, das man schon überblickt, ist nur eine Zeile
 * weniger Ware auf dem Schirm.
 */
const TOOLS_FROM = 8;

type Sort = 'neu' | 'guenstig' | 'teuer';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'neu', label: 'Neueste' },
  { key: 'guenstig', label: 'Günstigste' },
  { key: 'teuer', label: 'Teuerste' },
];

/** Dieselbe Platzhalter-Falle wie überall: `flex: 1` zieht die letzte Karte breit. */
type Cell = Listing | { id: string; spacer: true };

function padToGrid(items: Listing[]): Cell[] {
  const rest = items.length % COLS;
  if (items.length === 0 || rest === 0) return items;
  return [
    ...items,
    ...Array.from({ length: COLS - rest }, (_, i) => ({
      id: `__spacer__-${i}`,
      spacer: true as const,
    })),
  ];
}

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const { data: listings = [], isLoading, refetch } = useShopListings();
  const profiles = useProfiles(listings.map((l) => l.seller_id));
  // Merken direkt von der Karte — der O(1)-Blick ins Set, siehe useSaved.ts.
  const { data: savedIds } = useSavedIds(myUserId);
  const toggleSaved = useToggleSaved(myUserId);
  // Slug → Anzeigename. `live_auctions.category` trägt Slugs; ohne das stünde
  // „gebetsteppiche" im Filter statt „Gebetsteppiche".
  const { groups: categoryGroups } = useCategoryOptions();
  const categoryNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of categoryGroups) {
      m.set(p.slug, p.name);
      for (const c of p.children) m.set(c.slug, c.name);
    }
    return m;
  }, [categoryGroups]);

  /**
   * Kind-Slug → Eltern-Slug. Der Filter arbeitet auf OBERkategorien.
   *
   * Am 18.08.2026 zuerst mit Unterkategorien gebaut und am Gerät sofort
   * verworfen: Das Blatt zeigte einunddreißig Einträge, davon zwanzig mit „1",
   * und man scrollte an ihnen vorbei, bevor „Zustand" überhaupt sichtbar wurde.
   * Zwölf Oberkategorien passen auf einen Blick und tragen Zahlen, die eine
   * Entscheidung stützen („Mode 8"). Wer feiner filtern will, hat dafür den
   * Kategorien-Reiter mit seinem Baum.
   */
  const parentOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of categoryGroups) {
      m.set(p.slug, p.slug);
      for (const c of p.children) m.set(c.slug, p.slug);
    }
    return m;
  }, [categoryGroups]);

  const [pulling, setPulling] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('neu');
  const [filterOpen, setFilterOpen] = useState(false);
  /** `null` = alle. Getrennte Zustände statt eines Objekts: Jeder wird einzeln gesetzt. */
  const [cat, setCat] = useState<string | null>(null);
  const [cond, setCond] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const activeFilters = [cat, cond, size, city, maxPrice].filter((v) => v !== null).length;
  const resetFilters = useCallback(() => {
    setCat(null);
    setCond(null);
    setSize(null);
    setCity(null);
    setMaxPrice(null);
  }, []);

  /**
   * Die Auswahl entsteht AUS DEN DATEN, nicht aus einer festen Liste.
   *
   * Eine feste Liste hätte 31 Unterkategorien und sechs Zustände, von denen die
   * meisten null Treffer liefern — Auswahlmöglichkeiten, die ins Leere führen,
   * sind schlimmer als keine. Was hier steht, hat garantiert mindestens einen
   * Artikel, und die Zahl daneben sagt wie viele.
   */
  const options = useMemo(() => {
    const count = (get: (l: Listing) => string | null | undefined) => {
      const map = new Map<string, number>();
      for (const l of listings) {
        const v = get(l);
        if (v) map.set(v, (map.get(v) ?? 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'));
    };
    return {
      // Auf die Oberkategorie gerollt — siehe `parentOf`.
      cats: count((l) => (l.category ? (parentOf.get(l.category) ?? l.category) : null)),
      conds: count((l) => l.condition),
      /**
       * ⚠️ Größen werden NICHT nach Häufigkeit sortiert, als einzige Gruppe.
       *
       * Bei Kategorie, Zustand und Ort sucht man das Naheliegende — die
       * häufigste Wahl zuerst ist dort die richtige Reihenfolge. Bei Größen
       * sucht man die EIGENE, und die ist so oft selten wie häufig. Eine nach
       * Häufigkeit geordnete Liste zwingt dann, alles zu lesen; „38 · 40 · 42 ·
       * M · One Size" findet man mit einem Blick.
       *
       * `numeric: true` sortiert „38" vor „40" vor „100" — ohne das käme die
       * Zeichenkettenordnung heraus („100" vor „38").
       */
      sizes: count((l) => l.size).sort((a, b) =>
        a[0].localeCompare(b[0], 'de', { numeric: true, sensitivity: 'base' }),
      ),
      cities: count((l) => l.city),
    };
  }, [listings, parentOf]);

  /** Preisstufen, die zum Bestand passen — „bis 500 €" wäre bei 249 € Höchstpreis sinnlos. */
  const priceSteps = useMemo(() => {
    const top = Math.max(0, ...listings.map((l) => l.buy_now_cents));
    return [2500, 5000, 10000, 25000].filter((c) => c < top);
  }, [listings]);

  // Die Werkzeuge hängen am GELADENEN Bestand, nicht am gefilterten — sonst
  // verschwände die Suche, sobald sie wenige Treffer liefert, und man käme
  // nicht mehr an sie heran, um den Suchbegriff zu ändern.
  const showTools = listings.length >= TOOLS_FROM;

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = listings.filter((l) => {
      // Filter zuerst, Suche danach — beide verengen, die Reihenfolge ist für
      // das Ergebnis gleich. Zusammen in EINEM Durchlauf, weil zwei Durchläufe
      // über dieselbe Liste nichts gewinnen.
      // Vergleich auf Elternebene: „Mode" muss auch „Abaya" durchlassen.
      if (cat && (!l.category || (parentOf.get(l.category) ?? l.category) !== cat)) return false;
      if (cond && l.condition !== cond) return false;
      if (size && l.size !== size) return false;
      if (city && l.city !== city) return false;
      if (maxPrice !== null && l.buy_now_cents > maxPrice) return false;
      if (!needle) return true;
      // Titel, Größe und Ort: die drei Dinge, nach denen jemand im Regal sucht —
      // „Abaya", „42", „Berlin". Die Beschreibung bleibt draußen, sie würde bei
      // drei Sätzen Fließtext zu viele Zufallstreffer liefern.
      //
      // Die Größe MUSS mit, seit es das Feld gibt (19.08.2026): Vorher stand sie
      // im Titel und war damit auffindbar. Sie in eine eigene Spalte zu heben und
      // die Suche nicht mitzuziehen hätte eine Fähigkeit weggenommen, die es
      // schon gab — der Filter allein setzt voraus, dass jemand ihn öffnet.
      const inTitle = l.title.toLowerCase().includes(needle);
      const inSize = (l.size ?? '').toLowerCase().includes(needle);
      const inCity = (l.city ?? '').toLowerCase().includes(needle);
      return inTitle || inSize || inCity;
    });

    if (sort === 'neu') return found;
    // `filter()` gibt bereits ein neues Feld zurück — hier darf also an Ort und
    // Stelle sortiert werden, ohne den Zwischenspeicher von React Query
    // umzustellen.
    return found.sort((a, b) =>
      sort === 'guenstig'
        ? a.buy_now_cents - b.buy_now_cents
        : b.buy_now_cents - a.buy_now_cents,
    );
  }, [listings, query, sort, cat, cond, size, city, maxPrice, parentOf]);

  // Die Reiter- und Stapel-Falle aus HANDOFF 3: Expo Router hält Bildschirme
  // aufgebaut. Wer ein Angebot kauft oder zurückzieht und zurückkommt, sähe es
  // sonst noch.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/categories')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Alle Angebote</Text>
          {/* Die Zahl steht hier und nicht als Kachel: Sie beantwortet „lohnt
              sich das Scrollen", und das ist eine Frage an die Überschrift. */}
          {listings.length > 0 ? (
            <Text style={styles.headerSub}>
              {/* Wird eingegrenzt, zählt die Trefferzahl — „38 Artikel" über
                  zwei Karten wäre eine Auskunft über etwas, das man gerade
                  nicht sieht.

                  ⚠️ Das galt zuerst nur für die SUCHE. Am 18.08.2026 am Gerät
                  gesehen: Mit den Filtern „Mode" und „Berlin" standen zwei
                  Karten da und darüber „38 Artikel". Wer hier eine dritte Art
                  der Eingrenzung einbaut, muss sie in diese Bedingung
                  aufnehmen. */}
              {query.trim() || activeFilters > 0
                ? shown.length === 1
                  ? '1 Treffer'
                  : `${shown.length} Treffer`
                : `${listings.length} Artikel · rund um die Uhr`}
            </Text>
          ) : null}
        </View>
        <View style={styles.back} />
      </View>

      {showTools ? (
        <View style={styles.tools}>
          <View style={styles.searchWrap}>
            <Search size={16} color={ui.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Im Regal suchen"
              placeholderTextColor={ui.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {/* Ohne diesen Knopf muss man zwölfmal die Rücktaste drücken, um
                aus einer Suche wieder herauszukommen. */}
            {query ? (
              <Pressable
                hitSlop={8}
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Suche löschen"
              >
                <X size={16} color={ui.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortRow}
          >
            {/* Der Filter steht VOR der Sortierung: Er verändert, WAS man
                sieht, die Sortierung nur die Reihenfolge. Die Zahl daneben ist
                Pflicht — ein aktiver Filter, den man nicht sieht, erklärt
                später ein halb leeres Regal nicht. */}
            <Pressable
              onPress={() => setFilterOpen(true)}
              style={[styles.chip, styles.filterChip, activeFilters > 0 && styles.chipOn]}
              accessibilityRole="button"
              accessibilityLabel={
                activeFilters > 0 ? `Filter, ${activeFilters} aktiv` : 'Filter'
              }
            >
              <SlidersHorizontal
                size={14}
                color={activeFilters > 0 ? ui.bg : ui.text}
              />
              <Text style={[styles.chipText, activeFilters > 0 && styles.chipTextOn]}>
                {activeFilters > 0 ? `Filter · ${activeFilters}` : 'Filter'}
              </Text>
            </Pressable>

            {SORTS.map((option) => {
              const on = option.key === sort;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSort(option.key)}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={padToGrid(shown)}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
          gap: space.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: space.xl }} color={ui.textMuted} />
          ) : query.trim() || activeFilters > 0 ? (
            // ⚠️ NICHT „Noch nichts im Regal": Das Regal ist voll, es passt nur
            // nichts zur Auswahl. Derselbe Fehler wie am 18.08. auf der
            // Startseite — ein Leerzustand, der über die falsche Menge redet
            // und den Suchenden wegschickt.
            //
            // Suche und Filter können BEIDE schuld sein. Der Text nennt
            // deshalb, was gerade eingegrenzt ist, und der Knopf räumt genau
            // das weg — sonst tippt jemand „Suche zurücksetzen" und steht
            // weiter vor einer leeren Fläche, weil noch ein Filter steht.
            <View style={styles.empty}>
              <BerkatMark size={36} color={ui.sunken} />
              <Text style={styles.emptyTitle}>
                {query.trim() ? `Nichts für „${query.trim()}"` : 'Nichts in dieser Auswahl'}
              </Text>
              <Text style={styles.emptyBody}>
                {query.trim() && activeFilters > 0
                  ? 'Es liegt an der Suche, an den Filtern — oder an beidem zusammen.'
                  : query.trim()
                    ? 'Gesucht wird in Titel, Größe und Ort. Versuch ein anderes Wort.'
                    : 'Die Filter sind zu eng. Nimm einen davon weg.'}
                {` Im Regal liegen ${listings.length} Artikel.`}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.clearCta, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setQuery('');
                  resetFilters();
                }}
                accessibilityRole="button"
                accessibilityLabel="Suche und Filter zurücksetzen"
              >
                <Text style={styles.clearCtaText}>
                  {query.trim() && activeFilters > 0
                    ? 'Suche und Filter zurücksetzen'
                    : query.trim()
                      ? 'Suche zurücksetzen'
                      : 'Filter zurücksetzen'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <BerkatMark size={36} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Noch nichts im Regal</Text>
              <Text style={styles.emptyBody}>
                Hier steht, was Verkäufer dauerhaft anbieten — auch wenn gerade niemand sendet.
                Du kannst der Erste sein: unter „Verkaufen" → „Dein Regal".
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          if ('spacer' in item) return <View style={{ flex: 1 }} />;
          const mine = myUserId === item.seller_id;
          const saved = Boolean(savedIds?.has(item.id));
          return (
            <ListingCard
              listing={item}
              sellerName={profiles[item.seller_id]?.username}
              mine={mine}
              saved={saved}
              onToggleSaved={
                mine
                  ? undefined
                  : () =>
                      myUserId
                        ? toggleSaved.mutate({ auctionId: item.id, saved })
                        : router.push('/login')
              }
              onPress={() => router.push(`/listing/${item.id}`)}
            />
          );
        }}
      />

      {/* ── Das Filter-Blatt. Dasselbe Muster wie das Wann-Blatt im Sendeplan
          und das Bearbeiten-Blatt der Artikelseite: Die Entscheidungen wandern
          eine Ebene tiefer, die Hauptfläche zeigt das Ergebnis.

          Es wirkt SOFORT, ohne „Übernehmen": Man sieht die Trefferzahl unten
          mitlaufen und schließt, wenn es passt. Ein Übernehmen-Knopf wäre eine
          zweite Entscheidung über dieselbe Sache. ────────────────────────── */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filter</Text>
            <Pressable
              hitSlop={10}
              onPress={() => setFilterOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <X size={22} color={ui.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody}>
            <FilterGroup
              label="Kategorie"
              options={options.cats}
              value={cat}
              onChange={setCat}
              display={(slug) => categoryNames.get(slug) ?? slug}
            />
            {/* Größe direkt nach der Kategorie: Wer „Mode" wählt, meint fast
                immer als Nächstes seine Größe. Zustand und Ort verengen danach,
                die Größe entscheidet. */}
            <FilterGroup
              label="Größe"
              options={options.sizes}
              value={size}
              onChange={setSize}
              display={(v) => v}
            />
            <FilterGroup
              label="Zustand"
              options={options.conds}
              value={cond}
              onChange={setCond}
              display={(slug) => conditionLabel(slug) ?? slug}
            />
            <FilterGroup
              label="Ort"
              options={options.cities}
              value={city}
              onChange={setCity}
              display={(c) => c}
            />

            {priceSteps.length > 0 ? (
              <>
                <Text style={styles.groupLabel}>Preis</Text>
                <View style={styles.groupRow}>
                  {priceSteps.map((cents) => {
                    const on = maxPrice === cents;
                    return (
                      <Pressable
                        key={cents}
                        onPress={() => setMaxPrice(on ? null : cents)}
                        style={[styles.opt, on && styles.optOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.optText, on && styles.optTextOn]}>
                          bis {formatEuro(cents)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.sheetFoot}>
            {activeFilters > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.footGhost, pressed && { opacity: 0.7 }]}
                onPress={resetFilters}
                accessibilityRole="button"
              >
                <Text style={styles.footGhostText}>Zurücksetzen</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.footPrimary, pressed && { opacity: 0.85 }]}
              onPress={() => setFilterOpen(false)}
              accessibilityRole="button"
            >
              {/* Die Zahl ist der eigentliche Inhalt des Knopfes: Sie sagt, was
                  die Auswahl gerade bewirkt, noch bevor man sie sieht. */}
              <Text style={styles.footPrimaryText}>
                {shown.length === 0
                  ? 'Keine Treffer'
                  : shown.length === 1
                    ? '1 Artikel zeigen'
                    : `${shown.length} Artikel zeigen`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Eine Filtergruppe: Überschrift, darunter die Werte mit ihrer Anzahl.
 *
 * Ein Tipp auf den bereits gewählten Wert hebt ihn auf — sonst käme man ohne
 * „Zurücksetzen" nie wieder auf „alle", und für eine einzelne Gruppe gibt es
 * keinen eigenen Knopf dafür.
 */
function FilterGroup({
  label,
  options,
  value,
  onChange,
  display,
}: {
  label: string;
  options: [string, number][];
  value: string | null;
  onChange: (v: string | null) => void;
  display: (key: string) => string;
}) {
  if (options.length < 2) return null; // Eine einzige Wahl ist keine Wahl.
  return (
    <>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.groupRow}>
        {options.map(([key, count]) => {
          const on = value === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(on ? null : key)}
              style={[styles.opt, on && styles.optOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${display(key)}, ${count}`}
            >
              <Text style={[styles.optText, on && styles.optTextOn]}>
                {display(key)} <Text style={styles.optCount}>{count}</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },
  headerSub: { textAlign: 'center', fontSize: 11, color: ui.textMuted, marginTop: 1 },

  row: { gap: space.md },

  tools: { paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 15, color: ui.text, padding: 0 },
  sortRow: { gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  // Dunkel, nicht gold: Eine Sortierung ist kein Kaufweg (theme/tokens).
  chipOn: { backgroundColor: ui.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: ui.text },
  chipTextOn: { color: ui.bg },

  empty: { alignItems: 'center', paddingTop: space.xl * 2, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text, marginTop: space.md },
  emptyBody: {
    fontSize: 13,
    color: ui.textMuted,
    marginTop: space.xs,
    textAlign: 'center',
    lineHeight: 19,
  },
  clearCta: {
    marginTop: space.md,
    height: 40,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  clearCtaText: { fontSize: 14, fontWeight: '700', color: ui.text },

  // Der Filter-Knopf trägt ein Symbol neben dem Wort — er ist kein Wert wie die
  // Sortier-Chips, sondern ein Weg in ein Blatt.
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },

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
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  optOn: { backgroundColor: ui.brand },
  optText: { fontSize: 13, fontWeight: '600', color: ui.text },
  optTextOn: { color: ui.bg },
  // Die Anzahl blasser als der Name: Sie ist die Nebenauskunft, nicht das, was
  // man liest, um zu entscheiden.
  optCount: { fontWeight: '400', color: ui.textMuted },

  sheetFoot: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  footGhost: {
    height: 48,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  footGhostText: { fontSize: 15, fontWeight: '700', color: ui.text },
  // Gold: Hier steht kein Kauf, aber der Weg zurück zur Ware — und es ist der
  // einzige Hauptweg auf diesem Blatt.
  footPrimary: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
  },
  footPrimaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
});

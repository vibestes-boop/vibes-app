// Startseite — der Basar bei Tag.
//
// Aufbau nach Whatnot: Suche, Filterreihe, zweispaltiges Raster. Der
// Verkäufername steht ÜBER der Karte, nicht darunter — bei Live-Shopping kauft
// man den Menschen, nicht das Bild.
//
// SENDET NIEMAND, ZEIGT DAS RASTER DAS REGAL (seit 18.08.2026).
// Vorher stand hier eine Ähre, ein Satz und ein Knopf, der ins Regal führte.
// Das war der Zustand, den rund 94 % aller Besucher sehen (HANDOFF 17) — die
// wichtigste Fläche der App verwies also fast immer auf einen anderen
// Bildschirm, statt selbst etwas zu zeigen. Aus der Design-Analyse: „Ein Regal
// erzeugt keine Nachfrage. Es hält Nachfrage, die schon da ist." Wer die App
// öffnet, HAT Nachfrage; sie einen Tipp weit wegzuschicken verschenkt sie.
//
// Die Regel dahinter: Erst die Live-Shows, und nur wenn es keine gibt, die
// Ware. Nie beides zugleich — eine laufende Sendung ist immer das Wichtigere,
// und zwei Sorten Karten im selben Raster wären zwei Antworten auf eine Frage.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Lock, MessageSquare, Search, ShoppingBag } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfiles, useServerClock, useShowPreviews } from '../../lib/useAuction';
import { BerkatMark } from '../../components/BerkatMark';
import { Avatar } from '../../components/Avatar';
import { CategoryRail, RAIL_SHORT, RAIL_TALL, type RailItem } from '../../components/CategoryRail';
import { LivePreview } from '../../components/LivePreview';
import { UpcomingStrip } from '../../components/UpcomingStrip';
import { SellerResults } from '../../components/SellerResults';
import { SEARCH_MIN, useSellerSearch } from '../../lib/useSellerSearch';
import { useUpcomingShows } from '../../lib/useSchedule';
import { useCategories, useCategoryOptions } from '../../lib/useCategories';
import {
  useCategoryListings,
  useListingSearch,
  useShopCount,
  useShopListings,
  type Listing,
} from '../../lib/useListings';
import { ListingResults } from '../../components/ListingResults';
import { ListingCard } from '../../components/ListingCard';
import { useSavedCounts, useSavedIds, useToggleSaved } from '../../lib/useSaved';
import { ui, radius, ratio, space } from '../../theme/tokens';
import { useSession } from '../../lib/session';
import { useUnreadCount } from '../../lib/useNotifications';
import { useUnreadMessageCount } from '../../lib/useDirectMessages';

type LiveShow = {
  id: string;
  host_id: string;
  title: string | null;
  viewer_count: number | null;
  thumbnail_url: string | null;
  category: string | null;
  women_only: boolean;
};

/**
 * Sentinel für „keine Kategorie gewählt".
 *
 * Bewusst ein Wert, der nie ein echter Slug sein kann: Die Spalten-Prüfung auf
 * `berkat_categories.slug` verlangt `^[a-z][a-z0-9-]{1,30}$`, die zwei
 * Unterstriche schließen eine Kollision also aus. Vorher stand hier der
 * Anzeigename „Für dich" und diente zugleich als Filterwert — das ging nur so
 * lange gut, wie Name und Schlüssel dasselbe waren.
 */
const ALL = '__all__';

// Der Lückenfüller der letzten Reihe. `spacer` ist kein Zierrat, sondern das
// Kennzeichen, an dem Karte und Platzhalter sicher auseinandergehalten werden.
const SPACER_ID = '__spacer__';
type Spacer = { id: typeof SPACER_ID; spacer: true };
/** Ein Angebot aus dem Regal, wenn keine Show läuft. */
type ShelfItem = { shelf: Listing };
type GridItem = LiveShow | Spacer | ShelfItem;

/**
 * Wie viele Angebote das Raster im Ruhezustand trägt.
 *
 * Es ist die Startseite, kein Katalog: Wer weiterstöbern will, findet unten den
 * Weg ins ganze Regal. Eine gerade Zahl, damit die letzte Reihe voll ist.
 */
const SHELF_PREVIEW = 8;

function useLiveShows() {
  return useQuery({
    queryKey: ['berkat', 'shows'],
    refetchInterval: 20_000,
    queryFn: async (): Promise<LiveShow[]> => {
      // Frauen-Only-Shows filtert die RLS auf live_sessions selbst heraus —
      // hier ist bewusst kein zusätzlicher Filter, sonst gäbe es zwei
      // Wahrheiten über dieselbe Grenze.
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, host_id, title, viewer_count, thumbnail_url, category, women_only')
        .eq('status', 'active')
        // `live_sessions` teilt sich Berkat mit Serlo. Ohne diesen Filter
        // standen hier auch ganz normale Serlo-Lives — ohne Artikel, ohne
        // Gebote, in einer reinen Auktions-App.
        .eq('app', 'berkat')
        .order('viewer_count', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as LiveShow[];
    },
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Abzeichen an der Glocke. Scheitert die Abfrage, liefert der Hook 0 — eine
  // fehlende Zahl darf die Startseite nicht mitreißen.
  const userId = useSession((st) => st.userId);
  const { data: unread = 0 } = useUnreadCount(userId);
  // Zweites Abzeichen, eigene Quelle: Nachrichten sind keine Meldungen. Wer
  // eine Frage zur Lieferadresse bekommt, findet sie sonst nur, wenn er zufällig
  // ins Konto geht — bis zum 16.08.2026 war das der einzige Weg dorthin.
  const { data: unreadMessages = 0 } = useUnreadMessageCount(userId);
  const { data: shows = [], isLoading, refetch } = useLiveShows();
  const { data: upcoming = [], refetch: refetchUpcoming } = useUpcomingShows();

  // Der Kreisel gehört NUR zum Ziehen von Hand. Hinge er an isRefetching,
  // würde er alle 20 Sekunden beim automatischen Abruf aufspringen — die Liste
  // sähe dauernd aus, als hinge sie fest.
  const [pulling, setPulling] = useState(false);
  const pullToRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([refetch(), refetchUpcoming()]);
    } finally {
      setPulling(false);
    }
  }, [refetch, refetchUpcoming]);
  const profiles = useProfiles(shows.map((s) => s.host_id));

  // Was in jeder Show gerade läuft. Die Uhr des Servers gilt auch hier: Der
  // Countdown auf den Karten darf nicht daran hängen, wie das Handy gestellt ist.
  const { serverNow } = useServerClock();
  const showIds = useMemo(() => shows.map((s) => s.id), [shows]);
  const previews = useShowPreviews(showIds, serverNow);

  // EIN Takt für die ganze Liste. Ein eigener Zähler je Karte wären sechzig
  // Uhren für dieselbe Sekunde; hier tickt die Liste, und jede Karte rechnet
  // sich ihre Restzeit selbst aus. Läuft nirgends eine Auktion, steht der Takt.
  const hasRunning = useMemo(
    () => Object.values(previews).some((p) => p.status === 'running'),
    [previews],
  );
  const [, tick] = useState(0);
  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [hasRunning]);

  // Beim Zurückwechseln auf diesen Reiter sofort nachladen. Expo Router hält
  // die Reiter im Speicher — ohne das stand die Startseite nach einem
  // Auktionsstart im Studio noch bis zu 20 Sekunden auf „Beginnt bald", obwohl
  // die Uhr längst lief. Beim allerersten Fokus wird übersprungen, sonst holt
  // die Startseite ihre eigenen Abfragen direkt nach dem Start doppelt.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'shows'] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'show-previews'] });
      // Auch der Sendeplan: Wer gerade im Verkaufen-Reiter einen Termin
      // eingetragen hat, soll ihn beim Zurückwechseln sofort oben stehen sehen.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'upcoming-shows'] });
      // Und die beiden Abzeichen oben rechts. Sie hingen sonst bis zu 30 bzw.
      // 60 Sekunden hinterher, weil beide Quellen serverseitig entstehen und
      // der Reiter im Speicher bleibt.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'notifications-unread'] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'unread-messages'] });
    }, [queryClient]),
  );

  const [search, setSearch] = useState('');
  // Die Suche im Raster filtert nur, was OHNEHIN geladen ist — also die
  // laufenden Shows. Diese hier fragt den Server nach Menschen und findet sie
  // deshalb auch, wenn gerade niemand sendet.
  const {
    data: foundSellers = [],
    isFetching: searching,
    error: searchError,
  } = useSellerSearch(search);
  // Die zweite Hälfte derselben Suche: Artikel nach Titel. Läuft parallel zur
  // Verkäufer-Suche — wer „Teekanne" tippt, meint keinen Benutzernamen.
  const { data: foundListings = [] } = useListingSearch(search);
  /** Irgendein Treffer im Kopf — egal ob Mensch oder Ware. */
  const hasSearchHits = foundSellers.length > 0 || foundListings.length > 0;
  const searchingSellers = search.trim().length >= SEARCH_MIN;
  const [filter, setFilter] = useState(ALL);

  /**
   * ⚠️ EIN Wert treibt beide Bewegungen — Verschiebung der Leiste UND das
   * Überblenden darin. Zwei getrennte Animationen für eine Geste laufen
   * unweigerlich auseinander; das sieht man als Zucken.
   *
   * `useNativeDriver: true` ist hier keine Optimierung, sondern der Punkt:
   * Die Bewegung läuft dann auf dem UI-Thread und bleibt flüssig, während
   * JavaScript Bilder nachlädt oder eine Abfrage auswertet. Möglich ist das
   * nur, weil ausschließlich `transform` und `opacity` bewegt werden — eine
   * Höhe ginge nicht (genau daran ist die erste Fassung gescheitert).
   */
  // `live_sessions.category` trägt seit dem 16.08.2026 einen SLUG, keinen
  // Anzeigenamen. Ohne diese Übersetzung stünde in der Leiste „beauty" und
  // „buecher" statt „Beauty & Duft" und „Bücher & Medien" — vorher fiel das
  // nicht auf, weil dort immer die Konstante `'shopping'` stand.
  const { groups: categoryGroups } = useCategoryOptions();
  // Die Zähler für die Entdeckungs-Leiste. Derselbe Abruf, den der
  // Kategorien-Reiter ohnehin macht — React Query gibt beiden dieselbe Antwort.
  const { data: counted = [] } = useCategories();
  // Nur die Zahl, keine Zeile (`head: true`) — sie beantwortet im Leerzustand
  // die Frage „gibt es hier überhaupt etwas zu tun?".
  const { data: shopCount = 0 } = useShopCount();
  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const parent of categoryGroups) {
      map.set(parent.slug, parent.name);
      for (const child of parent.children) map.set(child.slug, child.name);
    }
    return map;
  }, [categoryGroups]);

  /**
   * Die Leiste zeigt ALLE Oberkategorien, nicht nur die mit laufenden Shows.
   *
   * Bis zum 18.08.2026 wurde sie aus `shows` aufgebaut. Damit war sie genau
   * dann leer, wenn niemand sendet — also fast immer —, und beantwortete
   * ausgerechnet dann nichts, wenn jemand etwas zum Stöbern gesucht hätte.
   * Whatnots Leiste ist eine Entdeckungs-Leiste (Analyse, Nachtrag zur
   * vierten): Sie zeigt, was es GIBT; was gerade LÄUFT, steht im Raster
   * darunter.
   *
   * Die Reihenfolge trägt die Auskunft: erst Kategorien mit laufenden Shows,
   * dann die mit Ware im Regal, dann der Rest in gepflegter Sortierung. Wer die
   * Leiste von links liest, liest sie nach Wärme.
   */
  const categories = useMemo((): RailItem[] => {
    // `get_berkat_category_counts` rollt Kinder bereits auf die Eltern auf —
    // eine Show unter „Abaya" zählt dort auf „Mode". Selbst nachzurechnen wäre
    // eine zweite Wahrheit über dieselbe Zahl, und die Aggregation der RPC
    // achtet zusätzlich die Frauen-Only-Grenze (`SECURITY INVOKER`).
    const tiles = counted
      .filter((c) => !c.parent_slug)
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        liveCount: c.live_count,
        listingCount: c.listing_count,
      }));

    tiles.sort(
      (a, b) =>
        b.liveCount - a.liveCount ||
        b.listingCount - a.listingCount ||
        a.name.localeCompare(b.name, 'de'),
    );

    return [{ slug: ALL, name: 'Für dich', liveCount: shows.length, art: false }, ...tiles];
  }, [shows.length, counted]);

  // Erst ab zwei Kategorien lohnt eine Leiste — vorher gäbe es nichts zu
  // wählen, und das Polster oben wäre nur Leere.
  const railOn = categories.length > 1;
  const scrollY = useRef(new Animated.Value(0)).current;
  const RAIL_TRAVEL = RAIL_TALL - RAIL_SHORT;
  const railShift = scrollY.interpolate({
    inputRange: [0, RAIL_TRAVEL],
    outputRange: [0, -RAIL_TRAVEL],
    extrapolate: 'clamp',
  });
  const railProgress = scrollY.interpolate({
    inputRange: [0, RAIL_TRAVEL],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });


  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return shows.filter((show) => {
      if (filter !== ALL && show.category !== filter) return false;
      if (!needle) return true;
      const host = profiles[show.host_id]?.username ?? '';
      return (
        (show.title ?? '').toLowerCase().includes(needle) || host.toLowerCase().includes(needle)
      );
    });
  }, [shows, search, filter, profiles]);

  /**
   * Der Ruhezustand: keine laufende Show im Raster und keine Suche.
   *
   * Dann tritt das Regal an die Stelle des Rasters. Bei aktiver Suche wäre das
   * falsch — die Trefferliste steht schon im Kopf.
   *
   * ⚠️ Ein gesetzter FILTER schließt den Ruhezustand seit dem 18.08.2026 NICHT
   * mehr aus. Seit die Leiste alle Kategorien zeigt (Entdeckung statt
   * Show-Filter), führt der häufigste Tipp auf eine Kategorie, in der gerade
   * niemand sendet. Bliebe es beim alten Verhalten, hätte fast jeder Tipp mit
   * „Nichts gefunden" geantwortet, obwohl dort Ware liegt — die Leiste wäre
   * schlechter gewesen als gar keine.
   */
  const idle = !searchingSellers && !search && visible.length === 0;
  /** Die Kategorie und ihre Kinder — „Mode" muss auch zeigen, was unter „Abaya" liegt. */
  const filterSlugs = useMemo(() => {
    if (filter === ALL) return [];
    const parent = categoryGroups.find((g) => g.slug === filter);
    return parent ? [parent.slug, ...parent.children.map((c) => c.slug)] : [filter];
  }, [filter, categoryGroups]);

  // Zwei Quellen, eine Fläche: ohne Filter das ganze Regal, mit Filter die
  // Kategorie. Immer nur eine davon ist aktiv (`enabled`), es läuft also nie
  // ein Abruf für Zeilen, die niemand sieht.
  const { data: wholeShelf = [] } = useShopListings(SHELF_PREVIEW, idle && filter === ALL);
  const { data: categoryShelf = [] } = useCategoryListings(idle ? filterSlugs : []);
  const shelf = filter === ALL ? wholeShelf : categoryShelf.slice(0, SHELF_PREVIEW);
  // Eigener Aufruf statt einer gemeinsamen Liste mit den Show-Gastgebern: Die
  // Kette läuft profiles → visible → idle → shelf, ein Ring wäre die Folge.
  // React Query hält beide Antworten ohnehin im selben Zwischenspeicher, und
  // bei leerem Regal fragt dieser hier gar nicht erst (`enabled`).
  const shelfProfiles = useProfiles(shelf.map((l) => l.seller_id));

  // ⚠️ Merken direkt von der Karte — hier fehlte es, und zwar als EINZIGES der
  // drei Raster. Der Kommentar am Regal-Zweig unten sagt seit dem 18.08.
  // „dieselbe Karte wie im Marktplatz und in der Kategorie"; dort ist das Herz
  // seit dem 17.08. verkabelt, hier nie. Die Karte zeigt es nur, wenn sie
  // `onToggleSaved` bekommt — es fiel also nicht als Fehler auf, sondern als
  // gar nichts.
  //
  // Das trifft ausgerechnet den Bildschirm, den jeder als Ersten sieht: Wer im
  // Ruhezustand stöbert (rund 94 % der Zeit), konnte sich nichts merken, ohne
  // vorher zwei Bildschirme weiter zu gehen.
  //
  // Beide Abfragen laufen nur über die höchstens acht gezeigten Zeilen und
  // teilen sich den Zwischenspeicher mit `/shop` — dort stehen dieselben
  // Angebote unter demselben Schlüssel.
  const { data: savedIds } = useSavedIds(userId);
  const toggleSaved = useToggleSaved(userId);
  const { data: saveCounts } = useSavedCounts(shelf.map((l) => l.id));

  // Zwei Spalten, jede Karte `flex: 1`: Bleibt in der letzten Reihe ein Platz
  // frei, zieht sich die einzelne Karte über die volle Breite — samt Vorschau.
  // Ein leerer Platzhalter besetzt die zweite Spalte und hält die Karte halb.
  // Bei null Shows entsteht keiner, sonst stünde die Leer-Ansicht nie da.
  const gridData = useMemo((): GridItem[] => {
    if (idle) {
      const items: GridItem[] = shelf.map((listing) => ({ shelf: listing }));
      return items.length % 2 === 1 ? [...items, { id: SPACER_ID, spacer: true }] : items;
    }
    return visible.length % 2 === 1 ? [...visible, { id: SPACER_ID, spacer: true }] : visible;
  }, [idle, shelf, visible]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ⚠️ EINE Zeile für Marke, Suche und die zwei Knöpfe.
          Vorher waren es zwei — Kopfzeile, darunter das Suchfeld — und das
          kostete rund 46 Punkte Höhe, bevor der erste Inhalt kam. Auf einer
          Startseite, die stöbern soll, ist das die teuerste Fläche überhaupt.

          ⚠️ DER PREIS: Das Wortzeichen „berkat" ist weg, das Ährenzeichen
          bleibt. Beides plus Suchfeld plus zwei Knöpfe geht auf 393 Punkten
          nicht auf — dem Suchfeld blieben unter 180 Punkte, und ein Suchfeld,
          in das kein Suchbegriff sichtbar hineinpasst, ist keins.
          Wer das Wortzeichen zurückwill, bekommt das Suchfeld schmal; die
          Entscheidung gehört Zaur, nicht dem Layout. */}
      <View style={styles.header}>
        <BerkatMark size={26} color={ui.brand} />

        {/* ⚠️ Der Platzhalter trägt seit dem 22.08.2026 den MARKENNAMEN.
            Zwei Gründe, und der zweite wiegt schwerer als der erste:

            1. Seit die Kopfzeile mit dem Suchfeld in einer Zeile liegt, ist das
               Wortzeichen „berkat" weg (Abschnitt 68) — die Marke stand auf der
               Startseite nirgends mehr. Whatnot löst genau das genauso: „Whatnot
               durchsuchen" (Analyse 13).
            2. „Show oder Verkäufer" war seit dem 18.08. schlicht FALSCH. Die
               Suche findet seit Abschnitt 23 auch Artikel — sie zählte also zwei
               von drei Dingen auf, die sie kann, und ausgerechnet das häufigste
               fehlte.

            Das Lupensymbol daneben sagt „suchen" bereits; der Platzhalter darf
            deshalb den Namen tragen statt einer Aufzählung, die nie vollständig
            wird. */}
        <View style={styles.searchWrap}>
          <Search size={17} color={ui.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Berkat durchsuchen"
            placeholderTextColor={ui.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        {/* Rechts außen zwei Knöpfe, wie bei Whatnot: Posteingang und Glocke.
            Sie sehen gleich aus, sind aber nicht dasselbe — links steht, was
            ein MENSCH geschrieben hat, rechts, was BERKAT gemeldet hat. Der
            Posteingang steht davor, weil eine Frage des Verkäufers zur
            Lieferadresse dringender ist als ein Paket mit 24 Stunden Zeit. */}
        <View style={styles.headerActions}>
          <Pressable
            hitSlop={8}
            onPress={() => router.push('/messages')}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={
              unreadMessages > 0 ? `Nachrichten, ${unreadMessages} ungelesen` : 'Nachrichten'
            }
          >
            <MessageSquare size={21} color={ui.text} />
            {unreadMessages > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            hitSlop={8}
            onPress={() => router.push('/notifications')}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Meldungen, ${unread} neue` : 'Meldungen'}
          >
            <Bell size={21} color={ui.text} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Die Leiste trägt jetzt alle Kategorien und ist damit auch dann voll,
          wenn niemand sendet — die Bedingung von heute Mittag („erst ab zwei
          Einträgen") greift nur noch, solange die Kategorien nicht geladen
          sind. Sie bleibt trotzdem stehen: Ein Wackeln beim Nachladen wäre
          schlimmer als eine Zehntelsekunde ohne Leiste. */}
      {/* ⚠️ Die Leiste LIEGT ÜBER der Liste, sie steht nicht davor.
          Im Fluss würde jede Bewegung den Listeninhalt mitverschieben — das war
          der eigentliche Grund für das Ruckeln. Die Liste trägt stattdessen ein
          Polster von `RAIL_TALL` und behält ihr Layout unverändert.
          Nach der Liste gerendert, damit sie ohne `zIndex` obenauf liegt. */}
      <View style={styles.listWrap}>
      <Animated.FlatList
        data={gridData}
        // Regal-Artikel und Shows können dieselbe Position, aber nie dieselbe
        // Liste belegen; das Präfix hält die Schlüssel trotzdem auseinander,
        // falls beide Sorten je nebeneinander stehen sollten.
        /**
         * ⚠️ Beide Rückrufe sind AUSDRÜCKLICH getypt.
         * `Animated.FlatList` ist in den React-Native-Typen nur lose beschrieben
         * (`FlatListProps<any>`) — ohne diese Annotationen wäre `item` still zu
         * `any` geworden, und `'shelf' in item` prüfte nichts mehr. Ein
         * Typverlust, den kein Fehler meldet, ist der teuerste.
         */
        keyExtractor={(item: GridItem) => ('shelf' in item ? `shelf:${item.shelf.id}` : item.id)}
        refreshing={pulling}
        onRefresh={pullToRefresh}
        // ⚠️ Ohne den Versatz erschiene der Ladekreisel HINTER der Leiste.
        progressViewOffset={railOn ? RAIL_TALL : 0}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingTop: railOn ? RAIL_TALL : 0,
          paddingBottom: insets.bottom + space.xl,
        }}
        // Der Sendeplan steht ÜBER dem Raster, nicht darin: Er beantwortet eine
        // andere Frage („wann kommt wieder was?") als die Karten („was läuft
        // jetzt?"). Bei aktiver Suche verschwindet er — ein Termin ist kein
        // Suchtreffer.
        ListHeaderComponent={
          // Wer sucht, sucht selten eine laufende Show — er sucht einen
          // Menschen. Deshalb steht die Trefferliste an derselben Stelle, an
          // der sonst der „Demnächst"-Streifen steht.
          searchingSellers ? (
            <View>
              <SellerResults
                sellers={foundSellers}
                loading={searching}
                // Ohne den Fehler kann die Trefferliste „nicht angemeldet" nicht
                // von „nichts gefunden" unterscheiden — und sagte bisher das
                // Falsche.
                error={searchError}
                onSignIn={() => router.push('/login')}
                query={search.trim()}
                onSelect={(sellerId) => router.push(`/seller/${sellerId}`)}
              />
              {/* Artikel-Treffer darunter — rendert bei null Treffern nichts,
                  die Verkäufer-Box erklärt den Leerfall schon. */}
              <ListingResults
                listings={foundListings}
                onSelect={(auctionId) => router.push(`/listing/${auctionId}`)}
              />
            </View>
          ) : search ? null : (
            <View>
              {/* Ein Termin gehört zu keiner Kategorie — bei gesetztem Filter
                  wäre der Streifen eine Antwort auf eine nicht gestellte
                  Frage. */}
              {filter === ALL ? (
                <UpcomingStrip
                  shows={upcoming}
                  // `?tab=shows`: Wer auf einen TERMIN tippt, will den Termin sehen
                  // — nicht das Regal. Ohne den Parameter öffnet das Profil auf
                  // „Shop", und die Ankündigung liegt hinter dem dritten Reiter.
                  onSelect={(hostId) => router.push(`/seller/${hostId}?tab=shows`)}
                />
              ) : null}

              {/* Die Zeile über der Ware. Sie muss sein: Ohne sie stünden im
                  Show-Raster plötzlich Artikel, und niemand wüsste, warum sich
                  die Startseite anders verhält als eben noch. Der Satz sagt
                  beides — dass gerade niemand sendet, und dass es trotzdem
                  etwas gibt. Bei gesetztem Filter nennt er die Kategorie, sonst
                  stünde „Gerade ist niemand live" über einem Regal, das nur
                  einen Ausschnitt zeigt. */}
              {idle && shelf.length > 0 ? (
                <View style={styles.shelfHead}>
                  <Text style={styles.shelfTitle}>
                    {filter === ALL
                      ? 'Gerade ist niemand live'
                      : `Nichts live in ${categoryNames.get(filter) ?? 'dieser Kategorie'}`}
                  </Text>
                  <Text style={styles.shelfBody}>
                    Aus dem Regal — rund um die Uhr kaufbar, auch ohne Sendung.
                  </Text>
                </View>
              ) : null}
            </View>
          )
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <BerkatMark size={40} color={ui.sunken} />
              <Text style={styles.emptyTitle}>
                {searchingSellers && hasSearchHits
                  ? 'Keine laufende Show'
                  : search || filter !== ALL
                    ? 'Nichts gefunden'
                    : 'Gerade ist niemand live'}
              </Text>
              <Text style={styles.emptyBody}>
                {/* ⚠️ Dieser Leerzustand gehört dem SHOW-Raster, die Treffer
                    stehen im Kopf darüber — beides muss zusammenpassen. Am
                    18.08.2026 am Gerät gesehen: Die Artikelsuche fand
                    „Kaffeetasse", und darunter stand „Nichts gefunden. Versuch
                    es mit einem anderen Wort." Zwei Wahrheiten auf einem
                    Bildschirm, und der Satz schickt jemanden weg, der schon
                    gefunden hat. Wer hier eine dritte Trefferart einbaut, muss
                    sie in `hasSearchHits` mit aufnehmen. */}
                {searchingSellers && hasSearchHits
                  ? foundSellers.length > 0 && foundListings.length > 0
                    ? 'Aber die Treffer oben — Verkäufer und Artikel.'
                    : foundListings.length > 0
                      ? 'Aber die Artikel oben — tipp auf einen, um ihn dir anzusehen.'
                      : 'Aber die Verkäufer oben — tipp auf einen, um zu sehen, was er anbietet.'
                  : search || filter !== ALL
                  ? 'Versuch es mit einem anderen Wort.'
                  : // Steht ein Termin an, ist „schau später wieder rein" die
                    // falsche Auskunft — es gibt ja eine Antwort, und sie steht
                    // direkt darüber.
                    upcoming.length > 0
                    ? 'Aber der nächste Termin steht schon oben — folge dem Verkäufer, dann erinnern wir dich.'
                    : // Dieselbe Regel eine Ebene weiter: Liegt etwas im Regal,
                      // ist „schau später wieder rein" wieder die falsche
                      // Auskunft. Es gibt etwas zu tun, es steht nur zwei
                      // Bildschirme entfernt.
                      shopCount > 0
                      ? 'Aber es liegt etwas im Regal — rund um die Uhr kaufbar, auch ohne Sendung.'
                      : 'Schau später wieder rein — oder mach unter „Verkaufen" selbst die erste Show auf.'}
              </Text>

              {/* ⚠️ Seit dem 18.08.2026 ist das der AUSNAHMEFALL, nicht der
                  Normalfall: Sendet niemand, füllt das Regal das Raster, und
                  dieser Leerzustand erscheint gar nicht erst. Hierher kommt
                  nur noch, wer ein leeres Regal hat — oder dessen Regal-Abruf
                  gescheitert ist, während der Zähler noch eine Zahl kennt.
                  Genau dafür bleibt der Knopf stehen. */}
              {!search && filter === ALL && shopCount > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/shop')}
                  accessibilityRole="button"
                  accessibilityLabel={`Alle ${shopCount} Angebote ansehen`}
                >
                  <ShoppingBag size={16} color={ui.text} />
                  <Text style={styles.emptyCtaText}>
                    {shopCount === 1 ? '1 Angebot ansehen' : `${shopCount} Angebote ansehen`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        // Der Weg weiter — nur wenn es mehr gibt als die gezeigten acht. Steht
        // ohnehin alles da, wäre der Knopf eine Lüge über die Menge und ein
        // Tipp, der nichts Neues zeigt.
        //
        // ⚠️ Das Ziel hängt am Filter. Bei „Beauty & Duft" ins ganze Regal zu
        // schicken hieße, die eben getroffene Wahl wegzuwerfen — und die Zahl
        // daneben wäre die falsche (Gesamtbestand statt Kategorie).
        ListFooterComponent={
          !idle || shelf.length === 0 ? null : filter !== ALL ? (
            categoryShelf.length > shelf.length ? (
              <Pressable
                style={({ pressed }) => [styles.shelfMore, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/category/${filter}`)}
                accessibilityRole="button"
                accessibilityLabel={`Alle ${categoryShelf.length} Angebote in dieser Kategorie ansehen`}
              >
                <ShoppingBag size={16} color={ui.text} />
                <Text style={styles.emptyCtaText}>
                  Alle {categoryShelf.length} in {categoryNames.get(filter) ?? 'dieser Kategorie'}
                </Text>
              </Pressable>
            ) : null
          ) : shopCount > shelf.length ? (
            <Pressable
              style={({ pressed }) => [styles.shelfMore, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/shop')}
              accessibilityRole="button"
              accessibilityLabel={`Alle ${shopCount} Angebote ansehen`}
            >
              <ShoppingBag size={16} color={ui.text} />
              <Text style={styles.emptyCtaText}>Alle {shopCount} Angebote ansehen</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }: { item: GridItem }) => {
          // Der Platzhalter hält nur die Spalte offen: keine Karte, kein Bild,
          // nichts zum Drücken.
          if ('spacer' in item) return <View style={styles.spacer} />;

          // Ware aus dem Regal — dieselbe Karte wie im Marktplatz und in der
          // Kategorie. Kein eigener Aufbau: Die Anbieterkennzeichnung hängt an
          // ihr, und eine zweite Abschrift wäre genau der Fehler, für den es
          // `ListingCard` überhaupt gibt.
          if ('shelf' in item) {
            const mine = item.shelf.seller_id === userId;
            const saved = Boolean(savedIds?.has(item.shelf.id));
            return (
              <ListingCard
                listing={item.shelf}
                sellerName={shelfProfiles[item.shelf.seller_id]?.username}
                layout="grid"
                mine={mine}
                saved={saved}
                saveCount={saveCounts?.get(item.shelf.id)}
                // Am eigenen Artikel kein Herz — dort steht „Deins", und
                // gemerkt wird, was einem nicht gehört. Ohne Anmeldung führt
                // der Tipp zur Anmeldung statt ins Leere: Dieselbe Antwort wie
                // auf der Artikelseite, wo ein grauer Knopf ohne Erklärung
                // schon einmal eine Sackgasse war (HANDOFF 22).
                onToggleSaved={
                  mine
                    ? undefined
                    : () =>
                        userId
                          ? toggleSaved.mutate({ auctionId: item.shelf.id, saved })
                          : router.push('/login')
                }
                onPress={() => router.push(`/listing/${item.shelf.id}`)}
              />
            );
          }

          const host = profiles[item.host_id];
          const preview = previews[item.id];
          const secondsLeft =
            preview?.status === 'running' && preview.endsAt
              ? Math.max(0, (new Date(preview.endsAt).getTime() - serverNow()) / 1000)
              : null;
          return (
            <View style={styles.card}>
            <Pressable
              onPress={() => router.push(`/live/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={item.title ?? 'Live-Show'}
            >
              <View style={styles.sellerRow}>
                <Avatar uri={host?.avatarUrl} name={host?.username} size={24} />
                <Text numberOfLines={1} style={styles.sellerName}>
                  {host?.username ?? '…'}
                </Text>
              </View>

              <View style={styles.thumb}>
                {item.thumbnail_url ? (
                  <Image
                    source={{ uri: item.thumbnail_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={140}
                  />
                ) : null}
                {/* Beide Merkzeichen stehen oben in einer Reihe. Das
                    Frauen-Only-Zeichen saß früher unten links — da liegt jetzt
                    die Vorschau. Die Reihe bricht um, statt sich zu überlappen. */}
                <View style={styles.pillRow}>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>Live · {item.viewer_count ?? 0}</Text>
                  </View>
                  {item.women_only ? (
                    <View style={styles.wozBadge}>
                      <Lock size={11} color={ui.successInk} />
                      <Text style={styles.wozText}>Frauen-Only</Text>
                    </View>
                  ) : null}
                </View>

                {preview ? <LivePreview preview={preview} secondsLeft={secondsLeft} /> : null}
              </View>

              <Text numberOfLines={2} style={styles.cardTitle}>
                {item.title ?? 'Ohne Titel'}
              </Text>
            </Pressable>

            {/* ⚠️ AUSSERHALB des Karten-Knopfes, nicht darin.
                Whatnot macht die Kategorie zu einem Link (blau, anklickbar) —
                bei uns stand dort grauer Text, also eine Tür, die nirgends
                hinführt (zwölfte Analyse).

                Ein zweiter Knopf IM ersten wäre der bequeme Weg und derselbe
                Fehler wie in der Verkäufer-Karte des Shops (Abschnitt 25,
                „button-in-button"): Wer die Kategorie trifft, meint sie — wer
                daneben trifft, meint die Show. Zwei getrennte Flächen sagen das
                eindeutig, ein verschachtelter Knopf überlässt es dem Zufall.

                Ein Tipp FILTERT hier, statt woanders hinzuspringen: Der Rest
                der Startseite ist schon die passende Liste, sie muss nur
                enger werden. */}
            {item.category ? (
              <Pressable
                onPress={() => setFilter(item.category!)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Nur ${categoryNames.get(item.category) ?? item.category} zeigen`}
              >
                <Text style={styles.cardCategory}>
                  {categoryNames.get(item.category) ?? item.category}
                </Text>
              </Pressable>
            ) : null}
            </View>
          );
        }}
      />

      {railOn ? (
        <Animated.View
          style={[styles.railWrap, { transform: [{ translateY: railShift }] }]}
          pointerEvents="box-none"
        >
          <CategoryRail
            items={categories}
            active={filter}
            onSelect={setFilter}
            progress={railProgress}
          />
        </Animated.View>
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: ui.goldInk },

  // Nimmt, was zwischen Zeichen und Knöpfen übrig bleibt. 38 statt 42 Punkte
  // hoch: Es steht jetzt neben zwei 34er-Knöpfen und soll die Zeile nicht
  // aufblähen.
  searchWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  searchInput: { flex: 1, fontSize: 15, color: ui.text, padding: 0 },

  /**
   * ⚠️ `overflow: 'hidden'` ist hier PFLICHT, nicht Kosmetik.
   *
   * Die Leiste liegt absolut auf `top: 0` und schiebt sich beim Scrollen um 68
   * Punkte nach oben. Ohne Beschnitt malt sie ihre eigene Fläche genau dorthin,
   * wo Suchfeld und Knöpfe stehen — und die verschwinden dahinter. Genau so am
   * Gerät gesehen (22.08.2026): Die Kopfzeile war weg, obwohl sie noch da war.
   *
   * Die Regel: Wer etwas absolut positioniert und dann VERSCHIEBT, muss sagen,
   * wo es aufhören soll. Sonst hört es nirgends auf.
   */
  listWrap: { flex: 1, overflow: 'hidden' },
  // Über der Liste, nicht darin — siehe die Begründung am Aufrufort.
  railWrap: { position: 'absolute', top: 0, left: 0, right: 0 },

  card: { flex: 1, marginBottom: space.lg },
  spacer: { flex: 1 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sellerName: { flex: 1, fontSize: 13, fontWeight: '600', color: ui.text },
  thumb: {
    aspectRatio: ratio.card,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  pillRow: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    right: space.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 5,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ui.live,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ui.liveInk },
  livePillText: { fontSize: 11, fontWeight: '700', color: ui.liveInk },
  wozBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ui.success,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  wozText: { fontSize: 11, fontWeight: '700', color: ui.successInk },
  cardTitle: { marginTop: space.sm, fontSize: 14, fontWeight: '700', color: ui.text },
  // ⚠️ Markengrün statt Grau, seit sie anklickbar ist. Grauer Text heißt in
  // Berkat „Auskunft", und eine Auskunft tippt niemand an. Nicht Blau wie bei
  // Whatnot: Berkat hat keine blaue Verweis-Farbe, und eine neue einzuführen
  // hieße, sie überall einzuführen (zwölfte Analyse, offener Punkt).
  cardCategory: { marginTop: 2, fontSize: 12, fontWeight: '600', color: ui.brand },

  empty: { alignItems: 'center', paddingTop: 88, gap: space.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  emptyBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.xl,
    lineHeight: 20,
  },
  /* Kontur statt Gold: Gold ist in Berkat der Kaufweg (Gebot, Preis, Zuschlag).
     „Sieh dir das Regal an" ist eine Einladung zum Stöbern, kein Kauf. */
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    height: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  emptyCtaText: { fontSize: 14, fontWeight: '700', color: ui.text },

  /* Die Überschrift über der Ware. Kleiner als ein Leerzustand-Titel: Sie
     erklärt eine Fläche, die schon gefüllt ist — sie ist nicht selbst die
     Nachricht. */
  shelfHead: { paddingTop: space.sm, paddingBottom: space.md, gap: 2 },
  shelfTitle: { fontSize: 15, fontWeight: '700', color: ui.text },
  shelfBody: { fontSize: 13, color: ui.textMuted, lineHeight: 18 },
  /* Wie `emptyCta`, nur zentriert unter dem Raster statt in einer leeren
     Fläche — dieselbe Kontur, weil es dieselbe Einladung ist. */
  shelfMore: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
    height: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
});

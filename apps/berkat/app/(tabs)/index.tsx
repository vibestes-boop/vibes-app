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
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpRight, Bell, Heart, Lock, MessageSquare, Search, ShoppingBag, UsersRound } from 'lucide-react-native';
import { useLiveShows, type LiveShow } from '../../lib/useLiveShows';
import { useProfiles, useServerClock, useShowPreviews } from '../../lib/useAuction';
import { BerkatMark } from '../../components/BerkatMark';
import { Avatar } from '../../components/Avatar';
import { CategoryRail, categoryRailMetrics, type RailItem } from '../../components/CategoryRail';
import { HomeSkeleton } from '../../components/HomeSkeleton';
import { StoryRail } from '../../components/StoryRail';
import { useBerkatStories, useCreateStory } from '../../lib/useStories';
import { LivePreview } from '../../components/LivePreview';
import { UpcomingStrip } from '../../components/UpcomingStrip';
import { useUpcomingShows } from '../../lib/useSchedule';
import { useCategories, useCategoryOptions } from '../../lib/useCategories';
import {
  useCategoryListings,
  useShopCount,
  useShopListings,
  type Listing,
} from '../../lib/useListings';
import { ListingCard } from '../../components/ListingCard';
import { useSavedCounts, useSavedIds, useToggleSaved } from '../../lib/useSaved';
import { ui, radius, ratio, space } from '../../theme/tokens';
import { useSession } from '../../lib/session';
import { useUnreadCount } from '../../lib/useNotifications';
import { useUnreadMessageCount } from '../../lib/useDirectMessages';
import { PressFeedback } from '../../components/PressFeedback';
import { useReducedMotion } from '../../lib/useReducedMotion';


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

export default function HomeScreen() {
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const [railCompact, setRailCompact] = useState(false);
  const { fontScale } = useWindowDimensions();
  const { tall: RAIL_TALL, short: RAIL_SHORT } = categoryRailMetrics(fontScale);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Abzeichen an der Glocke. Scheitert die Abfrage, liefert der Hook 0 — eine
  // fehlende Zahl darf die Startseite nicht mitreißen.
  const userId = useSession((st) => st.userId);
  // Stories: der Ring über dem Regal. Begründung in `lib/useStories.ts`.
  //
  // ⚠️ Das eigene Profil wird hier NICHT mehr gebraucht. Bis zum 24.08.2026
  // gingen Bild und Name hinein, weil die eigene Scheibe vor der ersten Story
  // den Avatar zeigte. Seit die Kamera-Kachel das Anlegen übernimmt, gibt es
  // diese Scheibe nicht mehr — und eine Scheibe MIT Story bringt Bild und Name
  // aus ihrer eigenen Gruppe mit.
  const { data: storyGroups = [], refetch: refetchStories } = useBerkatStories();
  const createStory = useCreateStory();
  const { data: unread = 0, refetch: refetchUnread } = useUnreadCount(userId, isFocused);
  // Zweites Abzeichen, eigene Quelle: Nachrichten sind keine Meldungen. Wer
  // eine Frage zur Lieferadresse bekommt, findet sie sonst nur, wenn er zufällig
  // ins Konto geht — bis zum 16.08.2026 war das der einzige Weg dorthin.
  const { data: unreadMessages = 0, refetch: refetchMessages } = useUnreadMessageCount(userId, isFocused);
  const { data: shows = [], isLoading, isError: showsError, refetch } = useLiveShows(isFocused);
  const { data: upcoming = [], refetch: refetchUpcoming } = useUpcomingShows();

  // Der Kreisel gehört NUR zum Ziehen von Hand. Hinge er an isRefetching,
  // würde er alle 20 Sekunden beim automatischen Abruf aufspringen — die Liste
  // sähe dauernd aus, als hinge sie fest.
  const [pulling, setPulling] = useState(false);
  const profiles = useProfiles(shows.map((s) => s.host_id));

  // Was in jeder Show gerade läuft. Die Uhr des Servers gilt auch hier: Der
  // Countdown auf den Karten darf nicht daran hängen, wie das Handy gestellt ist.
  const { serverNow } = useServerClock();
  const showIds = useMemo(() => shows.map((s) => s.id), [shows]);
  const previews = useShowPreviews(showIds, serverNow, isFocused);

  // EIN Takt für die ganze Liste. Ein eigener Zähler je Karte wären sechzig
  // Uhren für dieselbe Sekunde; hier tickt die Liste, und jede Karte rechnet
  // sich ihre Restzeit selbst aus. Läuft nirgends eine Auktion, steht der Takt.
  const hasRunning = useMemo(
    () => Object.values(previews).some((p) => p.status === 'running'),
    [previews],
  );
  const [, tick] = useState(0);
  useEffect(() => {
    if (!isFocused || !hasRunning) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [isFocused, hasRunning]);

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
      // enabled kann bereits einen Abruf gestartet haben; nicht abbrechen
      // und neu senden, sondern diesen Abruf für die Rückkehr mitbenutzen.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'shows'] }, { cancelRefetch: false });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'show-previews'] }, { cancelRefetch: false });
      // Auch der Sendeplan: Wer gerade im Verkaufen-Reiter einen Termin
      // eingetragen hat, soll ihn beim Zurückwechseln sofort oben stehen sehen.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'upcoming-shows'] }, { cancelRefetch: false });
      // Und die beiden Abzeichen oben rechts. Sie hingen sonst bis zu 30 bzw.
      // 60 Sekunden hinterher, weil beide Quellen serverseitig entstehen und
      // der Reiter im Speicher bleibt.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'notifications-unread'] }, { cancelRefetch: false });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'unread-messages'] }, { cancelRefetch: false });
    }, [queryClient]),
  );

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
  const { data: counted = [], isLoading: categoriesLoading, refetch: refetchCategories } = useCategories(isFocused);
  // Nur die Zahl, keine Zeile (`head: true`) — sie beantwortet im Leerzustand
  // die Frage „gibt es hier überhaupt etwas zu tun?".
  const { data: shopCount = 0, refetch: refetchShopCount } = useShopCount();
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
  const railOn = categories.length > 1 || categoriesLoading;
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


  const visible = useMemo(
    () => shows.filter((show) => filter === ALL || show.category === filter),
    [shows, filter],
  );

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
  /**
   * Stöbern statt Suchen — unabhängig davon, ob gerade jemand sendet.
   *
   * ⚠️ **DIESE UNTERSCHEIDUNG IST AM 25.08.2026 DAZUGEKOMMEN, UND SIE WAR EIN
   * ECHTER FEHLER.** Vorher hing das Regal an `idle`, also an „niemand ist
   * live" — und `idle` schaltete nicht bloss die Anzeige um, sondern die
   * **Abfrage** (`enabled`). Sobald EINE Sendung lief, verschwanden alle
   * dreiunddreissig Regal-Artikel von der Startseite: Aus einem Marktplatz
   * wurde eine einzelne Karte.
   *
   * Das war zu der Zeit richtig gedacht, als das Regal zwei Artikel hatte und
   * als Lückenfüller gemeint war („Aus dem Regal — auch ohne Sendung"). Mit
   * einem gefüllten Regal ist es die falsche Rechnung: Eine laufende Show ist
   * ein Grund MEHR zu bleiben, kein Grund, alles andere wegzunehmen. Whatnot
   * zeigt beides untereinander.
   */
  const browsing = isFocused;
  /** Niemand sendet — nur noch für die Überschrift und den Leerzustand. */
  const idle = visible.length === 0;
  /** Die Kategorie und ihre Kinder — „Mode" muss auch zeigen, was unter „Abaya" liegt. */
  const filterSlugs = useMemo(() => {
    if (filter === ALL) return [];
    const parent = categoryGroups.find((g) => g.slug === filter);
    return parent ? [parent.slug, ...parent.children.map((c) => c.slug)] : [filter];
  }, [filter, categoryGroups]);

  // Zwei Quellen, eine Fläche: ohne Filter das ganze Regal, mit Filter die
  // Kategorie. Immer nur eine davon ist aktiv (`enabled`), es läuft also nie
  // ein Abruf für Zeilen, die niemand sieht.
  const wholeShelfQuery = useShopListings(SHELF_PREVIEW, browsing && filter === ALL);
  const categoryShelfQuery = useCategoryListings(filterSlugs, browsing);
  const shelfQuery = filter === ALL ? wholeShelfQuery : categoryShelfQuery;
  const categoryShelf = categoryShelfQuery.data ?? [];
  const shelf = useMemo(() => (shelfQuery.data ?? []).slice(0, SHELF_PREVIEW), [shelfQuery.data]);
  const shelfLoading = browsing && shelfQuery.isLoading;
  const homeError = showsError || (browsing && shelfQuery.isError);
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

  // Aktualisiert die sichtbare Quelle, einschließlich Regal, Stories und Zähler.
  // refetch() umgeht enabled: die ausgeblendete Kategorie-/Gesamtquelle deshalb
  // ausdrücklich auslassen. Ein laufender Gesten-Abruf wird nicht doppelt gestartet.
  const refreshingHome = useRef(false);
  const refetchShelf = shelfQuery.refetch;
  const pullToRefresh = useCallback(async () => {
    if (refreshingHome.current) return;
    refreshingHome.current = true;
    setPulling(true);
    try {
      await Promise.all([
        refetch(), refetchUpcoming(), refetchStories(), refetchCategories(), refetchShopCount(),
        ...(browsing ? [refetchShelf()] : []),
        ...(userId ? [refetchUnread(), refetchMessages()] : []),
        queryClient.invalidateQueries({ queryKey: ['berkat', 'show-previews'] }),
        queryClient.invalidateQueries({ queryKey: ['berkat', 'saved-counts'] }),
      ]);
    } finally {
      refreshingHome.current = false;
      setPulling(false);
    }
  }, [browsing, userId, refetch, refetchUpcoming, refetchStories, refetchCategories,
    refetchShopCount, refetchShelf, refetchUnread, refetchMessages, queryClient]);

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

  /**
   * Eine Regal-Karte — an ZWEI Stellen gebraucht, deshalb einmal geschrieben.
   *
   * Sendet niemand, steht das Regal im Raster selbst (`gridData`). Läuft eine
   * Show, steht es **unter** den Shows im Fuß. Zwei Orte, eine Karte: Eine
   * zweite Abschrift wäre genau der Fehler, für den es `ListingCard` gibt
   * (Übergabe: vier Fassungen derselben Auskunft, und sie liefen auseinander).
   */
  const shelfCard = useCallback(
    (listing: Listing) => {
      const mine = listing.seller_id === userId;
      const saved = Boolean(savedIds?.has(listing.id));
      return (
        <ListingCard
          listing={listing}
          sellerName={shelfProfiles[listing.seller_id]?.username}
          layout="grid"
          mine={mine}
          saved={saved}
          saveCount={saveCounts?.get(listing.id)}
          // Am eigenen Artikel kein Herz — dort steht „Deins", und gemerkt
          // wird, was einem nicht gehört. Ohne Anmeldung führt der Tipp zur
          // Anmeldung statt ins Leere (HANDOFF 22).
          onToggleSaved={
            mine
              ? undefined
              : () =>
                  userId
                    ? toggleSaved.mutate({ auctionId: listing.id, saved })
                    : router.push('/login')
          }
          onPress={() => router.push(`/listing/${listing.id}`)}
        />
      );
    },
    [savedIds, saveCounts, shelfProfiles, toggleSaved, userId],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View key={fontScale} style={styles.header}>
        <View style={styles.wordmark} accessible accessibilityRole="text" accessibilityLabel="Berkat">
          <BerkatMark size={26} color={ui.brand} />
          <Text style={styles.brandName}>berkat</Text>
        </View>

        <View style={styles.headerActions}>
          <PressFeedback
            onPress={() => router.push('/messages')}
            style={[styles.iconButton]}
            accessibilityRole="button"
            accessibilityLabel={
              unreadMessages > 0 ? `Nachrichten, ${unreadMessages} ungelesen` : 'Nachrichten'
            }
          >
            <MessageSquare size={21} color={ui.text} />
            {unreadMessages > 0 ? (
              <View style={styles.badge}>
                <Text allowFontScaling={false} style={styles.badgeText}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </Text>
              </View>
            ) : null}
          </PressFeedback>

          <PressFeedback
            onPress={() => router.push('/notifications')}
            style={[styles.iconButton]}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Meldungen, ${unread} neue` : 'Meldungen'}
          >
            <Bell size={21} color={ui.text} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text allowFontScaling={false} style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </PressFeedback>
        </View>
      </View>

      <View style={styles.searchArea}>
        <PressFeedback onPress={() => router.push('/search')}
          accessibilityRole="button" accessibilityLabel="Berkat durchsuchen"
          style={[styles.searchWrap]}>
          <Search size={19} color={ui.textMuted} />
          <Text style={styles.searchPlaceholder}>Berkat durchsuchen</Text>
        </PressFeedback>
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
          listener: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
            setRailCompact(event.nativeEvent.contentOffset.y >= RAIL_TRAVEL * 0.5);
          },
        })}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingTop: railOn ? RAIL_TALL : 0,
          paddingBottom: insets.bottom + space.xl,
        }}
        // Ohne Ware steht der Sendeplan im Kopf; sonst folgt er dem Regal.
        ListHeaderComponent={
            <View key={fontScale}>
              {homeError ? (
                <View style={styles.loadNotice} accessibilityLiveRegion="polite">
                  <Text style={styles.shelfBody}>
                    Ein Teil der Startseite konnte nicht geladen werden.
                  </Text>
                  <PressFeedback onPress={pullToRefresh} disabled={pulling}
                    accessibilityRole="button" accessibilityState={{ busy: pulling, disabled: pulling }}
                    style={styles.loadRetry}>
                    <Text style={styles.loadRetryText}>{pulling ? 'Wird aktualisiert …' : 'Erneut laden'}</Text>
                  </PressFeedback>
                </View>
              ) : null}
              <View style={styles.shortcuts}>
                <PressFeedback onPress={() => router.push('/saved')}
                  accessibilityRole="button" accessibilityLabel="Merkliste öffnen"
                  style={[styles.shortcut]}>
                  <Heart size={18} color={ui.brand} />
                  <Text style={styles.shortcutText}>Gemerkt</Text>
                  <ArrowUpRight size={14} color={ui.textMuted} />
                </PressFeedback>
                <PressFeedback onPress={() => router.push('/following')}
                  accessibilityRole="button" accessibilityLabel="Gefolgte Profile öffnen"
                  style={[styles.shortcut]}>
                  <UsersRound size={18} color={ui.brand} />
                  <Text style={styles.shortcutText}>Gefolgt</Text>
                  <ArrowUpRight size={14} color={ui.textMuted} />
                </PressFeedback>
              </View>
              <StoryRail
                groups={storyGroups}
                myUserId={userId ?? null}
                busy={createStory.isPending}
                onOpen={(sellerId) => router.push(`/story/${sellerId}`)}
                onCreate={() =>
                  userId
                    ? void createStory.mutateAsync()
                    : router.push('/login')
                }
              />

              {/* Ein Termin gehört zu keiner Kategorie — bei gesetztem Filter
                  wäre der Streifen eine Antwort auf eine nicht gestellte
                  Frage. */}
              {filter === ALL && shelf.length === 0 ? (
                <UpcomingStrip
                  shows={upcoming}
                  // `?tab=shows`: Wer auf einen TERMIN tippt, will den Termin sehen
                  // — nicht das Regal. Ohne den Parameter öffnet das Profil auf
                  // „Shop", und die Ankündigung liegt hinter dem dritten Reiter.
                  onSelect={(hostId) => router.push(`/seller/${hostId}?tab=shows`)}
                />
              ) : null}

              {idle && (shelf.length > 0 || shelfLoading) ? (
                <View style={styles.shelfHead}>
                  <View style={styles.sectionRow}>
                    <Text accessibilityRole="header" style={styles.shelfTitle}>
                      {filter === ALL ? 'Entdecken' : categoryNames.get(filter) ?? 'Entdecken'}
                    </Text>
                    <PressFeedback
                      onPress={() => router.push(filter === ALL ? '/shop' : `/category/${filter}`)}
                      accessibilityRole="button"
                      accessibilityLabel={filter === ALL ? 'Alle Angebote ansehen' : 'Alle Angebote dieser Kategorie ansehen'}
                      style={[styles.sectionLink]}>
                      <Text style={styles.sectionLinkText}>Alle ansehen</Text>
                      <ArrowUpRight size={16} color={ui.brand} />
                    </PressFeedback>
                  </View>
                  <Text style={styles.shelfBody}>Zum Stöbern. Zum Behalten.</Text>
                </View>
              ) : null}
              {!idle ? (
                <View style={styles.shelfHead}>
                  <Text accessibilityRole="header" style={styles.shelfTitle}>Jetzt live</Text>
                </View>
              ) : null}
            </View>
        }
        ListEmptyComponent={
          isLoading || shelfLoading ? (
            browsing ? <HomeSkeleton /> : (
              <View style={styles.empty} accessibilityRole="progressbar" accessibilityLabel="Startseite wird geladen">
                <ActivityIndicator color={ui.brand} />
              </View>
            )
          ) : homeError ? null : (
            <View style={styles.empty}>
              <BerkatMark size={40} color={ui.sunken} />
              <Text style={styles.emptyTitle}>
                {filter !== ALL ? 'Hier ist es noch ruhig' : 'Gerade ist niemand live'}
              </Text>
              <Text style={styles.emptyBody}>
                {filter !== ALL
                    ? 'In dieser Kategorie gibt es gerade keine Angebote. Entdecke die anderen Kategorien.'
                    : upcoming.length > 0
                      ? 'Der nächste Termin steht schon oben. Im Verkäuferprofil findest du mehr dazu.'
                      : shopCount > 0
                        ? 'Im Marktplatz kannst du auch ohne Live-Show stöbern.'
                        : 'Schau später wieder rein oder starte unter „Verkaufen“ deine eigene Show.'}
              </Text>

              {filter !== ALL ? (
                <PressFeedback onPress={() => setFilter(ALL)} accessibilityRole="button"
                  style={[styles.emptyCta]}>
                  <Text style={styles.emptyCtaText}>Alle Kategorien entdecken</Text>
                </PressFeedback>
              ) : null}

              {/* ⚠️ Seit dem 18.08.2026 ist das der AUSNAHMEFALL, nicht der
                  Normalfall: Sendet niemand, füllt das Regal das Raster, und
                  dieser Leerzustand erscheint gar nicht erst. Hierher kommt
                  nur noch, wer ein leeres Regal hat — oder dessen Regal-Abruf
                  gescheitert ist, während der Zähler noch eine Zahl kennt.
                  Genau dafür bleibt der Knopf stehen. */}
              {filter === ALL && shopCount > 0 ? (
                <PressFeedback
                  style={[styles.emptyCta]}
                  onPress={() => router.push('/shop')}
                  accessibilityRole="button"
                  accessibilityLabel={`Alle ${shopCount} Angebote ansehen`}
                >
                  <ShoppingBag size={16} color={ui.text} />
                  <Text style={styles.emptyCtaText}>
                    {shopCount === 1 ? '1 Angebot ansehen' : `${shopCount} Angebote ansehen`}
                  </Text>
                </PressFeedback>
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
          !browsing || shelf.length === 0 ? null : (
            <View>
              {/* ── ⚠️ DAS REGAL UNTER DEN SENDUNGEN (25.08.2026) ──────────
                  Läuft eine Show, stand hier bisher NICHTS — die Startseite
                  zeigte eine einzige Karte, und der ganze Marktplatz war weg.
                  Der Fehler war nicht die Gestaltung, sondern die Bedingung:
                  `idle` schaltete die Abfrage ab, nicht nur die Anzeige.

                  Jetzt hängt das Regal an `browsing` (also „nicht am Suchen")
                  und steht in BEIDEN Fällen da — sendet niemand, im Raster
                  selbst; sendet jemand, hier unten.

                  ⚠️ Die Überschrift steht NUR im Sende-Fall. Ohne Show trägt
                  sie schon der Kopf („Direkt kaufen") — zweimal derselbe Satz auf einem Bildschirm wäre
                  Lärm. */}
              {!idle ? (
                <View style={styles.shelfHead}>
                  <Text style={styles.shelfTitle}>Direkt kaufen</Text>
                  <Text style={styles.shelfBody}>
                    Entdecke Artikel — auch zwischen den Shows.
                  </Text>
                </View>
              ) : null}

              {/* Ein eigenes, umbrechendes Raster statt weiterer Zeilen in der
                  Liste: Ein Abschnittskopf mitten in einem `numColumns={2}`-
                  Raster geht nur mit Tricks, die später niemand mehr versteht.
                  Bei höchstens acht Karten (`SHELF_PREVIEW`) kostet das nichts
                  — die lange Liste bleibt oben und damit virtualisiert. */}
              {!idle ? (
                <View style={styles.footerGrid}>
                  {shelf.map((listing) => (
                    <View key={`foot:${listing.id}`} style={styles.footerCell}>
                      {shelfCard(listing)}
                    </View>
                  ))}
                </View>
              ) : null}

              {filter === ALL ? (
                <UpcomingStrip
                  shows={upcoming}
                  onSelect={(hostId) => router.push(`/seller/${hostId}?tab=shows`)}
                />
              ) : null}

              {filter !== ALL ? (
            categoryShelf.length > shelf.length ? (
              <PressFeedback
                style={[styles.shelfMore]}
                onPress={() => router.push(`/category/${filter}`)}
                accessibilityRole="button"
                accessibilityLabel={`Alle ${categoryShelf.length} Angebote in dieser Kategorie ansehen`}
              >
                <ShoppingBag size={16} color={ui.text} />
                <Text style={styles.emptyCtaText}>
                  Alle {categoryShelf.length} in {categoryNames.get(filter) ?? 'dieser Kategorie'}
                </Text>
              </PressFeedback>
            ) : null
          ) : shopCount > shelf.length ? (
            <PressFeedback
              style={[styles.shelfMore]}
              onPress={() => router.push('/shop')}
              accessibilityRole="button"
              accessibilityLabel={`Alle ${shopCount} Angebote ansehen`}
            >
              <ShoppingBag size={16} color={ui.text} />
              <Text style={styles.emptyCtaText}>Alle {shopCount} Angebote ansehen</Text>
            </PressFeedback>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }: { item: GridItem }) => {
          // Der Platzhalter hält nur die Spalte offen: keine Karte, kein Bild,
          // nichts zum Drücken.
          if ('spacer' in item) return <View style={styles.spacer} />;

          // Ware aus dem Regal — dieselbe Karte wie im Marktplatz und in der
          // Kategorie. Kein eigener Aufbau: Die Anbieterkennzeichnung hängt an
          // ihr, und eine zweite Abschrift wäre genau der Fehler, für den es
          // `ListingCard` überhaupt gibt.
          if ('shelf' in item) return shelfCard(item.shelf);

          const host = profiles[item.host_id];
          const preview = previews[item.id];
          const secondsLeft =
            preview?.status === 'running' && preview.endsAt
              ? Math.max(0, (new Date(preview.endsAt).getTime() - serverNow()) / 1000)
              : null;
          return (
            <View style={styles.card}>
            <PressFeedback kind="card"
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
            </PressFeedback>

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
              <PressFeedback
                onPress={() => setFilter(item.category!)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Nur ${categoryNames.get(item.category) ?? item.category} zeigen`}
              >
                <Text style={styles.cardCategory}>
                  {categoryNames.get(item.category) ?? item.category}
                </Text>
              </PressFeedback>
            ) : null}
            </View>
          );
        }}
      />

      {railOn ? (
        <Animated.View
          style={[styles.railWrap, { transform: [{ translateY: reducedMotion ? 0 : railShift }] }]}
          pointerEvents="box-none"
        >
          <CategoryRail
            key={fontScale}
            items={categories}
            active={filter}
            onSelect={setFilter}
            progress={railProgress}
            compact={!reducedMotion && railCompact}
            loading={categoriesLoading}
          />
        </Animated.View>
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadNotice: { padding: space.md, marginBottom: space.md, borderRadius: radius.md, backgroundColor: ui.card },
  loadRetry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: space.md },
  loadRetryText: { fontSize: 14, fontWeight: '600', color: ui.brand },
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingTop: space.xs,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brandName: { fontSize: 24, fontWeight: '700', letterSpacing: -0.8, color: ui.brand },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
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

  searchArea: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, minHeight: 46,
    borderRadius: radius.pill, backgroundColor: ui.card,
    borderWidth: 1, borderColor: ui.line,
  },
  searchPlaceholder: { flex: 1, minWidth: 0, fontSize: 15, color: ui.textMuted, paddingVertical: 10 },
  shortcuts: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  shortcut: {
    flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.md, backgroundColor: ui.card,
  },
  shortcutText: { flex: 1, fontSize: 14, fontWeight: '600', color: ui.brand },
  sectionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.md },
  sectionLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sectionLinkText: { color: ui.brand, fontSize: 13, fontWeight: '600' },

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
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
  emptyCtaText: { fontSize: 14, fontWeight: '700', color: ui.text },

  /* Die Überschrift über der Ware. Kleiner als ein Leerzustand-Titel: Sie
     erklärt eine Fläche, die schon gefüllt ist — sie ist nicht selbst die
     Nachricht. */
  shelfHead: { paddingTop: space.xs, paddingBottom: space.lg, gap: 2 },
  shelfTitle: { flexGrow: 1, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, color: ui.text },
  shelfBody: { fontSize: 13, color: ui.textMuted, lineHeight: 18 },
  /* Wie `emptyCta`, nur zentriert unter dem Raster statt in einer leeren
     Fläche — dieselbe Kontur, weil es dieselbe Einladung ist. */
  /* Das Regal im Fuß — umbrechend statt `numColumns`, siehe die Begründung
     dort. `48%` und nicht `flex: 1`: In einem umbrechenden Flex-Container
     zöge `flex: 1` eine einzelne Karte in der letzten Zeile auf volle Breite
     (dieselbe Falle wie in `StandingShelf`). */
  footerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  footerCell: { width: '48%' },
  shelfMore: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
  },
});

// Startseite — der Basar bei Tag.
//
// Aufbau nach Whatnot: Suche, Filterreihe, zweispaltiges Raster. Der
// Verkäufername steht ÜBER der Karte, nicht darunter — bei Live-Shopping kauft
// man den Menschen, nicht das Bild.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Lock, MessageSquare, Search, ShoppingBag } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfiles, useServerClock, useShowPreviews } from '../../lib/useAuction';
import { BerkatMark } from '../../components/BerkatMark';
import { Avatar } from '../../components/Avatar';
import { CategoryRail, type RailItem } from '../../components/CategoryRail';
import { LivePreview } from '../../components/LivePreview';
import { UpcomingStrip } from '../../components/UpcomingStrip';
import { SellerResults } from '../../components/SellerResults';
import { SEARCH_MIN, useSellerSearch } from '../../lib/useSellerSearch';
import { useUpcomingShows } from '../../lib/useSchedule';
import { useCategoryOptions } from '../../lib/useCategories';
import { useListingSearch, useShopCount } from '../../lib/useListings';
import { ListingResults } from '../../components/ListingResults';
import { ui, radius, space } from '../../theme/tokens';
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
type GridItem = LiveShow | Spacer;

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

  const [railCollapsed, setRailCollapsed] = useState(false);
  // Schwelle mit Abstand nach oben und unten, damit die Leiste nicht bei jedem
  // Wackeln des Daumens hin- und herspringt.
  const collapsedRef = useRef(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const next = collapsedRef.current ? y > 8 : y > 48;
    if (next !== collapsedRef.current) {
      collapsedRef.current = next;
      setRailCollapsed(next);
    }
  }, []);

  // `live_sessions.category` trägt seit dem 16.08.2026 einen SLUG, keinen
  // Anzeigenamen. Ohne diese Übersetzung stünde in der Leiste „beauty" und
  // „buecher" statt „Beauty & Duft" und „Bücher & Medien" — vorher fiel das
  // nicht auf, weil dort immer die Konstante `'shopping'` stand.
  const { groups: categoryGroups } = useCategoryOptions();
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

  const categories = useMemo((): RailItem[] => {
    const counts = new Map<string, number>();
    for (const show of shows) {
      if (!show.category) continue;
      counts.set(show.category, (counts.get(show.category) ?? 0) + 1);
    }
    return [
      { slug: ALL, name: 'Für dich', liveCount: shows.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([slug, liveCount]) => ({
          slug,
          // Kennt die Liste den Slug nicht (alte Zeile, gelöschte Kategorie),
          // steht er selbst da — besser als eine leere Kachel.
          name: categoryNames.get(slug) ?? slug,
          liveCount,
        })),
    ];
  }, [shows, categoryNames]);

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

  // Zwei Spalten, jede Karte `flex: 1`: Bleibt in der letzten Reihe ein Platz
  // frei, zieht sich die einzelne Karte über die volle Breite — samt Vorschau.
  // Ein leerer Platzhalter besetzt die zweite Spalte und hält die Karte halb.
  // Bei null Shows entsteht keiner, sonst stünde die Leer-Ansicht nie da.
  const gridData = useMemo(
    (): GridItem[] =>
      visible.length % 2 === 1 ? [...visible, { id: SPACER_ID, spacer: true }] : visible,
    [visible],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BerkatMark size={24} color={ui.brand} />
        <Text style={styles.wordmark}>berkat</Text>

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

      <View style={styles.searchWrap}>
        <Search size={17} color={ui.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Show oder Verkäufer suchen"
          placeholderTextColor={ui.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <View style={styles.railWrap}>
        <CategoryRail
          items={categories}
          active={filter}
          collapsed={railCollapsed}
          onSelect={setFilter}
        />
      </View>

      <FlatList
        data={gridData}
        keyExtractor={(item) => item.id}
        refreshing={pulling}
        onRefresh={pullToRefresh}
        onScroll={onScroll}
        scrollEventThrottle={32}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{
          paddingHorizontal: space.md,
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
          ) : search || filter !== ALL ? null : (
            <UpcomingStrip
              shows={upcoming}
              // `?tab=shows`: Wer auf einen TERMIN tippt, will den Termin sehen
              // — nicht das Regal. Ohne den Parameter öffnet das Profil auf
              // „Shop", und die Ankündigung liegt hinter dem dritten Reiter.
              onSelect={(hostId) => router.push(`/seller/${hostId}?tab=shows`)}
            />
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

              {/* Der Knopf steht unabhängig vom Text: Auch wer gerade auf einen
                  Termin verwiesen wird, darf jetzt etwas kaufen. Solange
                  niemand sendet — rund 94 % der Zeit — ist das der einzige Weg
                  von der Startseite zu etwas Kaufbarem. Vorher hing „Alle
                  Angebote" an einer einzigen Zeile im Kategorien-Reiter. */}
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
        renderItem={({ item }) => {
          // Der Platzhalter hält nur die Spalte offen: keine Karte, kein Bild,
          // nichts zum Drücken.
          if ('spacer' in item) return <View style={styles.spacer} />;

          const host = profiles[item.host_id];
          const preview = previews[item.id];
          const secondsLeft =
            preview?.status === 'running' && preview.endsAt
              ? Math.max(0, (new Date(preview.endsAt).getTime() - serverNow()) / 1000)
              : null;
          return (
            <Pressable
              style={styles.card}
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
              {item.category ? (
                <Text style={styles.cardCategory}>
                  {categoryNames.get(item.category) ?? item.category}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  wordmark: { fontSize: 21, fontWeight: '700', color: ui.text, letterSpacing: -0.4 },
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

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginTop: space.md,
    paddingHorizontal: space.md,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  searchInput: { flex: 1, fontSize: 15, color: ui.text, padding: 0 },

  railWrap: { paddingVertical: space.md },

  card: { flex: 1, marginBottom: space.lg },
  spacer: { flex: 1 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sellerName: { flex: 1, fontSize: 13, fontWeight: '600', color: ui.text },
  thumb: {
    aspectRatio: 1,
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
  cardCategory: { marginTop: 1, fontSize: 12, color: ui.textMuted },

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
});

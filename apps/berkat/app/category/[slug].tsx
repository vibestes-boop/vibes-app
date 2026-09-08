// Eine Kategorie — beide Regale auf einem Bildschirm.
//
// Oben, was gerade läuft. Darunter, was man ohne Show kaufen kann. Die
// Reihenfolge ist die Aussage: Eine laufende Auktion ist ein Ereignis mit Uhr,
// ein Dauerangebot wartet. Wer beides hat, zeigt zuerst das, was vorbeigeht.
//
// EIN FlatList, keine verschachtelten Listen: Die Shows liegen im
// `ListHeaderComponent`. Zwei ScrollViews ineinander sind auf Android der
// sichere Weg zu einer Liste, die sich nicht mehr scrollen lässt.

import { useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Lock, ShoppingBag } from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { useProfiles } from '../../lib/useAuction';
import { useCategoryContent, useCategoryTree } from '../../lib/useCategories';
import type { Listing } from '../../lib/useListings';
import { useSavedIds, useToggleSaved } from '../../lib/useSaved';
import { goBack } from '../../lib/nav';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { SellerShopMore } from '../../components/SellerShopMore';
import { ListingCard } from '../../components/ListingCard';
import { radius, space, ui } from '../../theme/tokens';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const focused = useIsFocused();
  const { fontScale } = useWindowDimensions();
  const [pulling, setPulling] = useState(false);
  const pullBusy = useRef(false);
  const categoryQuery = useCategoryTree(focused);
  const { data: categories = [], tree } = categoryQuery;

  // Der Name steht schon im Zwischenspeicher des Reiters — ein eigener Aufruf
  // dafür wäre eine Abfrage für eine Überschrift. Fehlt er (Direktlink, kalter
  // Start), tut es der Slug.
  const title = useMemo(
    () => categories.find((c) => c.slug === slug)?.name ?? slug ?? 'Kategorie',
    [categories, slug],
  );

  // Eine OBERkategorie zeigt auch, was in ihren Kindern liegt. Ohne das wäre
  // „Mode" leer, während unter „Abaya" drei Artikel hängen — und die Kachel
  // hätte gelogen, weil ihre Zahl die Kinder mitzählt.
  const slugs = useMemo(() => {
    if (!slug) return [];
    const parent = tree.find((node) => node.slug === slug);
    return parent ? [slug, ...parent.children.map((child) => child.slug)] : [slug];
  }, [slug, tree]);

  const { shows, listings } = useCategoryContent(slugs, focused && Boolean(categoryQuery.data));

  // Zwei Spalten, `flex: 1` je Zelle: Bleibt in der letzten Reihe ein Platz
  // frei, zöge sich der einzelne Artikel über die volle Breite. Der Platzhalter
  // besetzt ihn. `spacer: true` als Merkmal statt eines Vergleichs auf der id —
  // TypeScript reduziert das Literal in der Vereinigung sonst zu `string`
  // (dieselbe Falle wie im Show-Raster der Startseite).
  const gridItems = useMemo((): (Listing | { id: string; spacer: true })[] => {
    const rows = listings.data?.listings ?? [];
    return rows.length % 2 === 1
      ? [...rows, { id: '__spacer__', spacer: true as const }]
      : rows;
  }, [listings.data]);

  const liveShows = shows.data ?? [];
  const items = listings.data?.listings ?? [];

  const sellerIds = useMemo(
    () => [...liveShows.map((s) => s.host_id), ...items.map((i) => i.seller_id)],
    [liveShows, items],
  );
  const profiles = useProfiles(sellerIds);

  // Kein Kaufweg auf dieser Seite. Eine Kategorie ist eine Stöber-Fläche, und
  // seit dem 17.08.2026 liegt der einzige Kaufknopf der App auf `/listing/<id>`
  // — dort, wo Beschreibung, Versandkosten und Anbieterkennzeichnung
  // danebenstehen. Begründung im Kopf von `components/ListingCard.tsx`.
  const { data: savedIds } = useSavedIds(myUserId);
  const toggleSaved = useToggleSaved(myUserId);
  const loading = categoryQuery.isLoading || shows.isLoading || listings.isLoading;
  const hasError = categoryQuery.isError || shows.isError || (listings.isError && !listings.isFetchNextPageError);
  const fetching = categoryQuery.isFetching || shows.isFetching || listings.isFetching;
  const refresh = async () => {
    if (fetching || listings.isDebouncing || pullBusy.current) return;
    pullBusy.current = true;
    setPulling(true);
    try {
      if (!categoryQuery.data) {
        await categoryQuery.refetch({ cancelRefetch: false });
      } else {
        await Promise.all([
          categoryQuery.refetch({ cancelRefetch: false }),
          shows.refetch({ cancelRefetch: false }),
          listings.refetch({ cancelRefetch: false }),
        ]);
      }
    } finally {
      pullBusy.current = false;
      setPulling(false);
    }
  };
  const loadMore = () => {
    if (!listings.isFetching && !listings.isDebouncing && !pullBusy.current && listings.hasNextPage) {
      void listings.fetchNextPage({ cancelRefetch: false });
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View key={fontScale} style={styles.header}>
        <Pressable
          hitSlop={10}
          onPress={() => goBack('/(tabs)/categories')}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text numberOfLines={2} style={styles.headerTitle}>
          {title}
        </Text>
        <View style={styles.back} />
      </View>

      <FlatList
        key={listings.filterKey}
        data={gridItems}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} tintColor={ui.textMuted} />}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
          gap: space.lg,
        }}
        ListHeaderComponent={
          <>
          {hasError ? (
            <View style={styles.error}>
              <Text style={styles.emptyTitle}>Laden hat nicht geklappt</Text>
              <Text style={styles.emptyBody}>
                {items.length > 0 || liveShows.length > 0
                  ? 'Ein Teil konnte nicht aktualisiert werden. Bereits geladene Inhalte bleiben sichtbar.'
                  : 'Wir konnten diese Kategorie nicht vollständig laden. Versuch es bitte noch einmal.'}
              </Text>
              <Pressable
                style={styles.retry}
                onPress={refresh}
                disabled={fetching}
                accessibilityRole="button"
                accessibilityState={{ disabled: fetching, busy: fetching }}
              >
                <Text style={styles.retryText}>{fetching ? 'Wird geladen …' : 'Erneut laden'}</Text>
              </Pressable>
            </View>
          ) : null}
          {liveShows.length === 0 ? null : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Läuft gerade</Text>
              {liveShows.map((show) => {
                const host = profiles[show.host_id];
                return (
                  <Pressable
                    key={show.id}
                    style={({ pressed }) => [styles.showRow, pressed && styles.pressed]}
                    onPress={() => router.push(`/live/${show.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={show.title ?? 'Live-Show'}
                  >
                    <View style={styles.showThumb}>
                      {show.thumbnail_url ? (
                        <Image
                          source={{ uri: show.thumbnail_url }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={120}
                        />
                      ) : null}
                      <View style={styles.livePill}>
                        <View style={styles.liveDot} />
                        <Text style={styles.livePillText}>{show.viewer_count ?? 0}</Text>
                      </View>
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.sellerRow}>
                        <Avatar uri={host?.avatarUrl} name={host?.username} size={20} />
                        <Text numberOfLines={1} style={styles.sellerName}>
                          {host?.username ?? '…'}
                        </Text>
                        {show.women_only ? <Lock size={12} color={ui.success} /> : null}
                      </View>
                      <Text numberOfLines={2} style={styles.showTitle}>
                        {show.title ?? 'Ohne Titel'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {items.length > 0 ? (
                <View style={styles.shelfHead}>
                  <ShoppingBag size={15} color={ui.text} />
                  <Text style={styles.sectionLabel}>Angebote</Text>
                </View>
              ) : null}
            </View>
          )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={ui.brand} accessibilityLabel="Kategorie wird geladen" />
            </View>
          ) : hasError || liveShows.length > 0 ? null : (
            <View style={styles.empty}>
              <BerkatMark size={38} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Hier ist noch nichts</Text>
              <Text style={styles.emptyBody}>
                In {title} ist gerade kein Angebot und keine Show verfügbar. Entdecke weitere Kategorien oder schau später wieder vorbei.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          // Der Lückenfüller hält die Spalte offen — sonst zöge sich ein
          // einzelner Artikel in der letzten Reihe über die volle Breite.
          if ('spacer' in item) return <View style={styles.gridCell} />;

          const mine = item.seller_id === myUserId;
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
        ListFooterComponent={<>
          <SellerShopMore hasMore={listings.hasNextPage} fetching={listings.isFetching || pulling}
            loadingMore={listings.isFetchingNextPage} failed={listings.isFetchNextPageError} onLoad={loadMore} />
          {items.length > 0 ? <Text style={styles.footHint}>
            Alles von einem Verkäufer kommt in dasselbe Paket — du zahlst nur einmal Versand.
          </Text> : null}
        </>}

      />
    </View>
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
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  section: { gap: space.sm },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: ui.textMuted },
  shelfHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  pressed: { opacity: 0.65 },
  error: { backgroundColor: ui.card, borderRadius: radius.md, padding: space.lg, alignItems: 'center', gap: space.sm, marginBottom: space.md },
  retry: { minHeight: 48, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: ui.lineStrong, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 15, fontWeight: '600', color: ui.text },

  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.sm,
  },
  showThumb: {
    width: 76,
    height: 76,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  livePill: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ui.live,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ui.liveInk },
  livePillText: { fontSize: 10, fontWeight: '700', color: ui.liveInk },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sellerName: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: ui.text },
  showTitle: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 3 },

  // Die Zelle hält nur die Spalte — gezeichnet wird in `ListingCard`.
  gridCell: { flex: 1 },

  footHint: {
    fontSize: 11,
    color: ui.textMuted,
    textAlign: 'center',
    paddingTop: space.lg,
    lineHeight: 16,
  },

  empty: { alignItems: 'center', paddingTop: 72, gap: space.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text, textAlign: 'center' },
  emptyBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    lineHeight: 20,
  },
});

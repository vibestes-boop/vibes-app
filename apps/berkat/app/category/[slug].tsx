// Eine Kategorie — beide Regale auf einem Bildschirm.
//
// Oben, was gerade läuft. Darunter, was man ohne Show kaufen kann. Die
// Reihenfolge ist die Aussage: Eine laufende Auktion ist ein Ereignis mit Uhr,
// ein Dauerangebot wartet. Wer beides hat, zeigt zuerst das, was vorbeigeht.
//
// EIN FlatList, keine verschachtelten Listen: Die Shows liegen im
// `ListHeaderComponent`. Zwei ScrollViews ineinander sind auf Android der
// sichere Weg zu einer Liste, die sich nicht mehr scrollen lässt.

import { useCallback, useMemo } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { ListingCard } from '../../components/ListingCard';
import { radius, space, ui } from '../../theme/tokens';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: categories = [], tree } = useCategoryTree();

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

  const { shows, listings } = useCategoryContent(slugs);

  // Zwei Spalten, `flex: 1` je Zelle: Bleibt in der letzten Reihe ein Platz
  // frei, zöge sich der einzelne Artikel über die volle Breite. Der Platzhalter
  // besetzt ihn. `spacer: true` als Merkmal statt eines Vergleichs auf der id —
  // TypeScript reduziert das Literal in der Vereinigung sonst zu `string`
  // (dieselbe Falle wie im Show-Raster der Startseite).
  const gridItems = useMemo((): (Listing | { id: string; spacer: true })[] => {
    const rows = listings.data ?? [];
    return rows.length % 2 === 1
      ? [...rows, { id: '__spacer__', spacer: true as const }]
      : rows;
  }, [listings.data]);

  // Beim Zurückkommen neu laden.
  //
  // Expo Router hält auch STACK-Bildschirme aufgebaut, nicht nur Reiter — wer
  // von hier aufs Profil geht, dort einen Artikel zurückzieht und zurückkommt,
  // sah sonst weiter den Stand von vorhin. Am 16.08.2026 genau so passiert:
  // „Fahrrad" stand nach dem Zurückziehen noch unter Sonstiges, und ein Tipp
  // darauf führte auf ein Profil, auf dem er nicht mehr war.
  //
  // Das ist dieselbe Falle wie in HANDOFF 3 („Reiter-Bildschirme bleiben
  // aufgebaut"), nur eine Ebene tiefer. `refetchOnWindowFocus` allein genügt
  // nicht: Das feuert erst beim Wechsel aus dem Hintergrund der ganzen App.
  const refetchShows = shows.refetch;
  const refetchListings = listings.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetchShows();
      void refetchListings();
    }, [refetchShows, refetchListings]),
  );

  const liveShows = shows.data ?? [];
  const items = listings.data ?? [];

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
  const loading = shows.isLoading || listings.isLoading;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/categories')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
        <View style={styles.back} />
      </View>

      <FlatList
        data={gridItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
          gap: space.lg,
        }}
        ListHeaderComponent={
          liveShows.length === 0 ? null : (
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
                  <Text style={styles.sectionLabel}>Jetzt kaufbar</Text>
                </View>
              ) : null}
            </View>
          )
        }
        ListEmptyComponent={
          loading ? null : liveShows.length > 0 ? null : (
            <View style={styles.empty}>
              <BerkatMark size={38} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Hier ist noch nichts</Text>
              <Text style={styles.emptyBody}>
                Keine laufende Show und kein Dauerangebot in {title}. Unter „Verkaufen" kannst du
                das ändern — ein Artikel hier ist rund um die Uhr kaufbar, auch ohne Sendung.
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
        ListFooterComponent={
          items.length > 0 ? (
            <Text style={styles.footHint}>
              Alles von einem Verkäufer kommt in dasselbe Paket — du zahlst nur einmal Versand.
            </Text>
          ) : null
        }
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
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
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
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  emptyBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.lg,
    lineHeight: 20,
  },
});

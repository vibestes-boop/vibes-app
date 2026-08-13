// Startseite — der Basar bei Tag.
//
// Aufbau nach Whatnot: Suche, Filterreihe, zweispaltiges Raster. Der
// Verkäufername steht ÜBER der Karte, nicht darunter — bei Live-Shopping kauft
// man den Menschen, nicht das Bild.

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
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
import { Lock, Search } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfiles } from '../../lib/useAuction';
import { BerkatMark } from '../../components/BerkatMark';
import { Avatar } from '../../components/Avatar';
import { CategoryRail, type RailItem } from '../../components/CategoryRail';
import { ui, radius, space } from '../../theme/tokens';

type LiveShow = {
  id: string;
  host_id: string;
  title: string | null;
  viewer_count: number | null;
  thumbnail_url: string | null;
  category: string | null;
  women_only: boolean;
};

const ALL = 'Für dich';

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
  const { data: shows = [], isLoading, refetch } = useLiveShows();

  // Der Kreisel gehört NUR zum Ziehen von Hand. Hinge er an isRefetching,
  // würde er alle 20 Sekunden beim automatischen Abruf aufspringen — die Liste
  // sähe dauernd aus, als hinge sie fest.
  const [pulling, setPulling] = useState(false);
  const pullToRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);
  const profiles = useProfiles(shows.map((s) => s.host_id));

  const [search, setSearch] = useState('');
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

  const categories = useMemo((): RailItem[] => {
    const counts = new Map<string, number>();
    for (const show of shows) {
      if (!show.category) continue;
      counts.set(show.category, (counts.get(show.category) ?? 0) + 1);
    }
    return [
      { name: ALL, liveCount: shows.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, liveCount]) => ({ name, liveCount })),
    ];
  }, [shows]);

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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BerkatMark size={24} color={ui.brand} />
        <Text style={styles.wordmark}>berkat</Text>
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
        data={visible}
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
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <BerkatMark size={40} color={ui.sunken} />
              <Text style={styles.emptyTitle}>
                {search || filter !== ALL ? 'Nichts gefunden' : 'Gerade ist niemand live'}
              </Text>
              <Text style={styles.emptyBody}>
                {search || filter !== ALL
                  ? 'Versuch es mit einem anderen Wort.'
                  : 'Schau später wieder rein — oder mach unter „Verkaufen" selbst die erste Show auf.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const host = profiles[item.host_id];
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

              <Text numberOfLines={2} style={styles.cardTitle}>
                {item.title ?? 'Ohne Titel'}
              </Text>
              {item.category ? <Text style={styles.cardCategory}>{item.category}</Text> : null}
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
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sellerName: { flex: 1, fontSize: 13, fontWeight: '600', color: ui.text },
  thumb: {
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  livePill: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
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
    position: 'absolute',
    bottom: space.sm,
    left: space.sm,
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
});

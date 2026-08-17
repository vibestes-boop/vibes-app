// Alles, was gerade kaufbar ist — über alle Verkäufer und Kategorien.
//
// Der Bildschirm, der aus einer Auktions-App einen Marktplatz macht: Bis hierher
// war ein Dauerangebot nur über das Profil seines Verkäufers oder über eine
// Kategorie erreichbar — und die Kategorie ist beim Einstellen freiwillig. Wer
// ohne sie einstellte, legte seinen Artikel für die Allgemeinheit unauffindbar
// ab.
//
// ⚠️ BEWUSST OHNE FILTER, SUCHE UND UMKREIS.
// In der Datenbank liegen zwei Angebote. Eine Filterleiste über zwei Artikel ist
// keine Hilfe, sondern Beschäftigung — und Zustand, PLZ und Ort stehen bereits
// an der Zeile, lassen sich also später ohne Datenwanderung nachrüsten.
//
// Ein Stack-Bildschirm, kein sechster Reiter: Unten liegen schon fünf, und
// „Kategorien" musste dafür bereits auf 10 pt verkleinert werden.

import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Lock } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { formatEuro, useProfiles } from '../lib/useAuction';
import { conditionLabel } from '../lib/useBerkatSeller';
import { useShopListings } from '../lib/useShop';
import type { CategoryListing } from '../lib/useCategories';
import { BerkatMark } from '../components/BerkatMark';
import { radius, space, ui } from '../theme/tokens';

const COLS = 2;

/** Dieselbe Platzhalter-Falle wie überall: `flex: 1` zieht die letzte Karte breit. */
type Cell = CategoryListing | { id: string; spacer: true };

function padToGrid(items: CategoryListing[]): Cell[] {
  const rest = items.length % COLS;
  if (items.length === 0 || rest === 0) return items;
  return [
    ...items,
    ...Array.from({ length: COLS - rest }, (_, i) => ({ id: `__spacer__-${i}`, spacer: true as const })),
  ];
}

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const { data: listings = [], isLoading, refetch } = useShopListings();
  const profiles = useProfiles(listings.map((l) => l.seller_id));
  const [pulling, setPulling] = useState(false);

  // Die Reiter- und Stapel-Falle aus Abschnitt 3: Expo Router hält Bildschirme
  // aufgebaut. Wer ein Angebot zurückzieht und zurückkommt, sähe es sonst noch.
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
        <Text style={styles.headerTitle}>Alle Angebote</Text>
        <View style={styles.back} />
      </View>

      <FlatList
        data={padToGrid(listings)}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: space.xl }} color={ui.textMuted} />
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
          if ('spacer' in item) return <View style={styles.cell} />;

          const seller = profiles[item.seller_id];
          const meta = [
            conditionLabel(item.condition),
            [item.postal_code, item.city].filter(Boolean).join(' ') || null,
          ].filter(Boolean);
          const mine = myUserId === item.seller_id;

          return (
            <Pressable
              style={styles.cell}
              onPress={() => router.push(`/seller/${item.seller_id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} für ${formatEuro(item.buy_now_cents)}`}
            >
              <View style={styles.thumb}>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={140}
                  />
                ) : null}
                {item.women_only ? (
                  <View style={styles.lock}>
                    <Lock size={11} color={ui.successInk} />
                  </View>
                ) : null}
              </View>

              <Text numberOfLines={1} style={styles.seller}>
                {seller?.username ?? '…'}
              </Text>
              <Text numberOfLines={2} style={styles.title}>
                {item.title}
              </Text>
              <Text style={styles.price}>{formatEuro(item.buy_now_cents)}</Text>
              {meta.length ? (
                <Text numberOfLines={1} style={styles.meta}>
                  {meta.join(' · ')}
                </Text>
              ) : null}
              {/* Pflichtangabe nach Art. 246d § 1 EGBGB — an jedem Angebot. */}
              {item.seller_kind ? (
                <Text style={styles.kind}>
                  {item.seller_kind === 'private' ? 'Privatverkauf' : 'Gewerblich'}
                  {mine ? ' · von dir' : ''}
                </Text>
              ) : mine ? (
                <Text style={styles.kind}>von dir</Text>
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
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  row: { gap: space.md },
  cell: { flex: 1, marginBottom: space.lg },
  thumb: {
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  lock: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ui.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seller: { fontSize: 11, color: ui.textMuted, marginTop: 6 },
  title: { fontSize: 14, fontWeight: '600', color: ui.text, marginTop: 1 },
  price: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 2 },
  meta: { fontSize: 11, color: ui.textMuted, marginTop: 2 },
  kind: { fontSize: 11, color: ui.textMuted, marginTop: 1, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: space.xl * 2, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text, marginTop: space.md },
  emptyBody: {
    fontSize: 13,
    color: ui.textMuted,
    marginTop: space.xs,
    textAlign: 'center',
    lineHeight: 19,
  },
});

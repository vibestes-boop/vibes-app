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
//
// Seit dem 17.08.2026 führt jede Karte auf `/listing/<id>` statt auf das Profil
// des Verkäufers, und der Kaufknopf ist aus dem Raster verschwunden. Begründung
// im Kopf von `components/ListingCard.tsx`.

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { useProfiles } from '../lib/useAuction';
import { useShopListings, type Listing } from '../lib/useListings';
import { ListingCard } from '../components/ListingCard';
import { BerkatMark } from '../components/BerkatMark';
import { space, ui } from '../theme/tokens';

const COLS = 2;

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
  const [pulling, setPulling] = useState(false);

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
              {listings.length} Artikel · rund um die Uhr
            </Text>
          ) : null}
        </View>
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
          gap: space.lg,
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
          if ('spacer' in item) return <View style={{ flex: 1 }} />;
          return (
            <ListingCard
              listing={item}
              sellerName={profiles[item.seller_id]?.username}
              mine={myUserId === item.seller_id}
              onPress={() => router.push(`/listing/${item.id}`)}
            />
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
  headerTitle: { textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },
  headerSub: { textAlign: 'center', fontSize: 11, color: ui.textMuted, marginTop: 1 },

  row: { gap: space.md },

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

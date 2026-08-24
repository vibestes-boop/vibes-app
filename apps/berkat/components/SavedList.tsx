// Die Merkliste als zweispaltiges Gitter — ohne Kopfzeile, ohne Zurück-Pfeil.
//
// ⚠️ ZWEISPALTIG SEIT DEM 24.08.2026, und das hat einen Preis, den man kennen
// muss: Im Zeilen-Layout trug der `trailing`-Bereich von `ListingCard` das
// Etikett „Verkauft" / „Weg". Den gibt es im Gitter nicht. Damit die Auskunft
// nicht stumm verschwindet — und sie IST der Zweck einer Merkliste —, zeigt die
// Gitter-Karte den Status jetzt selbst, unten links über dem Bild.
//
// WARUM HERAUSGELÖST (24.08.2026)
// Sie hing bis dahin nur an `app/saved.tsx`, erreichbar über das Konto. Mit dem
// Register-Umbau auf „Aktivität" braucht sie zwei Häuser: den eigenen
// Bildschirm (weiterhin aus dem Konto) und den Reiter „Gemerkt". Zweimal
// dieselbe Liste zu schreiben wäre genau die Verdopplung, aus der eine Fassung
// gepflegt wird und die andere veraltet.
//
// Was hier NICHT hineingehört: Kopfzeile und Navigation. Die unterscheiden sich
// je Haus — auf dem eigenen Bildschirm ein Titel mit Zurück, im Reiter gar
// nichts. Deshalb bleibt das draussen.

import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSavedCounts, useSavedListings, useToggleSaved, type SavedListing } from '../lib/useSaved';
import { useUsernames } from '../lib/useAuction';
import { ListingCard } from './ListingCard';
import { BerkatMark } from './BerkatMark';
import { space, ui } from '../theme/tokens';

/**
 * Der Lückenfüller der letzten Reihe.
 *
 * ⚠️ Kein Zierrat: `ListingCard`s Zelle ist `flex: 1`. Bei ungerader Anzahl
 * zöge die letzte Karte sonst über die volle Breite — derselbe Fehler, der im
 * Shop schon einmal auftrat (v1.26.3).
 */
const SPACER_ID = '__spacer__';
type Row = SavedListing | { id: typeof SPACER_ID; spacer: true };

type Props = {
  userId: string | null;
  /** Platz für die Reiter-Leiste beziehungsweise den unteren Rand. */
  bottomInset: number;
};

export function SavedList({ userId, bottomInset }: Props) {
  const { data: saved = [], isLoading, refetch } = useSavedListings(userId);
  const toggle = useToggleSaved(userId);
  const [pulling, setPulling] = useState(false);

  // Verkäufername und Merk-Zähler gehören zur Karte — ohne sie ist das Gitter
  // nur ein Bild. Beides sind Nachschlage-Abfragen über die ohnehin geladenen
  // Kennungen, keine zusätzliche Runde pro Karte.
  const sellerNames = useUsernames(saved.map((l) => l.seller_id));
  const { data: saveCounts } = useSavedCounts(saved.map((l) => l.id));

  const rows = useMemo<Row[]>(
    () => (saved.length % 2 === 1 ? [...saved, { id: SPACER_ID, spacer: true as const }] : saved),
    [saved],
  );

  // Stack-Falle: Wer von hier einen Artikel öffnet, dort das Herz wegnimmt und
  // zurückkommt, sähe ihn sonst noch in der Liste.
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
    <FlatList
      data={rows}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={{ gap: space.md }}
      contentContainerStyle={{
        gap: space.md,
        paddingHorizontal: space.md,
        paddingTop: space.md,
        paddingBottom: bottomInset + space.xl,
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
            <Text style={styles.emptyTitle}>Noch nichts gemerkt</Text>
            <Text style={styles.emptyBody}>
              Tipp auf das Herz an einem Angebot — hier findest du es wieder, auch wenn du den
              Verkäufer längst vergessen hast.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        if ('spacer' in item) return <View style={{ flex: 1 }} />;
        return (
          <ListingCard
            listing={item}
            layout="grid"
            sellerName={sellerNames[item.seller_id]}
            onPress={() => router.push(`/listing/${item.id}`)}
            // Hier ist per Definition alles gemerkt — das Herz ist gefüllt und
            // der Tipp darauf nimmt es aus der Liste. Dass ein verkaufter
            // Artikel trotzdem sichtbar bleibt, ist Absicht; das Etikett unten
            // links in `ListingCard` sagt, was mit ihm passiert ist.
            saved
            onToggleSaved={() => toggle.mutate({ auctionId: item.id, saved: true })}
            saveCount={saveCounts?.get(item.id)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingTop: space.xl * 2,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: 'center', lineHeight: 19 },
});

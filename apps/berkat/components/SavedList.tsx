// Die Merkliste als Liste — ohne Kopfzeile, ohne Zurück-Pfeil.
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

import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Heart } from 'lucide-react-native';

import { useSavedListings, useToggleSaved, type SavedListing } from '../lib/useSaved';
import { ListingCard } from './ListingCard';
import { BerkatMark } from './BerkatMark';
import { space, ui } from '../theme/tokens';

type Props = {
  userId: string | null;
  /** Platz für die Reiter-Leiste beziehungsweise den unteren Rand. */
  bottomInset: number;
};

export function SavedList({ userId, bottomInset }: Props) {
  const { data: saved = [], isLoading, refetch } = useSavedListings(userId);
  const toggle = useToggleSaved(userId);
  const [pulling, setPulling] = useState(false);

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
      data={saved}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        paddingHorizontal: space.md,
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
      renderItem={({ item }: { item: SavedListing }) => (
        <ListingCard
          listing={item}
          layout="row"
          onPress={() => router.push(`/listing/${item.id}`)}
          // Rechts: Status, wenn der Artikel weg ist — und immer das gefüllte
          // Herz zum Entfernen. Beides zusammen, weil ein toter Eintrag genau
          // die zwei Fragen aufwirft: „was ist passiert?" und „wie werde ich
          // ihn los?".
          trailing={
            <View style={styles.trailing}>
              {item.status !== 'listed' ? (
                <Text style={styles.goneTag}>{item.status === 'sold' ? 'Verkauft' : 'Weg'}</Text>
              ) : null}
              <Pressable
                hitSlop={8}
                onPress={() => toggle.mutate({ auctionId: item.id, saved: true })}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} aus der Merkliste entfernen`}
              >
                <Heart size={20} color={ui.success} fill={ui.success} />
              </Pressable>
            </View>
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  trailing: { alignItems: 'flex-end', gap: 6 },
  goneTag: { fontSize: 11, fontWeight: '700', color: ui.textMuted },

  empty: {
    alignItems: 'center',
    paddingTop: space.xl * 2,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: 'center', lineHeight: 19 },
});

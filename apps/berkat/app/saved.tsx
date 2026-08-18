// Die Merkliste — alles, wo ein Herz drauf ist.
//
// Erreichbar über das Konto. Die Liste zeigt auch VERKAUFTE und ZURÜCKGEZOGENE
// Artikel — mit Etikett statt sie stumm zu verschlucken: „Das, was du wolltest,
// ist weg" ist genau die Auskunft, für die man eine Merkliste hat. Wer den
// toten Eintrag loswerden will, tippt das Herz.

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { useSavedListings, useToggleSaved, type SavedListing } from '../lib/useSaved';
import { ListingCard } from '../components/ListingCard';
import { BerkatMark } from '../components/BerkatMark';
import { radius, space, ui } from '../theme/tokens';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: saved = [], isLoading, refetch } = useSavedListings(myUserId);
  const toggle = useToggleSaved(myUserId);
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

  const renderRow = ({ item }: { item: SavedListing }) => (
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
            <Text style={styles.goneTag}>
              {item.status === 'sold' ? 'Verkauft' : 'Weg'}
            </Text>
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
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/account')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gemerkt</Text>
        <View style={styles.back} />
      </View>

      {!myUserId ? (
        <View style={styles.empty}>
          <Heart size={36} color={ui.sunken} />
          <Text style={styles.emptyTitle}>Melde dich an</Text>
          <Text style={styles.emptyBody}>
            Deine Merkliste hängt an deinem Konto — sonst wäre sie beim nächsten Gerät weg.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/login')}>
            <Text style={styles.emptyBtnText}>Anmelden</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
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
                <Text style={styles.emptyTitle}>Noch nichts gemerkt</Text>
                <Text style={styles.emptyBody}>
                  Tipp auf das Herz an einem Angebot — hier findest du es wieder, auch wenn
                  du den Verkäufer längst vergessen hast.
                </Text>
              </View>
            )
          }
          renderItem={renderRow}
        />
      )}
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

  trailing: { alignItems: 'flex-end', gap: 6 },
  goneTag: { fontSize: 11, fontWeight: '700', color: ui.textMuted },

  empty: { alignItems: 'center', paddingTop: space.xl * 2, paddingHorizontal: space.lg, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    marginTop: space.sm,
    height: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: ui.text },
});

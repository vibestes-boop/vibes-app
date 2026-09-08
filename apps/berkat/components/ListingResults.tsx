import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Listing } from '../lib/useListings';
import { ListingCard } from './ListingCard';
import { SearchResultsState, type SearchStateProps } from './SearchResultsState';
import { space, ui } from '../theme/tokens';

type Props = SearchStateProps & {
  listings: Listing[];
  userId: string | null;
  onSelect: (auctionId: string) => void;
  savedIds?: Set<string>;
  onToggleSaved: (auctionId: string, saved: boolean) => void;
};

export function ListingResults({ listings, userId, onSelect, savedIds, onToggleSaved, ...state }: Props) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const feedback = <SearchResultsState key={fontScale} {...state} kind="Artikel" hasResults={listings.length > 0}
    emptyText="Versuch einen kürzeren Begriff oder eine andere Schreibweise. Wir suchen nach Artikeltiteln in allen Kategorien." />;
  return <FlatList
    data={listings} keyExtractor={(item) => item.id}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
    contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
    ListHeaderComponent={listings.length > 0 ? feedback : null}
    ListEmptyComponent={feedback}
    ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
    ListFooterComponent={listings.length >= 20 ? <Text key={fontScale} style={s.limit}>Bis zu 20 passende Artikel. Mit einem genaueren Begriff grenzt du die Auswahl ein.</Text> : null}
    renderItem={({ item }) => {
      const saved = Boolean(savedIds?.has(item.id));
      const mine = item.seller_id === userId;
      return <ListingCard listing={item} layout="search" mine={mine} saved={saved}
        onPress={() => onSelect(item.id)}
        onToggleSaved={mine ? undefined : () => onToggleSaved(item.id, saved)} />;
    }}
  />;
}
const s = StyleSheet.create({ limit: { fontSize: 13, lineHeight: 19, color: ui.textMuted, paddingTop: space.lg } });

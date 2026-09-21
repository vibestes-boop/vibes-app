import { ActivityIndicator, FlatList, View, useWindowDimensions } from 'react-native';
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
  /**
   * Seitenweise nachladen — seit 21.09.2026, als die Suche auf dieselbe
   * Maschine wie „Alle Angebote" gestellt wurde.
   *
   * ⚠️ Vorher endete die Trefferliste hart bei zwanzig, mit einem Satz, der den
   * Nutzer aufforderte, „einen genaueren Begriff" zu nehmen. Das war die
   * Bitte, ein Werkzeug zu ersetzen, das es nicht gab.
   */
  onEndReached?: () => void;
  hasMore?: boolean;
  /** Ein Satz über dem Ergebnis, wenn die Filter die Menge eingeengt haben. */
  header?: React.ReactNode;
};

export function ListingResults({ listings, userId, onSelect, savedIds, onToggleSaved,
  onEndReached, hasMore, header, ...state }: Props) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const feedback = <SearchResultsState key={fontScale} {...state} kind="Artikel" hasResults={listings.length > 0}
    emptyText="Jedes Wort muss vorkommen — in Titel, Beschreibung, Marke, Farbe, Größe oder Ort. Lass ein Wort weg oder nimm einen Filter heraus." />;
  return <FlatList
    data={listings} keyExtractor={(item) => item.id}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
    contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
    ListHeaderComponent={<>{header}{listings.length > 0 ? feedback : null}</>}
    ListEmptyComponent={feedback}
    ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
    onEndReached={onEndReached}
    onEndReachedThreshold={0.6}
    ListFooterComponent={hasMore
      ? <ActivityIndicator style={{ paddingTop: space.lg }} color={ui.textMuted} accessibilityLabel="Weitere Artikel werden geladen" />
      : null}
    renderItem={({ item }) => {
      const saved = Boolean(savedIds?.has(item.id));
      const mine = item.seller_id === userId;
      return <ListingCard listing={item} layout="search" mine={mine} saved={saved}
        onPress={() => onSelect(item.id)}
        onToggleSaved={mine ? undefined : () => onToggleSaved(item.id, saved)} />;
    }}
  />;
}

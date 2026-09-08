import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ui, radius, space } from '../theme/tokens';
import { Avatar } from './Avatar';
import type { FoundSeller } from '../lib/useSellerSearch';
import { SearchResultsState, type SearchStateProps } from './SearchResultsState';

type Props = SearchStateProps & { sellers: FoundSeller[]; onSelect: (sellerId: string) => void };

export function isSearchPermissionError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return Boolean(e && (e.code === '42501' || /permission denied/i.test(e.message ?? '')));
}
function subtitle(seller: FoundSeller): string {
  const parts: string[] = [];
  if (seller.listings > 0) parts.push(`${seller.listings} kaufbar`);
  if (seller.sold > 0) parts.push(`${seller.sold} ${seller.sold === 1 ? 'Zuschlag' : 'Zuschläge'}`);
  return parts.length ? parts.join(' · ') : 'Profil entdecken';
}
export function SellerResults({ sellers, onSelect, ...state }: Props) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const feedback = <SearchResultsState key={fontScale} {...state} kind="Verkäufer" hasResults={sellers.length > 0}
    emptyText="Versuch einen kürzeren Namen oder prüfe die Schreibweise. Die Verkäufersuche findet Benutzernamen." />;
  return <FlatList
    data={sellers} keyExtractor={(item) => item.id}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
    contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
    ListHeaderComponent={sellers.length > 0 ? feedback : null} ListEmptyComponent={feedback}
    renderItem={({ item }) => <Pressable key={`${item.id}:${fontScale}`} onPress={() => onSelect(item.id)}
      style={({ pressed }) => [s.row, pressed && s.pressed]} accessibilityRole="button"
      accessibilityLabel={`${item.username ?? 'Verkäufer'}, ${subtitle(item)}`}>
      <Avatar uri={item.avatar_url} name={item.username} size={44} />
      <View style={s.copy}>
        <Text numberOfLines={2} style={s.name}>{item.username ?? 'Verkäufer'}</Text>
        <Text style={s.sub}>{subtitle(item)}</Text>
      </View>
      <ChevronRight size={18} color={ui.textMuted} />
    </Pressable>}
  />;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: ui.card,
    borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm, minHeight: 80 },
  pressed: { opacity: 0.65 },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: ui.text },
  sub: { fontSize: 13, lineHeight: 19, color: ui.textMuted },
});

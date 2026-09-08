import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { radius, space, ui } from '../theme/tokens';

type Props = {
  hasMore: boolean;
  fetching: boolean;
  loadingMore: boolean;
  failed: boolean;
  onLoad: () => void;
};

export function SellerShopMore({ hasMore, fetching, loadingMore, failed, onLoad }: Props) {
  const { fontScale } = useWindowDimensions();
  if (!hasMore) return null;
  return <View key={fontScale} style={s.wrap}>
    {failed ? <Text style={s.error} accessibilityLiveRegion="polite">Weitere Angebote konnten nicht geladen werden. Deine bisherigen Angebote bleiben sichtbar.</Text> : null}
    <Pressable onPress={onLoad} disabled={fetching} accessibilityRole="button"
      accessibilityState={{ disabled: fetching, busy: loadingMore }}
      style={({ pressed }) => [s.button, pressed && s.pressed]}>
      {loadingMore ? <ActivityIndicator size="small" color={ui.brand} /> : null}
      <Text style={s.label}>{loadingMore ? 'Angebote werden geladen …' : failed ? 'Weitere Angebote erneut laden' : 'Weitere Angebote laden'}</Text>
    </Pressable>
  </View>;
}

const s = StyleSheet.create({
  wrap: { gap: space.sm, paddingBottom: space.md },
  error: { fontSize: 14, lineHeight: 21, color: ui.textMuted },
  button: { minHeight: 48, borderWidth: 1, borderColor: ui.line, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand, textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.65 },
});

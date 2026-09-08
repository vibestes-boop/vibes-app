import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { radius, space, ui } from '../theme/tokens';

/** Stable detail proportions for direct links without a cached list entry. */
export function ListingLoading() {
  return <ScrollView contentContainerStyle={s.content} accessible accessibilityRole="progressbar"
    accessibilityLabel="Angebot wird geladen" accessibilityState={{ busy: true }}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.shapes}>
      <View style={s.photo} />
      <View style={[s.line, s.title]} />
      <View style={[s.line, s.price]} />
      <View style={s.line} />
      <View style={[s.line, s.title]} />
      <View style={s.seller} />
    </View>
  </ScrollView>;
}

export function ListingPreviewStatus({ loading, failed, onRetry }: { loading: boolean; failed: boolean; onRetry: () => void }) {
  const { fontScale } = useWindowDimensions();
  return <View key={fontScale} style={s.status} accessibilityLiveRegion="polite">
    {loading || !failed ? <View style={s.statusRow}>
      <ActivityIndicator color={ui.textMuted} />
      <Text style={s.statusText}>Details werden geladen …</Text>
    </View> : <>
      <Text style={s.statusText}>Details gerade nicht erreichbar.</Text>
      <Pressable onPress={onRetry} style={s.retry} accessibilityRole="button">
        <Text style={s.retryText}>Details erneut laden</Text>
      </Pressable>
    </>}
  </View>;
}

const s = StyleSheet.create({
  content: { gap: space.lg, paddingHorizontal: space.lg, paddingBottom: space.xl },
  shapes: { gap: space.lg },
  photo: { aspectRatio: 1, borderRadius: radius.lg, backgroundColor: ui.sunken },
  line: { height: 16, borderRadius: radius.sm, backgroundColor: ui.sunken },
  title: { width: '76%' },
  price: { width: '32%', height: 28 },
  seller: { height: 64, borderRadius: radius.md, backgroundColor: ui.sunken },
  status: { minHeight: 52, justifyContent: 'center', gap: space.sm, paddingVertical: space.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  statusText: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: ui.textMuted, textAlign: 'center' },
  retry: { minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: ui.line },
  retryText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand, textAlign: 'center' },
});

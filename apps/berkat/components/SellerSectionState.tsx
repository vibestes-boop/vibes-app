import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, ui } from '../theme/tokens';

type Props = {
  loading: boolean;
  error?: unknown;
  hasData: boolean;
  title: string;
  emptyTitle?: string;
  emptyBody?: string;
  onRetry: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

/** A failed section keeps its cached content; it must never look successfully empty. */
export function SellerSectionState({ loading, error, hasData, title, emptyTitle, emptyBody, onRetry, actionLabel, onAction }: Props) {
  if (loading && !hasData) return <View style={s.loading} accessible accessibilityRole="progressbar" accessibilityLabel={`${title} werden geladen`} accessibilityState={{ busy: true }}>
    <ActivityIndicator color={ui.brand} /><Text style={s.body}>{title} werden geladen …</Text>
  </View>;
  if (error) return <View style={s.notice} accessibilityLiveRegion="polite">
    <Text style={s.title}>{title} konnten nicht {hasData ? 'aktualisiert' : 'geladen'} werden</Text>
    <Text style={s.body}>{hasData ? 'Der zuletzt geladene Stand bleibt sichtbar. Versuch es noch einmal.' : 'Versuch es noch einmal, um den aktuellen Stand zu sehen.'}</Text>
    <Pressable onPress={onRetry} disabled={loading} accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => [s.action, pressed && s.pressed]}>
      <Text style={s.actionText}>{loading ? 'Wird aktualisiert …' : 'Erneut versuchen'}</Text>
    </Pressable>
  </View>;
  if (hasData || !emptyTitle) return null;
  return <View style={s.empty} accessibilityLiveRegion="polite">
    <Text style={s.title}>{emptyTitle}</Text><Text style={s.body}>{emptyBody}</Text>
    {actionLabel && onAction ? <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => [s.action, pressed && s.pressed]}>
      <Text style={s.actionText}>{actionLabel}</Text>
    </Pressable> : null}
  </View>;
}
const s = StyleSheet.create({
  loading: { paddingVertical: space.xl, gap: space.md, alignItems: 'center' },
  notice: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.lg, gap: space.sm, marginBottom: space.md },
  empty: { paddingVertical: space.xl, paddingHorizontal: space.sm, gap: space.sm },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: ui.text },
  body: { fontSize: 14, lineHeight: 21, color: ui.textMuted },
  action: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingVertical: space.sm },
  actionText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand },
  pressed: { opacity: 0.65 },
});

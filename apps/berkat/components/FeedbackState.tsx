import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ActionButton } from './ActionButton';
import { radius, space, ui } from '../theme/tokens';

export function FeedbackState({ title, body, loading = false, action }: {
  title: string; body?: string; loading?: boolean;
  action?: { label: string; onPress: () => void; busy?: boolean };
}) {
  const { fontScale } = useWindowDimensions();
  return <View key={fontScale} style={s.card} accessibilityLiveRegion="polite">
    {loading ? <ActivityIndicator color={ui.brand} accessibilityLabel={title} /> : null}
    <Text style={s.title} accessibilityRole="header">{title}</Text>
    {body ? <Text style={s.body}>{body}</Text> : null}
    {action ? <ActionButton quiet label={action.label} onPress={action.onPress} busy={action.busy} /> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { padding: space.lg, backgroundColor: ui.card, borderRadius: radius.lg, gap: space.sm },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: ui.text },
  body: { fontSize: 14, lineHeight: 21, color: ui.textMuted },
});

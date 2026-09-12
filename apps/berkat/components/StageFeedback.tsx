import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PressFeedback } from './PressFeedback';
import { radius, space, stage } from '../theme/tokens';

type Action = { label: string; onPress: () => void; busy?: boolean };
export function StageFeedback({ title, body, loading = false, action, secondary }: {
  title: string; body?: string; loading?: boolean; action?: Action; secondary?: Action;
}) {
  const { fontScale } = useWindowDimensions();
  return <View key={fontScale} style={s.card} accessibilityLiveRegion="polite">
    <View style={s.heading}>
      {loading ? <ActivityIndicator color={stage.text} /> : null}
      <Text style={s.title} accessibilityRole="header">{title}</Text>
    </View>
    {body ? <Text style={s.body}>{body}</Text> : null}
    {action || secondary ? <View style={s.actions}>
      {[action, secondary].map((item, i) => item ? <PressFeedback key={i} onPress={item.onPress} disabled={item.busy}
        style={[s.button, i === 0 && s.primary]} accessibilityRole="button" accessibilityLabel={item.label}
        accessibilityState={{ busy: Boolean(item.busy), disabled: Boolean(item.busy) }}>
        {item.busy ? <ActivityIndicator color={i === 0 ? stage.ink : stage.text} /> : null}
        <Text style={[s.label, i === 0 && s.primaryLabel]}>{item.label}</Text>
      </PressFeedback> : null)}
    </View> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: stage.surface, padding: space.md, gap: space.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '700', color: stage.text },
  body: { fontSize: 13, lineHeight: 19, color: stage.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  button: { minHeight: 44, flexShrink: 1, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, borderWidth: 1, borderColor: stage.lineStrong },
  primary: { backgroundColor: stage.text, borderColor: stage.text },
  label: { flexShrink: 1, textAlign: 'center', fontSize: 13, lineHeight: 19, fontWeight: '700', color: stage.text },
  primaryLabel: { color: stage.ink },
});

import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { PressFeedback } from './PressFeedback';
import { radius, space, ui } from '../theme/tokens';

/** Shared navigation pattern for account, activity and seller tools. */
export function NavigationRow({ title, detail, Icon, onPress }: {
  title: string; detail?: string; Icon: LucideIcon; onPress: () => void;
}) {
  return <PressFeedback kind="card" style={s.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
    <View style={s.icon}><Icon size={21} color={ui.brand} /></View>
    <View style={s.copy}><Text style={s.title}>{title}</Text>{detail ? <Text style={s.detail}>{detail}</Text> : null}</View>
    <ChevronRight size={18} color={ui.textMuted} />
  </PressFeedback>;
}
const s = StyleSheet.create({
  row: { minHeight: 64, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: ui.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: ui.line },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: ui.bg, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: ui.text },
  detail: { fontSize: 13, lineHeight: 19, color: ui.textMuted },
});

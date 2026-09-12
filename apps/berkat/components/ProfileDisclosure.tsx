import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronDown, type LucideIcon } from 'lucide-react-native';
import { PressFeedback } from './PressFeedback';
import { space, ui } from '../theme/tokens';

export function ProfileDisclosure({ title, Icon, children }: { title: string; Icon: LucideIcon; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={s.wrap}>
    <PressFeedback style={s.row} onPress={() => setExpanded(v => !v)} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }}>
      <Icon size={17} color={ui.textMuted} /><Text style={s.title}>{title}</Text>
      <ChevronDown size={16} color={ui.textMuted} style={expanded ? { transform: [{ rotate: '180deg' }] } : undefined} />
    </PressFeedback>
    {expanded ? <View style={s.content}>{children}</View> : null}
  </View>;
}
const s = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.line },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  title: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: ui.text },
  content: { paddingBottom: space.md },
});

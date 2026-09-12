import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { PressFeedback } from './PressFeedback';
import { space, ui } from '../theme/tokens';

export function ScreenHeader({ title, onBack, right, children, actionsWidth = 44 }: { title?: string; onBack: () => void; right?: ReactNode; children?: ReactNode; actionsWidth?: number }) {
  return <View style={s.header}>
    <View style={{ width: actionsWidth }}><PressFeedback onPress={onBack} style={s.back} accessibilityRole="button" accessibilityLabel="Zurück"><ChevronLeft size={24} color={ui.text} /></PressFeedback></View>
    {children ? <View style={s.identity}>{children}</View> : <Text style={s.title} accessibilityRole="header">{title}</Text>}
    <View style={[s.right, { width: actionsWidth }]}>{right}</View>
  </View>;
}
const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingBottom: space.sm },
  back: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, lineHeight: 25, fontWeight: '700', color: ui.text, textAlign: 'center' },
  identity: { flex: 1, minWidth: 0 },
  right: { minWidth: 44, flexDirection: 'row', alignItems: 'center' },
});

import { darkColors } from '@/lib/theme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

export type EditorTool = { id: string; label: string; Icon: LucideIcon; active?: boolean; onPress: () => void };

/** Bounded, scrollable controls stay readable even over a bright photo. */
export function EditorToolbar({ tools, top, bottom, disabled = false }: {
  tools: EditorTool[]; top: number; bottom: number; disabled?: boolean;
}) {
  return <View style={[s.rail, { top, bottom }]} pointerEvents="box-none">
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content} bounces={false}>
      {tools.map(({ id, label, Icon, active, onPress }) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active, disabled }} disabled={disabled} onPress={onPress}
        style={({ pressed }) => [s.tool, active && s.active, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
        <Icon size={23} color={active ? darkColors.accent.primary : '#FFFFFF'} strokeWidth={1.8} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2} style={[s.label, active && s.activeLabel]}>{label}</Text>
        {active && <View style={s.dot} />}
      </Pressable>)}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  rail: { position: 'absolute', right: 12, width: 88, alignItems: 'stretch' },
  content: { padding: 4, gap: 4, borderRadius: 22, backgroundColor: 'rgba(12,12,14,0.88)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  tool: { minHeight: 62, width: 78, paddingHorizontal: 3, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 17 },
  active: { backgroundColor: 'rgba(220,229,241,0.16)' },
  label: { color: '#F4F4F5', fontSize: 11, fontWeight: '600', textAlign: 'center', width: '100%' },
  activeLabel: { color: darkColors.accent.primary },
  dot: { position: 'absolute', top: 8, right: 10, width: 5, height: 5, borderRadius: 3, backgroundColor: darkColors.accent.primary },
});

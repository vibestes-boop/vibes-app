import { GlassSurface } from '@/components/ui/GlassSurface';
import type { LucideIcon } from 'lucide-react-native';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/useTheme';
export function TabGlyph({ icon: Icon, label, selected = false, badge = 0, loading = false, create = false }: {
  icon?: LucideIcon; label: string; selected?: boolean; badge?: number; loading?: boolean; create?: boolean;
}) {
  const { colors } = useTheme();
  const foreground = create || selected ? colors.text.primary : colors.text.secondary;
  return <View style={s.wrap} pointerEvents="none">
    <View style={s.icon}>
      {(create || selected) && <GlassSurface material="solid" radius={create ? 22 : 17} elevated={create} style={StyleSheet.absoluteFill} />}
      {loading ? <ActivityIndicator color={foreground} size="small" /> : create ? <Plus size={24} color={foreground} strokeWidth={2.4} /> : Icon ? <Icon size={24} color={foreground} strokeWidth={selected ? 2.3 : 1.8} /> : null}
      {badge > 0 && <View style={[s.badge, { backgroundColor: colors.accent.danger, borderColor: colors.tabBar.bg }]}><Text style={s.count}>{badge > 99 ? '99+' : badge}</Text></View>}
    </View>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3} style={[s.label, { color: selected ? colors.tabBar.active : colors.text.secondary }]}>{label}</Text>
  </View>;
}
const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56, width: '100%' },
  icon: { width: 46, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, lineHeight: 15, fontWeight: '600', maxWidth: '100%', textAlign: 'center' },
  badge: { position: 'absolute', right: -3, top: -4, borderRadius: 9, minWidth: 17, height: 17, paddingHorizontal: 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  count: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '700' },
});

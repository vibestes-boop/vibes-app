import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SquarePlus } from 'lucide-react-native';
import { useTheme } from '@/lib/useTheme';

// Nur das Symbol, ohne Beschriftung (wie Instagram). Den Namen liest der
// Screenreader am Knopf vor; die Auswahl zeichnet die Leiste als gleitende Kapsel.
// Erstellen ist ein Plus im Quadrat wie bei Instagram, ohne eigene Kapsel, damit es
// nicht wie ein zweiter ausgewählter Tab aussieht.
export function TabGlyph({ icon: Icon, selected = false, badge = 0, loading = false, create = false }: {
  icon?: LucideIcon; selected?: boolean; badge?: number; loading?: boolean; create?: boolean;
}) {
  const { colors } = useTheme();
  const foreground = create || selected ? colors.text.primary : colors.text.secondary;
  return <View style={s.icon} pointerEvents="none">
    {loading ? <ActivityIndicator color={foreground} size="small" /> : create ? <SquarePlus size={27} color={foreground} strokeWidth={2} /> : Icon ? <Icon size={26} color={foreground} strokeWidth={selected ? 2.3 : 1.9} /> : null}
    {badge > 0 && <View style={[s.badge, { backgroundColor: colors.accent.danger, borderColor: colors.tabBar.bg }]}><Text style={s.count}>{badge > 99 ? '99+' : badge}</Text></View>}
  </View>;
}
const s = StyleSheet.create({
  icon: { width: 46, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, top: -3, borderRadius: 9, minWidth: 17, height: 17, paddingHorizontal: 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  count: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '700' },
});

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SquarePlus } from 'lucide-react-native';
import { useTheme } from '@/lib/useTheme';

// Farben je Ton der Leiste. Die Auswahl sitzt immer auf einer hellen Kapsel,
// darum dort dunkel; sonst hell auf dunkler bzw. dunkel auf heller Leiste.
// Vorher kamen die Farben aus dem Theme: Im hellen Modus waren die Symbole
// dunkelgrau, und über dem Video-Feed (dunkles Glas) verschwanden sie.
const INK = '#181B20';
const GLYPH = {
  dark: { selected: INK, create: '#FFFFFF', idle: 'rgba(255,255,255,0.8)', badgeRing: '#17191E' },
  light: { selected: INK, create: INK, idle: '#4C535E', badgeRing: '#FFFFFF' },
} as const;

// Nur das Symbol, ohne Beschriftung (wie Instagram). Den Namen liest der
// Screenreader am Knopf vor; die Auswahl zeichnet die Leiste als gleitende Kapsel.
// Erstellen ist ein Plus im Quadrat wie bei Instagram, ohne eigene Kapsel, damit es
// nicht wie ein zweiter ausgewählter Tab aussieht.
export function TabGlyph({ icon: Icon, selected = false, badge = 0, loading = false, create = false, tone }: {
  icon?: LucideIcon; selected?: boolean; badge?: number; loading?: boolean; create?: boolean;
  /** Ton der Leiste; ohne Angabe nach Theme */
  tone?: 'light' | 'dark';
}) {
  const { colors, isDark } = useTheme();
  const palette = GLYPH[tone ?? (isDark ? 'dark' : 'light')];
  const foreground = create ? palette.create : selected ? palette.selected : palette.idle;
  return <View style={s.icon} pointerEvents="none">
    {loading ? <ActivityIndicator color={foreground} size="small" /> : create ? <SquarePlus size={27} color={foreground} strokeWidth={2} /> : Icon ? <Icon size={26} color={foreground} strokeWidth={selected ? 2.3 : 1.9} /> : null}
    {badge > 0 && <View style={[s.badge, { backgroundColor: colors.accent.danger, borderColor: palette.badgeRing }]}><Text style={s.count}>{badge > 99 ? '99+' : badge}</Text></View>}
  </View>;
}
const s = StyleSheet.create({
  icon: { width: 46, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: 0, top: -3, borderRadius: 9, minWidth: 17, height: 17, paddingHorizontal: 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  count: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '700' },
});

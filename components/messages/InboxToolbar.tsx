import { GlassSurface } from '@/components/ui/GlassSurface';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
export function InboxToolbar({ query, onQueryChange, unreadOnly, onFilterChange, unreadCount }: {
  query: string; onQueryChange: (query: string) => void; unreadOnly: boolean; onFilterChange: (unread: boolean) => void; unreadCount: number;
}) {
  const { t } = useI18n(); const { colors } = useTheme();
  return <View style={s.wrap}>
    <GlassSurface radius={26} style={s.search}><Search size={19} color={colors.icon.muted} /><TextInput value={query} onChangeText={onQueryChange} placeholder={t('inbox.searchChats')} accessibilityLabel={t('inbox.searchChats')} placeholderTextColor={colors.text.muted} autoCorrect={false} autoCapitalize="none" returnKeyType="search" style={[s.input, { color: colors.text.primary }]} />{query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={t('explore.clearSearch')} onPress={() => onQueryChange('')} style={s.clear}><X size={18} color={colors.icon.default} /></Pressable>}</GlassSurface>
    <View style={s.filters}>{[false, true].map(unread => <Pressable key={String(unread)} onPress={() => onFilterChange(unread)} accessibilityRole="tab" accessibilityState={{ selected: unreadOnly === unread }} style={[s.chip, { backgroundColor: unreadOnly === unread ? colors.text.primary : colors.bg.elevated, borderColor: unreadOnly === unread ? colors.text.primary : colors.border.default }]}><Text style={{ color: unreadOnly === unread ? colors.bg.primary : colors.text.secondary, fontSize: 13, fontWeight: '600' }}>{t(unread ? 'inbox.unread' : 'explore.all')}{unread && unreadCount > 0 ? ` · ${unreadCount}` : ''}</Text></Pressable>)}</View>
  </View>;
}
const s = StyleSheet.create({ wrap: { paddingHorizontal: 20, paddingBottom: 10 }, search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 26, paddingLeft: 14, paddingRight: 4 }, input: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 15 }, clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, filters: { flexDirection: 'row', gap: 8, paddingTop: 14 }, chip: { minHeight: 44, paddingHorizontal: 18, borderRadius: 23, borderWidth: 1, justifyContent: 'center' } });

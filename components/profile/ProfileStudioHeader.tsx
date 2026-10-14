import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
import { Bell, ChevronRight, LogOut, Settings, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderButton } from './HeaderButton';

export function ProfileStudioHeader({ username, paddingTop, unreadNotifs, onNotifications, onSettings, onSignOut }: {
  username: string; paddingTop: number; unreadNotifs: number; onNotifications: () => void; onSettings: () => void; onSignOut: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  return <>
    <View style={[s.header, { paddingTop, backgroundColor: colors.bg.primary }]}>
      <Text style={[s.title, { color: colors.text.primary }]}>{t('tabs.profile')}</Text>
      <View style={s.actions}><HeaderButton label={t('tabs.notifications')} icon={Bell} onPress={onNotifications} badge={unreadNotifs} /><HeaderButton label={t('mobileDesign.profileMenu')} icon={Settings} onPress={() => setMenuOpen(true)} /></View>
    </View>
    <Modal transparent animationType="slide" visible={menuOpen} onRequestClose={() => setMenuOpen(false)}>
      <View style={s.modal}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('mobileDesign.close')} onPress={() => setMenuOpen(false)} />
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: colors.bg.primary, paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={[s.grip, { backgroundColor: colors.border.strong }]} />
          <View style={s.sheetHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={[s.menuTitle, { color: colors.text.primary }]}>{t('mobileDesign.profileMenu')}</Text><Text numberOfLines={1} style={[s.handle, { color: colors.text.secondary }]}>@{username}</Text></View><Pressable onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel={t('mobileDesign.close')} style={s.close}><X size={21} color={colors.icon.default} /></Pressable></View>
          {[{ Icon: Settings, label: t('nativeUi.settings'), action: onSettings, color: colors.text.primary }, { Icon: LogOut, label: t('nativeUi.signOut'), action: onSignOut, color: colors.accent.danger }].map(({ Icon, label, action, color }) => <Pressable key={label} accessibilityRole="button" onPress={() => { setMenuOpen(false); action(); }} style={[s.row, { borderTopColor: colors.border.subtle }]}><Icon size={21} color={color} strokeWidth={1.7} /><Text style={[s.rowLabel, { color }]}>{label}</Text><ChevronRight size={18} color={colors.icon.muted} /></Pressable>)}
        </View>
      </View>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 18 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.8, flex: 1 }, actions: { flexDirection: 'row', gap: 8 },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }, sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12 },
  grip: { height: 4, width: 34, borderRadius: 4, alignSelf: 'center', marginBottom: 20 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  menuTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 }, handle: { marginTop: 6, fontSize: 13 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: StyleSheet.hairlineWidth }, rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});

import { AppTabBar } from '@/components/nav/AppTabBar';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Flower2, Radio, ShoppingBag, Users } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function NavigationSettings() {
  const { t } = useI18n(); const { colors } = useTheme(); const router = useRouter(); const insets = useSafeAreaInsets();
  useThemedStatusBar('auto');
  return <View style={{ flex: 1, backgroundColor: colors.bg.primary, paddingTop: insets.top }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('mobileDesign.back')} style={{ padding: 12 }}><ArrowLeft size={22} color={colors.text.primary} /></Pressable><Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700' }}>{t('settings.tabBar')}</Text></View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 20 }}>
      <Text style={{ color: colors.text.secondary, fontSize: 15, lineHeight: 23 }}>{t('ux.navigationBody')}</Text>
      <View style={{ borderRadius: 20, overflow: 'hidden' }}><AppTabBar focusedRoute="explore" bottomInset={12} onNavigate={route => router.navigate(`/(tabs)/${route === 'index' ? '' : route}` as never)} onCreate={() => router.push('/create/start')} /></View>
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700' }}>{t('ux.moreDiscover')}</Text>
      {[{ Icon: Users, label: t('tabs.guild'), route: '/(tabs)/guild' }, { Icon: ShoppingBag, label: t('tabs.shop'), route: '/(tabs)/shop' }, { Icon: Radio, label: t('tabs.live'), route: '/live' }, { Icon: Flower2, label: t('tabs.women_only'), route: '/women-only' }].map(({ Icon, label, route }) => <Pressable key={route} onPress={() => router.navigate(route as never)} accessibilityRole="button" style={{ backgroundColor: colors.bg.elevated, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}><Icon size={22} color={colors.accent.primary} /><Text style={{ flex: 1, color: colors.text.primary, fontSize: 16 }}>{label}</Text><ChevronRight size={18} color={colors.icon.muted} /></Pressable>)}
    </ScrollView>
  </View>;
}

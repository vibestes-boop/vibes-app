import { Compass, MessageCircle, User, Zap } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useI18n } from '@/lib/i18n';
import { TabGlyph } from './TabGlyph';

export function AppTabBar({ focusedRoute, bottomInset, unreadMessages = 0, unreadNotifications = 0, refreshing = false, onNavigate, onCreate }: {
  focusedRoute: string; bottomInset: number; unreadMessages?: number; unreadNotifications?: number; refreshing?: boolean;
  onNavigate: (route: string) => void; onCreate: () => void;
}) {
  const { t } = useI18n();
  const items = [
    { route: 'index', label: t('tabs.home'), icon: Zap },
    { route: 'explore', label: t('tabs.explore'), icon: Compass },
    { route: 'create', label: t('nativeUi.create'), icon: undefined },
    { route: 'messages', label: t('tabs.messages'), icon: MessageCircle },
    { route: 'profile', label: t('tabs.profile'), icon: User },
  ];
  const selected = ['guild', 'shop'].includes(focusedRoute) ? 'explore' : focusedRoute === 'notifications' ? 'profile' : focusedRoute;
  return <View pointerEvents="box-none" style={[s.outer, { paddingBottom: Math.max(bottomInset - 4, 10) }]}>
    <GlassSurface radius={34} style={s.bar}>
      {items.map(item => <Pressable key={item.route} accessibilityRole={item.route === 'create' ? 'button' : 'tab'}
        accessibilityLabel={item.route === 'create' ? t('nativeUi.createPost') : item.label}
        accessibilityState={item.route === 'create' ? undefined : { selected: selected === item.route }}
        onPress={() => item.route === 'create' ? onCreate() : onNavigate(item.route)}
        style={({ pressed }) => [s.item, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
        <TabGlyph icon={item.icon} label={item.label} create={item.route === 'create'} selected={selected === item.route}
          loading={item.route === 'index' && refreshing} badge={item.route === 'messages' ? unreadMessages : item.route === 'profile' ? unreadNotifications : 0} />
      </Pressable>)}
    </GlassSurface>
  </View>;
}
const s = StyleSheet.create({
  outer: { paddingHorizontal: 8, paddingTop: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 5 },
  item: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center' },
});

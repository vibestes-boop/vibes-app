import { useEffect } from 'react';
import { AppTabBar } from '@/components/nav/AppTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnreadDMCount } from '@/lib/useMessages';
import { useUnreadCount } from '@/lib/useNotifications';
import { useNotificationsRealtime } from '@/lib/useNotificationsRealtime';
import { setTabBarCompact } from '@/lib/tabBarMotion';
import { useTabRefreshStore, vibesFeedActions } from '@/lib/useTabRefresh';
import { useTheme } from '@/lib/useTheme';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useNotificationsRealtime();
  const { data: unreadDMs = 0 } = useUnreadDMCount();
  const { data: unreadNotifs = 0 } = useUnreadCount();
  const refresh = useTabRefreshStore(s => s.triggerVibesRefresh);
  const refreshing = useTabRefreshStore(s => s.isVibesRefreshing);
  const focusedRoute = state.routes[state.index]?.name ?? 'index';
  // Neuer Tab: Leiste wieder voll, wie bei Instagram
  useEffect(() => { setTabBarCompact(false); }, [focusedRoute]);
  return <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
    {/* Über dem Video-Feed ist es immer dunkel, auch im hellen Modus */}
    <AppTabBar focusedRoute={focusedRoute} bottomInset={insets.bottom} unreadMessages={unreadDMs} unreadNotifications={unreadNotifs} refreshing={refreshing}
      tone={focusedRoute === 'index' ? 'dark' : 'auto'}
      onCreate={() => { impactAsync(ImpactFeedbackStyle.Medium); router.push('/create/start'); }}
      onNavigate={route => {
        impactAsync(ImpactFeedbackStyle.Light);
        if (route === 'index' && focusedRoute === 'index') { vibesFeedActions.refresh?.(); refresh(); }
        else navigation.navigate(route);
      }} />
  </View>;
}
export default function TabLayout() {
  const { colors } = useTheme();
  // freezeOnBlur: Ein verlassener Tab rendert nicht weiter (Chats, Feed, Profil
  // liefen sonst im Hintergrund mit). react-native-screens friert erst einen Takt
  // nach dem Wechsel ein, das Pausieren der Videos beim Verlassen läuft vorher.
  return <Tabs tabBar={props => <CustomTabBar {...props} />} screenOptions={{ headerShown: false, lazy: true, freezeOnBlur: true, sceneStyle: { backgroundColor: colors.bg.primary } }}>
    <Tabs.Screen name="index" /><Tabs.Screen name="explore" /><Tabs.Screen name="messages" /><Tabs.Screen name="profile" />
    <Tabs.Screen name="guild" options={{ href: null }} /><Tabs.Screen name="shop" options={{ href: null }} /><Tabs.Screen name="notifications" options={{ href: null }} />
  </Tabs>;
}

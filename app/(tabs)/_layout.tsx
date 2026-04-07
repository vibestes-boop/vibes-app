import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, Text, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Users, MessageCircle, User, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
// react-native-reanimated: named imports (safe for Hermes)
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;  // real Reanimated v3: .default; stub: direct
const Animated = { View: _animNS?.View, Text: _animNS?.Text, FlatList: _animNS?.FlatList };

// expo-haptics: named imports (safe for Hermes)
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useUnreadDMCount } from '@/lib/useMessages';
import { useUnreadCount } from '@/lib/useNotifications';
import { useTabRefreshStore, vibesFeedActions, guildFeedActions } from '@/lib/useTabRefresh';

// ── Tab-Konfiguration ────────────────────────────────────────────────────────
const TABS = [
  { name: 'index', label: 'Vibes', icon: Zap, pushTo: null, isCreate: false },
  { name: 'guild', label: 'Guild', icon: Users, pushTo: null, isCreate: false },
  { name: '_create', label: '', icon: Plus, pushTo: '/create', isCreate: true },
  { name: 'messages', label: 'Nachrichten', icon: MessageCircle, pushTo: null, isCreate: false },
  { name: 'profile', label: 'Studio', icon: User, pushTo: null, isCreate: false },
] as const;

// Real-Tab-Reihenfolge (Expo-Router-Screens)
const REAL_TAB_ORDER = ['index', 'explore', 'guild', 'messages', 'profile'] as const;

// ── Normaler Tab-Button ──────────────────────────────────────────────────────
function TabBarItem({
  route,
  isFocused,
  onPress,
  onLongPress,
  badge,
  isRefreshing = false,
}: {
  route: (typeof TABS)[number];
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  badge?: number;
  isRefreshing?: boolean;
}) {
  const Icon = route.icon;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withTiming(0.85, { duration: 80 }); };
  const handlePressOut = () => { scale.value = withTiming(1, { duration: 80 }); };

  const iconOpacity = useSharedValue(isFocused ? 1 : 0.45);
  useEffect(() => {
    iconOpacity.value = withTiming(isFocused ? 1 : 0.45, { duration: 60 });
  }, [isFocused, iconOpacity]);

  const iconAnimStyle = useAnimatedStyle(() => ({ opacity: iconOpacity.value }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabIconWrapper, animatedStyle]}>
        <View style={{ position: 'relative', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          {/* Original Icon — ausgeblendet während Refresh */}
          {!isRefreshing && (
            <Animated.View style={[{ position: 'absolute' }, iconAnimStyle]}>
              <Icon
                size={24}
                stroke={isFocused ? '#FFFFFF' : '#6B7280'}
                strokeWidth={isFocused ? 2.5 : 1.8}
              />
            </Animated.View>
          )}
          {/* TikTok-Style Lade-Spinner (eingebaut, kein Reanimated nötig) */}
          {isRefreshing && (
            <ActivityIndicator
              size="small"
              color="#22D3EE"
              style={{ position: 'absolute' }}
            />
          )}
          {badge != null && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
            </View>
          )}
        </View>
        {isFocused && <View style={styles.activeDot} />}
        {route.label ? (
          <Text style={[styles.tabLabel, { color: isFocused ? '#FFFFFF' : '#6B7280' }]}>
            {route.label}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

// ── Zentraler Create-Button ──────────────────────────────────────────────────
function CreateTabButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    impactAsync(ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withTiming(0.88, { duration: 60 }),
      withTiming(1.05, { duration: 80 }),
      withTiming(1, { duration: 80 }),
    );
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.createTab} accessibilityLabel="Post erstellen">
      <Animated.View style={animStyle}>
        <View style={styles.createGlow} />
        <LinearGradient
          colors={['#A5F3FC', '#22D3EE', '#0891B2']}
          style={styles.createBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.createPillLeft} />
          <Plus size={22} color="#fff" strokeWidth={2.8} />
          <View style={styles.createPillRight} />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ── Haupt Tab-Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: unreadDMs = 0 } = useUnreadDMCount();
  const { data: unreadNotifs = 0 } = useUnreadCount();
  const triggerVibesRefresh = useTabRefreshStore((s) => s.triggerVibesRefresh);
  const isVibesRefreshing = useTabRefreshStore((s) => s.isVibesRefreshing);
  const triggerGuildRefresh = useTabRefreshStore((s) => s.triggerGuildRefresh);
  const isGuildRefreshing = useTabRefreshStore((s) => s.isGuildRefreshing);

  return (
    <View style={styles.tabBarContainer}>
      <View style={[styles.blurView, styles.blurFallback]}>
        <View style={[styles.tabBarInner, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {TABS.map((tabConfig) => {
            if (tabConfig.isCreate) {
              return (
                <CreateTabButton
                  key={tabConfig.name}
                  onPress={() => {
                    impactAsync(ImpactFeedbackStyle.Medium);
                    router.push('/create/camera' as any);
                  }}
                />
              );
            }

            const isExternal = tabConfig.pushTo !== null;
            const routeIndex = isExternal
              ? -1
              : (REAL_TAB_ORDER as readonly string[]).indexOf(tabConfig.name);
            const isFocused = !isExternal && state.index === routeIndex;

            const onPress = () => {
              if (isExternal) {
                router.push((tabConfig as any).pushTo as any);
                return;
              }
              const route = state.routes[routeIndex];
              if (!route) return;
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              // Bereits auf Vibes-Tab: Direkt Refresh triggern (zwei Wege)
              if (isFocused && tabConfig.name === 'index') {
                impactAsync(ImpactFeedbackStyle.Light);
                vibesFeedActions.refresh?.();
                triggerVibesRefresh();
                return;
              }
              // Bereits auf Guild-Tab: Direkt Refresh triggern
              if (isFocused && tabConfig.name === 'guild') {
                impactAsync(ImpactFeedbackStyle.Light);
                guildFeedActions.refresh?.();
                triggerGuildRefresh();
                return;
              }
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(tabConfig.name);
              }
            };

            const onLongPress = () => {
              if (isExternal) return;
              const route = state.routes[routeIndex];
              if (route) navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            const badge =
              tabConfig.name === 'messages' ? unreadDMs :
                tabConfig.name === 'profile' ? unreadNotifs :
                  undefined;

            return (
              <TabBarItem
                key={tabConfig.name}
                route={tabConfig}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                badge={badge}
                isRefreshing={
                  (tabConfig.name === 'index' && isVibesRefreshing) ||
                  (tabConfig.name === 'guild' && isGuildRefreshing)
                }
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  blurView: { overflow: 'hidden' },
  blurFallback: { backgroundColor: 'rgba(5,5,8,0.95)' },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activeDot: {
    position: 'absolute',
    bottom: -7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22D3EE',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F472B6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#050508',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  createTab: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  createGlow: {
    position: 'absolute',
    top: -3,
    left: -6,
    right: -6,
    bottom: -3,
    borderRadius: 18,
    backgroundColor: 'rgba(34,211,238,0.18)',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 0,
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  createPillLeft: {
    width: 4,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    position: 'absolute',
    left: 0,
  },
  createPillRight: {
    width: 4,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    position: 'absolute',
    right: 0,
  },
});

// ── Tab Layout ───────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        // Verhindert schwarzen Flash bei lazy Tab-Wechsel:
        // Der Scene-Container ist standardmäßig transparent → zeigt den nativen Black-Background
        // solange der Tab noch nicht gemounted wurde.
        sceneStyle: { backgroundColor: '#050508' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" options={{ href: undefined }} />
      <Tabs.Screen name="guild" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
      {/* notifications ist real aber im Tab-Bar versteckt */}
      <Tabs.Screen name="notifications" options={{ tabBarButton: () => null }} />
    </Tabs>
  );
}


import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet, Text, Pressable, ActivityIndicator } from 'react-native';
import { Zap, User, Plus } from 'lucide-react-native';
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
import { useTheme } from '@/lib/useTheme';
import {
  useTabBarStore,
  TAB_FEATURES,
  type TabFeatureMeta,
  type TabFeature,
} from '@/lib/tabBarStore';

// ── Feste Tab-Slots ──────────────────────────────────────────────────────────
// Slot 1: Feed (fest), Slot 3: + Create (fest), Slot 5: Profil (fest)
// Slot 2 + 4: kommen aus tabBarStore (user-customizable)

// Real-Tab-Reihenfolge (Expo-Router-Screens) — bestimmt state.index Mapping
// Reihenfolge MUSS exakt mit <Tabs.Screen> in TabLayout übereinstimmen (state.index mapping)
const REAL_TAB_ORDER = ['index', 'explore', 'guild', 'messages', 'profile', 'shop', 'notifications'] as const;

// ── Normaler Tab-Button ──────────────────────────────────────────────────────
function TabBarItem({
  route,
  isFocused,
  onPress,
  onLongPress,
  badge,
  isRefreshing = false,
}: {
  route: TabFeatureMeta;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  badge?: number;
  isRefreshing?: boolean;
}) {
  const Icon = route.icon;
  const scale = useSharedValue(1);
  const { colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withTiming(0.85, { duration: 80 }); };
  const handlePressOut = () => { scale.value = withTiming(1, { duration: 80 }); };

  const iconOpacity = useSharedValue(isFocused ? 1 : 0.72);
  useEffect(() => {
    iconOpacity.value = withTiming(isFocused ? 1 : 0.72, { duration: 60 });
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
          {!isRefreshing && (
            <Animated.View style={[{ position: 'absolute' }, iconAnimStyle]}>
              <Icon
                size={24}
                color={isFocused ? colors.tabBar.active : colors.tabBar.inactive}
                strokeWidth={isFocused ? 0 : 1.8}
                fill={isFocused ? colors.tabBar.active : 'transparent'}
              />
            </Animated.View>
          )}
          {isRefreshing && (
            <ActivityIndicator
              size="small"
              color={colors.accent.primary}
              style={{ position: 'absolute' }}
            />
          )}
          {badge != null && badge > 0 && (
            <View style={[styles.badge, { borderColor: colors.bg.primary }]}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
            </View>
          )}
        </View>
        {isFocused && <View style={[styles.activeDot, { backgroundColor: colors.accent.primary }]} />}
        {route.label ? (
          <Text style={[styles.tabLabel, { color: isFocused ? colors.tabBar.active : colors.tabBar.inactive }]}>
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
  const { colors } = useTheme();

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

  const shadowBorderColor = colors.text.primary;
  const btnBg = colors.text.primary;
  const iconColor = colors.bg.primary;

  return (
    <Pressable onPress={handlePress} style={styles.createTab} accessibilityLabel="Post erstellen">
      <Animated.View style={[styles.createOuter, animStyle]}>
        {/* Offset-Border-Layer — Neo-Brutalist Tiefe */}
        <View style={[styles.createShadowLayer, { borderColor: shadowBorderColor }]} />
        {/* Haupt-Button */}
        <View style={[styles.createBtn, { backgroundColor: btnBg }]}>
          <Plus size={20} color={iconColor} strokeWidth={3} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Haupt Tab-Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: unreadDMs = 0 } = useUnreadDMCount();
  const { data: unreadNotifs = 0 } = useUnreadCount();
  const triggerVibesRefresh = useTabRefreshStore((s) => s.triggerVibesRefresh);
  const isVibesRefreshing = useTabRefreshStore((s) => s.isVibesRefreshing);
  const triggerGuildRefresh = useTabRefreshStore((s) => s.triggerGuildRefresh);
  const isGuildRefreshing = useTabRefreshStore((s) => s.isGuildRefreshing);

  // Customizable Slots aus Store
  const slot2Feature = useTabBarStore((s) => s.slot2);
  const slot4Feature = useTabBarStore((s) => s.slot4);

  // Dynamische Tab-Konfiguration aus Store-Slots
  const slot2Meta = TAB_FEATURES[slot2Feature];
  const slot4Meta = TAB_FEATURES[slot4Feature];

  // Hilfsfunktion: Badge für ein Feature
  const getBadge = (feature: TabFeature): number | undefined => {
    if (feature === 'messages')      return unreadDMs      || undefined;
    if (feature === 'notifications') return unreadNotifs   || undefined;
    return undefined;
  };

  // Hilfsfunktion: Tab-Aktion für Slot 2 oder 4
  const handleSlotPress = (meta: typeof slot2Meta) => {
    impactAsync(ImpactFeedbackStyle.Light);
    if (meta.isPush) {
      router.push(meta.route as any);
      return;
    }
    // Expo Router Tab-Navigation
    const routeIndex = (REAL_TAB_ORDER as readonly string[]).indexOf(meta.route);
    if (routeIndex < 0) { router.push(meta.route as any); return; }
    const route = state.routes[routeIndex];
    if (route) navigation.navigate(meta.route);
  };

  // Feed-Tab: aktueller Expo-Router-Index
  const feedIndex = 0;
  const profileIndex = (REAL_TAB_ORDER as readonly string[]).indexOf('profile');
  const isFeedFocused    = state.index === feedIndex;
  const isProfileFocused = state.index === profileIndex;

  // Slot 2: fokussiert wenn der Screen dessen Route aktiv ist
  const slot2Index = !slot2Meta.isPush
    ? (REAL_TAB_ORDER as readonly string[]).indexOf(slot2Meta.route)
    : -1;
  const slot4Index = !slot4Meta.isPush
    ? (REAL_TAB_ORDER as readonly string[]).indexOf(slot4Meta.route)
    : -1;
  const isSlot2Focused = slot2Index >= 0 && state.index === slot2Index;
  const isSlot4Focused = slot4Index >= 0 && state.index === slot4Index;

  return (
    <View style={[styles.tabBarContainer, { borderTopColor: colors.tabBar.border }]}>
      <View style={[styles.blurView, { backgroundColor: colors.tabBar.bg }]}>
        <View style={[styles.tabBarInner, { paddingBottom: Math.max(insets.bottom - 6, 2) }]}>

          {/* ── Slot 1: Feed (fest) ── */}
          <TabBarItem
            route={{ name: 'index', label: 'Feed', icon: Zap, pushTo: null, isCreate: false } as any}
            isFocused={isFeedFocused}
            onPress={() => {
              if (isFeedFocused) {
                impactAsync(ImpactFeedbackStyle.Light);
                vibesFeedActions.refresh?.();
                triggerVibesRefresh();
                return;
              }
              navigation.navigate('index');
            }}
            onLongPress={() => {}}
            isRefreshing={isVibesRefreshing}
          />

          {/* ── Slot 2: wählbar ── */}
          <TabBarItem
            route={{ name: slot2Meta.route, label: slot2Meta.label, icon: slot2Meta.icon, pushTo: null, isCreate: false } as any}
            isFocused={isSlot2Focused}
            badge={getBadge(slot2Feature)}
            onPress={() => {
              if (isSlot2Focused && slot2Feature === 'guild') {
                impactAsync(ImpactFeedbackStyle.Light);
                guildFeedActions.refresh?.();
                triggerGuildRefresh();
                return;
              }
              handleSlotPress(slot2Meta);
            }}
            onLongPress={() => {}}
            isRefreshing={slot2Feature === 'guild' && isGuildRefreshing}
          />

          {/* ── Slot 3: + Create (fest) ── */}
          <CreateTabButton
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Medium);
              router.push('/create/camera' as any);
            }}
          />

          {/* ── Slot 4: wählbar ── */}
          <TabBarItem
            route={{ name: slot4Meta.route, label: slot4Meta.label, icon: slot4Meta.icon, pushTo: null, isCreate: false } as any}
            isFocused={isSlot4Focused}
            badge={getBadge(slot4Feature)}
            onPress={() => handleSlotPress(slot4Meta)}
            onLongPress={() => {}}
          />

          {/* ── Slot 5: Profil (fest) ── */}
          <TabBarItem
            route={{ name: 'profile', label: 'Profil', icon: User, pushTo: null, isCreate: false } as any}
            isFocused={isProfileFocused}
            badge={unreadNotifs || undefined}
            onPress={() => {
              if (!isProfileFocused) navigation.navigate('profile');
            }}
            onLongPress={() => {}}
          />

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
    alignItems: 'flex-end',
    paddingTop: 6,
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
    backgroundColor: '#FFFFFF',
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
  // Wrapper für Neo-Brutalist Offset-Effekt
  createOuter: {
    width: 56,
    height: 36,
    position: 'relative',
  },
  // Offset-Border darunter (rechts+unten versetzt)
  createShadowLayer: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  // Haupt-Button (volle Fläche, leicht angehoben)
  createBtn: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Tab Layout ───────────────────────────────────────────────────────────────
export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        sceneStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" options={{ href: undefined }} />
      <Tabs.Screen name="guild" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="shop" options={{ tabBarButton: () => null }} />
      {/* notifications ist real aber im Tab-Bar versteckt */}
      <Tabs.Screen name="notifications" options={{ tabBarButton: () => null }} />
    </Tabs>
  );
}


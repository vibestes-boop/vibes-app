import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Compass, MessageCircle, User, Zap, type LucideIcon } from 'lucide-react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
import { TAB_BAR_ITEM_H, TAB_BAR_PAD, tabBarBottomGap } from '@/lib/tabBarLayout';
import { tabBarCompact } from '@/lib/tabBarMotion';
import { TabGlyph } from './TabGlyph';

// Animated.View über require: der Default-Import crasht in Hermes HBC (siehe OfflineBanner)
/* eslint-disable @typescript-eslint/no-require-imports */
const _ra = require('react-native-reanimated') as any;
const AnimatedView = (_ra?.default ?? _ra)?.View ?? View;
/* eslint-enable @typescript-eslint/no-require-imports */

// Schwebende Kapsel wie bei Instagram: nur Symbole, die Auswahl gleitet als
// Kapsel von Tab zu Tab, und beim Runterscrollen wird die Leiste kompakter.
const ITEM_H = TAB_BAR_ITEM_H;
const PAD = TAB_BAR_PAD;
const COMPACT_SCALE = 0.86;
const SLIDE = { damping: 20, stiffness: 260, mass: 0.8 };
const PRESS = { damping: 18, stiffness: 420, mass: 0.6 };

type Item = { route: string; label: string; icon?: LucideIcon };

function TabButton({ item, selected, badge, loading, tone, onPress }: {
  item: Item; selected: boolean; badge: number; loading: boolean; tone: 'light' | 'dark'; onPress: () => void;
}) {
  const create = item.route === 'create';
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Pressable accessibilityRole={create ? 'button' : 'tab'} accessibilityLabel={item.label}
    accessibilityState={create ? undefined : { selected }} onPress={onPress} style={s.item}
    onPressIn={() => { scale.value = withSpring(0.86, PRESS); }} onPressOut={() => { scale.value = withSpring(1, PRESS); }}>
    <AnimatedView style={pressStyle}>
      <TabGlyph icon={item.icon} create={create} selected={selected} loading={loading} badge={badge} tone={tone} />
    </AnimatedView>
  </Pressable>;
}

export function AppTabBar({ focusedRoute, bottomInset, unreadMessages = 0, unreadNotifications = 0, refreshing = false, compactable = true, tone = 'auto', onNavigate, onCreate }: {
  focusedRoute: string; bottomInset: number; unreadMessages?: number; unreadNotifications?: number; refreshing?: boolean;
  /** 'dark' über dunklen Inhalten (Video-Feed), auch im hellen Modus; sonst nach Theme */
  tone?: 'auto' | 'light' | 'dark';
  /** false für Vorschauen (Einstellungen): die Leiste reagiert dann nicht aufs Scrollen */
  compactable?: boolean;
  onNavigate: (route: string) => void; onCreate: () => void;
}) {
  const { t } = useI18n();
  const { isDark } = useTheme();
  const barTone = (tone === 'auto' ? (isDark ? 'dark' : 'light') : tone) as 'light' | 'dark';
  const items: Item[] = [
    { route: 'index', label: t('tabs.home'), icon: Zap },
    { route: 'explore', label: t('tabs.explore'), icon: Compass },
    { route: 'create', label: t('nativeUi.createPost') },
    { route: 'messages', label: t('tabs.messages'), icon: MessageCircle },
    { route: 'profile', label: t('tabs.profile'), icon: User },
  ];
  const selected = ['guild', 'shop'].includes(focusedRoute) ? 'explore' : focusedRoute === 'notifications' ? 'profile' : focusedRoute;
  const index = items.findIndex(item => item.route === selected && item.route !== 'create');

  // Breite eines Tabs aus der gemessenen Leiste; die Kapsel springt beim ersten Mal hin
  const [itemW, setItemW] = useState(0);
  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!itemW || index < 0) return;
    const to = index * itemW;
    if (placed.current) x.value = withSpring(to, SLIDE);
    else { x.value = to; placed.current = true; }
  }, [index, itemW, x]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scale: compactable ? 1 - (1 - COMPACT_SCALE) * tabBarCompact.value : 1 }],
  }), [compactable]);

  return <View pointerEvents="box-none" style={[s.outer, { paddingBottom: tabBarBottomGap(bottomInset) }]}>
    <AnimatedView style={[s.wrap, barStyle]}>
      {/* Deckende Schicht über dem Glas: Symbole bleiben über Videos und Bildern lesbar */}
      <GlassSurface radius={(ITEM_H + PAD * 2) / 2} tone={barTone} veil={barTone === 'dark' ? 0.5 : 0.72} style={s.bar}>
        <View style={s.row} onLayout={(e: LayoutChangeEvent) => setItemW(e.nativeEvent.layout.width / items.length)}>
          {itemW > 0 && index >= 0 && <AnimatedView pointerEvents="none" style={[s.pill, { width: itemW }, pillStyle]}>
            {/* Auswahl immer als helle Kapsel, wie der Umschalter „Für dich“ oben */}
            <GlassSurface material="solid" tone="light" elevated={barTone === 'light'} radius={ITEM_H / 2} style={s.pillFace} />
          </AnimatedView>}
          {items.map(item => <TabButton key={item.route} item={item} selected={selected === item.route}
            loading={item.route === 'index' && refreshing} tone={barTone}
            badge={item.route === 'messages' ? unreadMessages : item.route === 'profile' ? unreadNotifications : 0}
            onPress={() => item.route === 'create' ? onCreate() : onNavigate(item.route)} />)}
        </View>
      </GlassSurface>
    </AnimatedView>
  </View>;
}
const s = StyleSheet.create({
  outer: { paddingHorizontal: 22, paddingTop: 4, alignItems: 'center' },
  wrap: { width: '100%', maxWidth: 420 },
  bar: { padding: PAD },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: { position: 'absolute', left: 0, top: 0, height: ITEM_H, paddingHorizontal: 2 },
  pillFace: { flex: 1 },
  item: { flex: 1, height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
});

import { GlassSurface } from '@/components/ui/GlassSurface';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { SerloWordmark } from '@/components/brand/SerloWordmark';
import { SlidingLabel, SlidingPill, SpringPressable, useSlidingSelection } from '@/components/ui/SlidingSelection';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';

export function FeedHeader({ mode, top, overMedia = false, onModeChange, onSearch, onLive }: {
  mode: 'foryou' | 'following'; top: number; overMedia?: boolean;
  onModeChange: (mode: 'foryou' | 'following') => void; onSearch: () => void; onLive?: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const foreground = overMedia ? '#FFFFFF' : colors.text.primary;
  // Auswahl gleitet als Kapsel wie in der unteren Leiste; die Schrift überblendet mit
  const segment = useSlidingSelection(mode);

  return <View key={foreground} style={[s.bar, { top }]} pointerEvents="box-none">
    {onLive ? <Pressable onPress={onLive} accessibilityRole="button" accessibilityLabel={t('mobileDesign.watchLive')} style={s.live}>
      <View style={s.dot} /><Text style={[s.liveText, { color: foreground }]}>LIVE</Text>
    </Pressable> : <View style={[s.brand, overMedia && s.mediaShadow]}><SerloWordmark size={23} inverse={overMedia} /></View>}
    <GlassSurface radius={27} tone={overMedia ? 'dark' : 'auto'} style={s.segment}>
      <SlidingPill selection={segment} style={[s.pill, { backgroundColor: overMedia ? '#FFFFFF' : colors.bg.elevated, borderColor: overMedia ? '#FFFFFF' : colors.border.default }]} />
      {(['foryou', 'following'] as const).map(value => <SpringPressable key={value} onLayout={segment.onLayoutFor(value)} onPress={() => onModeChange(value)} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} style={s.tab}>
        <SlidingLabel selection={segment} optionKey={value} numberOfLines={2} maxFontSizeMultiplier={1.4} color={overMedia ? '#D4D4D8' : colors.text.secondary} activeColor={overMedia ? '#18181B' : colors.text.primary} style={s.label}>{t(value === 'foryou' ? 'feed.forYou' : 'feed.following')}</SlidingLabel>
      </SpringPressable>)}
    </GlassSurface>
    <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel={t('explore.searchPlaceholder')} style={s.search}>
      <GlassSurface radius={23} tone={overMedia ? 'dark' : 'auto'} style={[StyleSheet.absoluteFill, s.center]}><Search size={20} color={foreground} strokeWidth={1.8} /></GlassSurface>
    </Pressable>
  </View>;
}
const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, zIndex: 25, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  brand: { flexShrink: 0, justifyContent: 'center', minHeight: 44 },
  mediaShadow: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 1 } },
  segment: { flex: 1, minWidth: 0, flexDirection: 'row', padding: 4, borderRadius: 27 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 23, paddingHorizontal: 4 },
  label: { alignSelf: 'stretch', fontSize: 12, textAlign: 'center', fontFamily: 'Inter_600SemiBold' },
  search: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', },
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, shadowColor: '#1B2535', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  live: { minWidth: 57, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FC7173' },
  liveText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});

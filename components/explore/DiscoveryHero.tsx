import { DISCOVERY_MEDIA_GUTTER } from '@/lib/exploreLayout';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { ExternalLink, type LucideIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useI18n } from '@/lib/i18n';

type Shortcut = { id: string; label: string; Icon: LucideIcon; onPress: () => void };

/** The landscape moves slightly behind fixed text and glass controls. */
export function DiscoveryHero({ shortcuts, scrollY }: { shortcuts: Shortcut[]; scrollY: Animated.Value }) {
  const { t } = useI18n();
  const { fontScale } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const translateY = useMemo(() => scrollY.interpolate({ inputRange: [-120, 0, 240], outputRange: [-18, 0, 18], extrapolate: 'clamp' }), [scrollY]);
  return <View style={s.card}>
    <Animated.View pointerEvents="none" style={[s.landscape, !reduceMotion && { transform: [{ translateY }] }]}>
      <Image source={require('../../assets/discover/sharoy.jpg')} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit="cover" contentPosition="center" accessibilityLabel="Sharoy" />
    </Animated.View>
    <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.84)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
    <View style={[s.topline, fontScale > 1.5 && { flexDirection: 'column', alignItems: 'flex-start', paddingTop: 12 }]}>
      <Text style={[s.eyebrow, fontScale > 1.5 && { flex: 0 }]}>{t('nativeUi.community')}</Text>
      <Pressable onPress={() => void Linking.openURL('https://commons.wikimedia.org/wiki/File:Шарой_сверху.jpg')} accessibilityRole="link" accessibilityLabel={`${t('nativeUi.photoCreditLink')}: ${t('nativeUi.photoCredit')}`} style={[s.locationTap, fontScale > 1.5 && { maxWidth: '100%' }]}>
        <GlassSurface tone="dark" radius={16} elevated={false} style={s.location}><ExternalLink size={12} color="#FFFFFF" strokeWidth={1.8} /><Text style={s.locationText}>{t('nativeUi.photoCreditLink')}</Text></GlassSurface>
      </Pressable>
    </View>
    <Text accessibilityRole="header" maxFontSizeMultiplier={1.35} style={s.title}>{t('ux.discoveryTitle')}</Text>
    <View style={[s.shortcuts, fontScale > 1.5 && { flexDirection: 'column' }]}>
      {shortcuts.map(({ id, label, Icon, onPress }) => <Pressable key={id} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.shortcut, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        <GlassSurface tone="dark" radius={23} elevated={false} style={StyleSheet.absoluteFill} />
        <Icon size={17} color="#FFFFFF" strokeWidth={1.8} /><Text style={s.shortcutText}>{label}</Text>
      </Pressable>)}
    </View>
    <Text style={s.creditText}>{t('nativeUi.photoCredit')}</Text>
  </View>;
}
const s = StyleSheet.create({
  card: { borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#18181B', marginHorizontal: DISCOVERY_MEDIA_GUTTER, marginBottom: 12, paddingHorizontal: 16, paddingBottom: 10 },
  landscape: { position: 'absolute', left: -10, right: -10, top: -24, bottom: -24 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6 },
  eyebrow: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Inter_500Medium', flex: 1, lineHeight: 14 },
  title: { fontSize: 31, lineHeight: 34, letterSpacing: -1.3, fontFamily: 'Inter_700Bold', color: '#FFFFFF', paddingTop: 3, paddingBottom: 20 },
  locationTap: { minHeight: 44, maxWidth: '45%', justifyContent: 'center' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, minHeight: 28 },
  locationText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', flexShrink: 1 },
  shortcuts: { flexDirection: 'row', gap: 7 },
  shortcut: { flexGrow: 1, flexBasis: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 7 },
  shortcutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  creditText: { fontSize: 10, lineHeight: 14, color: '#DFE2E6', paddingTop: 10 },
});

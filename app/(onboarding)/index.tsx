import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MapPin, MessageCircle, Radio, Images } from 'lucide-react-native';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';
import { SerloWordmark } from '@/components/brand/SerloWordmark';
import { OnboardingButton } from '@/components/onboarding/OnboardingShell';

export default function OnboardingWelcome() {
  useThemedStatusBar('light');
  const { t } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[s.hero, { height: Math.max(300, Math.min(420, height * 0.47)) }]}>
        <Image source={require('../../assets/discover/sharoy.jpg')} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit="cover" contentPosition="center" accessibilityLabel={t('mobileDesign.sharoyPhoto')} />
        <LinearGradient colors={['rgba(0,0,0,0.54)', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0.68)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View style={[s.heroHeader, { paddingTop: insets.top + 14 }]}><SerloWordmark size={35} inverse /><View style={s.communityPill}><Text style={s.communityText}>COMMUNITY</Text></View></View>
        <View style={s.place}><MapPin size={12} color="#FFFFFF" /><Text style={s.placeText}>{t('mobileDesign.sharoyPlace')}</Text></View>
      </View>
      <View style={[s.sheet, { backgroundColor: colors.bg.primary }]}>
        <View style={[s.line, { backgroundColor: colors.accent.primary }]} />
        <Text style={[s.eyebrow, { color: colors.accent.primary }]}>{t('mobileDesign.welcomeEyebrow')}</Text>
        <Text accessibilityRole="header" style={[s.title, { color: colors.text.primary }]}>{t('mobileDesign.welcomeTitle')}</Text>
        <Text style={[s.description, { color: colors.text.secondary }]}>{t('mobileDesign.welcomeBody')}</Text>
        <View style={[s.features, { borderColor: colors.border.default }]}>
          {[{ Icon: Images, key: 'mobileDesign.share' }, { Icon: MessageCircle, key: 'tabs.messages' }, { Icon: Radio, key: 'tabs.live' }].map(({ Icon, key }) => <View key={key} style={s.feature}><Icon size={19} strokeWidth={1.6} color={colors.accent.primary} /><Text style={[s.featureLabel, { color: colors.text.secondary }]}>{t(key as Parameters<typeof t>[0])}</Text></View>)}
        </View>
        <View style={{ flex: 1, minHeight: 22 }} />
        <OnboardingButton label={t('mobileDesign.setupProfile')} onPress={() => router.push('/(onboarding)/username')} />
        <Pressable onPress={() => void Linking.openURL('https://commons.wikimedia.org/wiki/File:Шарой_сверху.jpg')} accessibilityRole="link" accessibilityLabel={t('nativeUi.photoCredit')} style={[s.credit, { paddingBottom: Math.max(insets.bottom, 12) }]}><Text style={[s.creditText, { color: colors.text.muted }]}>Sharoy · © Serpuhovichok · CC BY-SA 3.0</Text></Pressable>
      </View>
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, hero: { backgroundColor: '#18181B' },
  heroHeader: { paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  communityPill: { borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.24)' },
  communityText: { color: '#FFFFFF', fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.8 },
  place: { position: 'absolute', bottom: 46, left: 25, flexDirection: 'row', alignItems: 'center', gap: 6 }, placeText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 0.2 },
  sheet: { marginTop: -25, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 26, paddingTop: 23, flex: 1 },
  line: { width: 28, height: 3, borderRadius: 2, marginBottom: 21 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.3, textTransform: 'uppercase', marginBottom: 10 },
  title: { fontSize: 39, lineHeight: 43, fontFamily: 'Inter_700Bold', letterSpacing: -1.8 },
  description: { fontSize: 14, lineHeight: 22, marginTop: 14, maxWidth: 390 },
  features: { flexDirection: 'row', paddingTop: 18, paddingBottom: 18, marginTop: 24, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  feature: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 3 }, featureLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  credit: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingTop: 14 }, creditText: { fontSize: 9 },
});

import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { Camera, ChevronRight, FileText, Image as ImageIcon, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
export default function CreateStart() {
  const { t } = useI18n(); const { colors } = useTheme(); const router = useRouter(); const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(false); const busy = useRef(false); const [error, setError] = useState(false);
  useThemedStatusBar('auto');
  const openGallery = async () => {
    if (busy.current) return;
    busy.current = true; setPicking(true); setError(false);
    try {
      // The system picker grants access to the selected asset; camera access is unrelated.
      const result = await launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.92, videoMaxDuration: 60 });
      const asset = result.canceled ? null : result.assets[0];
      if (asset) router.replace({ pathname: '/create', params: { mediaUri: asset.uri, mediaType: asset.type === 'video' ? 'video' : 'image' } });
    } catch { setError(true); } finally { busy.current = false; setPicking(false); }
  };
  const options = [
    { Icon: Camera, title: t('ux.capture'), body: t('ux.captureBody'), action: () => router.replace('/create/camera'), gallery: false },
    { Icon: ImageIcon, title: t('create.fromGallery'), body: t('ux.galleryBody'), action: () => void openGallery(), gallery: true },
    { Icon: FileText, title: t('ux.writeText'), body: t('ux.textBody'), action: () => router.replace({ pathname: '/create/camera', params: { mode: 'text' } }), gallery: false },
  ];
  return <View style={[s.screen, { backgroundColor: colors.bg.primary, paddingTop: insets.top }]}>
    <View style={s.header}><Text style={[s.eyebrow, { color: colors.accent.primary }]}>{t('nativeUi.createPost')}</Text><Pressable onPress={() => router.back()} disabled={picking} accessibilityRole="button" accessibilityLabel={t('mobileDesign.close')} style={s.close}><X size={23} color={colors.text.primary} /></Pressable></View>
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }}>
      <Text style={[s.title, { color: colors.text.primary }]}>{t('ux.createTitle')}</Text><Text style={[s.body, { color: colors.text.secondary }]}>{t('ux.createBody')}</Text>
      <View style={{ gap: 12, marginTop: 30 }}>{options.map(({ Icon, title, body, action, gallery }) => <Pressable key={title} onPress={action} disabled={picking} accessibilityRole="button" accessibilityState={{ disabled: picking, busy: gallery && picking }} style={({ pressed }) => [s.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default, opacity: pressed ? 0.75 : 1 }]}>
        <View style={[s.icon, { backgroundColor: colors.bg.primary }]}>{gallery && picking ? <ActivityIndicator color={colors.accent.primary} /> : <Icon size={26} color={colors.accent.primary} strokeWidth={1.7} />}</View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={[s.option, { color: colors.text.primary }]}>{title}</Text><Text style={[s.description, { color: colors.text.secondary }]}>{body}</Text></View><ChevronRight size={20} color={colors.icon.muted} />
      </Pressable>)}</View>
      {error && <Text accessibilityRole="alert" style={[s.body, { color: colors.accent.danger }]}>{t('ux.galleryError')}</Text>}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 10 },
  eyebrow: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, lineHeight: 39, letterSpacing: -1.2, fontFamily: 'Inter_700Bold' }, body: { fontSize: 15, lineHeight: 23, marginTop: 12 },
  card: { minHeight: 106, padding: 16, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, option: { fontSize: 17, fontFamily: 'Inter_600SemiBold' }, description: { fontSize: 13, lineHeight: 19, marginTop: 5 },
});

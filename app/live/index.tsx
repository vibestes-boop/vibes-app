import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, Radio, Video, Play } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveLiveSessions } from '@/lib/useLiveSession';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';

export default function LiveDirectoryScreen() {
  useThemedStatusBar('auto');
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const sessions = useActiveLiveSessions();
  return <View style={[s.root, { backgroundColor: colors.bg.primary, paddingTop: insets.top }]}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel={t('settings.back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/explore')} style={s.back}><ArrowLeft color={colors.icon.default} size={23} /></Pressable><Text style={[s.title, { color: colors.text.primary }]}>{t('nativeUi.liveTitle')}</Text></View>
    <FlatList data={sessions.data ?? []} keyExtractor={item => item.id} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 14 }}
      refreshControl={<RefreshControl refreshing={sessions.isRefetching} onRefresh={() => void sessions.refetch()} tintColor={colors.accent.primary} />}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 10 }}>
        <Text style={{ color: colors.text.secondary, fontSize: 15, lineHeight: 23 }}>{t('nativeUi.liveBody')}</Text>
        <View style={s.actions}><Pressable style={[s.action, { backgroundColor: colors.text.primary }]} accessibilityRole="button" onPress={() => router.push('/live/start')}><Video size={19} color={colors.bg.primary} /><Text style={[s.actionText, { color: colors.bg.primary }]}>{t('nativeUi.goLive')}</Text></Pressable>
          <Pressable style={[s.action, { backgroundColor: colors.bg.elevated }]} accessibilityRole="button" onPress={() => router.push('/live/replays')}><Play size={17} color={colors.accent.primary} /><Text style={[s.actionText, { color: colors.accent.primary }]}>{t('nativeUi.replays')}</Text></Pressable></View>
      </View>}
      ListEmptyComponent={sessions.isLoading ? <ActivityIndicator color={colors.accent.primary} style={{ padding: 40 }} /> : <View style={[s.empty, { backgroundColor: colors.bg.secondary }]}>
        <Radio size={36} color={colors.icon.muted} /><Text style={[s.emptyTitle, { color: colors.text.primary }]}>{t(sessions.isError ? 'nativeUi.loadError' : 'nativeUi.noLives')}</Text>
        {sessions.isError ? <Pressable accessibilityRole="button" onPress={() => void sessions.refetch()} style={s.back}><Text style={{ color: colors.accent.primary }}>{t('nativeUi.retry')}</Text></Pressable> : <Text style={[s.emptyBody, { color: colors.text.muted }]}>{t('nativeUi.noLivesBody')}</Text>}
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${t('nativeUi.watchLive')}: ${item.title || item.profiles?.username || ''}`} onPress={() => router.push({ pathname: '/live/watch/[id]', params: { id: item.id } })} style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.default }]}>
        <View style={[s.cover, { backgroundColor: colors.bg.elevated }]}>{item.thumbnail_url ? <Image source={{ uri: item.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Radio size={40} color={colors.icon.muted} />}<View style={s.liveBadge}><Text style={s.liveText}>LIVE</Text></View></View>
        <View style={{ padding: 16, gap: 5 }}><Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700' }} numberOfLines={2}>{item.title || t('nativeUi.watchLive')}</Text>{item.profiles?.username && <Text style={{ color: colors.text.muted, fontSize: 13 }}>@{item.profiles.username}</Text>}</View>
      </Pressable>}
    />
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6 }, back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 25, fontWeight: '700', flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, action: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 15, borderRadius: 16, gap: 8 }, actionText: { fontSize: 13, fontWeight: '700' },
  empty: { borderRadius: 22, padding: 28, alignItems: 'center', gap: 14 }, emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' }, emptyBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' }, card: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' }, cover: { height: 200, justifyContent: 'center', alignItems: 'center' }, liveBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: '#C63249', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }, liveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
});

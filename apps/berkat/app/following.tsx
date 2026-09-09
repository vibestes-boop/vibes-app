import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowUpRight, ChevronRight, Search, SlidersHorizontal, UsersRound } from 'lucide-react-native';
import { Avatar } from '../components/Avatar';
import { useFollowing } from '../lib/useFollowing';
import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { radius, space, ui } from '../theme/tokens';

export default function FollowingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const focused = useIsFocused();
  const userId = useSession((state) => state.userId);
  const sessionLoading = useSession((state) => state.loading);
  const following = useFollowing(userId, focused && !sessionLoading);
  const [pulling, setPulling] = useState(false);
  const pullBusy = useRef(false);
  const rows = useMemo(() => {
    // Eine parallel geänderte Folgebeziehung kann Offset-Seiten verschieben.
    // Beim Aktualisieren werden alle Seiten neu geladen; bis dahin keine Doppelkarte.
    const seen = new Set<string>();
    return (following.data?.pages.flatMap((page) => page.rows) ?? []).filter((row) => {
      if (seen.has(row.following_id)) return false;
      seen.add(row.following_id);
      return true;
    });
  }, [following.data]);
  const refresh = async () => {
    if (pullBusy.current || following.isFetching || !userId) return;
    pullBusy.current = true;
    setPulling(true);
    try { await following.refetch({ cancelRefetch: false }); }
    finally { pullBusy.current = false; setPulling(false); }
  };
  const discover = () => router.push({ pathname: '/search', params: { tab: 'sellers' } });
  const busy = sessionLoading || (Boolean(userId) && (following.isLoading || (following.isError && following.isFetching && rows.length === 0)));
  const failed = following.isError && !following.isFetchNextPageError;

  const feedback = busy ? <View accessible accessibilityRole="progressbar" accessibilityLabel="Gefolgte Profile werden geladen" accessibilityState={{ busy: true }}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.skeletons}>
      {[0, 1, 2].map((id) => <View key={id} style={s.row}>
        <View style={s.skeletonAvatar} /><View style={s.copy}><View style={s.skeletonName} /><View style={s.skeletonLine} /></View>
      </View>)}
    </View>
  </View> : !userId ? <View style={s.empty}>
    <View style={s.emptyIcon}><UsersRound size={32} strokeWidth={1.5} color={ui.brand} /></View>
    <Text style={s.emptyTitle}>Deine Favoriten wiederfinden</Text>
    <Text style={s.body}>Melde dich an, um die Profile zu sehen, denen du folgst.</Text>
    <Pressable onPress={() => router.push('/login')} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && s.pressed]}>
      <Text style={s.primaryText}>Anmelden</Text>
    </Pressable>
  </View> : failed ? <View style={s.notice} accessibilityLiveRegion="polite">
    <Text style={s.noticeTitle}>{rows.length ? 'Aktualisieren hat nicht geklappt' : 'Deine Profile fehlen gerade'}</Text>
    <Text style={s.noticeBody}>{rows.length ? 'Die zuletzt geladenen Profile bleiben sichtbar. Versuch es noch einmal.' : 'Wir konnten deine gefolgten Profile nicht laden. Versuch es noch einmal.'}</Text>
    <Pressable onPress={() => void refresh()} disabled={following.isFetching}
      accessibilityRole="button" accessibilityState={{ disabled: following.isFetching, busy: following.isFetching }}
      style={({ pressed }) => [s.retry, pressed && s.pressed]}>
      <Text style={s.actionText}>{following.isFetching ? 'Wird aktualisiert …' : 'Erneut versuchen'}</Text>
    </Pressable>
  </View> : rows.length === 0 ? <View style={s.empty} accessibilityLiveRegion="polite">
    <View style={s.emptyIcon}><UsersRound size={32} strokeWidth={1.5} color={ui.brand} /></View>
    <Text style={s.emptyTitle}>Ein guter Fund bleibt in der Nähe</Text>
    <Text style={s.body}>Tippe auf einem Profil auf „Folgen“. Hier findest du es wieder, auch wenn gerade keine Show läuft.</Text>
    <Pressable onPress={discover} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && s.pressed]}>
      <Text style={s.primaryText}>Verkäufer entdecken</Text>
    </Pressable>
  </View> : null;

  return <View style={[s.screen, { paddingTop: insets.top }]}>
    <View key={`header:${fontScale}`} style={s.header}>
      <Pressable onPress={() => goBack()} accessibilityRole="button" accessibilityLabel="Zurück"
        style={({ pressed }) => [s.back, pressed && s.pressed]}><ArrowLeft size={23} color={ui.brand} /></Pressable>
      <Text style={s.title} accessibilityRole="header">Gefolgt</Text>
      <Pressable onPress={() => router.push('/interests')} accessibilityRole="button" accessibilityLabel="Interessen auswählen"
        accessibilityHint="Passe die Themen und die Gewichtung gefolgter Verkäufer auf deiner Startseite an."
        style={({ pressed }) => [s.back, pressed && s.pressed]}><SlidersHorizontal size={21} color={ui.brand} /></Pressable>
    </View>
    <FlatList
      key={userId ?? 'guest'} data={userId && !sessionLoading ? rows : []} keyExtractor={(item) => item.following_id}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + space.xl }]}
      refreshControl={userId ? <RefreshControl refreshing={pulling} onRefresh={() => void refresh()} tintColor={ui.brand} /> : undefined}
      ListHeaderComponent={<View key={`intro:${fontScale}`}>
        <Text style={s.intro}>Profile, die du wiederfinden möchtest.</Text>
        {userId && rows.length > 0 ? <>
          <Pressable onPress={discover} accessibilityRole="button" style={({ pressed }) => [s.discover, pressed && s.pressed]}>
            <Search size={18} color={ui.brand} /><Text style={s.discoverText}>Verkäufer entdecken</Text><ArrowUpRight size={18} color={ui.textMuted} />
          </Pressable>
          <Text style={s.order}>Zuletzt gefolgt</Text>
          {feedback}
        </> : null}
      </View>}
      ListEmptyComponent={<View key={`empty:${fontScale}`}>{feedback}</View>}
      ListFooterComponent={userId && following.hasNextPage ? <View key={`more:${fontScale}`} style={s.footer}>
        {following.isFetchNextPageError ? <Text style={s.noticeBody} accessibilityLiveRegion="polite">Weitere Profile konnten nicht geladen werden. Die bisherigen bleiben hier.</Text> : null}
        <Pressable onPress={() => { if (!following.isFetching) void following.fetchNextPage({ cancelRefetch: false }); }}
          disabled={following.isFetching} accessibilityRole="button"
          accessibilityState={{ disabled: following.isFetching, busy: following.isFetchingNextPage }}
          style={({ pressed }) => [s.more, pressed && s.pressed]}>
          {following.isFetchingNextPage ? <ActivityIndicator size="small" color={ui.brand} /> : null}
          <Text style={s.actionText}>{following.isFetchingNextPage ? 'Wird geladen …' : following.isFetchNextPageError ? 'Weitere Profile erneut laden' : 'Weitere Profile laden'}</Text>
        </Pressable>
      </View> : null}
      renderItem={({ item }) => <Pressable key={`${item.following_id}:${fontScale}`} disabled={!item.profile}
        onPress={() => { if (item.profile) router.push(`/seller/${item.profile.id}`); }}
        accessibilityRole="button" accessibilityState={{ disabled: !item.profile }}
        accessibilityLabel={item.profile ? `Profil von ${item.profile.username ?? 'Verkäufer'} öffnen` : 'Profil nicht verfügbar'}
        style={({ pressed }) => [s.row, pressed && s.pressed]}>
        <Avatar uri={item.profile?.avatar_url} name={item.profile?.username} size={52} />
        <View style={s.copy}>
          <Text style={s.name} numberOfLines={2}>{item.profile ? item.profile.username ?? 'Verkäufer' : 'Profil nicht verfügbar'}</Text>
          <Text style={s.sub}>{item.profile ? 'Profil ansehen' : 'Momentan nicht erreichbar'}</Text>
        </View>
        {item.profile ? <ChevronRight size={18} color={ui.textMuted} /> : null}
      </Pressable>}
    />
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
  back: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '700', color: ui.text, flex: 1 },
  content: { paddingHorizontal: space.lg },
  intro: { fontSize: 15, lineHeight: 22, color: ui.textMuted, marginBottom: space.lg },
  discover: { flexDirection: 'row', gap: space.sm, alignItems: 'center', minHeight: 56, backgroundColor: ui.card, padding: space.md, borderRadius: radius.lg, marginBottom: space.lg },
  discoverText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.brand },
  order: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginBottom: space.sm },
  row: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: ui.card, borderRadius: radius.lg, marginBottom: space.sm },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  name: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: ui.text },
  sub: { fontSize: 13, lineHeight: 19, color: ui.textMuted },
  pressed: { opacity: 0.65 },
  empty: { alignItems: 'center', paddingVertical: space.xl, gap: space.lg },
  emptyIcon: { width: 80, height: 80, borderRadius: radius.lg, backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: ui.text, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 23, color: ui.textMuted, textAlign: 'center', maxWidth: 380 },
  primary: { minHeight: 52, backgroundColor: ui.brand, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.md, justifyContent: 'center' },
  primaryText: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.card, textAlign: 'center' },
  notice: { padding: space.lg, borderRadius: radius.lg, backgroundColor: ui.card, gap: space.sm, marginBottom: space.md },
  noticeTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: ui.text },
  noticeBody: { fontSize: 14, lineHeight: 21, color: ui.textMuted },
  retry: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  actionText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand, flexShrink: 1, textAlign: 'center' },
  footer: { gap: space.sm, paddingVertical: space.md },
  more: { minHeight: 52, padding: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: ui.card, borderRadius: radius.lg },
  skeletons: { gap: space.xs },
  skeletonAvatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: ui.sunken },
  skeletonName: { width: '75%', height: 17, borderRadius: radius.sm, backgroundColor: ui.sunken, marginBottom: space.sm },
  skeletonLine: { width: '50%', height: 13, borderRadius: radius.sm, backgroundColor: ui.sunken },
});

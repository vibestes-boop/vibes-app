import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldAlert } from 'lucide-react-native';
import { useSession } from '../../lib/session';
import { useProfiles } from '../../lib/useAuction';
import { useConversations } from '../../lib/useDirectMessages';
import { goBack } from '../../lib/nav';
import { Avatar } from '../../components/Avatar';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FeedbackState } from '../../components/FeedbackState';
import { PressFeedback } from '../../components/PressFeedback';
import { radius, space, ui } from '../../theme/tokens';

function whenLabel(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std`;
  if (std < 48) return 'gestern';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { fontScale } = useWindowDimensions();
  const myUserId = useSession(s => s.userId);
  const query = useConversations(myUserId, focused);
  const conversations = query.data ?? [];
  const profiles = useProfiles(conversations.map(c => c.otherId));
  const [onlyUnread, setOnlyUnread] = useState(false);
  const unreadCount = conversations.filter(c => c.unread).length;
  const shown = onlyUnread ? conversations.filter(c => c.unread) : conversations;
  useEffect(() => { if (onlyUnread && unreadCount === 0 && !query.isError) setOnlyUnread(false); }, [onlyUnread, unreadCount, query.isError]);
  const [pulling, setPulling] = useState(false);
  const onPull = async () => { setPulling(true); try { await query.refetch({ cancelRefetch: false }); } finally { setPulling(false); } };
  useFocusEffect(useCallback(() => { if (myUserId) void query.refetch({ cancelRefetch: false }); }, [myUserId, query.refetch]));
  return <View style={[s.screen, { paddingTop: insets.top }]}>
    <ScreenHeader title="Nachrichten" onBack={() => goBack('/(tabs)/account')} />
    {!myUserId ? <View style={s.gate}><FeedbackState title="Deine Gespräche an einem Ort" body="Melde dich an, um Nachrichten zu lesen und Verkäufern zu schreiben."
      action={{ label: 'Anmelden', onPress: () => router.push('/login') }} /></View> : <FlatList
      data={shown} keyExtractor={item => item.id} contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl, gap: space.xs }}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void onPull()} tintColor={ui.brand} />}
      ListHeaderComponent={<View key={fontScale} style={s.intro}>
        <View style={s.safety}><ShieldAlert size={18} color={ui.textMuted} /><Text style={s.safetyText}>Passwort, Kontobestätigung oder externe Zahlungen: Solche Aufforderungen kommen hier nie von Berkat.</Text></View>
        {unreadCount > 0 ? <PressFeedback style={[s.chip, onlyUnread && s.chipOn]} onPress={() => setOnlyUnread(v => !v)} accessibilityRole="button" accessibilityState={{ selected: onlyUnread }}>
          <Text style={[s.chipText, onlyUnread && s.chipTextOn]}>{onlyUnread ? 'Alle anzeigen' : `${unreadCount} ungelesen`}</Text>
        </PressFeedback> : null}
        {query.isError ? <FeedbackState title="Nachrichten gerade nicht erreichbar" body={shown.length ? 'Du siehst den zuletzt geladenen Stand. Aktualisiere ihn für neue Nachrichten.' : 'Bitte lade deine Gespräche erneut.'}
          action={{ label: 'Erneut laden', onPress: () => void query.refetch({ cancelRefetch: false }), busy: query.isFetching }} /> : null}
      </View>}
      ListEmptyComponent={query.isError ? null : query.isPending ? <FeedbackState title="Gespräche werden geladen" body="Einen Moment …" loading /> : <FeedbackState
        title={onlyUnread ? 'Alles gelesen' : 'Hier beginnen deine Gespräche'}
        body={onlyUnread ? 'Wechsle zu allen Gesprächen, um etwas nachzulesen.' : 'Öffne einen Artikel und tippe auf „Nachricht schreiben“. Der Artikel wird deiner Frage zugeordnet.'}
        action={{ label: onlyUnread ? 'Alle Gespräche' : 'Artikel entdecken', onPress: () => onlyUnread ? setOnlyUnread(false) : router.push('/search') }} />}
      renderItem={({ item }) => {
        const other = profiles[item.otherId];
        const name = other?.username ?? 'Gespräch';
        const preview = item.preview ? `${item.lastFromMe ? 'Du: ' : ''}${item.preview}` : 'Gespräch öffnen';
        return <PressFeedback key={`${item.id}:${fontScale}`} kind="card" style={s.row} onPress={() => router.push(`/messages/${item.otherId}`)} accessibilityRole="button" accessibilityLabel={`${name}${item.unread ? ', ungelesen' : ''}: ${preview}`}>
          <Avatar uri={other?.avatarUrl} name={other?.username} size={46} />
          <View style={s.rowText}>
            <View style={[s.rowHead, fontScale > 1.5 && s.rowHeadLarge]}><Text numberOfLines={1} style={s.rowName}>{name}</Text><Text style={s.rowWhen}>{whenLabel(item.lastMessageAt)}</Text></View>
            <Text numberOfLines={2} style={[s.rowPreview, item.unread && s.rowPreviewUnread]}>{preview}</Text>
          </View>
          {item.unread ? <View style={s.unreadDot} /> : null}
        </PressFeedback>;
      }} />}
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  gate: { padding: space.lg },
  intro: { gap: space.md, marginBottom: space.md },
  safety: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  safetyText: { flex: 1, fontSize: 12, lineHeight: 18, color: ui.textMuted },
  chip: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: space.lg, backgroundColor: ui.card },
  chipOn: { backgroundColor: ui.brand },
  chipText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.text },
  chipTextOn: { color: ui.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: ui.card, borderRadius: radius.lg, minHeight: 84 },
  rowText: { flex: 1, minWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  rowHeadLarge: { flexDirection: 'column', alignItems: 'flex-start', gap: space.xs },
  rowName: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '700', color: ui.text },
  rowWhen: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
  rowPreview: { fontSize: 14, lineHeight: 20, color: ui.textMuted, marginTop: space.xs },
  rowPreviewUnread: { color: ui.text, fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ui.success },
});

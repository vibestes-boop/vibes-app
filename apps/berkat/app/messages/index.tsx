// Der Posteingang.
//
// Er existiert aus genau einem Grund: Ohne ihn wäre jede Nachricht, die man
// bekommt, unauffindbar. Man könnte schreiben, aber nie lesen — derselbe
// Fehler, der bei den Push-Meldungen erst am 14.08. auffiel.
//
// Bewusst schlicht: eine Zeile pro Mensch, neueste oben. Vorschautexte gibt es
// nicht — dafür müsste jede Zeile eine eigene Abfrage machen, und ein
// Posteingang mit fünfzig Abfragen ist kein Posteingang.

import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MessageSquare } from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { useProfiles } from '../../lib/useAuction';
import { useConversations } from '../../lib/useDirectMessages';
import { Avatar } from '../../components/Avatar';
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
  const myUserId = useSession((s) => s.userId);
  const { data: conversations = [], isLoading, refetch } = useConversations(myUserId);

  const profiles = useProfiles(conversations.map((c) => c.otherId));

  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  // Stack-Bildschirme bleiben aufgebaut — wer aus einem Verlauf zurückkommt,
  // sähe sonst die alte Reihenfolge.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nachrichten</Text>
        <View style={styles.back} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={
          conversations.length === 0
            ? styles.emptyWrap
            : { paddingBottom: insets.bottom + space.xl }
        }
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <MessageSquare size={38} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Noch keine Nachrichten</Text>
              <Text style={styles.emptyBody}>
                Schreib einem Verkäufer aus seiner Show heraus — tipp dort oben auf seinen Namen.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const other = profiles[item.otherId];
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(`/messages/${item.otherId}`)}
              accessibilityRole="button"
            >
              <Avatar uri={other?.avatarUrl} name={other?.username} size={46} />
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={styles.rowName}>
                  {other?.username ?? '…'}
                </Text>
                <Text style={styles.rowWhen}>{whenLabel(item.lastMessageAt)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  rowPressed: { backgroundColor: ui.sunken },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: '600', color: ui.text },
  rowWhen: { fontSize: 12, color: ui.textMuted, marginTop: 2 },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 14, color: ui.textMuted, textAlign: 'center', lineHeight: 20 },
});

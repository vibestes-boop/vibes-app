// Ein Verlauf mit genau einer Person.
//
// Der Parameter ist die **Gegenseite**, nicht die Unterhaltung — man kommt aus
// dem Live-Raum, und dort kennt man den Menschen, nicht die Konversations-ID.
// Die wird beim Öffnen aufgelöst oder angelegt.
//
// Helle Fläche: Schreiben ist kein Zuschauen.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, SendHorizontal } from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { useProfiles } from '../../lib/useAuction';
import { goBack } from '../../lib/nav';
import {
  useConversationWith,
  useMarkMessagesRead,
  useMessages,
  useSendMessage,
  type DirectMessage,
} from '../../lib/useDirectMessages';
import { Avatar } from '../../components/Avatar';
import { radius, space, ui } from '../../theme/tokens';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function ConversationScreen() {
  const { id: otherId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: conversationId, isLoading: resolving } = useConversationWith(myUserId, otherId);
  const { data: messages = [], isLoading } = useMessages(conversationId);
  const send = useSendMessage(conversationId, myUserId);
  const markRead = useMarkMessagesRead(conversationId, myUserId);

  const profiles = useProfiles(otherId ? [otherId] : []);
  const other = profiles[otherId ?? ''];

  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<FlatList<DirectMessage>>(null);

  // Gelesen setzen, sobald etwas Ungelesenes im Verlauf liegt — nicht nur beim
  // ersten Öffnen: Wer den Bildschirm offen hält, während die Gegenseite
  // schreibt, hat es auch gelesen.
  useEffect(() => {
    if (!conversationId) return;
    if (messages.some((m) => m.sender_id !== myUserId && !m.read)) markRead();
  }, [conversationId, messages, myUserId, markRead]);

  const onSend = useCallback(async () => {
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    const res = await send(text);
    if (!res.ok) {
      setDraft(text);
      setNotice(res.message);
    }
  }, [draft, send]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/messages')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Pressable
          style={styles.headerIdentity}
          onPress={() => otherId && router.push(`/seller/${otherId}`)}
          accessibilityRole="button"
        >
          <Avatar uri={other?.avatarUrl} name={other?.username} size={30} />
          <Text numberOfLines={1} style={styles.headerTitle}>
            {other?.username ?? '…'}
          </Text>
        </Pressable>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 52}
      >
        {resolving || isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={ui.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Avatar uri={other?.avatarUrl} name={other?.username} size={56} />
                <Text style={styles.emptyTitle}>
                  Schreib {other?.username ?? 'ihm'} die erste Nachricht 👋
                </Text>
                <Text style={styles.emptyBody}>
                  Fragen zum Artikel, zum Versand, oder einfach hallo.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === myUserId;
              return (
                <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {item.content ?? ''}
                    </Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {timeLabel(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        <View style={[styles.inputRow, { paddingBottom: insets.bottom || space.sm }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Nachricht schreiben …"
            placeholderTextColor={ui.textMuted}
            style={styles.input}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={() => void onSend()}
            disabled={!draft.trim()}
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnOff]}
            accessibilityRole="button"
            accessibilityLabel="Senden"
          >
            <SendHorizontal size={19} color={ui.goldInk} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: ui.text },

  listContent: { padding: space.md, gap: space.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: ui.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: ui.card, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: ui.text, lineHeight: 20 },
  bubbleTextMine: { color: '#FFFFFF' },
  bubbleTime: { fontSize: 10, color: ui.textMuted, marginTop: 3, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.65)' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: ui.text, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: 'center', lineHeight: 19 },

  notice: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    padding: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderRadius: radius.lg,
    backgroundColor: ui.sunken,
    paddingHorizontal: space.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: ui.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
});

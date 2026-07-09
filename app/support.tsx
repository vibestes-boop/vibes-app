import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useMySupport, useCreateSupportThread, useSendSupportMessage } from '@/lib/useSupport';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Send, LifeBuoy } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SupportScreen() {
  useThemedStatusBar('auto');
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch } = useMySupport();
  const { mutateAsync: createThread, isPending: creating } = useCreateSupportThread();
  const { mutateAsync: sendMessage, isPending: sending } = useSendSupportMessage();

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Neue Admin-Antworten laden, wenn der Screen wieder in den Fokus kommt.
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const thread = data?.thread ?? null;
  const messages = data?.messages ?? [];

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      if (thread) {
        await sendMessage({ threadId: thread.id, body });
      } else {
        await createThread({ subject: t('settings.supSubject'), body });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    } catch {
      setDraft(body);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border.subtle }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700' }}>{t('settings.helpSupport')}</Text>
          <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
            {thread ? t('settings.supSubThread') : t('settings.supSubNew')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 4}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.accent.secondary} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, gap: 10, flexGrow: 1 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }}>
                  <LifeBuoy size={26} color={colors.text.secondary} strokeWidth={1.8} />
                </View>
                <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '600' }}>{t('settings.supEmptyTitle')}</Text>
                <Text style={{ color: colors.text.secondary, fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
                  {t('settings.supEmptyDesc')}
                </Text>
              </View>
            )}

            {messages.map((m) => {
              const mine = m.sender_type === 'user';
              return (
                <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  {!mine && (
                    <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 3, marginLeft: 4 }}>{t('settings.supTeam')}</Text>
                  )}
                  <View
                    style={{
                      maxWidth: '82%',
                      backgroundColor: mine ? colors.accent.secondary : colors.bg.elevated,
                      paddingHorizontal: 13,
                      paddingVertical: 9,
                      borderRadius: 16,
                      borderBottomRightRadius: mine ? 4 : 16,
                      borderBottomLeftRadius: mine ? 16 : 4,
                    }}
                  >
                    <Text style={{ color: mine ? '#FFFFFF' : colors.text.primary, fontSize: 14.5, lineHeight: 20 }}>{m.body}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Eingabe */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 8, borderTopWidth: 0.5, borderTopColor: colors.border.subtle }}>
          <TextInput
            style={{ flex: 1, maxHeight: 120, backgroundColor: colors.bg.input, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: colors.text.primary, fontSize: 15 }}
            placeholder={thread ? t('settings.supPlaceholderThread') : t('settings.supPlaceholderNew')}
            placeholderTextColor={colors.text.muted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || creating || sending}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent.secondary, alignItems: 'center', justifyContent: 'center', opacity: !draft.trim() || creating || sending ? 0.5 : 1 }}
          >
            {creating || sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Send size={18} color="#FFFFFF" strokeWidth={2} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

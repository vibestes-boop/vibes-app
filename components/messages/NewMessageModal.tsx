import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowUpRight, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/authStore';
import { useOrCreateConversation, type Conversation } from '@/lib/useMessages';
import { getBlockedIdSet } from '@/lib/useBlock';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';

type Recipient = Conversation['other_user'];
export function NewMessageModal({ onClose, recent = [] }: { onClose: () => void; recent?: Recipient[] }) {
  const { t } = useI18n(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const userId = useAuthStore(s => s.profile?.id);
  const [query, setQuery] = useState(''); const [debounced, setDebounced] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null); const [openError, setOpenError] = useState(false);
  const mounted = useRef(true); const busy = useRef(false);
  const { mutateAsync: openConversation } = useOrCreateConversation();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const normalized = query.trim().replace(/^@/, '');
  useEffect(() => { const timer = setTimeout(() => setDebounced(normalized), 300); return () => clearTimeout(timer); }, [normalized]);
  const waiting = normalized !== debounced;
  const search = useQuery<Recipient[]>({
    queryKey: ['dm-recipients', userId, debounced], enabled: !!userId && debounced.length >= 2,
    queryFn: async () => {
      const blocked = await getBlockedIdSet();
      const { data, error } = await supabase.from('profiles').select('id, username, avatar_url').ilike('username', `%${debounced.replace(/[\\%_]/g, '\\$&')}%`).neq('id', userId!).limit(40);
      if (error) throw error;
      return ((data ?? []) as Recipient[]).filter(person => !blocked.has(person.id)).slice(0, 20);
    },
    staleTime: 30_000,
  });
  const select = async (person: Recipient) => {
    if (busy.current || !userId) return;
    busy.current = true; setOpeningId(person.id); setOpenError(false);
    try {
      const id = await openConversation(person.id);
      if (!mounted.current || useAuthStore.getState().profile?.id !== userId) return;
      onClose(); router.push({ pathname: '/messages/[id]', params: { id, username: person.username ?? '', avatarUrl: person.avatar_url ?? '', otherUserId: person.id } });
    } catch { if (mounted.current) setOpenError(true); }
    finally { busy.current = false; if (mounted.current) setOpeningId(null); }
  };
  const searching = normalized.length > 0;
  const users = searching ? (!waiting && normalized.length >= 2 ? search.data ?? [] : []) : recent.filter(person => person.id !== userId);
  const loading = searching && (waiting || search.isFetching);
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.screen, { backgroundColor: colors.bg.primary }]}>
      <View style={[s.header, { paddingTop: Platform.OS === 'android' ? insets.top + 12 : 20 }]}><View style={{ flex: 1 }}><Text style={[s.title, { color: colors.text.primary }]}>{t('messages.newMessage')}</Text><Text style={[s.sub, { color: colors.text.secondary }]}>{t('inbox.startHint')}</Text></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('mobileDesign.close')} style={s.iconButton}><X size={23} color={colors.text.primary} /></Pressable></View>
      <View style={[s.search, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}><Search size={19} color={colors.icon.muted} /><TextInput value={query} onChangeText={value => { setQuery(value); setOpenError(false); }} placeholder={t('messages.searchUser')} accessibilityLabel={t('messages.searchUser')} placeholderTextColor={colors.text.muted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={[s.input, { color: colors.text.primary }]} />{query.length > 0 && <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('explore.clearSearch')} style={s.iconButton}><X size={18} color={colors.icon.default} /></Pressable>}</View>
      {openError && <Text accessibilityRole="alert" style={[s.error, { color: colors.accent.danger }]}>{t('inbox.openError')}</Text>}
      {!searching && users.length > 0 && <Text style={[s.section, { color: colors.text.secondary }]}>{t('inbox.recent')}</Text>}
      <FlatList data={users} keyExtractor={person => person.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => <Pressable onPress={() => void select(item)} disabled={openingId !== null} accessibilityRole="button" accessibilityLabel={t('inbox.openChat', { name: item.username ?? '?' })} accessibilityState={{ disabled: openingId !== null, busy: openingId === item.id }} style={[s.row, { borderBottomColor: colors.border.subtle }]}>
          {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={s.avatar} /> : <View style={[s.avatar, s.initial, { backgroundColor: colors.bg.elevated }]}><Text style={{ color: colors.accent.primary, fontSize: 20, fontWeight: '600' }}>{item.username?.[0]?.toUpperCase() ?? '?'}</Text></View>}
          <Text numberOfLines={1} style={[s.name, { color: colors.text.primary }]}>@{item.username ?? '?'}</Text>{openingId === item.id ? <ActivityIndicator color={colors.accent.primary} /> : <ArrowUpRight size={20} color={colors.icon.muted} />}
        </Pressable>}
        ListEmptyComponent={<View style={s.empty}>
          {loading ? <ActivityIndicator accessibilityLabel={t('inbox.searching')} color={colors.accent.primary} /> : <>
            <Search size={30} color={colors.icon.muted} /><Text accessibilityRole={search.isError && searching ? 'alert' : undefined} style={[s.emptyText, { color: colors.text.secondary }]}>{t(!searching ? 'inbox.searchHint' : normalized.length < 2 ? 'ux.searchMinimumPeople' : search.isError ? 'inbox.searchError' : 'messages.noUserFound')}</Text>
            {searching && normalized.length >= 2 && search.isError && <Pressable onPress={() => void search.refetch()} accessibilityRole="button" style={[s.retry, { backgroundColor: colors.bg.elevated }]}><Text style={{ color: colors.accent.primary, fontWeight: '600' }}>{t('nativeUi.retry')}</Text></Pressable>}
            {!searching && <Pressable onPress={() => { onClose(); router.navigate('/(tabs)/explore'); }} accessibilityRole="button" style={[s.retry, { backgroundColor: colors.bg.elevated }]}><Text style={{ color: colors.accent.primary, fontWeight: '600' }}>{t('nativeUi.people')}</Text></Pressable>}
          </>}
        </View>} />
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 12 }, title: { fontSize: 25, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 }, sub: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, search: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, paddingLeft: 15, paddingRight: 4, borderRadius: 17, borderWidth: 1 }, input: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 15 },
  section: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 }, row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 13, borderBottomWidth: StyleSheet.hairlineWidth }, avatar: { width: 50, height: 50, borderRadius: 25 }, initial: { alignItems: 'center', justifyContent: 'center' }, name: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600' },
  empty: { flex: 1, padding: 28, paddingBottom: 60, alignItems: 'center', justifyContent: 'center', gap: 14 }, emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center' }, retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 14 }, error: { fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginTop: 14 },
});

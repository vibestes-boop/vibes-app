/**
 * app/admin/users.tsx — Nutzerverwaltung
 *
 * - Suche nach Username
 * - Nutzer sperren / entsperren
 * - Verifizierung ein/ausschalten
 * - Admin-Rechte vergeben / entziehen
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Search, Shield, CheckCircle,
  Ban, ShieldCheck, Users,
} from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import {
  useAdminUsers, useAdminBanUser, useAdminVerifyUser,
  useAdminToggleAdmin, type AdminUser,
} from '@/lib/useAdmin';
import { useTheme } from '@/lib/useTheme';

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const { data: users = [], isLoading } = useAdminUsers(query || ' ');
  const { mutateAsync: banUser }    = useAdminBanUser();
  const { mutateAsync: verifyUser } = useAdminVerifyUser();
  const { mutateAsync: toggleAdmin } = useAdminToggleAdmin();

  const handleBan = useCallback((user: AdminUser) => {
    Alert.alert(
      user.is_banned ? 'Sperre aufheben' : 'Nutzer sperren',
      `@${user.username} ${user.is_banned ? 'entsperren?' : 'sperren?'}`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: user.is_banned ? 'Entsperren' : 'Sperren',
          style: user.is_banned ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await banUser({ userId: user.id, ban: !user.is_banned });
              impactAsync(ImpactFeedbackStyle.Medium);
            } catch {
              Alert.alert('Fehler', 'Aktion fehlgeschlagen.');
            }
          },
        },
      ]
    );
  }, [banUser]);

  const handleVerify = useCallback(async (user: AdminUser) => {
    try {
      await verifyUser({ userId: user.id, verify: !user.is_verified });
      impactAsync(ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert('Fehler', 'Verifizierung fehlgeschlagen.');
    }
  }, [verifyUser]);

  const handleToggleAdmin = useCallback((user: AdminUser) => {
    Alert.alert(
      user.is_admin ? 'Admin-Rechte entziehen' : 'Admin-Rechte vergeben',
      `@${user.username} ${user.is_admin ? 'aus Adminteam entfernen' : 'zu Admin machen'}?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: user.is_admin ? 'Entziehen' : 'Vergeben',
          style: 'destructive',
          onPress: async () => {
            try { await toggleAdmin({ userId: user.id, isAdmin: !user.is_admin }); }
            catch { Alert.alert('Fehler', 'Aktion fehlgeschlagen.'); }
          },
        },
      ]
    );
  }, [toggleAdmin]);

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>Nutzerverwaltung</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Suche */}
      <View style={[s.searchWrap, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        <Search size={16} color={colors.text.muted} strokeWidth={2} />
        <TextInput
          style={[s.searchInput, { color: colors.text.primary }]}
          placeholder="Username suchen…"
          placeholderTextColor={colors.text.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Liste */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Users size={40} color={colors.text.muted} strokeWidth={1.2} />
              <Text style={[s.emptyText, { color: colors.text.muted }]}>
                {query ? 'Keine Nutzer gefunden.' : 'Starte eine Suche.'}
              </Text>
            </View>
          }
          renderItem={({ item: user }) => (
            <View style={[s.userCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
              {/* Avatar */}
              <View style={s.userLeft}>
                {user.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={s.avatar} contentFit="cover" />
                ) : (
                  <View style={[s.avatarFallback, { backgroundColor: colors.bg.primary }]}>
                    <Text style={s.avatarInitial}>{user.username[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={s.usernameRow}>
                    <Text style={[s.username, { color: colors.text.primary }]}>@{user.username}</Text>
                    {user.is_verified && <CheckCircle size={12} color="#FBBF24" strokeWidth={2.5} />}
                    {user.is_admin   && <ShieldCheck size={12} color="#6366F1" strokeWidth={2.5} />}
                    {user.is_banned  && <Text style={s.bannedChip}>GESPERRT</Text>}
                    {user.women_only_verified && <Text style={{ fontSize: 12 }}>🌸</Text>}
                  </View>
                  <Text style={[s.userMeta, { color: colors.text.muted }]}>
                    {user.post_count} Posts · {user.follower_count} Follower
                  </Text>
                </View>
              </View>

              {/* Aktionsbuttons */}
              <View style={s.actions}>
                {/* Verifizieren */}
                <Pressable
                  style={[s.actionBtn, { borderColor: colors.border.subtle, backgroundColor: user.is_verified ? 'rgba(251,191,36,0.12)' : colors.bg.primary }]}
                  onPress={() => handleVerify(user)}
                  accessibilityLabel={user.is_verified ? 'Verifizierung entfernen' : 'Verifizieren'}
                  hitSlop={4}
                >
                  <CheckCircle size={14} color={user.is_verified ? '#FBBF24' : colors.text.muted} strokeWidth={2} />
                </Pressable>

                {/* Sperren */}
                <Pressable
                  style={[s.actionBtn, { borderColor: colors.border.subtle, backgroundColor: user.is_banned ? 'rgba(239,68,68,0.12)' : colors.bg.primary }]}
                  onPress={() => handleBan(user)}
                  accessibilityLabel={user.is_banned ? 'Entsperren' : 'Sperren'}
                  hitSlop={4}
                >
                  <Ban size={14} color={user.is_banned ? '#EF4444' : colors.text.muted} strokeWidth={2} />
                </Pressable>

                {/* Admin */}
                <Pressable
                  style={[s.actionBtn, { borderColor: colors.border.subtle, backgroundColor: user.is_admin ? 'rgba(99,102,241,0.12)' : colors.bg.primary }]}
                  onPress={() => handleToggleAdmin(user)}
                  accessibilityLabel={user.is_admin ? 'Admin-Rechte entziehen' : 'Admin machen'}
                  hitSlop={4}
                >
                  <Shield size={14} color={user.is_admin ? '#6366F1' : colors.text.muted} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 12,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },

  userCard: {
    borderRadius: 14, borderWidth: 1, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  userLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#888' },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  username: { fontSize: 14, fontWeight: '700' },
  bannedChip: { fontSize: 9, fontWeight: '800', color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  userMeta: { fontSize: 11, marginTop: 2 },

  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

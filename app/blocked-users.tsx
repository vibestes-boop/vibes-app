/**
 * blocked-users.tsx
 * Zeigt alle geblockten User — Apple App Store Pflicht.
 * User können direkt in dieser Liste entblocken.
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldOff, UserX } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useBlockedUsers, useBlockUser, type BlockedUser } from '@/lib/useBlock';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/lib/useTheme';

function BlockedUserRow({ user }: { user: BlockedUser }) {
  const [unblocking, setUnblocking] = useState(false);
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const { unblock } = useBlockUser(user.id);
  const { colors } = useTheme();

  const handleUnblock = () => {
    Alert.alert(
      `@${user.username ?? 'User'} entblocken?`,
      'Dieser User kann dann wieder dein Profil und deine Posts sehen.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entblocken',
          onPress: async () => {
            setUnblocking(true);
            try {
              await unblock.mutateAsync();
              queryClient.setQueryData<BlockedUser[]>(
                ['blocked-users', currentUserId],
                (old) => (old ?? []).filter((u) => u.id !== user.id)
              );
            } catch {
              Alert.alert('Fehler', 'Entblocken fehlgeschlagen.');
            } finally {
              setUnblocking(false);
            }
          },
        },
      ]
    );
  };

  const initial = (user.username ?? '?')[0].toUpperCase();

  return (
    <View style={[styles.row, { borderBottomColor: colors.border.subtle }]}>
      <View style={styles.avatarWrap}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[styles.avatarInitial, { color: colors.text.muted }]}>{initial}</Text>
          </View>
        )}
        <View style={[styles.blockBadge, { borderColor: colors.bg.secondary }]}>
          <UserX size={10} color="#fff" strokeWidth={2.5} />
        </View>
      </View>

      <View style={styles.info}>
        <Text style={[styles.username, { color: colors.text.primary }]}>@{user.username ?? 'Unbekannt'}</Text>
        <Text style={styles.blockedLabel}>Geblockt</Text>
      </View>

      <Pressable
        onPress={handleUnblock}
        disabled={unblocking}
        style={styles.unblockBtn}
        accessibilityRole="button"
        accessibilityLabel={`${user.username ?? 'User'} entblocken`}
      >
        {unblocking ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.unblockText}>Entblocken</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const { data: blockedUsers = [], isLoading } = useBlockedUsers();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle, backgroundColor: colors.bg.secondary }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.bg.elevated }]}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          hitSlop={12}
        >
          <ArrowLeft size={20} color={colors.text.secondary} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Geblockte Nutzer</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.center}>
          <ShieldOff size={48} color={colors.icon.muted} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Keine geblockten Nutzer</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text.muted }]}>
            Nutzer die du blockst, kannst du hier verwalten.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BlockedUserRow user={item} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border.subtle }]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '700' },
  blockBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  info: { flex: 1, gap: 2 },
  username: { fontSize: 15, fontWeight: '600' },
  blockedLabel: { color: '#EF4444', fontSize: 12, fontWeight: '500' },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(29,185,84,0.08)', minWidth: 90, alignItems: 'center',
  },
  unblockText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  separator: { height: 1, marginLeft: 76 },
});

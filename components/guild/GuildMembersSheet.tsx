import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { X, Users } from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useGuildMembers, type GuildMember } from '@/lib/useGuildMembers';
import { useFollow } from '@/lib/useFollow';
import { useAuthStore } from '@/lib/authStore';

// ─── Single member row ────────────────────────────────────────────────────────
function MemberRow({
  member,
  guildColors,
  onClose,
}: {
  member: GuildMember;
  guildColors: [string, string];
  onClose: () => void;
}) {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const isOwn = member.id === currentUserId;
  const { isFollowing, toggle: toggleFollow } = useFollow(isOwn ? null : member.id);
  const initial = (member.username ?? '?')[0].toUpperCase();

  const handlePressName = () => {
    impactAsync(ImpactFeedbackStyle.Light);
    onClose();
    router.push({ pathname: '/user/[id]', params: { id: member.id } });
  };

  return (
    <View style={s.row}>
      {/* Avatar */}
      <Pressable onPress={handlePressName} hitSlop={8}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={s.avatar} contentFit="cover" />
        ) : (
          <View style={[s.avatar, s.avatarFallback, { backgroundColor: guildColors[0] + '33' }]}>
            <Text style={[s.avatarInitial, { color: guildColors[0] }]}>{initial}</Text>
          </View>
        )}
      </Pressable>

      {/* Name */}
      <Pressable style={{ flex: 1 }} onPress={handlePressName} hitSlop={4}>
        <Text style={s.username} numberOfLines={1}>
          @{member.username ?? 'unknown'}
        </Text>
        {isOwn && <Text style={s.youLabel}>Du</Text>}
      </Pressable>

      {/* Follow-Button — nur bei fremden Usern */}
      {!isOwn && (
        <Pressable
          onPress={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            toggleFollow();
          }}
          style={[s.followBtn, isFollowing && s.followBtnActive]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? `${member.username} entfolgen` : `${member.username} folgen`}
        >
          <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
            {isFollowing ? 'Folgst du' : 'Folgen'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────
export function GuildMembersSheet({
  visible,
  onClose,
  guildId,
  guildName,
  guildColors,
}: {
  visible: boolean;
  onClose: () => void;
  guildId: string | null | undefined;
  guildName: string;
  guildColors: [string, string];
}) {
  const { data: members = [], isLoading } = useGuildMembers(visible ? guildId : null);

  const renderItem = useCallback(
    ({ item }: { item: GuildMember }) => (
      <MemberRow member={item} guildColors={guildColors} onClose={onClose} />
    ),
    [guildColors, onClose]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Users size={16} color={guildColors[0]} strokeWidth={2} />
            <Text style={[s.title, { color: guildColors[0] }]}>{guildName}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Schließen">
            <X size={20} color="rgba(255,255,255,0.6)" strokeWidth={2} />
          </Pressable>
        </View>

        <Text style={s.subtitle}>
          {isLoading ? '…' : `${members.length} Mitglieder`}
        </Text>

        {/* List */}
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={guildColors[0]} size="large" />
          </View>
        ) : members.length === 0 ? (
          <View style={s.center}>
            <Users size={48} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
            <Text style={s.emptyText}>Noch keine Mitglieder</Text>
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={s.separator} />}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A12',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 72,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  youLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 1,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.5)',
    backgroundColor: 'rgba(34,211,238,0.1)',
  },
  followBtnActive: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  followBtnText: {
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '600',
  },
  followBtnTextActive: {
    color: 'rgba(255,255,255,0.6)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    fontWeight: '500',
  },
});

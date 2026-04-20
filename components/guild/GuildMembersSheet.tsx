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
import { useTheme } from '@/lib/useTheme';

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
  const { colors } = useTheme();

  const handlePressName = () => {
    impactAsync(ImpactFeedbackStyle.Light);
    onClose();
    router.push({ pathname: '/user/[id]', params: { id: member.id } });
  };

  return (
    <View style={[s.row, { borderBottomColor: colors.border.subtle }]}>
      {/* Avatar */}
      <Pressable onPress={handlePressName} hitSlop={8}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={s.avatar} contentFit="cover" />
        ) : (
          <View style={[s.avatar, s.avatarFallback, { backgroundColor: guildColors[0] + '22' }]}>
            <Text style={[s.avatarInitial, { color: guildColors[0] }]}>{initial}</Text>
          </View>
        )}
      </Pressable>

      {/* Name */}
      <Pressable style={{ flex: 1 }} onPress={handlePressName} hitSlop={4}>
        <Text style={[s.username, { color: colors.text.primary }]} numberOfLines={1}>
          @{member.username ?? 'unknown'}
        </Text>
        {isOwn && <Text style={[s.youLabel, { color: colors.text.muted }]}>Du</Text>}
      </Pressable>

      {/* Follow-Button */}
      {!isOwn && (
        <Pressable
          onPress={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            toggleFollow();
          }}
          style={[
            s.followBtn,
            {
              borderColor: isFollowing ? colors.border.default : colors.text.primary,
              backgroundColor: isFollowing ? colors.bg.elevated : colors.text.primary,
            },
          ]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? `${member.username} entfolgen` : `${member.username} folgen`}
        >
          <Text style={[s.followBtnText, { color: isFollowing ? colors.text.secondary : colors.bg.primary }]}>
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
  const { colors } = useTheme();

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
      <SafeAreaView style={[s.container, { backgroundColor: colors.bg.secondary }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border.default, backgroundColor: colors.bg.secondary }]}>
          <View style={s.headerLeft}>
            <Users size={16} color={guildColors[0]} strokeWidth={2} />
            <Text style={[s.title, { color: colors.text.primary }]}>{guildName}</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[s.closeBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
          >
            <X size={18} color={colors.icon.default} strokeWidth={2} />
          </Pressable>
        </View>

        <Text style={[s.subtitle, { color: colors.text.muted }]}>
          {isLoading ? '…' : `${members.length} Mitglieder`}
        </Text>

        {/* List */}
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={guildColors[0]} size="large" />
          </View>
        ) : members.length === 0 ? (
          <View style={s.center}>
            <Users size={48} color={colors.icon.muted} strokeWidth={1.5} />
            <Text style={[s.emptyText, { color: colors.text.muted }]}>Noch keine Mitglieder</Text>
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: colors.border.subtle }]} />}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor via inline mit colors.bg.secondary
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
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
    paddingVertical: 13,
    gap: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 78,
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
    fontSize: 15,
    fontWeight: '600',
    // color via inline
  },
  youLabel: {
    fontSize: 12,
    marginTop: 1,
    // color via inline
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    // borderColor + backgroundColor via inline
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
    // color via inline
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

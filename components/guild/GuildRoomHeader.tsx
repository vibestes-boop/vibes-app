import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Zap, Users } from 'lucide-react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { GuildViewToggle } from './GuildViewToggle';
import type { GuildViewMode } from './guildConstants';
import { useTheme } from '@/lib/useTheme';

/**
 * Minimal Guild Header — TikTok/Instagram-Style.
 * Guild-Name + klickbare Mitglieder-Zahl (links) + View-Toggle (rechts).
 */
export function GuildRoomHeader({
  guildName,
  guildColors,
  memberCount,
  mode,
  onToggle,
  onMembersPress,
}: {
  guildName: string;
  memberCount?: number;
  guildColors: [string, string];
  mode: GuildViewMode;
  onToggle: (m: GuildViewMode) => void;
  onMembersPress?: () => void;
}) {
  const [accent] = guildColors;
  const { colors } = useTheme();

  return (
    <View style={s.wrap}>
      {/* Zeile: Guild-Name + Mitgliederzahl */}
      <View style={s.nameRow}>
        <Zap size={12} color={accent} fill={accent} />
        <Text style={[s.name, { color: accent }]} numberOfLines={1}>
          {guildName}
        </Text>

        {/* Mitgliederzahl — tippbar → öffnet Mitgliederliste */}
        {memberCount != null && memberCount > 0 && (
          <Pressable
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Light);
              onMembersPress?.();
            }}
            style={[s.memberChip, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${memberCount} Mitglieder anzeigen`}
          >
            <Users size={10} color={colors.icon.muted} strokeWidth={2} />
            <Text style={[s.memberCount, { color: colors.text.muted }]}>{memberCount}</Text>
          </Pressable>
        )}
      </View>

      {/* Feed / Leaderboard Toggle */}
      <GuildViewToggle mode={mode} onChange={onToggle} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    opacity: 0.7,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  memberCount: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
});


import { useTheme } from '@/lib/useTheme';
import { impactAsync,ImpactFeedbackStyle } from 'expo-haptics';
import { Trophy,UserPlus,Users,Zap } from 'lucide-react-native';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import type { GuildViewMode } from './guildConstants';

/**
 * Guild Header — eine Zeile, Zweck vor Verwaltung:
 *   ⚡ Name · Mitglieder-Chip   [+ Einladen] [🏆]
 *
 * - Einladen ist der primäre CTA solange die Guild klein ist (Wachstum >
 *   Features). Teilt den Referral-Link mit Guild-Kontext.
 * - Rangliste ist bewusst von der halben Toggle-Leiste auf ein Icon
 *   geschrumpft: mit wenigen Mitgliedern wirkt ein leeres Leaderboard
 *   demotivierend — bleibt erreichbar, wirbt aber nicht mehr um Aufmerksamkeit.
 */
export function GuildRoomHeader({
  guildName,
  guildColors,
  memberCount,
  mode,
  onToggle,
  onMembersPress,
  onInvitePress,
}: {
  guildName: string;
  memberCount?: number;
  guildColors: [string, string];
  mode: GuildViewMode;
  onToggle: (m: GuildViewMode) => void;
  onMembersPress?: () => void;
  onInvitePress?: () => void;
}) {
  const [accent] = guildColors;
  const { colors } = useTheme();
  const isLeaderboard = mode === 'leaderboard';

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        {/* Links: Identität — Name prominent + tappbare Mitgliederzahl */}
        <Zap size={15} color={accent} fill={accent} />
        <Text style={[s.name, { color: colors.text.primary }]} numberOfLines={1}>
          {guildName}
        </Text>
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
            <Users size={11} color={colors.icon.muted} strokeWidth={2} />
            <Text style={[s.memberCount, { color: colors.text.muted }]}>{memberCount}</Text>
          </Pressable>
        )}

        <View style={{ flex: 1 }} />

        {/* Rechts: Einladen (primär) + Rangliste (sekundär, Icon) */}
        {onInvitePress && (
          <Pressable
            onPress={() => {
              impactAsync(ImpactFeedbackStyle.Light);
              onInvitePress();
            }}
            style={[s.inviteBtn, { backgroundColor: colors.text.primary }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Freunde in den Clan einladen"
          >
            <UserPlus size={13} color={colors.bg.primary} strokeWidth={2.4} />
            <Text style={[s.inviteText, { color: colors.bg.primary }]}>Einladen</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            impactAsync(ImpactFeedbackStyle.Light);
            onToggle(isLeaderboard ? 'feed' : 'leaderboard');
          }}
          style={[
            s.iconBtn,
            { backgroundColor: colors.bg.elevated, borderColor: colors.border.default },
            isLeaderboard && s.iconBtnActive,
          ]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ selected: isLeaderboard }}
          accessibilityLabel={isLeaderboard ? 'Zurück zum Feed' : 'Rangliste anzeigen'}
        >
          <Trophy size={15} color={isLeaderboard ? '#FBBF24' : colors.icon.muted} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  memberCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  inviteText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBtnActive: {
    borderColor: 'rgba(251,191,36,0.45)',
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
});

import { View, Text, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { GuildViewToggle } from './GuildViewToggle';
import type { GuildViewMode } from './guildConstants';

/**
 * Minimal Guild Header — TikTok/Instagram-Style.
 * Kein Gradient, kein Blur, kein "Dein Room"-Label, kein Member-Count.
 * Nur: Guild-Name (klein, links) + View-Toggle (rechts).
 */
export function GuildRoomHeader({
  guildName,
  guildColors,
  mode,
  onToggle,
}: {
  guildName: string;
  memberCount?: number;   // nicht mehr verwendet, aber API bleibt kompatibel
  guildColors: [string, string];
  mode: GuildViewMode;
  onToggle: (m: GuildViewMode) => void;
}) {
  const [accent] = guildColors;

  return (
    <View style={s.wrap}>
      {/* Guild-Name: klein und dezent, kein dekoratives Element */}
      <View style={s.nameRow}>
        <Zap size={12} color={accent} fill={accent} />
        <Text style={[s.name, { color: accent }]} numberOfLines={1}>
          {guildName}
        </Text>
      </View>

      {/* Feed / Leaderboard Toggle — das einzig wirklich wichtige Element */}
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
});

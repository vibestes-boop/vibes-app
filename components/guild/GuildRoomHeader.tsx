import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Users } from 'lucide-react-native';
import { GuildViewToggle } from './GuildViewToggle';
import { guildStyles as styles } from './guildStyles';
import type { GuildViewMode } from './guildConstants';

export function GuildRoomHeader({
  guildName,
  memberCount,
  guildColors,
  mode,
  onToggle,
}: {
  guildName: string;
  memberCount?: number;
  guildColors: [string, string];
  mode: GuildViewMode;
  onToggle: (m: GuildViewMode) => void;
}) {
  const [c0, c1] = guildColors;

  return (
    <LinearGradient
      colors={[`${c0}CC`, `${c1}88`, 'transparent']}
      style={styles.guildHeader}
    >
      <BlurView intensity={30} tint="dark" style={styles.guildHeaderBlur}>
        <View style={styles.guildHeaderIcon}>
          <LinearGradient colors={guildColors} style={styles.guildIconGradient}>
            <Users size={22} color="#FFF" />
          </LinearGradient>
        </View>
        <View>
          <Text style={styles.guildHeaderLabel}>Dein Guild-Room</Text>
          <Text style={styles.guildHeaderName}>{guildName}</Text>
        </View>
        {memberCount !== undefined && (
          <View style={styles.memberCountBadge}>
            <Text style={styles.memberCountText}>{memberCount} Mitglieder</Text>
          </View>
        )}
      </BlurView>
      <GuildViewToggle mode={mode} onChange={onToggle} />
    </LinearGradient>
  );
}

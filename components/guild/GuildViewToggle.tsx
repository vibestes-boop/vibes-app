import { View, Text, TouchableOpacity } from 'react-native';
import { Rss, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getGuildStyles } from './guildStyles';
import type { GuildViewMode } from './guildConstants';
import { useTheme } from '@/lib/useTheme';

export function GuildViewToggle({
  mode,
  onChange,
}: {
  mode: GuildViewMode;
  onChange: (m: GuildViewMode) => void;
}) {
  const { colors } = useTheme();
  const styles = getGuildStyles(colors);

  return (
    <View style={styles.toggleWrap}>
      <TouchableOpacity
        style={[styles.toggleBtn, mode === 'feed' && styles.toggleBtnActive]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange('feed');
        }}
        activeOpacity={0.75}
      >
        <Rss size={18} color={mode === 'feed' ? colors.text.primary : colors.text.muted} strokeWidth={2.2} />
        <Text style={[styles.toggleText, mode === 'feed' && styles.toggleTextActive]}>Feed</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, mode === 'leaderboard' && styles.toggleBtnActiveGold]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange('leaderboard');
        }}
        activeOpacity={0.75}
      >
        <Trophy
          size={18}
          color={mode === 'leaderboard' ? '#FBBF24' : colors.text.muted}
          strokeWidth={2.2}
        />
        <Text style={[styles.toggleText, mode === 'leaderboard' && styles.toggleTextGold]}>Rangliste</Text>
      </TouchableOpacity>
    </View>
  );
}

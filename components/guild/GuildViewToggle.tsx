import { View, Text, TouchableOpacity } from 'react-native';
import { Rss, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { guildStyles as styles } from './guildStyles';
import type { GuildViewMode } from './guildConstants';

export function GuildViewToggle({
  mode,
  onChange,
}: {
  mode: GuildViewMode;
  onChange: (m: GuildViewMode) => void;
}) {
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
        <Rss size={18} color={mode === 'feed' ? '#FFFFFF' : 'rgba(255,255,255,0.65)'} strokeWidth={2.2} />
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
          color={mode === 'leaderboard' ? '#FBBF24' : 'rgba(255,255,255,0.65)'}
          strokeWidth={2.2}
        />
        <Text style={[styles.toggleText, mode === 'leaderboard' && styles.toggleTextGold]}>Rangliste</Text>
      </TouchableOpacity>
    </View>
  );
}

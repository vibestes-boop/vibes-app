import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ImageIcon } from 'lucide-react-native';
import { guildStyles as styles } from './guildStyles';

export function EmptyGuildState({ guildColors }: { guildColors: [string, string] }) {
  return (
    <View style={styles.emptyWrap}>
      <LinearGradient colors={guildColors} style={styles.emptyIcon}>
        <ImageIcon size={28} color="#FFF" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>Euer Pod ist noch ruhig.</Text>
      <Text style={styles.emptySubtitle}>
        Sei der Erste – poste etwas und wecke deinen Guild-Room auf.
      </Text>
    </View>
  );
}

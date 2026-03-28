import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Users } from 'lucide-react-native';
import { createStyles as styles } from './createStyles';

export function CreateGuildBanner({ guildName }: { guildName: string }) {
  return (
    <View style={styles.guildBanner}>
      <LinearGradient
        colors={['rgba(99,102,241,0.15)', 'rgba(139,92,246,0.08)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <View style={styles.guildBannerIcon}>
        <Users size={16} stroke="#A78BFA" strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.guildBannerTitle}>Wird deinem {guildName} zugänglich gemacht</Text>
        <Text style={styles.guildBannerSub}>… und der gesamten Vibes-Welt 🌍</Text>
      </View>
    </View>
  );
}

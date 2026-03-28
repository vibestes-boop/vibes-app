import { View } from 'react-native';
import { createStyles as styles } from './createStyles';

export function CreateProgressBar({ visible, progress }: { visible: boolean; progress: number }) {
  if (!visible) return null;
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${progress}%` }]} />
    </View>
  );
}

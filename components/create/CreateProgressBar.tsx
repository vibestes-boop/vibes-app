import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';

interface CreateProgressBarProps {
  visible: boolean;
  /** 0-100 normal progress. Negative value (-1, -2, -3) = retry attempt number. */
  progress: number;
  onCancel?: () => void;
}

export function CreateProgressBar({ visible, progress, onCancel }: CreateProgressBarProps) {
  const isRetrying = progress < 0;
  const retryAttempt = Math.abs(progress); // 1, 2 or 3

  // Animated width for the progress bar fill
  const fillWidth = useSharedValue(0);

  // Pulse opacity for retry state
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      fillWidth.value = withTiming(0, { duration: 200 });
      return;
    }
    if (isRetrying) {
      // During retry: pulse in place
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 400 }),
          withTiming(1,   { duration: 400 }),
        ),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 150 });
      fillWidth.value = withTiming(progress, { duration: 300 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, progress, isRetrying]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%` as `${number}%`,
    opacity: pulseOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.wrapper}>
      {/* Progress bar track */}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>

      {/* Status row: retry message + cancel button */}
      <View style={styles.statusRow}>
        {isRetrying ? (
          <Text style={styles.retryText}>
            Erneuter Versuch {retryAttempt}/3…
          </Text>
        ) : (
          <Text style={styles.progressText}>
            {progress < 100 ? `${Math.round(progress)}%` : 'Wird gespeichert…'}
          </Text>
        )}

        {onCancel && (
          <Pressable
            onPress={onCancel}
            style={styles.cancelBtn}
            accessibilityLabel="Upload abbrechen"
            accessibilityRole="button"
            hitSlop={8}
          >
            <X size={13} stroke="#9CA3AF" strokeWidth={2.5} />
            <Text style={styles.cancelText}>Abbrechen</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#000',
    paddingBottom: 4,
  },
  track: {
    height: 2,
    backgroundColor: 'rgba(34,211,238,0.15)',
    width: '100%',
  },
  fill: {
    height: 2,
    backgroundColor: '#22D3EE',
    borderRadius: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 2,
  },
  progressText: {
    color: 'rgba(34,211,238,0.7)',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  retryText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
});

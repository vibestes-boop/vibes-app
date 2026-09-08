import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import { radius, space, ui } from '../theme/tokens';
import { PressFeedback } from './PressFeedback';

type Props = {
  uri: string | null | undefined;
  style: StyleProp<ViewStyle>;
  contentFit?: 'cover' | 'contain';
  compact?: boolean;
  /** Fixed card preview: decode near its display size; galleries keep full sources. */
  thumbnail?: boolean;
  retry?: boolean;
  accessibilityLabel?: string;
  priority?: 'low' | 'normal' | 'high';
};

// Eine andere Bildquelle bekommt eigenen Ladezustand, auch in wiederverwendeten Listen.
export function ProductPhoto(props: Props) {
  return <Photo key={props.uri ?? 'empty'} {...props} />;
}

function Photo(props: Props) {
  const [attempt, setAttempt] = useState(0);
  // A retry owns its callbacks; a late error from the previous image cannot
  // replace a newer successful attempt.
  return <PhotoAttempt key={attempt} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}

function PhotoAttempt({ uri, style, contentFit = 'cover', compact = false, thumbnail = false, retry = false, accessibilityLabel,
  priority = 'normal', onRetry }: Props & { onRetry: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(uri ? 'loading' : 'failed');
  const [showLoading, setShowLoading] = useState(false);
  const { fontScale } = useWindowDimensions();
  useEffect(() => {
    if (!uri || status !== 'loading') return;
    // Cached images should not flash a spinner on every navigation.
    const timer = setTimeout(() => setShowLoading(true), 250);
    return () => clearTimeout(timer);
  }, [uri, status]);
  const failed = status === 'failed';
  const label = accessibilityLabel ?? 'Produktfoto';

  return (
    <View style={[styles.frame, style]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          priority={priority}
          // Avoid resizing the full bitmap on iOS's main thread after cache loading.
          enforceEarlyResizing={thumbnail}
          allowDownscaling
          transition={0}
          accessible={Boolean(accessibilityLabel) && status === 'ready'}
          accessibilityLabel={accessibilityLabel}
          onDisplay={() => setStatus(value => value === 'loading' ? 'ready' : value)}
          onError={() => setStatus('failed')}
        />
      ) : null}
      {!uri || failed ? (
        <View key={fontScale} style={styles.placeholder}>
          <Camera size={compact ? 18 : 26} strokeWidth={1.5} color={ui.textMuted} />
          {!compact ? <Text style={styles.hint}>{uri ? 'Foto gerade nicht erreichbar' : 'Kein Foto'}</Text> : null}
          {uri && failed && retry ? (
            <PressFeedback
              style={styles.retry}
              accessibilityRole="button"
              accessibilityLabel={`${label} erneut laden`}
              onPress={onRetry}
            >
              <Text style={styles.retryText}>Erneut laden</Text>
            </PressFeedback>
          ) : null}
        </View>
      ) : status === 'loading' && showLoading ? (
        <View key={fontScale} pointerEvents="none" style={styles.placeholder}
          accessible={Boolean(accessibilityLabel)} accessibilityRole="progressbar"
          accessibilityLabel={`${label} wird geladen`} accessibilityState={{ busy: true }}>
          {retry ? <ActivityIndicator color={ui.textMuted} /> : <Camera size={compact ? 18 : 26} strokeWidth={1.5} color={ui.textMuted} />}
          {retry && !compact ? <Text style={styles.hint}>Foto wird geladen …</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: ui.sunken, overflow: 'hidden' },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.sm },
  hint: { fontSize: 12, lineHeight: 17, color: ui.textMuted, textAlign: 'center' },
  retry: { minHeight: 48, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: ui.card, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '600', color: ui.brand, textAlign: 'center' },
});

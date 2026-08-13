// Das kleine Fenster unten rechts.
//
// Zeigt jetzt echtes Video statt eines Standbilds: die Verbindung hängt im
// Wurzel-Layout (siehe LiveStage), läuft also durch, während man daneben
// stöbert. Antippen holt die Show zurück, das Kreuz beendet sie.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useLivePlayer } from '../lib/livePlayer';
import { liveKitAvailable } from '../lib/livekit';
import { stage, radius, space } from '../theme/tokens';

type StageModule = {
  useStageReady: () => boolean;
  StageVideo: (props: { hostIdentity: string; style: ViewStyle }) => React.ReactNode;
};

// Bedingt geladen wie überall: in Expo Go gibt es die nativen Module nicht.
// `liveKitAvailable` ist eine Modul-Konstante, der Hook-Aufruf unten damit über
// die gesamte Laufzeit stabil.
const Stage = liveKitAvailable ? (require('./LiveStage') as StageModule) : null;
const useStageReady = Stage?.useStageReady ?? (() => false);
const StageVideo = Stage?.StageVideo ?? null;

/** Höhe der Reiterleiste, damit das Fenster nicht darauf sitzt. */
const TAB_BAR = 52;
const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

export function MiniLivePlayer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useLivePlayer((s) => s.session);
  const minimized = useLivePlayer((s) => s.minimized);
  const restore = useLivePlayer((s) => s.restore);
  const close = useLivePlayer((s) => s.close);
  const ready = useStageReady();

  if (!session || !minimized) return null;

  return (
    <View
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR + space.sm }]}
      pointerEvents="box-none"
    >
      <Pressable
        style={styles.card}
        onPress={() => {
          restore();
          router.push(`/live/${session.id}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${session.title ?? 'Show'} wieder groß anzeigen`}
      >
        {session.thumbnailUrl ? (
          <Image source={{ uri: session.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}

        {ready && StageVideo ? (
          <StageVideo hostIdentity={session.hostId} style={FILL} />
        ) : null}

        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>live</Text>
        </View>

        <Pressable
          onPress={close}
          hitSlop={10}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Show verlassen"
        >
          <X size={12} color={stage.text} />
        </Pressable>

        <View style={styles.caption}>
          <Text numberOfLines={1} style={styles.captionText}>
            {session.title ?? 'Live'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: space.md, alignItems: 'flex-end' },
  card: {
    width: 102,
    height: 136,
    borderRadius: radius.md,
    backgroundColor: stage.surfaceHigh,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: stage.lineStrong,
  },
  livePill: {
    position: 'absolute',
    top: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: stage.live,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: stage.liveInk },
  livePillText: { fontSize: 10, fontWeight: '700', color: stage.liveInk },
  close: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,21,18,0.82)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  captionText: { fontSize: 10, fontWeight: '600', color: stage.text },
});

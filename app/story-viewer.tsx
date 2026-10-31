import { StoryViewer } from '@/components/ui/StoryViewer';
import { useAuthStore } from '@/lib/authStore';
import { storyStillUri } from '@/lib/storyTransitions';
import type { StoryGroup } from '@/lib/useStories';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback,useEffect,useRef,useState, type ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';

// Animated.View über require: der Default-Import crasht in Hermes HBC (siehe
// StoryViewer). Hooks und with* bleiben statisch importiert.
/* eslint-disable @typescript-eslint/no-require-imports */
const _ra = require('react-native-reanimated') as any;
const AnimatedView = (_ra?.default ?? _ra)?.View ?? View;
/* eslint-enable @typescript-eslint/no-require-imports */

const { width: W } = Dimensions.get('window');
// Wechsel zum nächsten Highlight bzw. Nutzer: Das letzte Bild der alten Seite
// gleitet obenauf hinaus, die neue schiebt darunter ein Stück nach. Vorher sprang
// der Inhalt hart um. Bewusst ohne entering/exiting von Reanimated: Das lief im
// Simulator nur in manchen Durchläufen.
const PAGE_MS = 320;
const ENTER_OFFSET = 0.3;
const PAGE_EASING = Easing.out(Easing.cubic);

type Dir = 1 | -1;

/** Neue Seite: startet ein Stück versetzt (1 = von rechts) und rückt in die Mitte */
function PageEnter({ from, children }: { from: Dir | 0; children: ReactNode }) {
  const x = useSharedValue(from * W * ENTER_OFFSET);
  useEffect(() => {
    if (from !== 0) x.value = withTiming(0, { duration: PAGE_MS, easing: PAGE_EASING });
  }, [from, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <AnimatedView style={[StyleSheet.absoluteFill, style]}>{children}</AnimatedView>;
}

/** Alte Seite: ihr letztes Bild liegt obenauf und gleitet ganz hinaus */
function PageExit({ id, still, dir, onDone }: { id: number; still: string | null; dir: Dir; onDone: (id: number) => void }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(-dir * W, { duration: PAGE_MS, easing: PAGE_EASING }, (done) => {
      if (done) runOnJS(onDone)(id);
    });
  }, [dir, id, onDone, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFill, styles.exitPage, style]}>
      {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" /> : null}
    </AnimatedView>
  );
}

export default function StoryViewerScreen() {
  useThemedStatusBar('light');
  const { group, allGroups, close, setGroup } = useStoryViewerStore();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);
  const closingRef = useRef(false);

  // Laufender Wechsel. Als Ref, weil der Gruppenwechsel aus dem Store sofort
  // rendert: Die alte Seite muss schon in genau diesem Render obenauf liegen,
  // sonst blitzt die neue für einen Moment ohne Übergang auf.
  const exitRef = useRef<{ id: number; still: string | null; dir: Dir } | null>(null);
  const enterFromRef = useRef<Dir | 0>(0);
  const switchIdRef = useRef(0);
  const [, rerender] = useState(0);
  const endExit = useCallback((id: number) => {
    if (exitRef.current?.id !== id) return;
    exitRef.current = null;
    rerender((n) => n + 1);
  }, []);

  const goToGroup = useCallback((to: StoryGroup, dir: Dir, still: string | null) => {
    switchIdRef.current += 1;
    exitRef.current = { id: switchIdRef.current, still, dir };
    enterFromRef.current = dir;
    setGroup(to);
  }, [setGroup]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    close();
    // Stories-Cache für aktuellen User invalidieren → Ring-Status aktualisiert sich beim Rückkehr
    queryClient.invalidateQueries({ queryKey: ['guild-stories', userId] });
    // router.back() statt replace → bleibt dort wo man war (wie Short-Video), Scroll-Position bleibt erhalten
    router.back();
  }, [close, queryClient, userId]);

  // Falls group unerwartet null ist, zurück navigieren
  useEffect(() => {
    if (!group && !closingRef.current) {
      closingRef.current = true;
      router.back();
    }
  }, [group]);

  if (!group) return null;

  const idx = allGroups.findIndex((g) => g.userId === group.userId);
  const exit = exitRef.current;

  return (
    <View style={styles.root}>
      {/* Eigene Seite je Gruppe (key): frischer Viewer, Story-Index von vorn */}
      <PageEnter key={group.userId} from={enterFromRef.current}>
        <StoryViewer
          group={group}
          allGroups={allGroups}
          visible={true}
          onClose={handleClose}
          onNextGroup={() => {
            const next = allGroups[idx + 1];
            if (!next) { handleClose(); return; }
            // Weiter geht es nur von der letzten Story der Gruppe aus
            goToGroup(next, 1, storyStillUri(group.stories[group.stories.length - 1]));
          }}
          onPrevGroup={() => {
            const prev = allGroups[idx - 1];
            if (!prev) return;
            // Zurück geht es nur von der ersten Story der Gruppe aus
            goToGroup(prev, -1, storyStillUri(group.stories[0]));
          }}
        />
      </PageEnter>
      {exit && <PageExit key={exit.id} id={exit.id} still={exit.still} dir={exit.dir} onDone={endExit} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  exitPage: { backgroundColor: '#000' },
});

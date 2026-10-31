import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { UserProfileContent } from '@/components/profile/UserProfileContent';
import { panelShouldClose, panelShouldOpen } from '@/lib/swipeDecisions';

// Animated.View über require: der Default-Import crasht in Hermes HBC (siehe
// SlidingSelection). Hooks und with* bleiben statisch importiert.
/* eslint-disable @typescript-eslint/no-require-imports */
const _ra = require('react-native-reanimated') as any;
const AnimatedView = (_ra?.default ?? _ra)?.View ?? View;
/* eslint-enable @typescript-eslint/no-require-imports */

// Ohne Nachfedern, aber zügig (wie vorher bounciness 0)
const PANEL_SPRING = { damping: 32, stiffness: 320, mass: 1, overshootClamping: true };

/**
 * Profil des Autors, das beim Wischen nach links von rechts hereingleitet und
 * dem Finger folgt (TikTok). Nach rechts wischen schiebt es wieder hinaus.
 * Läuft komplett auf dem UI-Thread (Gesture Handler + Reanimated). Vorher
 * PanResponder: Jede Fingerbewegung ging über die App-Logik und hing nach,
 * sobald die nebenbei etwas tat (Video, Nachladen).
 *
 * `topBound`/`bottomBound`: Wischen, das außerhalb dieser Höhe beginnt, zählt
 * nicht (Kopfzeile, Fortschrittsbalken, Tab-Leiste).
 */
export function useProfileSwipePanel({ width, authorId, enabled = true, topBound = 0, bottomBound = Number.MAX_SAFE_INTEGER }: {
  width: number;
  authorId: string | null | undefined;
  enabled?: boolean;
  topBound?: number;
  bottomBound?: number;
}) {
  const [panel, setPanel] = useState<{ authorId: string } | null>(null);
  // Für Stellen, die ohne neues Rendern wissen müssen, ob das Panel offen ist
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const slideX = useSharedValue(width);
  // 1 = offen oder im Aufziehen (auf dem UI-Thread lesbar)
  const openSV = useSharedValue(0);
  const authorSV = useSharedValue(authorId ?? '');
  const widthSV = useSharedValue(width);
  const topSV = useSharedValue(topBound);
  const bottomSV = useSharedValue(bottomBound);
  useEffect(() => { authorSV.value = authorId ?? ''; }, [authorId, authorSV]);
  useEffect(() => {
    widthSV.value = width;
    if (!panelRef.current) slideX.value = width;
  }, [width, widthSV, slideX]);
  useEffect(() => { topSV.value = topBound; bottomSV.value = bottomBound; }, [topBound, bottomBound, topSV, bottomSV]);

  const mount = useCallback((id: string) => setPanel({ authorId: id }), []);
  const unmount = useCallback(() => setPanel(null), []);
  const tickOpen = useCallback(() => { impactAsync(ImpactFeedbackStyle.Medium); }, []);
  const tickClose = useCallback(() => { impactAsync(ImpactFeedbackStyle.Light); }, []);

  const close = useCallback(() => {
    openSV.value = 0;
    slideX.value = withSpring(widthSV.value, PANEL_SPRING, (done) => {
      if (done) runOnJS(unmount)();
    });
  }, [openSV, slideX, widthSV, unmount]);

  const openGesture = useMemo(() => Gesture.Pan()
    .enabled(enabled)
    // Nur nach links; senkrechtes Wischen (Feed, nächster Beitrag) gewinnt
    .activeOffsetX(-18)
    .failOffsetY([-16, 16])
    .onTouchesDown((e, manager) => {
      const y = e.allTouches[0]?.absoluteY ?? 0;
      if (openSV.value === 1 || !authorSV.value || y < topSV.value || y > bottomSV.value) manager.fail();
    })
    .onStart(() => {
      openSV.value = 1;
      slideX.value = widthSV.value;
      runOnJS(mount)(authorSV.value);
    })
    .onUpdate((e) => {
      slideX.value = Math.max(0, widthSV.value + e.translationX);
    })
    .onEnd((e) => {
      // Entschieden wird nach der tatsächlichen Lage des Panels: Manche Eingaben
      // melden am Ende eine Verschiebung von 0, obwohl der Finger weit gewandert ist.
      if (panelShouldOpen(slideX.value - widthSV.value, e.velocityX, widthSV.value)) {
        slideX.value = withSpring(0, PANEL_SPRING);
        runOnJS(tickOpen)();
      } else {
        openSV.value = 0;
        slideX.value = withSpring(widthSV.value, PANEL_SPRING, (done) => {
          if (done) runOnJS(unmount)();
        });
      }
    }), [enabled, openSV, authorSV, topSV, bottomSV, slideX, widthSV, mount, unmount, tickOpen]);

  const closeGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX(15)
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      slideX.value = Math.min(widthSV.value, Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (panelShouldClose(slideX.value, e.velocityX, widthSV.value)) {
        openSV.value = 0;
        runOnJS(tickClose)();
        slideX.value = withSpring(widthSV.value, PANEL_SPRING, (done) => {
          if (done) runOnJS(unmount)();
        });
      } else {
        slideX.value = withSpring(0, PANEL_SPRING);
      }
    }), [openSV, slideX, widthSV, unmount, tickClose]);

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));

  return { panel, panelRef, openGesture, closeGesture, panelStyle, close };
}

export type ProfileSwipePanelControl = ReturnType<typeof useProfileSwipePanel>;

/** Das Panel selbst; als letztes Kind über den Bildschirm legen. */
export function ProfileSwipePanel({ control }: { control: ProfileSwipePanelControl }) {
  if (!control.panel) return null;
  return (
    <GestureDetector gesture={control.closeGesture}>
      <AnimatedView style={[StyleSheet.absoluteFill, { zIndex: 400 }, control.panelStyle]}>
        {/* Schatten-Linie links (Tiefeneffekt) */}
        <View style={styles.edgeShadow} />
        <UserProfileContent userId={control.panel.authorId} onBack={control.close} />
      </AnimatedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  edgeShadow: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
});

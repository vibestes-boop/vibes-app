/**
 * components/live/PiPWindow.tsx
 *
 * Picture-in-Picture Fenster für den Duet-Modus.
 * - Kleines Video-Fenster (Gast) liegt über dem Hauptstream
 * - Ziehbar mit Gesture Handler + Reanimated: folgt dem Finger auf dem UI-Thread.
 *   (Vorher PanResponder mit JS-Treiber: hing nach, solange Chat und Geschenke liefen.)
 * - Tap → Swap (Haupt- und PiP-Video tauschen Plätze)
 * - "GAST" / "HOST" Label-Badge
 *
 * Nutzung (im Host-Screen):
 *   <PiPWindow track={coHostTrackRef} label="GAST" onSwap={handleSwap} />
 *
 * Nutzung (im Watch-Screen, eigene Kamera):
 *   <PiPWindow localView={LocalCoHostCameraView} label="DU" onSwap={handleSwap} />
 */
import { VideoTrack } from '@livekit/react-native';
import type { Participant,TrackPublication } from 'livekit-client';
import { Track } from 'livekit-client';
import { ArrowLeftRight } from 'lucide-react-native';
import React,{ useMemo } from 'react';
import {
Dimensions,
Pressable,
StyleSheet,
Text,
View,
} from 'react-native';
import { Gesture,GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedStyle,useSharedValue,withSpring } from 'react-native-reanimated';

// Animated.View über require: der Default-Import crasht in Hermes HBC (siehe
// SlidingSelection). Hooks und with* bleiben statisch importiert.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _ra = require('react-native-reanimated') as any;
const AnimatedView = (_ra?.default ?? _ra)?.View ?? View;

const { width: W, height: H } = Dimensions.get('window');

// Fenstergröße: 9:16 Portrait-Ratio, ~22% Bildschirmbreite
const PIP_W = Math.round(W * 0.285);
const PIP_H = Math.round(PIP_W * (16 / 9));

// Startposition: unten rechts, mit 16px Padding zu Rand und 80px über der Action-Bar
const DEFAULT_X = W - PIP_W - 16;
const DEFAULT_Y = H - PIP_H - 96;
// Nach dem Loslassen weich an einen gültigen Platz (vorher friction 6 / tension 40)
const PIP_SPRING = { damping: 18, stiffness: 160, mass: 1 };

export interface PiPTrackRef {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
}

interface PiPWindowProps {
  /** Remote Video-Track (Co-Host oder Host) */
  trackRef?: PiPTrackRef | null;
  /** Optionale lokale Kamera-Komponente (statt remote track) */
  LocalView?: React.ComponentType;
  /** Badge-Label z.B. "GAST" oder "DU" */
  label: string;
  /** Callback wenn Tap → Swap gedrückt */
  onSwap?: () => void;
  /** Mirror-Effekt (für eigene Kamera) */
  mirror?: boolean;
}

export function PiPWindow({
  trackRef,
  LocalView,
  label,
  onSwap,
  mirror = false,
}: PiPWindowProps) {
  // Position auf dem UI-Thread; beim Ziehen vom Startpunkt aus verschoben
  const x = useSharedValue(DEFAULT_X);
  const y = useSharedValue(DEFAULT_Y);
  const startX = useSharedValue(DEFAULT_X);
  const startY = useSharedValue(DEFAULT_Y);

  const drag = useMemo(() => Gesture.Pan()
    // Erst ab ein paar Punkten Bewegung: ein Tipp bleibt ein Tipp (Tauschen-Knopf)
    .minDistance(4)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      x.value = withSpring(Math.max(0, Math.min(W - PIP_W, x.value)), PIP_SPRING);
      y.value = withSpring(Math.max(0, Math.min(H - PIP_H - 80, y.value)), PIP_SPRING);
    }), [x, y, startX, startY]);

  const positionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <GestureDetector gesture={drag}>
    <AnimatedView style={[s.pip, positionStyle]}>
      {/* Video-Inhalt */}
      <View style={s.videoContainer}>
        {trackRef ? (
          <VideoTrack
            trackRef={trackRef as any}
            style={StyleSheet.absoluteFill as any}
            objectFit="cover"
          />
        ) : LocalView ? (
          <View style={StyleSheet.absoluteFill}>
            <LocalView />
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, s.placeholder]} />
        )}
      </View>

      {/* Label-Badge */}
      <View style={s.labelBadge}>
        <Text style={s.labelText}>{label}</Text>
      </View>

      {/* Swap-Button (unten rechts im Fenster) */}
      {onSwap && (
        <Pressable
          style={s.swapBtn}
          onPress={onSwap}
          hitSlop={8}
          accessibilityLabel="Kameras tauschen"
        >
          <ArrowLeftRight size={12} color="#fff" strokeWidth={2.5} />
        </Pressable>
      )}

      {/* Rahmen (leichte Andeutung dass es ein separates Fenster ist) */}
      <View style={s.border} pointerEvents="none" />
    </AnimatedView>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  pip: {
    position: 'absolute',
    width: PIP_W,
    height: PIP_H,
    borderRadius: 12,
    overflow: 'hidden',
    // Schatten (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    // Elevation (Android)
    elevation: 12,
    zIndex: 99,
  },

  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d1a',
    borderRadius: 12,
    overflow: 'hidden',
  },

  placeholder: {
    backgroundColor: '#0d0d1a',
  },

  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  labelBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  labelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },

  swapBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 5,
    padding: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

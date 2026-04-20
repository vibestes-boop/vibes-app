/**
 * components/live/PiPWindow.tsx
 *
 * Picture-in-Picture Fenster für den Duet-Modus.
 * - Kleines Video-Fenster (Gast) liegt über dem Hauptstream
 * - Draggable via PanResponder (kein Reanimated — stabiler in React Native)
 * - Tap → Swap (Haupt- und PiP-Video tauschen Plätze)
 * - "GAST" / "HOST" Label-Badge
 *
 * Nutzung (im Host-Screen):
 *   <PiPWindow track={coHostTrackRef} label="GAST" onSwap={handleSwap} />
 *
 * Nutzung (im Watch-Screen, eigene Kamera):
 *   <PiPWindow localView={LocalCoHostCameraView} label="DU" onSwap={handleSwap} />
 */
import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  Pressable,
} from 'react-native';
import { VideoTrack } from '@livekit/react-native';
import type { TrackPublication, Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import { ArrowLeftRight } from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

// Fenstergröße: 9:16 Portrait-Ratio, ~22% Bildschirmbreite
const PIP_W = Math.round(W * 0.285);
const PIP_H = Math.round(PIP_W * (16 / 9));

// Startposition: unten rechts, mit 16px Padding zu Rand und 80px über der Action-Bar
const DEFAULT_X = W - PIP_W - 16;
const DEFAULT_Y = H - PIP_H - 96;

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
  // Aktuelle Position als Animated.ValueXY
  const pan = useRef(new Animated.ValueXY({ x: DEFAULT_X, y: DEFAULT_Y })).current;
  // Letzte gültige Position für Bounds-Clamp nach dem Drag
  const lastPos = useRef({ x: DEFAULT_X, y: DEFAULT_Y });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        // Offset vom letzten Stopp setzen
        pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),

      onPanResponderRelease: (_) => {
        pan.flattenOffset();

        // Nach flattenOffset() enthält pan._value bereits die absolute Position (Bug 4 Fix)
        // lastPos.current.x + gestureState.dx würde den Offset doppelt zählen
        const rawX = (pan.x as any)._value as number;
        const rawY = (pan.y as any)._value as number;
        const clampedX = Math.max(0, Math.min(W - PIP_W, rawX));
        const clampedY = Math.max(0, Math.min(H - PIP_H - 80, rawY));

        Animated.spring(pan, {
          toValue: { x: clampedX, y: clampedY },
          useNativeDriver: false,
          friction: 6,
          tension: 40,
        }).start();

        lastPos.current = { x: clampedX, y: clampedY };
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        s.pip,
        { transform: pan.getTranslateTransform() },
      ]}
      {...panResponder.panHandlers}
    >
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
    </Animated.View>
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

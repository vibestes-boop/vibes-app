import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

// Reanimated via require (Hermes HBC Kompatibilität)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
// Reanimated-Hooks sind Top-Level-Named-Exports, NICHT auf .default (= _animNS).
// Im echten Build (Metro bundlet src/index als ESM) liegen sie auf _animMod;
// aus _animNS destrukturiert wären sie undefined → "undefined is not a function".
const _animHooks = _animMod && _animMod.useSharedValue ? _animMod : _animNS;
const { useSharedValue, useAnimatedStyle, runOnJS } = _animHooks ?? _animMod;

import { SW } from './sharedStyles';

const STRIP_PADDING = 20;
const STRIP_W = SW - STRIP_PADDING * 2;
const HANDLE_W = 22;
const FRAME_COUNT = 8;
const FRAME_W = (STRIP_W - HANDLE_W * 2) / FRAME_COUNT;

export type TrimResult = { startMs: number; endMs: number; speedFactor: number };

function TrimHandle({
  side, position, onDrag, onEnd,
}: { side: 'left' | 'right'; position: any; onDrag: (x: number) => void; onEnd: () => void }) {
  const gesture = Gesture.Pan().minDistance(0)
    .onUpdate((e: any) => { runOnJS(onDrag)(e.absoluteX - STRIP_PADDING); })
    .onEnd(() => { runOnJS(onEnd)(); });
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value }] }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[th.wrap, animStyle]}>
        <View style={th.bar}>
          <View style={th.grip} /><View style={th.grip} /><View style={th.grip} />
        </View>
        <Text style={[th.arrow, side === 'left' ? th.arrowL : th.arrowR]}>{side === 'left' ? '‹' : '›'}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const th = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, width: HANDLE_W, height: 56, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  bar: { width: HANDLE_W, height: '100%', borderRadius: 4, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 3 },
  grip: { width: 2, height: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 1 },
  arrow: { position: 'absolute', color: '#fff', fontSize: 18, fontWeight: '800', top: -22 },
  arrowL: { left: 3 },
  arrowR: { right: 3 },
});

export function VideoTrimSheet({
  visible, uri, onDone, onCancel,
}: { visible: boolean; uri: string; onDone: (r: TrimResult) => void; onCancel: () => void; }) {
  const [frames, setFrames] = useState<string[]>([]);
  const [framesLoading, setFramesLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [speedFactor, setSpeedFactor] = useState<0.5|1|1.5|2>(1);
  const [, setIsPlaying] = useState(true);
  const leftPos = useSharedValue(0);
  const rightPos = useSharedValue(STRIP_W - HANDLE_W);

  const player = useVideoPlayer(uri ?? '', (p: any) => { p.loop = true; p.play(); });

  useEffect(() => {
    if (!visible) return;
    setStartSec(0); setEndSec(0); setSpeedFactor(1); setIsPlaying(true);
    leftPos.value = 0; rightPos.value = STRIP_W - HANDLE_W;
    setFramesLoading(true);
    (async () => {
      try {
        const d = player.duration > 0 ? player.duration : 15;
        const thumbs = await Promise.all(
          Array.from({ length: FRAME_COUNT }).map((_, i) => {
            const timeMs = Math.floor((i / (FRAME_COUNT - 1)) * d * 1000);
            return getThumbnailAsync(uri, { time: timeMs, quality: 0.3 });
          })
        );
        setFrames(thumbs.map(t => t.uri));
        setDuration(d); setEndSec(d);
      } catch { /* ignore */ } finally { setFramesLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri]);

  const pxToSec = useCallback((px: number) => (px / STRIP_W) * (duration || 15), [duration]);

  const handleLeftDrag = useCallback((x: number) => {
    const c = Math.max(0, Math.min(x, rightPos.value - HANDLE_W * 2));
    leftPos.value = c; setStartSec(pxToSec(c));
    try { player.currentTime = pxToSec(c); } catch { /* ignore */ }
  }, [leftPos, rightPos, pxToSec, player]);

  const handleRightDrag = useCallback((x: number) => {
    const c = Math.max(leftPos.value + HANDLE_W * 2, Math.min(x, STRIP_W - HANDLE_W));
    rightPos.value = c; setEndSec(pxToSec(c));
  }, [rightPos, leftPos, pxToSec]);

  const highlightStyle = useAnimatedStyle(() => ({
    left: leftPos.value + HANDLE_W, right: STRIP_W - rightPos.value,
  }));
  const maskLeftStyle = useAnimatedStyle(() => ({ width: leftPos.value + HANDLE_W }));
  const maskRightStyle = useAnimatedStyle(() => ({ left: rightPos.value }));

  const fmt = (s: number) => `${Math.floor(s)}:${String(Math.round((s % 1) * 10)).padStart(1, '0')}s`;
  const trimDur = Math.max(0, endSec - startSec);

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={tv.overlay} />
        </TouchableWithoutFeedback>
        <View style={tv.sheet}>
          <View style={tv.handle} />
          <Text style={tv.title}>Video kürzen</Text>

          <View style={tv.durRow}>
            <View style={tv.badge}><Text style={tv.badgeText}>{fmt(startSec)} – {fmt(endSec)}</Text></View>
            <View style={tv.badgeSel}><Text style={tv.badgeSelText}>{trimDur.toFixed(1)}s</Text></View>
          </View>

          <View style={tv.stripOuter}>
            <View style={tv.stripContainer}>
              <View style={{ flexDirection: 'row', height: 56 }}>
                {framesLoading
                  ? Array.from({ length: FRAME_COUNT }).map((_, i) => <View key={i} style={[{ width: FRAME_W, height: 56 }, tv.frameSkel]} />)
                  : frames.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: FRAME_W, height: 56 }} contentFit="cover" />)
                }
              </View>
              <Animated.View style={[tv.highlight, highlightStyle]} />
              <Animated.View style={[tv.mask, { left: 0 }, maskLeftStyle]} />
              <Animated.View style={[tv.mask, { right: 0, left: undefined }, maskRightStyle]} />
            </View>
            <TrimHandle side="left" position={leftPos} onDrag={(absX) => handleLeftDrag(absX - STRIP_PADDING)} onEnd={() => {}} />
            <TrimHandle side="right" position={rightPos} onDrag={(absX) => handleRightDrag(absX - STRIP_PADDING)} onEnd={() => {}} />
          </View>

          <View style={tv.speedRow}>
            {([0.5, 1, 1.5, 2] as const).map(sp => (
              <Pressable key={sp} onPress={() => { setSpeedFactor(sp); try { player.playbackRate = sp; } catch { /* ignore */ } }}
                style={[tv.speedBtn, speedFactor === sp && tv.speedBtnActive]}>
                <Text style={[tv.speedText, speedFactor === sp && tv.speedTextActive]}>{sp}x</Text>
              </Pressable>
            ))}
          </View>

          <Text style={tv.hint}>Ziehe die weißen Griffe um den Ausschnitt zu wählen</Text>

          <Pressable
            style={tv.doneBtn}
            onPress={() => onDone({ startMs: Math.round(startSec * 1000), endMs: Math.round(endSec * 1000), speedFactor })}
          >
            <Text style={tv.doneBtnText}>Übernehmen</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const tv = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#0c0c16', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 0, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 16 },
  durRow: { flexDirection: 'row', gap: 10, paddingHorizontal: STRIP_PADDING, marginBottom: 14 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  badgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  badgeSel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  badgeSelText: { color: '#fff', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stripOuter: { marginHorizontal: STRIP_PADDING, height: 56, position: 'relative', marginBottom: 16 },
  stripContainer: { height: 56, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  frameSkel: { backgroundColor: 'rgba(255,255,255,0.06)' },
  highlight: { position: 'absolute', top: 0, height: '100%', borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#fff', zIndex: 5 },
  mask: { position: 'absolute', top: 0, height: '100%', backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 4 },
  speedRow: { flexDirection: 'row', gap: 6, marginHorizontal: STRIP_PADDING, marginBottom: 12 },
  speedBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  speedBtnActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  speedText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '700' },
  speedTextActive: { color: '#fff' },
  hint: { color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  doneBtn: { marginHorizontal: STRIP_PADDING, backgroundColor: '#fff', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  doneBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});

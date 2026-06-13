import { CheckCircle } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
// Hooks/Helper als STATISCHE Named-Imports — damit das Reanimated-Babel-Plugin
// die Worklets korrekt transformiert (bewährtes Muster wie in camera.tsx & 20+
// anderen Dateien). require()-only brach die Worklet-Verarbeitung → UI-Thread-
// Crash "undefined is not a function" in withDelay/withSequence.onStart.
// WICHTIG: Easing AUS REANIMATED (worklet-kompatibel), NICHT aus 'react-native'
// — RN's Easing läuft auf dem JS-Thread und ist im UI-Worklet undefined →
// crasht in withTiming(step/onStart). Das war die eigentliche Crash-Ursache.
import {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// require() NUR für den Animated.View-Namespace (Default-Export) — verhindert
// den dokumentierten Hermes-HBC-Crash beim Default-Import.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

const CONFETTI_COLORS = ['#FFFFFF','#A855F7','#F472B6','#FB923C','#34D399','#FBBF24','#60A5FA','#F87171'];

function ConfettiDot({ color, angle, delay }: { color: string; angle: number; delay: number }) {
  const tx = useSharedValue(0), ty = useSharedValue(0);
  const opacity = useSharedValue(0), scale = useSharedValue(0);
  useEffect(() => {
    const dist = 90 + Math.random() * 60, rad = (angle * Math.PI) / 180;
    tx.value = withDelay(delay, withTiming(Math.cos(rad) * dist, { duration: 900, easing: Easing.out(Easing.cubic) }));
    ty.value = withDelay(delay, withTiming(Math.sin(rad) * dist, { duration: 900, easing: Easing.out(Easing.cubic) }));
    opacity.value = withDelay(delay, withSequence(withTiming(1,{duration:0}), withDelay(500, withTiming(0,{duration:400}))));
    scale.value = withDelay(delay, withSequence(withSpring(1.2,{damping:8,stiffness:300}), withTiming(0.6,{duration:400})));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ transform:[{translateX:tx.value},{translateY:ty.value},{scale:scale.value}], opacity:opacity.value }));
  return <Animated.View style={[{position:'absolute',width:10,height:10,borderRadius:5,backgroundColor:color},style]} />;
}

export function PostSuccessOverlay({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const checkScale = useSharedValue(0), textOpacity = useSharedValue(0), bgOpacity = useSharedValue(0);
  useEffect(() => {
    if (!visible) { checkScale.value = 0; textOpacity.value = 0; bgOpacity.value = 0; return; }
    bgOpacity.value = withTiming(1, { duration: 200 });
    checkScale.value = withDelay(100, withSpring(1, { damping: 10, stiffness: 200 }));
    textOpacity.value = withDelay(350, withTiming(1, { duration: 300 }));
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  if (!visible) return null;
  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[suc.bg, bgStyle]}>
        <View style={suc.confetti} pointerEvents="none">
          {CONFETTI_COLORS.map((c, i) => <ConfettiDot key={i} color={c} angle={(i/CONFETTI_COLORS.length)*360} delay={i*40} />)}
        </View>
        <Animated.View style={checkStyle}>
          <CheckCircle size={88} color="#FFFFFF" strokeWidth={1.5} fill="rgba(255,255,255,0.10)" />
        </Animated.View>
        <Animated.View style={textStyle}>
          <Text style={suc.title}>Vibe ist live! 🎉</Text>
          <Text style={suc.sub}>Dein Post ist jetzt im Feed sichtbar</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const suc = StyleSheet.create({
  bg: { flex:1, backgroundColor:'rgba(0,0,0,0.92)', alignItems:'center', justifyContent:'center', gap:20 },
  confetti: { position:'absolute', alignItems:'center', justifyContent:'center' },
  title: { color:'#fff', fontSize:26, fontWeight:'900', letterSpacing:-0.5, textAlign:'center' },
  sub: { color:'rgba(255,255,255,0.5)', fontSize:15, textAlign:'center', marginTop:-8 },
});

/**
 * SerloLoader — markeneigener Lade-Indikator: ein blauer Lichtstrahl gleitet
 * sanft hin und her. Der Schweif streckt sich lang in der Mitte und zieht sich
 * am Wendepunkt kurz zusammen, ein funkelnder Glüh-Kopf führt; beim Umkehren
 * dreht der Kopf mit (Flip am kontrahierten Wendepunkt → unsichtbar).
 *
 * Procedural (kein Asset, OTA-fähig): react-native-svg für Kopf/Strahlen +
 * expo-linear-gradient für den Schweif, Reanimated für die Bewegung.
 *
 * Reanimated-Imports statisch (Memory vibes-reanimated-static-import) — sonst
 * UI-Thread-Worklet-Crash im Build. Animated-Namespace via require.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, G, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
Easing,
useAnimatedStyle,
useSharedValue,
withDelay,
withRepeat,
withSequence,
withTiming,
} from 'react-native-reanimated';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

const BLUE       = '#3B9EFF';
const BLUE_SOFT  = 'rgba(59,158,255,0)';
const BLUE_DIM   = 'rgba(59,158,255,0.55)';
const HEAD_WHITE = '#EAF6FF';

const P = 2400;        // ms pro Hin-und-Zurück
const A = 46;          // Reiseweite (px ab Mitte)
const W = 150;         // Schweif-Grundlänge (px) — lang + sichtbar
const H = 2.5;         // Schweif-Höhe
const HEAD_W = 96;     // Kopf-SVG-Breite (lange horizontale Strahlen)
const HEAD_H = 44;     // Kopf-SVG-Höhe
const EASE = Easing.inOut(Easing.ease);

export function SerloLoader() {
  const tx   = useSharedValue(-A);     // Kopf-Position
  const mag  = useSharedValue(0.05);   // Schweif-Streckung (0.05 = kurz, 1 = lang)
  const flip = useSharedValue(1);      // Laufrichtung (+1 rechts, -1 links)

  useEffect(() => {
    tx.value = withRepeat(
      withSequence(
        withTiming(A,  { duration: P / 2, easing: EASE }),
        withTiming(-A, { duration: P / 2, easing: EASE }),
      ), -1, false,
    );
    // Streckung: lang in der Mitte (P/4, 3P/4), kurz an den Wendepunkten
    mag.value = withRepeat(
      withSequence(
        withTiming(1,    { duration: P / 4, easing: EASE }),
        withTiming(0.05, { duration: P / 4, easing: EASE }),
      ), -1, false,
    );
    // Richtungs-Flip: hält je P/2, kippt dann am (kontrahierten) Wendepunkt
    flip.value = withRepeat(
      withSequence(
        withDelay(P / 2, withTiming(-1, { duration: 1, easing: Easing.linear })),
        withDelay(P / 2, withTiming(1,  { duration: 1, easing: Easing.linear })),
      ), -1, false,
    );
  }, [tx, mag, flip]);

  // Beam-Container: Position + Richtungs-Flip
  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { scaleX: flip.value }],
  }));
  // Schweif: rechte Kante (Kopfseite, lokal 0) bleibt fix, Streckung nach links
  const trailStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (W / 2) * (1 - mag.value) }, { scaleX: mag.value }],
  }));

  return (
    <View style={s.root} pointerEvents="none">
      <Animated.View style={[s.anchor, beamStyle]}>
        {/* Schweif (zwei Lagen: scharf + weiter/fainter = Glow-Halo) */}
        <Animated.View style={[s.trailWrap, trailStyle]}>
          <LinearGradient
            colors={[BLUE_SOFT, BLUE_DIM, BLUE, HEAD_WHITE]}
            locations={[0, 0.3, 0.72, 1]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={s.trailGlow}
          />
          <LinearGradient
            colors={[BLUE_SOFT, BLUE_DIM, BLUE, HEAD_WHITE]}
            locations={[0, 0.3, 0.72, 1]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={s.trailSharp}
          />
        </Animated.View>

        {/* Glüh-Kopf + Stern-Strahlen (symmetrisch → Flip unsichtbar) */}
        <View style={s.head}>
          <Svg width={HEAD_W} height={HEAD_H} viewBox="0 0 96 44">
            <Defs>
              <Filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
                <FeGaussianBlur stdDeviation="2.4" />
              </Filter>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0"    stopColor="#CFE8FF" stopOpacity={1} />
                <Stop offset="0.35" stopColor={BLUE}    stopOpacity={0.55} />
                <Stop offset="1"    stopColor={BLUE}    stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* Weicher Halo */}
            <Circle cx="48" cy="22" r="21" fill="url(#halo)" />
            {/* Weich geblurrte Strahlen (Gauss-Blur → echtes weiches Licht) */}
            <G filter="url(#soft)">
              <Rect x="4"  y="21"   width="88" height="2"   fill="#DCEEFF" opacity={0.9} />
              <Rect x="47" y="8"    width="2"  height="28"  fill="#DCEEFF" opacity={0.85} />
              <Rect x="36" y="21.2" width="24" height="1.6" fill="#CFE8FF" opacity={0.6} transform="rotate(45 48 22)" />
              <Rect x="36" y="21.2" width="24" height="1.6" fill="#CFE8FF" opacity={0.6} transform="rotate(-45 48 22)" />
            </G>
            {/* Weicher Kern-Glow + scharfer Kern */}
            <Circle cx="48" cy="22" r="6"   fill="#fff" opacity={0.3} />
            <Circle cx="48" cy="22" r="2.4" fill="#fff" />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}

const TRAIL_TOP = -H / 2;
const s = StyleSheet.create({
  root: {
    width: A * 2 + W + HEAD_W,
    height: HEAD_H + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 0-Punkt in der Mitte — Kinder positionieren relativ dazu
  anchor: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
  // Schweif-Box: rechte Kante am Anker (right: 0), erstreckt sich nach links
  trailWrap: { position: 'absolute', right: 0, top: TRAIL_TOP, width: W, height: H, justifyContent: 'center' },
  trailSharp: {
    position: 'absolute', right: 0, left: 0, top: 0, height: H, borderRadius: H,
    shadowColor: BLUE, shadowOpacity: 0.85, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
  },
  trailGlow:  {
    position: 'absolute', right: 0, left: 0, top: -3, height: H + 6, borderRadius: (H + 6) / 2,
    opacity: 0.55,
  },
  // Kopf zentriert auf dem Anker
  head: { position: 'absolute', right: -HEAD_W / 2, top: -HEAD_H / 2, width: HEAD_W, height: HEAD_H },
});

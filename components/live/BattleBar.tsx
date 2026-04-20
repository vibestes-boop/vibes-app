/**
 * components/live/BattleBar.tsx
 *
 * TikTok-Style Battle-Score-Bar — liegt FLUSH an der TOP-Kante der Videos.
 *
 * Layout (v1.22.2):
 *   ┌───────────────────────────────────────────────┐
 *   │ 🔴 23     ╲╲▶                    10 🔵      │   ← Gradient Pink→Cyan
 *   │ [████████████████████░░░░░░░░░░░░░░░░░░░░░]  │   ← slim progress underline
 *   └───────────────────────────────────────────────┘
 *          ↑ Videos starten direkt DARUNTER
 *
 * Enthält:
 *   - Split-Gradient (Host-Pink ←→ Guest-Cyan), Breite reflektiert Score-Ratio
 *   - Bewegliches Indikator-Badge in der Mitte am Gradient-Boundary
 *   - Scores auf beiden Enden, groß & bold
 *   - Countdown-Pill oben (schwebt über der Bar)
 *   - Winner-Overlay wenn Battle ended (ScaleIn + Konfetti)
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BattleState } from '@/lib/useBattle';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Höhe der kompakten Top-Bar (Score-Zeile + dünne Progress-Line darunter)
const BAR_H           = 44;
const UNDERLINE_H     = 4;

// TikTok-Palette
const HOST_COLOR      = '#FF2D6D'; // saturated pink
const HOST_COLOR_SOFT = '#FF5D95';
const GUEST_COLOR     = '#00D4FF'; // cyan
const GUEST_COLOR_SOFT= '#5BE3FF';

interface BattleBarProps {
  state: BattleState;
  /** Y-Position in px. Default: 13% Screen-Höhe = Top-Kante der Video-Splits. */
  top?: number;
}

function fmtScore(n: number): string {
  if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 10_000)  return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

export function BattleBar({ state, top }: BattleBarProps) {
  // Animated.Value für smooth Score-Übergänge (0..1)
  const animFraction = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.spring(animFraction, {
      toValue:         state.hostFraction,
      useNativeDriver: false, // width muss interpolation → no native driver
      friction:        5,
      tension:         48,
    }).start();
  }, [state.hostFraction, animFraction]);

  // Host-Anteil als Pixel-Breite (für farbiges Segment + Indikator-Position)
  const hostBarW = animFraction.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, SCREEN_W],
    extrapolate: 'clamp',
  });
  // Indikator-Badge folgt dem Boundary (= hostBarW)
  const indicatorLeft = animFraction.interpolate({
    inputRange:  [0, 1],
    outputRange: [16, SCREEN_W - 40],
    extrapolate: 'clamp',
  });

  // TikTok-Style: BattleBar sitzt DIREKT auf der Oberkante der Videos.
  // host.tsx + watch/[id].tsx positionieren Videos bei `top: '13%'` (side-by-side+battle).
  const barTop = top ?? Math.round(SCREEN_H * 0.13);

  const timerUrgent = !state.ended && state.secondsLeft <= 10;

  // Indikator-Richtung: wer führt? (für kleinen Pfeil im Badge)
  const leadingSide = useMemo<'host' | 'guest' | 'even'>(() => {
    if (state.hostScore === state.guestScore) return 'even';
    return state.hostScore > state.guestScore ? 'host' : 'guest';
  }, [state.hostScore, state.guestScore]);

  return (
    <View style={[s.container, { top: barTop }]} pointerEvents="none">
      {/* ── Timer-Pill oben, schwebt über der Bar ────────── */}
      {!state.ended && (
        <View style={[s.timerPill, timerUrgent && s.timerPillUrgent]}>
          <Text style={[s.timerText, timerUrgent && s.timerTextUrgent]}>
            ⚔  {fmtTime(state.secondsLeft)}
          </Text>
        </View>
      )}

      {/* ── Die eigentliche Bar ───────────────────────────── */}
      <View style={s.bar}>
        {/* Full-Width Gradient-Background: Pink → Cyan (statisch) */}
        <LinearGradient
          colors={[
            'rgba(255,45,109,0.25)',  // host pink (soft)
            'rgba(255,45,109,0.15)',
            'rgba(0,212,255,0.15)',
            'rgba(0,212,255,0.25)',   // guest cyan (soft)
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Score-Zeile */}
        <View style={s.scoreRow}>
          {/* Host-Score (links, pink) */}
          <View style={s.scoreLeft}>
            <View style={[s.dot, { backgroundColor: HOST_COLOR }]} />
            <Text style={[s.scoreText, s.scoreHost]}>{fmtScore(state.hostScore)}</Text>
          </View>

          {/* Spacer — Indikator wird drüber gelegt als absolute */}
          <View style={{ flex: 1 }} />

          {/* Guest-Score (rechts, cyan) */}
          <View style={s.scoreRight}>
            <Text style={[s.scoreText, s.scoreGuest]}>{fmtScore(state.guestScore)}</Text>
            <View style={[s.dot, { backgroundColor: GUEST_COLOR }]} />
          </View>
        </View>
      </View>

      {/* ── Slim Progress-Underline: Pink-Anteil animiert, Cyan-Rest dahinter ── */}
      <View style={s.underline}>
        <LinearGradient
          colors={[GUEST_COLOR_SOFT, GUEST_COLOR]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View style={[s.underlineHost, { width: hostBarW }]}>
          <LinearGradient
            colors={[HOST_COLOR, HOST_COLOR_SOFT]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>

      {/* ── Indikator-Badge am Boundary (folgt hostBarW) ─────────────────── */}
      <Animated.View style={[s.indicator, { left: indicatorLeft }]}>
        <LinearGradient
          colors={
            leadingSide === 'host'  ? [HOST_COLOR_SOFT, HOST_COLOR]   :
            leadingSide === 'guest' ? [GUEST_COLOR_SOFT, GUEST_COLOR] :
            ['#FFFFFF', '#E5E7EB']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.indicatorInner}
        >
          <Text style={s.indicatorArrow}>
            {leadingSide === 'host' ? '◀' : leadingSide === 'guest' ? '▶' : '⚔'}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* ── Winner-Overlay (Phase 4: Animated Scale + Konfetti) ─────────── */}
      {state.ended && state.winner && (
        <WinnerBanner
          winner={state.winner}
          hostScore={state.hostScore}
          guestScore={state.guestScore}
        />
      )}
    </View>
  );
}

// ─── Animierter Gewinner-Banner ────────────────────────────────────────────
function WinnerBanner({
  winner,
  hostScore,
  guestScore,
}: {
  winner: 'host' | 'guest' | 'draw';
  hostScore: number;
  guestScore: number;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue:         1,
      useNativeDriver: true,
      friction:        4,
      tension:         60,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
  }, [scale, pulse]);

  const label =
    winner === 'host'  ? 'HOST GEWINNT'  :
    winner === 'guest' ? 'GAST GEWINNT'  :
    'UNENTSCHIEDEN';
  const scoreLine =
    winner === 'draw'
      ? `${fmtScore(hostScore)} : ${fmtScore(guestScore)}`
      : winner === 'host'
        ? `${fmtScore(hostScore)} 🪙  vs  ${fmtScore(guestScore)}`
        : `${fmtScore(hostScore)}  vs  ${fmtScore(guestScore)} 🪙`;
  const color =
    winner === 'host'  ? HOST_COLOR   :
    winner === 'guest' ? GUEST_COLOR  :
    '#FACC15';

  return (
    <View style={s.winnerBanner}>
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
        <Animated.Text style={[s.trophyText, { transform: [{ scale: pulse }] }]}>
          🏆
        </Animated.Text>
        <Text style={[s.winnerText, { color }]}>{label}</Text>
        <Text style={s.winnerScore}>{scoreLine}</Text>
      </Animated.View>
      {winner !== 'draw' && <Confetti winner={winner} />}
    </View>
  );
}

function Confetti({ winner }: { winner: 'host' | 'guest' }) {
  const emojis = winner === 'host'
    ? ['🎉', '🎊', '✨', '🔥', '💥', '⭐']
    : ['🎉', '🎊', '💎', '💫', '🌟', '⭐'];
  return (
    <>
      {emojis.map((e, i) => <ConfettiPiece key={i} emoji={e} index={i} />)}
    </>
  );
}

function ConfettiPiece({ emoji, index }: { emoji: string; index: number }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const rotate     = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const delay = index * 120;
    Animated.parallel([
      Animated.timing(translateY, { toValue: 200, duration: 1800, delay, useNativeDriver: true }),
      Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ),
    ]).start();
  }, [translateY, rotate, index]);
  const rot = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const leftPct = 10 + (index * 14);
  return (
    <Animated.Text
      style={{
        position:  'absolute',
        left:      `${leftPct}%`,
        top:       0,
        fontSize:  22,
        transform: [{ translateY }, { rotate: rot }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left:     0,
    right:    0,
    // v1.22.0 (UX): BattleBar liegt UNTER Chat/Likes/Gifts/Animationen.
    // Kommentare: 10–30, Gift-Animationen: 50–100 → BattleBar: 2.
    zIndex:   2,
  },

  // ── Timer-Pill — schwebt über der Bar ─────────────────────────────────────
  timerPill: {
    position:          'absolute',
    top:               -14,
    alignSelf:         'center',
    backgroundColor:   'rgba(17,24,39,0.92)',
    borderRadius:      999,
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.15)',
    zIndex:            3,
  },
  timerPillUrgent: {
    backgroundColor: HOST_COLOR,
    borderColor:     HOST_COLOR_SOFT,
  },
  timerText: {
    color:         '#fff',
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.0,
    fontVariant:   ['tabular-nums'],
  },
  timerTextUrgent: {
    color: '#fff',
  },

  // ── Bar-Container mit Gradient ────────────────────────────────────────────
  bar: {
    height:          BAR_H,
    backgroundColor: 'rgba(0,0,0,0.35)', // Fallback hinter Gradient-Alpha
    overflow:        'hidden',
    flexDirection:   'row',
    alignItems:      'center',
  },

  // ── Score-Zeile ───────────────────────────────────────────────────────────
  scoreRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
  },
  scoreLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  scoreRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  dot: {
    width:  8,
    height: 8,
    borderRadius: 4,
  },
  scoreText: {
    fontSize:         20,
    fontWeight:       '900',
    letterSpacing:    0.4,
    fontVariant:      ['tabular-nums'],
    textShadowColor:  'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  scoreHost: {
    color: '#fff',
  },
  scoreGuest: {
    color: '#fff',
  },

  // ── Slim Progress-Underline (unter der Bar) ───────────────────────────────
  underline: {
    height:   UNDERLINE_H,
    width:    SCREEN_W,
    overflow: 'hidden',
  },
  underlineHost: {
    position: 'absolute',
    top:      0,
    bottom:   0,
    left:     0,
  },

  // ── Indikator-Badge am Boundary ───────────────────────────────────────────
  indicator: {
    position: 'absolute',
    top:      BAR_H / 2 - 12,
    width:    24,
    height:   24,
    zIndex:   2,
  },
  indicatorInner: {
    width:           24,
    height:          24,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.9)',
  },
  indicatorArrow: {
    color:      '#fff',
    fontSize:   11,
    fontWeight: '900',
  },

  // ── Gewinner-Banner ───────────────────────────────────────────────────────
  winnerBanner: {
    position:        'absolute',
    top:             BAR_H + UNDERLINE_H + 20,
    left:            0,
    right:           0,
    height:          180,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    12,
  },
  winnerText: {
    color:            '#FFD700',
    fontSize:         18,
    fontWeight:       '900',
    letterSpacing:    1,
    textShadowColor:  'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  trophyText: {
    fontSize:         42,
    marginBottom:     4,
    textShadowColor:  'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  winnerScore: {
    color:            '#fff',
    fontSize:         14,
    fontWeight:       '700',
    marginTop:        6,
    letterSpacing:    0.5,
    textShadowColor:  'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

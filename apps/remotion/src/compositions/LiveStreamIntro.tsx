/**
 * LiveStreamIntro — 5s Branded Intro für Serlo Hosts
 *
 * Zeitlinie (150 Frames @ 30fps):
 *   0  – 30f : Schwarzer Screen, Partikel erscheinen
 *   30 – 90f : "SERLO" Text — Buchstaben einzeln einblenden (Stagger)
 *   80 – 120f: "LIVE" Badge — Scale-Punch in Rot
 *   110– 150f: Glow-Puls + Hold
 *
 * Export-Format: WebM (Alpha-Channel) → direkt als OBS Browser-Source nutzbar
 * Optionaler Prop `hostName` — "@username fängt jetzt an" Untertitel
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
  Audio,
} from 'remotion';
import { BRAND } from '../brand';
import { ScaleIn, FadeIn, PulseLoop } from '../lib/animations';
import { AUDIO, VOLUME, audioAvailable } from '../lib/audio';

export interface LiveStreamIntroProps {
  hostName?: string;
  primaryColor?: string;
}

// ─── Partikel ─────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; size: number;
  speed: number; opacity: number;
  color: string; delay: number;
}

function generateParticles(count: number): Particle[] {
  const colors = [BRAND.gold, BRAND.red, '#8B5CF6', '#3B82F6', BRAND.goldLight];
  return Array.from({ length: count }, (_, i) => ({
    x: (i * 137.5) % 1080,
    y: (i * 89.3) % 1920,
    size: 4 + (i % 5) * 3,
    speed: 0.3 + (i % 4) * 0.2,
    opacity: 0.3 + (i % 3) * 0.2,
    color: colors[i % colors.length],
    delay: (i * 3) % 40,
  }));
}

const PARTICLES = generateParticles(40);

function ParticleLayer({ frame }: { frame: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {PARTICLES.map((p, i) => {
        const f = Math.max(0, frame - p.delay);
        const opacity = interpolate(f, [0, 20, 120, 150], [0, p.opacity, p.opacity, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const y = p.y - f * p.speed;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: p.x,
            top: ((y % 1920) + 1920) % 1920,
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: p.color, opacity,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }} />
        );
      })}
    </div>
  );
}

// ─── SERLO Buchstaben ─────────────────────────────────────────────────────────

function SerloText({ frame }: { frame: number }) {
  const { fps } = useVideoConfig();
  const letters = 'SERLO'.split('');

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {letters.map((letter, i) => {
        const f = Math.max(0, frame - 30 - i * 8);
        const scale = spring({ frame: f, fps, config: { damping: 12, stiffness: 180, mass: 0.6 }, from: 0, to: 1 });
        const opacity = interpolate(f, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
        const y = interpolate(f, [0, 20], [60, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

        return (
          <div key={i} style={{
            fontSize: 220, fontWeight: 900, fontFamily: BRAND.fontFamily,
            letterSpacing: '-4px', lineHeight: 1,
            background: 'linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            transform: `translateY(${y}px) scale(${scale})`,
            opacity,
            filter: `drop-shadow(0 0 30px rgba(255,255,255,0.4))`,
          }}>
            {letter}
          </div>
        );
      })}
    </div>
  );
}

// ─── LIVE Badge ───────────────────────────────────────────────────────────────

function LiveBadge({ frame, color }: { frame: number; color: string }) {
  return (
    <ScaleIn delay={80} feel="punchy">
      <PulseLoop periodFrames={40} minScale={1.0} maxScale={1.05} startFrame={95}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          background: color, borderRadius: 16, padding: '20px 48px',
          boxShadow: `0 0 60px ${color}88, 0 0 120px ${color}44`,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#fff',
            opacity: frame % 30 < 15 ? 1 : 0.4,
          }} />
          <span style={{
            fontSize: 72, fontWeight: 900, color: '#fff',
            letterSpacing: 8, fontFamily: BRAND.fontFamily,
          }}>
            LIVE
          </span>
        </div>
      </PulseLoop>
    </ScaleIn>
  );
}

// ─── Glow Ring ────────────────────────────────────────────────────────────────

function GlowRing({ frame, color }: { frame: number; color: string }) {
  const opacity = interpolate(frame, [60, 90], [0, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const size = interpolate(frame, [60, 150], [400, 700], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      position: 'absolute',
      width: size, height: size, borderRadius: '50%',
      border: `3px solid ${color}`,
      opacity: opacity * 0.5,
      boxShadow: `0 0 80px ${color}66, inset 0 0 80px ${color}22`,
    }} />
  );
}

// ─── Trennlinie ───────────────────────────────────────────────────────────────

function DividerLine({ frame, color }: { frame: number; color: string }) {
  const width = interpolate(frame, [70, 100], [0, 400], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{
      width, height: 3,
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      borderRadius: 2,
      boxShadow: `0 0 12px ${color}88`,
    }} />
  );
}

// ─── Haupt-Komposition ────────────────────────────────────────────────────────

export function LiveStreamIntro({ hostName, primaryColor = BRAND.red }: LiveStreamIntroProps) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{
      background: BRAND.black,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 40, fontFamily: BRAND.fontFamily, overflow: 'hidden',
    }}>
      <ParticleLayer frame={frame} />

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(circle at 50% 50%, ${primaryColor}18 0%, transparent 60%)`,
      }} />

      <GlowRing frame={frame} color={primaryColor} />
      <SerloText frame={frame} />
      <DividerLine frame={frame} color={primaryColor} />
      <LiveBadge frame={frame} color={primaryColor} />

      {hostName && (
        <FadeIn delay={100} duration={20}>
          <div style={{
            fontSize: 44, color: 'rgba(255,255,255,0.75)',
            fontWeight: 600, letterSpacing: 1, fontFamily: BRAND.fontFamily,
          }}>
            {hostName} fängt jetzt an
          </div>
        </FadeIn>
      )}

      {audioAvailable('introJingle') && (
        <Audio src={AUDIO.introJingle} volume={VOLUME.featured} />
      )}
    </AbsoluteFill>
  );
}

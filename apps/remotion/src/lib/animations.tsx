/**
 * animations.tsx — Serlo Remotion Animation-Utilities
 *
 * Wiederverwendbare Wrapper-Komponenten für konsistente Motion in allen Compositions.
 * Alle Komponenten respektieren den `delay`-Parameter (in Frames).
 *
 * Verfügbare Komponenten:
 *   FadeIn      — einfaches Einblenden (opacity 0→1)
 *   SlideIn     — Slide + Fade von einer Seite (bottom/top/left/right)
 *   ScaleIn     — Spring-Scale-Punch mit optionalem Overshoot
 *   FadeInOut   — Einblenden und Ausblenden (für Screen-Transitions)
 *   StaggerChildren — Wrapper der Children mit versetztem Delay einblendet
 */

import React, { ReactNode, Children, cloneElement, isValidElement } from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';

// ─── Shared Config ─────────────────────────────────────────────────────────────

/** Standard Spring-Config für weiche UI-Animationen */
const SOFT_SPRING = { damping: 14, stiffness: 120, mass: 0.8 };
/** Federnder Spring für Punch-Effekte (Badges, CTAs) */
const PUNCHY_SPRING = { damping: 10, stiffness: 200, mass: 0.5 };
/** Leichter Spring für subtile Einblendungen */
const GENTLE_SPRING = { damping: 18, stiffness: 90, mass: 1.0 };

// ─── FadeIn ───────────────────────────────────────────────────────────────────

export interface FadeInProps {
  children: ReactNode;
  /** Start-Frame (absolut oder relativ zur Sequence) */
  delay?: number;
  /** Dauer des Fade-Ins in Frames (default: 15) */
  duration?: number;
  style?: React.CSSProperties;
}

/**
 * Einfaches Opacity-Einblenden.
 * @example <FadeIn delay={20}>Hallo Welt</FadeIn>
 */
export function FadeIn({ children, delay = 0, duration = 15, style }: FadeInProps) {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, duration], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{ opacity, ...style }}>
      {children}
    </div>
  );
}

// ─── SlideIn ──────────────────────────────────────────────────────────────────

export type SlideDirection = 'bottom' | 'top' | 'left' | 'right';

export interface SlideInProps {
  children: ReactNode;
  delay?: number;
  /** Richtung aus der das Element hereinkommt (default: 'bottom') */
  from?: SlideDirection;
  /** Pixel-Distanz für den Slide (default: 60) */
  distance?: number;
  /** 'soft' für Standard-UI, 'punchy' für CTAs, 'gentle' für Hintergrundelemente */
  feel?: 'soft' | 'punchy' | 'gentle';
  style?: React.CSSProperties;
}

/**
 * Slide + Fade von einer Seite — nutzt Spring für natürliche Bewegung.
 * @example <SlideIn delay={30} from="right" distance={120}>Card</SlideIn>
 */
export function SlideIn({
  children,
  delay = 0,
  from = 'bottom',
  distance = 60,
  feel = 'soft',
  style,
}: SlideInProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const config = feel === 'punchy' ? PUNCHY_SPRING : feel === 'gentle' ? GENTLE_SPRING : SOFT_SPRING;
  const progress = spring({ frame: f, fps, config, from: 0, to: 1 });
  const offset = (1 - progress) * distance;
  const opacity = interpolate(f, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const transforms: Record<SlideDirection, string> = {
    bottom: `translateY(${offset}px)`,
    top:    `translateY(${-offset}px)`,
    left:   `translateX(${-offset}px)`,
    right:  `translateX(${offset}px)`,
  };

  return (
    <div style={{ transform: transforms[from], opacity, ...style }}>
      {children}
    </div>
  );
}

// ─── ScaleIn ──────────────────────────────────────────────────────────────────

export interface ScaleInProps {
  children: ReactNode;
  delay?: number;
  feel?: 'soft' | 'punchy' | 'gentle';
  style?: React.CSSProperties;
}

/**
 * Spring-Scale von 0 → 1 mit optionalem Overshoot.
 * Ideal für Badges, Icons, CTAs.
 * @example <ScaleIn delay={80} feel="punchy">🏆</ScaleIn>
 */
export function ScaleIn({ children, delay = 0, feel = 'punchy', style }: ScaleInProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const config = feel === 'punchy' ? PUNCHY_SPRING : feel === 'gentle' ? GENTLE_SPRING : SOFT_SPRING;
  const scale = spring({ frame: f, fps, config, from: 0, to: 1 });
  const opacity = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ transform: `scale(${scale})`, opacity, ...style }}>
      {children}
    </div>
  );
}

// ─── FadeInOut ────────────────────────────────────────────────────────────────

export interface FadeInOutProps {
  children: ReactNode;
  /** Absoluter Frame an dem das Einblenden beginnt */
  enterFrame: number;
  /** Absoluter Frame an dem das Ausblenden endet */
  exitFrame: number;
  /** Frames für das Einblenden (default: 15) */
  fadeInDuration?: number;
  /** Frames für das Ausblenden (default: 10) */
  fadeOutDuration?: number;
  style?: React.CSSProperties;
}

/**
 * Kombiniertes FadeIn + FadeOut — für Screen-Transitions und Overlays.
 * @example <FadeInOut enterFrame={0} exitFrame={90}>Screen 1</FadeInOut>
 */
export function FadeInOut({
  children,
  enterFrame,
  exitFrame,
  fadeInDuration = 15,
  fadeOutDuration = 10,
  style,
}: FadeInOutProps) {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [
      enterFrame,
      enterFrame + fadeInDuration,
      exitFrame - fadeOutDuration,
      exitFrame,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{ opacity, ...style }}>
      {children}
    </div>
  );
}

// ─── SlideAndFadeInOut ────────────────────────────────────────────────────────

export interface SlideAndFadeInOutProps extends FadeInOutProps {
  from?: SlideDirection;
  distance?: number;
}

/**
 * SlideIn + FadeOut — für Screen-Wechsel mit Bewegung.
 */
export function SlideAndFadeInOut({
  children,
  enterFrame,
  exitFrame,
  from = 'bottom',
  distance = 40,
  fadeInDuration = 20,
  fadeOutDuration = 10,
  style,
}: SlideAndFadeInOutProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = Math.max(0, frame - enterFrame);
  const progress = spring({ frame: f, fps, config: SOFT_SPRING, from: 0, to: 1 });
  const slideOffset = (1 - progress) * distance;

  const opacity = interpolate(
    frame,
    [enterFrame, enterFrame + fadeInDuration, exitFrame - fadeOutDuration, exitFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const transforms: Record<SlideDirection, string> = {
    bottom: `translateY(${slideOffset}px)`,
    top:    `translateY(${-slideOffset}px)`,
    left:   `translateX(${-slideOffset}px)`,
    right:  `translateX(${slideOffset}px)`,
  };

  return (
    <div style={{ transform: transforms[from], opacity, ...style }}>
      {children}
    </div>
  );
}

// ─── StaggerChildren ──────────────────────────────────────────────────────────

export interface StaggerChildrenProps {
  children: ReactNode;
  /** Delay für das erste Kind (default: 0) */
  initialDelay?: number;
  /** Abstand zwischen den Kindern in Frames (default: 8) */
  staggerFrames?: number;
  /** Animation für jedes Kind */
  animation?: 'fade' | 'slide-bottom' | 'slide-right' | 'scale';
  /** Distanz für Slide-Animationen */
  distance?: number;
  style?: React.CSSProperties;
}

/**
 * Blendet Children mit versetztem Delay ein — kein Boilerplate mehr pro Item.
 * @example
 * <StaggerChildren initialDelay={30} staggerFrames={10} animation="slide-right">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </StaggerChildren>
 */
export function StaggerChildren({
  children,
  initialDelay = 0,
  staggerFrames = 8,
  animation = 'fade',
  distance = 40,
  style,
}: StaggerChildrenProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={style}>
      {Children.map(children, (child, i) => {
        const delay = initialDelay + i * staggerFrames;
        const f = Math.max(0, frame - delay);

        const opacity = interpolate(f, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

        let transform = '';
        if (animation === 'slide-bottom') {
          const progress = spring({ frame: f, fps, config: SOFT_SPRING, from: 0, to: 1 });
          transform = `translateY(${(1 - progress) * distance}px)`;
        } else if (animation === 'slide-right') {
          const progress = spring({ frame: f, fps, config: SOFT_SPRING, from: 0, to: 1 });
          transform = `translateX(${(1 - progress) * distance}px)`;
        } else if (animation === 'scale') {
          const scale = spring({ frame: f, fps, config: PUNCHY_SPRING, from: 0, to: 1 });
          transform = `scale(${scale})`;
        }

        return (
          <div key={i} style={{ opacity, transform: transform || undefined }}>
            {child}
          </div>
        );
      })}
    </div>
  );
}

// ─── PulseLoop ────────────────────────────────────────────────────────────────

export interface PulseLoopProps {
  children: ReactNode;
  /** Dauer eines Puls-Zyklus in Frames (default: 30) */
  periodFrames?: number;
  /** Minimale Skalierung (default: 1.0) */
  minScale?: number;
  /** Maximale Skalierung (default: 1.06) */
  maxScale?: number;
  /** Delay bevor Puls startet (default: 0) */
  startFrame?: number;
  style?: React.CSSProperties;
}

/**
 * Endloser Puls-Effekt — für Live-Badges, CTAs, Highlights.
 * @example <PulseLoop periodFrames={45} minScale={1} maxScale={1.08}>🔴 LIVE</PulseLoop>
 */
export function PulseLoop({
  children,
  periodFrames = 30,
  minScale = 1.0,
  maxScale = 1.06,
  startFrame = 0,
  style,
}: PulseLoopProps) {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - startFrame);
  const cycleFrame = f % periodFrames;

  const scale = interpolate(
    cycleFrame,
    [0, periodFrames / 2, periodFrames],
    [minScale, maxScale, minScale],
    { easing: Easing.inOut(Easing.sin) }
  );

  return (
    <div style={{ transform: `scale(${scale})`, ...style }}>
      {children}
    </div>
  );
}

// ─── Reveal (Text-Mask-Effekt) ────────────────────────────────────────────────

export interface RevealProps {
  children: ReactNode;
  delay?: number;
  /** Richtung des Reveals (default: 'bottom') */
  direction?: 'bottom' | 'top' | 'left' | 'right';
  duration?: number;
  style?: React.CSSProperties;
}

/**
 * Clip-Path Reveal — Text erscheint als würde er enthüllt werden.
 * Für Headlines und dramatische Momente.
 */
export function Reveal({
  children,
  delay = 0,
  direction = 'bottom',
  duration = 20,
  style,
}: RevealProps) {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const progress = interpolate(f, [0, duration], [0, 100], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const clipPaths: Record<string, string> = {
    bottom: `inset(${100 - progress}% 0% 0% 0%)`,
    top:    `inset(0% 0% ${100 - progress}% 0%)`,
    left:   `inset(0% ${100 - progress}% 0% 0%)`,
    right:  `inset(0% 0% 0% ${100 - progress}%)`,
  };

  return (
    <div style={{ clipPath: clipPaths[direction], ...style }}>
      {children}
    </div>
  );
}

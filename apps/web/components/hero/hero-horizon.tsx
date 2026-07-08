'use client';

// -----------------------------------------------------------------------------
// HeroHorizon — die Landing-Hero-Bühne. Rendert Zaurs im Hero-Editor
// komponiertes Layout (public/hero/hero-layout.json) 1:1: Shader-Himmel mit
// Sonnenaufgang + freien FBM-Wolken, davor die Silhouetten-Ebenen (flip,
// Deckkraft, Tiefe-Dunst, optionale Drift/Schwebe-Animation — identische
// Formel wie im Editor), Text-Ebenen, Nebel/Vignette/Korn obendrauf.
// Beim Laden staffeln die Ebenen mit einer Aufgangs-Animation ein
// (prefers-reduced-motion: alles sofort sichtbar, Sonne am Ziel).
// -----------------------------------------------------------------------------

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  createHeroShader,
  heroColors,
  type HeroPresetName,
  type HeroShaderHandle,
} from './hero-shader';

export interface HeroLayerAnim {
  type: 'none' | 'drift' | 'float' | 'sway';
  amount: number;
  speed: number;
}

export interface HeroLayer {
  file?: string;
  type?: 'text' | 'cloud';
  x: number;
  bottom: number;
  scale: number;
  depth: number;
  flip?: boolean;
  opacity?: number | null;
  anim?: HeroLayerAnim;
  // Text-Ebenen
  text?: string;
  size?: number;
  color?: string;
  weight?: string;
  // Wolken-Ebenen (im Shader gerendert)
  amount?: number;
  soft?: number;
  drift?: number;
  seed?: number;
}

export interface HeroLayout {
  preset: HeroPresetName;
  sun: { x: number; y: number };
  cloud: number;
  format?: string;
  fx?: { haze: number; vignette: number; grain: number; light: number; stars: number };
  colors?: { skyTop: string; skyHorizon: string; sun: string; cloud: string };
  layers: HeroLayer[];
}

const DEFAULT_FX = { haze: 0.14, vignette: 0, grain: 0.05, light: 1, stars: 0 };

export function layerOpacity(l: HeroLayer): number {
  if (l.opacity != null) return l.opacity;
  return 1 - Math.min(Math.max(l.depth ?? 0, 0), 1) * 0.55;
}

// Identische Formel wie im Hero-Editor (und im Video-Export) — was Zaur dort
// eingestellt hat, bewegt sich hier exakt gleich.
function animOffset(l: HeroLayer, t: number, W: number, H: number) {
  const a = l.anim;
  if (!a || a.type === 'none' || !a.amount) return { dx: 0, dy: 0 };
  const s = a.speed || 1;
  const m = a.amount || 0.5;
  if (a.type === 'drift') return { dx: Math.sin(t * s * 0.45) * m * 0.04 * W, dy: 0 };
  if (a.type === 'float') return { dx: 0, dy: Math.sin(t * s * 0.55) * m * 0.025 * H };
  return { dx: Math.sin(t * s * 0.35) * m * 0.03 * W, dy: Math.sin(t * s * 0.7) * m * 0.012 * H };
}

const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export function HeroHorizon({
  layout,
  className,
  children,
}: {
  layout: HeroLayout;
  className?: string;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shaderRef = useRef<HeroShaderHandle | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const fx = { ...DEFAULT_FX, ...(layout.fx ?? {}) };
  const visualLayers = layout.layers.filter((l) => l.type !== 'cloud');
  const hasRuntimeAnim = visualLayers.some((l) => l.anim && l.anim.type !== 'none');

  useEffect(() => {
    if (!canvasRef.current) return;
    shaderRef.current = createHeroShader(canvasRef.current, {
      preset: layout.preset,
      sun: layout.sun,
      cloud: layout.cloud,
      light: fx.light,
      stars: fx.stars,
      colors: layout.colors,
      clouds: layout.layers
        .filter((l) => l.type === 'cloud')
        .map((l) => ({
          x: l.x, y: l.bottom, size: l.size ?? 0.14, amount: l.amount ?? 0.8,
          soft: l.soft ?? 0.5, drift: l.drift ?? 0.6, seed: l.seed ?? 1,
        })),
    });
    return () => {
      shaderRef.current?.destroy();
      shaderRef.current = null;
    };
    // Layout ist statisch aus der JSON — Shader einmal aufbauen reicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasRuntimeAnim || !stageRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const stage = stageRef.current;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      stage.querySelectorAll<HTMLElement>('[data-hero-anim]').forEach((el) => {
        const idx = Number(el.dataset.heroAnim);
        const l = visualLayers[idx];
        if (!l) return;
        const { dx, dy } = animOffset(l, t, W, H);
        el.style.transform =
          `translateX(calc(-50% + ${dx}px)) translateY(${dy}px)` + (l.flip ? ' scaleX(-1)' : '');
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRuntimeAnim]);

  const horizonHaze = heroColors({ preset: layout.preset, colors: layout.colors }).fallback;
  const riseDelay = (i: number) => 0.25 + i * 0.1;
  const contentDelay = riseDelay(visualLayers.length) + 0.25;

  return (
    <div
      ref={stageRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate' }}
    >
      <style>{`
        @keyframes serloHeroRise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        [data-hero-rise] { opacity: 0; animation: serloHeroRise 1s cubic-bezier(0.22,0.8,0.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          [data-hero-rise] { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        aria-hidden
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '18%',
          height: '30%',
          background: horizonHaze,
          opacity: fx.haze,
          maskImage: 'linear-gradient(180deg, transparent, black)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, black)',
          pointerEvents: 'none',
        }}
      />
      {visualLayers.map((l, i) => {
        const outer: CSSProperties = {
          position: 'absolute',
          left: `${l.x * 100}%`,
          bottom: `${l.bottom * 100}%`,
          width: l.type === 'text' ? 'auto' : `${l.scale * 100}%`,
          animationDelay: `${riseDelay(i)}s`,
          pointerEvents: 'none',
        };
        const innerTransform = `translateX(-50%)${l.flip ? ' scaleX(-1)' : ''}`;
        if (l.type === 'text') {
          return (
            <div key={`t-${i}`} data-hero-rise style={outer} aria-hidden>
              <div
                data-hero-anim={i}
                style={{
                  transform: innerTransform,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  // Näherung: der Landing-Hero ist ~78vh hoch (Editor: Anteil der Bühnenhöhe)
                  fontSize: `${((l.size ?? 0.08) * 78).toFixed(2)}vh`,
                  color: l.color ?? '#f5f3ee',
                  fontWeight: (l.weight as CSSProperties['fontWeight']) ?? 600,
                  textShadow: '0 2px 24px rgba(0,0,0,.45)',
                }}
              >
                {l.text ?? ''}
              </div>
            </div>
          );
        }
        return (
          <div key={`${l.file}-${i}`} data-hero-rise style={outer} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-hero-anim={i}
              src={`/hero/${l.file}`}
              alt=""
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                transform: innerTransform,
                opacity: layerOpacity(l),
                userSelect: 'none',
              }}
            />
          </div>
        );
      })}
      {fx.vignette > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: fx.vignette,
            background:
              'radial-gradient(115% 90% at 50% 42%, transparent 55%, rgba(0,0,0,.9) 130%)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: GRAIN_URI,
          opacity: fx.grain,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
      {children != null && (
        <div
          data-hero-rise
          style={{ position: 'relative', animationDelay: `${contentDelay}s`, height: '100%' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

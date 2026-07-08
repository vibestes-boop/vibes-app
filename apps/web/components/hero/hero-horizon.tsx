'use client';

// -----------------------------------------------------------------------------
// HeroHorizon — die Hero-Bühne: Shader-Himmel hinten, davor Zaurs frei
// komponierte Silhouetten-Layer (PNG-Schnipsel aus /public/hero), Horizont-
// Dunst + Filmkorn obendrauf. Rein präsentational — das Hero-Lab legt seine
// Editier-Overlays über dieselben layerStyle()-Positionen.
// Layout-Quelle: public/hero/hero-layout.json (im Lab per Hand gepflegt).
// -----------------------------------------------------------------------------

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  createHeroShader,
  HERO_PRESETS,
  type HeroPresetName,
  type HeroShaderHandle,
} from './hero-shader';

export interface HeroLayer {
  file: string;
  /** Layer-Mitte horizontal, 0..1 der Bühnenbreite */
  x: number;
  /** Unterkante des Layers relativ zur Bühnen-Unterkante, Anteil der Höhe (negativ = ragt raus) */
  bottom: number;
  /** Breite relativ zur Bühnenbreite (1 = volle Breite) */
  scale: number;
  /** 0 = ganz vorn (kein Dunst, schnellste Parallax) … 1 = ganz hinten */
  depth: number;
}

export interface HeroLayout {
  preset: HeroPresetName;
  sun: { x: number; y: number };
  cloud: number;
  layers: HeroLayer[];
}

export const DEFAULT_HERO_LAYOUT: HeroLayout = {
  preset: 'night',
  sun: { x: 0.3, y: 0.34 },
  cloud: 0.65,
  layers: [],
};

/** Dunst: hinten liegende Silhouetten lassen den hellen Himmel durchscheinen. */
export function layerOpacity(depth: number): number {
  return 1 - Math.min(Math.max(depth, 0), 1) * 0.55;
}

export function layerStyle(l: HeroLayer): CSSProperties {
  return {
    position: 'absolute',
    left: `${l.x * 100}%`,
    bottom: `${l.bottom * 100}%`,
    width: `${l.scale * 100}%`,
    transform: 'translateX(-50%)',
    opacity: layerOpacity(l.depth),
  };
}

const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export function HeroHorizon({
  layout,
  parallax = false,
  className,
  children,
}: {
  layout: HeroLayout;
  parallax?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shaderRef = useRef<HeroShaderHandle | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    shaderRef.current = createHeroShader(canvasRef.current, {
      preset: layout.preset,
      sun: layout.sun,
      cloud: layout.cloud,
    });
    return () => {
      shaderRef.current?.destroy();
      shaderRef.current = null;
    };
    // Shader nur einmal aufbauen — Updates laufen über den Effect darunter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    shaderRef.current?.update({
      preset: layout.preset,
      sun: layout.sun,
      cloud: layout.cloud,
    });
  }, [layout.preset, layout.sun, layout.cloud]);

  useEffect(() => {
    if (!parallax || !stageRef.current) return;
    const stage = stageRef.current;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        stage.querySelectorAll<HTMLElement>('[data-hero-depth]').forEach((el) => {
          const depth = Number(el.dataset.heroDepth ?? '0');
          el.style.transform = `translateX(-50%) translateY(${y * (1 - depth) * 0.16}px)`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [parallax]);

  const horizonHaze = HERO_PRESETS[layout.preset].fallback;
  const sorted = [...layout.layers].sort((a, b) => b.depth - a.depth);

  return (
    <div
      ref={stageRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate' }}
    >
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
          opacity: 0.14,
          maskImage: 'linear-gradient(180deg, transparent, black)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, black)',
          pointerEvents: 'none',
        }}
      />
      {sorted.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={l.file}
          src={`/hero/${l.file}`}
          alt=""
          draggable={false}
          data-hero-depth={l.depth}
          style={{ ...layerStyle(l), userSelect: 'none', pointerEvents: 'none' }}
        />
      ))}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: GRAIN_URI,
          opacity: 0.05,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
}

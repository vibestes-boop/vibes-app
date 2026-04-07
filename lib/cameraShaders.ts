/**
 * cameraShaders.ts — Skia SkSL GPU Shader Filter Library
 *
 * 4 professionelle Shader-Filter die mit ColorMatrix unmöglich sind:
 * - Film Grain: analoge Filmkörnung (rauscht in Echtzeit mit Zeit-Uniform)
 * - Chromatic Aberration: RGB-Split an Bildrändern (Kino-/Lo-Fi-Look)
 * - Halftone: Pop-Art Punktmuster
 * - Digital Glitch: horizontale Streifen-Artefakte
 *
 * SkSL (Skia Shader Language) — Subset von GLSL für GPU-Rendering.
 * Docs: https://skia.org/docs/user/sksl/
 *
 * Verwendung im Frame Processor (Live):
 *   const shader = Skia.RuntimeEffect.Make(FILM_GRAIN_SKSL);
 *   const builder = Skia.RuntimeShaderBuilder(shader!);
 *   builder.setUniform('time', elapsedSec);
 *   builder.setUniform('strength', 0.08);
 *   const imgFilter = Skia.ImageFilter.MakeRuntimeShader(builder, null, null);
 *   // Dann imgFilter auf den Paint anwenden
 *
 * Verwendung im Canvas (Statisches Foto):
 *   <RuntimeShader source={shaderEffect} uniforms={{ time: 0, strength: 0.08 }}>
 *     <SkiaImage ... />
 *   </RuntimeShader>
 */

// ─── Film Grain ────────────────────────────────────────────────────────────────
// Simuliert analoge Filmkörnung durch prozedurales Rauschen.
// 'time' uniform ändert das Rauschen pro Frame → lebt und atmet.
export const FILM_GRAIN_SKSL = `
uniform shader image;
uniform float time;
uniform float strength;

// Hash-Funktion für prozedurales Rauschen (keine Textur nötig)
float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

half4 main(float2 xy) {
  half4 color = image.eval(xy);

  // Rauschen variiert pro Pixel und pro Frame (time-abhängig)
  float noise = hash(xy + float2(time * 0.1, time * 0.07));
  noise = (noise - 0.5) * 2.0; // [-1, 1]

  color.rgb += half3(noise * strength);
  color.rgb = clamp(color.rgb, 0.0, 1.0);
  return color;
}
`;

export const FILM_GRAIN_DEFAULTS = {
  time: 0,
  strength: 0.09,
};

// ─── Chromatic Aberration ──────────────────────────────────────────────────────
// RGB-Kanäle werden radial von der Bildmitte separiert.
// Stärker an den Rändern → Kino-Linsen-Distortion-Look.
export const CHROMATIC_AB_SKSL = `
uniform shader image;
uniform float2 resolution;
uniform float strength;

half4 main(float2 xy) {
  float2 center = resolution * 0.5;
  float2 dir = (xy - center) / max(resolution.x, resolution.y);
  float len = length(dir);
  float offset = len * len * strength; // quadratisch → stärker an den Rändern

  float r = image.eval(xy + dir * offset * 1.0).r;
  float g = image.eval(xy).g;
  float b = image.eval(xy - dir * offset * 1.0).b;
  float a = image.eval(xy).a;

  return half4(r, g, b, a);
}
`;

export const CHROMATIC_AB_DEFAULTS = {
  resolution: [1.0, 1.0] as [number, number], // wird zur Laufzeit mit echten Werten ersetzt
  strength: 28.0,
};

// ─── Halftone ──────────────────────────────────────────────────────────────────
// Zerlegt das Bild in ein Raster von Kreisen — Helligkeit steuert Kreisgröße.
// Klassischer Pop-Art / Comic-Druckraster Effekt.
export const HALFTONE_SKSL = `
uniform shader image;
uniform float dotSize;
uniform float2 resolution;

half4 main(float2 xy) {
  // Raster-Zelle berechnen
  float2 cell = floor(xy / dotSize);
  float2 cellCenter = (cell + float2(0.5, 0.5)) * dotSize;

  // Farbe des Zellenzentrums samplen
  half4 color = image.eval(cellCenter);

  // Relative Helligkeit (Luminanz) als Kreisgröße
  float luma = dot(color.rgb, half3(0.299, 0.587, 0.114));
  float radius = dotSize * luma * 0.7;

  // Abstand des aktuellen Pixels zum Zellenzentrum
  float dist = length(xy - cellCenter);

  // Innerhalb Radius → dunkler Punkt, außerhalb → hell
  float inside = step(dist, radius);
  half3 dotColor = color.rgb * half3(0.15, 0.12, 0.18); // fast schwarz, aber farbig
  half3 bgColor  = half3(0.96, 0.94, 0.90);             // warmes Papier-Weiß

  return half4(mix(bgColor, dotColor, inside), 1.0);
}
`;

export const HALFTONE_DEFAULTS = {
  dotSize: 6.0,
  resolution: [1.0, 1.0] as [number, number],
};

// ─── Digital Glitch ────────────────────────────────────────────────────────────
// Simuliert digitale Übertragungsfehler: horizontale Blockverschiebungen.
// 'time' uniform lässt den Glitch lebend wirken.
export const GLITCH_SKSL = `
uniform shader image;
uniform float2 resolution;
uniform float time;
uniform float intensity;

// Pseudo-Zufallszahl für gegebene Eingabe
float rand(float x) {
  return fract(sin(x * 127.1) * 43758.5453);
}

half4 main(float2 xy) {
  float y = xy.y / resolution.y;

  // Zufällige horizontale Verschiebung in bestimmten Y-Bändern
  float band      = floor(y * 24.0 + time * 8.0);
  float bandRand  = rand(band);

  // Nur in seltenen Bändern aktiv (step → nur wenn rand > 0.92)
  float active    = step(0.92, bandRand);

  // Verschiebungs-Amplitude
  float shift = (rand(band + time) - 0.5) * intensity * active;

  float2 shiftedXY = float2(xy.x + shift * resolution.x, xy.y);

  // Randbehandlung: horizontal wrappen
  shiftedXY.x = mod(shiftedXY.x, resolution.x);

  half4 color = image.eval(shiftedXY);

  // Zusätzlich: RGB-Split im Glitch-Bereich
  float rOffset = shift * 0.5;
  float r = image.eval(float2(mod(xy.x + rOffset * resolution.x, resolution.x), xy.y)).r;
  float b = image.eval(float2(mod(xy.x - rOffset * resolution.x, resolution.x), xy.y)).b;

  return half4(mix(color.r, r, active * 0.8), color.g, mix(color.b, b, active * 0.8), 1.0);
}
`;

export const GLITCH_DEFAULTS = {
  resolution: [1.0, 1.0] as [number, number],
  time: 0,
  intensity: 0.06,
};

// ─── Shader Registry ───────────────────────────────────────────────────────────

export type ShaderFilterId = 'film_grain' | 'chromatic_ab' | 'halftone' | 'glitch';

export interface ShaderDef {
  sksl: string;
  defaults: Record<string, number | [number, number]>;
  /** Braucht Zeit-Uniform (wird per Reanimated-Clock animiert) */
  animated: boolean;
  /** Braucht Resolution-Uniform (wird mit SCREEN_W, SCREEN_H befüllt) */
  needsResolution: boolean;
}

export const SHADER_REGISTRY: Record<ShaderFilterId, ShaderDef> = {
  film_grain: {
    sksl: FILM_GRAIN_SKSL,
    defaults: FILM_GRAIN_DEFAULTS,
    animated: true,
    needsResolution: false,
  },
  chromatic_ab: {
    sksl: CHROMATIC_AB_SKSL,
    defaults: CHROMATIC_AB_DEFAULTS,
    animated: false,
    needsResolution: true,
  },
  halftone: {
    sksl: HALFTONE_SKSL,
    defaults: HALFTONE_DEFAULTS,
    animated: false,
    needsResolution: true,
  },
  glitch: {
    sksl: GLITCH_SKSL,
    defaults: GLITCH_DEFAULTS,
    animated: true,
    needsResolution: true,
  },
};

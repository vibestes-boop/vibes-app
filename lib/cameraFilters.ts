/**
 * Kamera-Filter Bibliothek v2.0
 *
 * Color-Filter: 22 professionelle Skia-ColorMatrix-Filter (Instagram-Stil)
 * Sticker:      15 animierte Emoji-Sticker mit ML Kit Face-Tracking
 * Frames:        6 Rahmen-Stile
 *
 * ColorMatrix Format (Skia 4x5):
 * [ R_R, R_G, R_B, R_A, R_offset,
 *   G_R, G_G, G_B, G_A, G_offset,
 *   B_R, B_G, B_B, B_A, B_offset,
 *   A_R, A_G, A_B, A_A, A_offset ]
 * Werte in [0,255] für Offsets, Faktoren unitless
 */

// ─── Filter Typen ──────────────────────────────────────────────────────────

export type ColorFilterId =
  | 'none'
  // Klassiker
  | 'vivid' | 'vintage' | 'bw' | 'sepia' | 'cool' | 'warm' | 'glow'
  // Instagram-Stil
  | 'lark' | 'reyes' | 'juno' | 'ludwig' | 'nashville'
  | 'moon' | 'fade' | 'chrome' | 'valencia' | 'clarendon'
  // Kreativ
  | 'rose' | 'tokyo' | 'matte' | 'velvet' | 'arctic';

export type StickerFilterId =
  | 'sunglasses' | 'crown' | 'hearts' | 'stars' | 'dogears'
  | 'rainbow'    | 'fire'  | 'butterfly' | 'ghost' | 'lightning'
  | 'sakura'     | 'diamond' | 'moon_s'  | 'alien' | 'angel';

export type FrameFilterId =
  | 'neon_frame' | 'polaroid'
  | 'gold_frame' | 'film'
  | 'vignette'   | 'rainbow_frame';

export type ShaderFilterId = 'film_grain' | 'chromatic_ab' | 'halftone' | 'glitch';

export type FilterCategory = 'color' | 'sticker' | 'frame' | 'shader';

export interface CameraFilter {
  id: ColorFilterId | StickerFilterId | FrameFilterId | ShaderFilterId;
  label: string;
  emoji: string;
  category: FilterCategory;
  colorMatrix?: number[];
  /** Für Frames: Konfig (Farbe, Breite, etc.) */
  frameConfig?: FrameConfig;
  /** Für GPU Shader: Shader-ID aus SHADER_REGISTRY */
  shaderType?: ShaderFilterId;
}

export interface FrameConfig {
  color: string;
  widthFactor: number; // 0-1, relativ zu Bildbreite
  bottomExtra?: number; // Polaroid extra Bottom
  gradient?: [string, string]; // Gradient-Farben
}

// ─── Color-Filter Definitionen ──────────────────────────────────────────────

export const COLOR_FILTERS: Record<ColorFilterId, number[]> = {
  // ── Identität (kein Filter) ────────────────────────────────────────────────
  none: [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ],

  // ── Klassiker ──────────────────────────────────────────────────────────────

  /** Vivid: hohe Sättigung, alle Kanäle verstärkt */
  vivid: [
    1.4, -0.2, -0.2, 0, 0,
    -0.2, 1.4, -0.2, 0, 0,
    -0.2, -0.2, 1.4, 0, 0,
    0, 0, 0, 1, 0,
  ],

  /** Vintage: gedämpfte Blaue, warme Schatten */
  vintage: [
    0.9, 0.05, 0.05, 0, 20,
    0.05, 0.7, 0.05, 0, 10,
    0.05, 0.05, 0.5, 0, 0,
    0, 0, 0, 1, 0,
  ],

  /** B&W: korrekte Luminanz-Gewichtung (Rec.709) */
  bw: [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
  ],

  /** Sepia: klassisches Braun-Ton-Mapping */
  sepia: [
    0.393, 0.769, 0.189, 0, 0,
    0.349, 0.686, 0.168, 0, 0,
    0.272, 0.534, 0.131, 0, 0,
    0, 0, 0, 1, 0,
  ],

  /** Cool: Blaue und Cyan-Töne verstärkt */
  cool: [
    0.8, 0, 0.1, 0, 10,
    0, 0.9, 0.1, 0, 5,
    0.1, 0.1, 1.3, 0, 20,
    0, 0, 0, 1, 0,
  ],

  /** Warm: Rote und Gelb-Töne, Blaue reduziert */
  warm: [
    1.3, 0.05, 0, 0, 10,
    0.05, 1.1, 0, 0, 5,
    0, 0, 0.8, 0, 0,
    0, 0, 0, 1, 0,
  ],

  /** Glow: Aufgehellt mit Softlicht-Charakter */
  glow: [
    1.2, 0.1, 0.1, 0, 20,
    0.1, 1.2, 0.1, 0, 20,
    0.1, 0.1, 1.2, 0, 20,
    0, 0, 0, 1, 0,
  ],

  // ── Instagram-Stil ─────────────────────────────────────────────────────────

  /** Lark: hell, luftig, leicht blau-grünlich, typisch Instagram-Portrait */
  lark: [
    1.05, 0, 0, 0, 8,
    0, 1.0, 0.05, 0, 8,
    0, 0.05, 1.1, 0, 12,
    0, 0, 0, 1, 0,
  ],

  /** Reyes: Schmuddelig-Vintage, aufgehellte Schwarzwerte (Fade-Look) */
  reyes: [
    0.85, 0.05, 0.05, 0, 30,
    0.05, 0.8, 0.05, 0, 25,
    0.05, 0.05, 0.75, 0, 20,
    0, 0, 0, 1, 0,
  ],

  /** Juno: Teal-Blau-Schatten, kräftige Farben (TikTok-Aesthetic) */
  juno: [
    1.1, 0, 0, 0, 0,
    0.05, 1.1, 0.05, 0, 0,
    0.1, 0.1, 1.3, 0, 0,
    0, 0, 0, 1, 0,
  ],

  /** Ludwig: warme neutrale Töne, erhöhter Kontrast, weiches Licht */
  ludwig: [
    1.15, 0.05, 0, 0, 5,
    0, 1.05, 0, 0, 5,
    0, 0, 0.95, 0, 5,
    0, 0, 0, 1, 0,
  ],

  /** Nashville: Pink-Röte, warm, low contrast – Selfie-Aesthetic */
  nashville: [
    1.2, 0.1, 0.05, 0, 10,
    0, 1.0, 0.05, 0, 5,
    0, 0, 0.9, 0, -5,
    0, 0, 0, 1, 0,
  ],

  /** Moon: Weiches Schwarz-Weiß, weniger hart als BW */
  moon: [
    0.35, 0.5, 0.15, 0, -8,
    0.35, 0.5, 0.15, 0, -8,
    0.35, 0.5, 0.15, 0, -8,
    0, 0, 0, 1, 0,
  ],

  /** Fade: Angehobene Schwarzwerte, flache Kontrast-Kurve (Matte-Aesthetic) */
  fade: [
    0.88, 0, 0, 0, 38,
    0, 0.88, 0, 0, 38,
    0, 0, 0.88, 0, 38,
    0, 0, 0, 1, 0,
  ],

  /** Chrome: Hoher Kontrast, kühle Mitten, Metallic-Look */
  chrome: [
    1.25, -0.1, -0.05, 0, -15,
    -0.05, 1.2, -0.1, 0, -15,
    -0.05, -0.1, 1.35, 0, -15,
    0, 0, 0, 1, 0,
  ],

  /** Valencia: Warm-Orange Fade, Photo-Vintage */
  valencia: [
    1.1, 0.1, 0, 0, 15,
    0.05, 1.0, 0, 0, 10,
    0, 0, 0.85, 0, 5,
    0, 0, 0, 1, 0,
  ],

  /** Clarendon: Intensiver Blauanteil in Schatten, starke Sättigung */
  clarendon: [
    1.2, 0, 0, 0, -10,
    0, 1.15, 0, 0, -10,
    0.05, 0.1, 1.35, 0, -10,
    0, 0, 0, 1, 0,
  ],

  // ── Kreativ ────────────────────────────────────────────────────────────────

  /** Rose: Zartrosa, romantisch, weich */
  rose: [
    1.1, 0.1, 0.05, 0, 10,
    0.05, 0.95, 0.05, 0, 5,
    0.05, 0, 0.85, 0, 8,
    0, 0, 0, 1, 0,
  ],

  /** Tokyo: Hoher Kontrast, warme Mitteltöne, Urban-Style */
  tokyo: [
    1.3, -0.1, -0.1, 0, -5,
    -0.05, 1.2, -0.05, 0, -5,
    -0.1, -0.05, 1.1, 0, -10,
    0, 0, 0, 1, 0,
  ],

  /** Matte: Stark angehobene Schwarzwerte, Low-Contrast-Film-Aesthetic */
  matte: [
    0.82, 0, 0, 0, 50,
    0, 0.82, 0, 0, 50,
    0, 0, 0.82, 0, 50,
    0, 0, 0, 1, 0,
  ],

  /** Velvet: Tiefe Farben, erhöhte Sättigung, sanfte Highlights */
  velvet: [
    1.2, -0.05, 0, 0, -10,
    -0.05, 1.15, -0.05, 0, -10,
    0, -0.05, 1.1, 0, -5,
    0, 0, 0, 1, 0,
  ],

  /** Arctic: Kalt und hell, blau-weiß-ästhetisch, Winter-Vibe */
  arctic: [
    0.85, 0.05, 0.15, 0, 20,
    0.05, 0.95, 0.1, 0, 20,
    0.05, 0.1, 1.4, 0, 30,
    0, 0, 0, 1, 0,
  ],
};

// ─── Frame Konfigurationen ──────────────────────────────────────────────────

export const FRAME_CONFIGS: Record<FrameFilterId, FrameConfig> = {
  neon_frame:    { color: '#a855f7', widthFactor: 0.015 },
  polaroid:      { color: '#ffffff', widthFactor: 0.035, bottomExtra: 0.12 },
  gold_frame:    { color: '#f59e0b', widthFactor: 0.022 },
  film:          { color: '#1a1a1a', widthFactor: 0.05 },
  vignette:      { color: 'transparent', widthFactor: 0 }, // Sonderfall: Skia Vignette
  rainbow_frame: { color: '#ec4899', widthFactor: 0.02, gradient: ['#f472b6', '#818cf8'] },
};

// ─── Filter Katalog ────────────────────────────────────────────────────────

export const FILTER_CATALOG: CameraFilter[] = [

  // ── Color Filter ───────────────────────────────────────────────────────────
  { id: 'none',      label: 'Original',   emoji: '✨', category: 'color', colorMatrix: COLOR_FILTERS.none },
  { id: 'vivid',     label: 'Vivid',      emoji: '🌈', category: 'color', colorMatrix: COLOR_FILTERS.vivid },
  { id: 'lark',      label: 'Lark',       emoji: '🕊️', category: 'color', colorMatrix: COLOR_FILTERS.lark },
  { id: 'reyes',     label: 'Reyes',      emoji: '🌿', category: 'color', colorMatrix: COLOR_FILTERS.reyes },
  { id: 'juno',      label: 'Juno',       emoji: '🌊', category: 'color', colorMatrix: COLOR_FILTERS.juno },
  { id: 'clarendon', label: 'Clarendon',  emoji: '💠', category: 'color', colorMatrix: COLOR_FILTERS.clarendon },
  { id: 'nashville', label: 'Nashville',  emoji: '🌸', category: 'color', colorMatrix: COLOR_FILTERS.nashville },
  { id: 'ludwig',    label: 'Ludwig',     emoji: '🏛️', category: 'color', colorMatrix: COLOR_FILTERS.ludwig },
  { id: 'valencia',  label: 'Valencia',   emoji: '🍊', category: 'color', colorMatrix: COLOR_FILTERS.valencia },
  { id: 'tokyo',     label: 'Tokyo',      emoji: '🗼', category: 'color', colorMatrix: COLOR_FILTERS.tokyo },
  { id: 'rose',      label: 'Rose',       emoji: '🌹', category: 'color', colorMatrix: COLOR_FILTERS.rose },
  { id: 'velvet',    label: 'Velvet',     emoji: '🍇', category: 'color', colorMatrix: COLOR_FILTERS.velvet },
  { id: 'arctic',    label: 'Arctic',     emoji: '❄️', category: 'color', colorMatrix: COLOR_FILTERS.arctic },
  { id: 'chrome',    label: 'Chrome',     emoji: '🪞', category: 'color', colorMatrix: COLOR_FILTERS.chrome },
  { id: 'bw',        label: 'B&W',        emoji: '🖤', category: 'color', colorMatrix: COLOR_FILTERS.bw },
  { id: 'moon',      label: 'Moon',       emoji: '🌑', category: 'color', colorMatrix: COLOR_FILTERS.moon },
  { id: 'matte',     label: 'Matte',      emoji: '🎞️', category: 'color', colorMatrix: COLOR_FILTERS.matte },
  { id: 'fade',      label: 'Fade',       emoji: '🫧', category: 'color', colorMatrix: COLOR_FILTERS.fade },
  { id: 'sepia',     label: 'Sepia',      emoji: '🟤', category: 'color', colorMatrix: COLOR_FILTERS.sepia },
  { id: 'warm',      label: 'Warm',       emoji: '🔥', category: 'color', colorMatrix: COLOR_FILTERS.warm },
  { id: 'cool',      label: 'Cool',       emoji: '🧊', category: 'color', colorMatrix: COLOR_FILTERS.cool },
  { id: 'glow',      label: 'Glow',       emoji: '💫', category: 'color', colorMatrix: COLOR_FILTERS.glow },
  { id: 'vintage',   label: 'Vintage',    emoji: '📷', category: 'color', colorMatrix: COLOR_FILTERS.vintage },

  // ── Sticker (ML Kit Face-Tracking nach Capture) ───────────────────────────
  { id: 'sunglasses', label: 'Shades',     emoji: '🕶️',  category: 'sticker' },
  { id: 'crown',      label: 'Crown',      emoji: '👑',  category: 'sticker' },
  { id: 'hearts',     label: 'Hearts',     emoji: '❤️',  category: 'sticker' },
  { id: 'stars',      label: 'Stars',      emoji: '⭐',  category: 'sticker' },
  { id: 'dogears',    label: 'Dog',        emoji: '🐶',  category: 'sticker' },
  { id: 'rainbow',    label: 'Rainbow',    emoji: '🌈',  category: 'sticker' },
  { id: 'fire',       label: 'Fire',       emoji: '🔥',  category: 'sticker' },
  { id: 'butterfly',  label: 'Butterfly',  emoji: '🦋',  category: 'sticker' },
  { id: 'ghost',      label: 'Ghost',      emoji: '👻',  category: 'sticker' },
  { id: 'lightning',  label: 'Thunder',    emoji: '⚡',  category: 'sticker' },
  { id: 'sakura',     label: 'Sakura',     emoji: '🌸',  category: 'sticker' },
  { id: 'diamond',    label: 'Diamond',    emoji: '💎',  category: 'sticker' },
  { id: 'moon_s',     label: 'Moon',       emoji: '🌙',  category: 'sticker' },
  { id: 'alien',      label: 'Alien',      emoji: '👽',  category: 'sticker' },
  { id: 'angel',      label: 'Angel',      emoji: '😇',  category: 'sticker' },

  // ── Frames ─────────────────────────────────────────────────────────────────
  { id: 'neon_frame',    label: 'Neon',     emoji: '🟣', category: 'frame', frameConfig: FRAME_CONFIGS.neon_frame },
  { id: 'polaroid',      label: 'Polaroid', emoji: '📸', category: 'frame', frameConfig: FRAME_CONFIGS.polaroid },
  { id: 'gold_frame',    label: 'Gold',     emoji: '🥇', category: 'frame', frameConfig: FRAME_CONFIGS.gold_frame },
  { id: 'film',          label: 'Film',     emoji: '🎞️', category: 'frame', frameConfig: FRAME_CONFIGS.film },
  { id: 'vignette',      label: 'Vignette', emoji: '🌑', category: 'frame', frameConfig: FRAME_CONFIGS.vignette },
  { id: 'rainbow_frame', label: 'Rainbow',  emoji: '🌈', category: 'frame', frameConfig: FRAME_CONFIGS.rainbow_frame },
  // ── GPU Shader Filter ──────────────────────────────────────────────────────
  { id: 'film_grain',   label: 'Grain',    emoji: '🎞️', category: 'shader', shaderType: 'film_grain'   },
  { id: 'chromatic_ab', label: 'Chroma',   emoji: '🌈', category: 'shader', shaderType: 'chromatic_ab' },
  { id: 'halftone',     label: 'Halftone', emoji: '🔵', category: 'shader', shaderType: 'halftone'     },
  { id: 'glitch',       label: 'Glitch',   emoji: '⚡', category: 'shader', shaderType: 'glitch'       },
];

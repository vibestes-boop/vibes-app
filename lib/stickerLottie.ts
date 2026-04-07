/**
 * stickerLottie.ts — Inline Lottie JSON für Skia Skottie Sticker
 *
 * Jede Lottie-Animation ist ein minimales JSON-Objekt:
 * - v: Lottie-Versions-String
 * - fr: Frame-Rate (30fps)
 * - ip/op: In-Point / Out-Point (Anfang/Ende in Frames)
 * - w/h: Breite/Höhe der Animation (internes Koordinatensystem)
 * - layers: Array von Ebenen (jede Ebene = ein animiertes Element)
 *
 * Wir erzeugen handgefertigte Minimal-Lotties — keine externe Datei nötig.
 * Jede Animation ist eine einfache geometrische Form die sich dreht/pulsiert.
 *
 * Fallback: wenn getStickerLottie() → null → Emoji-Text wird gerendert
 */

import { Skia } from '@shopify/react-native-skia';
import type { SkSkottieAnimation } from '@shopify/react-native-skia';

// ─── Minimales Lottie-Basis-Template ──────────────────────────────────────

/** Erzeugt ein rotierendes, farbiges Kreis-Ping-Lottie */
function makePulseCircleLottie(color: [number, number, number], size = 100): string {
  const [r, g, b] = color;
  return JSON.stringify({
    v: '5.9.0',
    fr: 30,
    ip: 0,
    op: 60, // 2 Sekunden Loop bei 30fps
    w: size,
    h: size,
    nm: 'sticker',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4, // Shape-Ebene
        nm: 'circle',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 }, // Opacity: 100%
          r: {
            a: 1, // Animiert
            k: [
              { t: 0,  s: [0],   e: [360] },
              { t: 60, s: [360], e: [360] },
            ],
          },
          p: { a: 0, k: [size / 2, size / 2, 0] }, // Zentrum
          s: {
            a: 1,
            k: [
              { t: 0,  s: [80, 80, 100],  e: [100, 100, 100] },
              { t: 30, s: [100, 100, 100], e: [80, 80, 100] },
              { t: 60, s: [80, 80, 100],  e: [80, 80, 100] },
            ],
          },
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            it: [
              {
                ty: 'el', // Ellipse
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [size * 0.6, size * 0.6] },
              },
              {
                ty: 'fl', // Fill
                c: { a: 0, k: [r / 255, g / 255, b / 255, 1] },
                o: { a: 0, k: 100 },
              },
            ],
          },
        ],
        ip: 0,
        op: 60,
        st: 0,
      },
    ],
  });
}

/** Erzeugt eine rotierende Stern-Lottie */
function makeStarLottie(color: [number, number, number], points = 5): string {
  const [r, g, b] = color;
  return JSON.stringify({
    v: '5.9.0',
    fr: 30,
    ip: 0,
    op: 90,
    w: 100,
    h: 100,
    nm: 'star',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'star',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: {
            a: 1,
            k: [
              { t: 0,  s: [0],   e: [360] },
              { t: 90, s: [360], e: [360] },
            ],
          },
          p: { a: 0, k: [50, 50, 0] },
          s: {
            a: 1,
            k: [
              { t: 0,  s: [90, 90, 100],  e: [110, 110, 100] },
              { t: 45, s: [110, 110, 100], e: [90, 90, 100]  },
              { t: 90, s: [90, 90, 100],  e: [90, 90, 100]  },
            ],
          },
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            it: [
              {
                ty: 'sr', // Star
                sy: 1,    // Polygon type: star
                pt: { a: 0, k: points },
                p:  { a: 0, k: [0, 0] },
                r:  { a: 0, k: 0 },
                ir: { a: 0, k: 18 }, // inner radius
                or: { a: 0, k: 40 }, // outer radius
                is: { a: 0, k: 0 },
                os: { a: 0, k: 0 },
              },
              {
                ty: 'fl',
                c: { a: 0, k: [r / 255, g / 255, b / 255, 1] },
                o: { a: 0, k: 100 },
              },
            ],
          },
        ],
        ip: 0,
        op: 90,
        st: 0,
      },
    ],
  });
}

// ─── Sticker JSON Map ──────────────────────────────────────────────────────
// Jeder Sticker hat eine maßgeschneiderte Lottie-Animation.
// Farben sind an den Emoji-Charakter angelehnt.

const STICKER_LOTTIE_FNS: Partial<Record<string, () => string>> = {
  sunglasses: () => makePulseCircleLottie([100, 100, 110], 100),   // dunkelgrau
  crown:      () => makeStarLottie([255, 196, 0]),                  // gold
  hearts:     () => makePulseCircleLottie([255, 70, 100], 100),     // pink
  stars:      () => makeStarLottie([255, 220, 50], 5),              // gelb
  dogears:    () => makePulseCircleLottie([196, 140, 90], 100),     // braun
  rainbow:    () => makePulseCircleLottie([255, 120, 200], 100),    // magenta
  fire:       () => makeStarLottie([255, 100, 30], 6),              // orange
  butterfly:  () => makePulseCircleLottie([160, 80, 255], 100),    // lila
  ghost:      () => makePulseCircleLottie([220, 220, 255], 100),    // weiß-blau
  lightning:  () => makeStarLottie([255, 240, 0], 4),               // gelb
  sakura:     () => makePulseCircleLottie([255, 160, 190], 100),    // rosa
  diamond:    () => makeStarLottie([130, 220, 255], 4),             // cyan
  moon_s:     () => makePulseCircleLottie([200, 200, 255], 100),    // helles lila
  alien:      () => makePulseCircleLottie([80, 220, 80], 100),      // grün
  angel:      () => makeStarLottie([255, 255, 200], 8),             // warm-weiß
};

// ─── Kompilierter Animations-Cache ────────────────────────────────────────
const compiledCache = new Map<string, SkSkottieAnimation | null>();

/**
 * Gibt eine kompilierte SkSkottieAnimation zurück.
 * Ergebnis wird gecacht — wird nur einmal pro Sticker kompiliert.
 * Gibt `null` zurück wenn kein Lottie für diesen Sticker definiert ist.
 */
export function getStickerAnimation(filterId: string): SkSkottieAnimation | null {
  if (compiledCache.has(filterId)) return compiledCache.get(filterId)!;

  const fn = STICKER_LOTTIE_FNS[filterId];
  if (!fn) {
    compiledCache.set(filterId, null);
    return null;
  }

  try {
    const json = fn();
    const anim = Skia.Skottie.Make(json);
    compiledCache.set(filterId, anim);
    return anim;
  } catch (e) {
    console.warn('[StickerLottie] Kompilierung fehlgeschlagen für', filterId, e);
    compiledCache.set(filterId, null);
    return null;
  }
}

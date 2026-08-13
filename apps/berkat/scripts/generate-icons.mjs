// Berkat-Marke → PNG-Assets.
//
// Kein sharp, kein librsvg: die Marke besteht ausschließlich aus einer Kapsel
// (der Halm) und sieben rotierten Ellipsen (die Körner). Beides lässt sich
// analytisch abtasten — das ist exakter als ein SVG-Rasterizer und braucht
// nur pngjs, das im Repo ohnehin liegt (wie scripts/generate-brand-assets.mjs).
//
//   node scripts/generate-icons.mjs
//
// Geometrie ist 1:1 assets/mark.svg. Wer dort etwas ändert, ändert es hier mit.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(appRoot, 'assets');

const GOLD = [233, 167, 60];
const DEEP_GREEN = [14, 42, 34];
const WHITE = [255, 255, 255];

// ── Marke im 64×64-Koordinatensystem von mark.svg ────────────────────────────
const STALK = { x1: 32, y1: 56, x2: 32, y2: 18, r: 1.6 };
const KERNELS = [
  { cx: 24, cy: 46, rx: 3.6, ry: 7.2, deg: -45 },
  { cx: 40, cy: 46, rx: 3.6, ry: 7.2, deg: 45 },
  { cx: 24.8, cy: 35, rx: 3.6, ry: 7.2, deg: -45 },
  { cx: 39.2, cy: 35, rx: 3.6, ry: 7.2, deg: 45 },
  { cx: 25.6, cy: 24, rx: 3.6, ry: 7.2, deg: -45 },
  { cx: 38.4, cy: 24, rx: 3.6, ry: 7.2, deg: 45 },
  { cx: 32, cy: 13, rx: 3.4, ry: 7, deg: 0 },
];

// Sichtbare Ausdehnung der Marke — von Hand aus den Formen abgeleitet, damit
// jedes Ziel-PNG die Marke optisch gleich groß zentriert.
const BOUNDS = { x0: 18.3, y0: 6.0, x1: 45.7, y1: 57.6 };

const SUBSAMPLES = 4; // 4×4 = 16 Proben pro Pixel

function insideCapsule(px, py, cap) {
  const dx = cap.x2 - cap.x1;
  const dy = cap.y2 - cap.y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - cap.x1) * dx + (py - cap.y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nx = px - (cap.x1 + t * dx);
  const ny = py - (cap.y1 + t * dy);
  return nx * nx + ny * ny <= cap.r * cap.r;
}

function insideEllipse(px, py, e) {
  // SVG rotate(deg, cx, cy) bildet lokal → global ab. Zum Testen also die
  // Gegenrotation auf den Punkt anwenden.
  const rad = (-e.deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - e.cx;
  const dy = py - e.cy;
  const u = dx * cos - dy * sin;
  const v = dx * sin + dy * cos;
  return (u * u) / (e.rx * e.rx) + (v * v) / (e.ry * e.ry) <= 1;
}

function insideMark(px, py) {
  if (insideCapsule(px, py, STALK)) return true;
  for (const kernel of KERNELS) {
    if (insideEllipse(px, py, kernel)) return true;
  }
  return false;
}

function render({ size, coverage, fg, bg }) {
  const png = new PNG({ width: size, height: size });

  const markW = BOUNDS.x1 - BOUNDS.x0;
  const markH = BOUNDS.y1 - BOUNDS.y0;
  const scale = (size * coverage) / Math.max(markW, markH);
  const originX = size / 2 - ((BOUNDS.x0 + BOUNDS.x1) / 2) * scale;
  const originY = size / 2 - ((BOUNDS.y0 + BOUNDS.y1) / 2) * scale;

  const step = 1 / SUBSAMPLES;
  const samplesPerPixel = SUBSAMPLES * SUBSAMPLES;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SUBSAMPLES; sy++) {
        for (let sx = 0; sx < SUBSAMPLES; sx++) {
          const px = (x + (sx + 0.5) * step - originX) / scale;
          const py = (y + (sy + 0.5) * step - originY) / scale;
          if (insideMark(px, py)) hits++;
        }
      }
      const cover = hits / samplesPerPixel;
      const index = (size * y + x) << 2;

      if (bg) {
        // Deckende Fläche: Vordergrund über Hintergrund mischen.
        png.data[index] = Math.round(bg[0] + (fg[0] - bg[0]) * cover);
        png.data[index + 1] = Math.round(bg[1] + (fg[1] - bg[1]) * cover);
        png.data[index + 2] = Math.round(bg[2] + (fg[2] - bg[2]) * cover);
        png.data[index + 3] = 255;
      } else {
        // Transparenter Hintergrund: Deckung wandert in den Alphakanal.
        png.data[index] = fg[0];
        png.data[index + 1] = fg[1];
        png.data[index + 2] = fg[2];
        png.data[index + 3] = Math.round(cover * 255);
      }
    }
  }

  return png;
}

function write(name, png) {
  const out = path.join(assetsDir, name);
  fs.writeFileSync(out, PNG.sync.write(png, { colorType: 6, deflateLevel: 9, inputHasAlpha: true }));
  console.log(`wrote assets/${name} (${png.width}×${png.height})`);
}

fs.mkdirSync(assetsDir, { recursive: true });

// App-Icon: deckend, Gold auf Tiefgrün. iOS duldet keinen Alphakanal.
// coverage bezieht sich auf die längere Achse — die Ähre ist schmal und hoch,
// also steuert die Höhe die Größe.
write('icon.png', render({ size: 1024, coverage: 0.66, fg: GOLD, bg: DEEP_GREEN }));

// Android adaptive icon: die äußeren ~33 % können beschnitten werden,
// deshalb sitzt die Marke deutlich kleiner in der Fläche.
write('android-icon-foreground.png', render({ size: 1024, coverage: 0.48, fg: GOLD, bg: null }));
write('android-icon-monochrome.png', render({ size: 1024, coverage: 0.48, fg: WHITE, bg: null }));

// Splash: Hintergrundfarbe kommt aus app.json, hier nur die Marke.
write('splash-icon.png', render({ size: 1024, coverage: 0.72, fg: GOLD, bg: null }));

// Benachrichtigungen: Android färbt das Icon selbst ein, es zählt nur die Form.
write('notification-icon.png', render({ size: 96, coverage: 0.82, fg: WHITE, bg: null }));

write('favicon.png', render({ size: 64, coverage: 0.7, fg: GOLD, bg: DEEP_GREEN }));

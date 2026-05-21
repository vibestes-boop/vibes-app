import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(repoRoot, 'assets');
const webPublicDir = path.join(repoRoot, 'apps/web/public');

const COLORS = {
  ink: [4, 5, 12],
  ink2: [8, 12, 26],
  cyan: [42, 239, 255],
  blue: [51, 120, 255],
  violet: [142, 89, 255],
  magenta: [255, 66, 172],
  pearl: [246, 250, 255],
  slate: [86, 104, 130],
  white: [255, 255, 255],
};

const ICON_PATH = [
  { x: 656, y: 266 },
  { x: 600, y: 198 },
  { x: 482, y: 190 },
  { x: 404, y: 230 },
  { x: 316, y: 276 },
  { x: 318, y: 382 },
  { x: 410, y: 416 },
  { x: 474, y: 440 },
  { x: 598, y: 452 },
  { x: 632, y: 532 },
  { x: 666, y: 610 },
  { x: 604, y: 704 },
  { x: 526, y: 784 },
  { x: 354, y: 768 },
  { x: 272, y: 648 },
  { x: 272, y: 648 },
];

const SVG_PATH_D =
  'M656 266C600 198 482 190 404 230C316 276 318 382 410 416C474 440 598 452 632 532C666 610 604 704 526 784C354 768 272 648 272 648';

function ensureDirs() {
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(webPublicDir, { recursive: true });
}

function writePng(relativePath, png) {
  const out = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, PNG.sync.write(png));
  console.log(`wrote ${relativePath}`);
}

function createPng(width, height, fill = [0, 0, 0, 0]) {
  const png = new PNG({ width, height });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = fill[0];
    png.data[index + 1] = fill[1];
    png.data[index + 2] = fill[2];
    png.data[index + 3] = fill[3];
  }
  return png;
}

function setPixel(png, x, y, rgba) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (y * png.width + x) * 4;
  const alpha = clamp01(rgba[3] / 255);
  const inv = 1 - alpha;
  png.data[index] = Math.round(rgba[0] * alpha + png.data[index] * inv);
  png.data[index + 1] = Math.round(rgba[1] * alpha + png.data[index + 1] * inv);
  png.data[index + 2] = Math.round(rgba[2] * alpha + png.data[index + 2] * inv);
  png.data[index + 3] = Math.round(255 * alpha + png.data[index + 3] * inv);
}

function setPixelOpaque(png, x, y, rgb) {
  const index = (y * png.width + x) * 4;
  png.data[index] = rgb[0];
  png.data[index + 1] = rgb[1];
  png.data[index + 2] = rgb[2];
  png.data[index + 3] = 255;
}

function drawBackground(png, opts = {}) {
  const { transparent = false, quiet = false } = opts;
  const cx = png.width * 0.5;
  const cy = png.height * 0.48;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const nx = (x - cx) / png.width;
      const ny = (y - cy) / png.height;
      const radial = clamp01(1 - Math.sqrt(nx * nx * 4.2 + ny * ny * 4.8));
      const diagonal = clamp01((x / png.width) * 0.65 + (1 - y / png.height) * 0.35);
      const auroraA = Math.exp(-((nx + 0.16) ** 2 / 0.038 + (ny - 0.08) ** 2 / 0.022));
      const auroraB = Math.exp(-((nx - 0.2) ** 2 / 0.034 + (ny + 0.2) ** 2 / 0.028));
      const vignette = clamp01(Math.sqrt(nx * nx + ny * ny) * 1.65);
      let color = mix(COLORS.ink, COLORS.ink2, radial * 0.85 + diagonal * 0.18);
      color = mix(color, COLORS.cyan, quiet ? 0 : auroraA * 0.22);
      color = mix(color, COLORS.violet, quiet ? 0 : auroraB * 0.2);
      color = mix(color, [0, 0, 0], vignette * 0.35);
      color = color.map((value) => clamp255(value));
      if (transparent) {
        setPixel(png, x, y, [...color, Math.round(255 * clamp01(radial * 1.8))]);
      } else {
        setPixelOpaque(png, x, y, color);
      }
    }
  }
}

function drawEdgePolish(png) {
  const w = png.width;
  const h = png.height;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y) / Math.min(w, h);
      const topLight = clamp01(1 - y / h) * 0.09;
      const darkEdge = clamp01(0.08 - edge) * 2.1;
      if (topLight > 0.005) setPixel(png, x, y, [...COLORS.white, Math.round(topLight * 255)]);
      if (darkEdge > 0.005) setPixel(png, x, y, [0, 0, 0, Math.round(darkEdge * 255)]);
    }
  }
}

function drawSMark(png, options = {}) {
  const {
    scale = 1,
    offsetX = 0,
    offsetY = 0,
    stroke = 92,
    glow = true,
    monochrome = false,
    alpha = 1,
  } = options;
  const points = sampleIconPath().map((point) => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
    t: point.t,
  }));
  const halfStroke = stroke * 0.5;
  const field = buildPathField(png.width, png.height, points, halfStroke + stroke * 0.9);

  if (glow) {
    drawDistanceRibbon(png, field, halfStroke + stroke * 0.75, (dist, t) => {
      const glowAlpha = clamp01(1 - Math.max(0, dist - halfStroke * 0.72) / (stroke * 0.78));
      const color = mix(COLORS.cyan, COLORS.violet, t);
      return [...color, Math.round(58 * alpha * glowAlpha * glowAlpha)];
    });
  }

  drawDistanceRibbon(png, field, halfStroke + 1.5, (dist, t) => {
    const edge = smoothstep(halfStroke + 1.5, halfStroke - 1.5, dist);
    const normal = clamp01(1 - dist / halfStroke);
    if (monochrome) return [255, 255, 255, Math.round(255 * alpha * edge)];
    const base = ribbonColor(t);
    const lit = mix(base, COLORS.pearl, clamp01(0.2 + normal * 0.34));
    return [...lit.map(clamp255), Math.round(255 * alpha * edge)];
  });

  drawDistanceRibbon(png, field, halfStroke * 0.48, (dist, t) => {
    const edge = smoothstep(halfStroke * 0.48, halfStroke * 0.26, dist);
    if (monochrome) return [255, 255, 255, Math.round(56 * alpha * edge)];
    const color = mix(COLORS.pearl, ribbonColor(t), 0.24);
    return [...color.map(clamp255), Math.round(88 * alpha * edge)];
  });
}

function drawDistanceRibbon(png, field, reach, colorFn) {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = y * png.width + x;
      const distance = field.distance[index];
      if (!Number.isFinite(distance) || distance > reach) continue;
      setPixel(png, x, y, colorFn(distance, field.t[index]));
    }
  }
}

function buildPathField(width, height, points, reach) {
  const size = width * height;
  const distanceSq = new Float32Array(size);
  const t = new Float32Array(size);
  distanceSq.fill(Number.POSITIVE_INFINITY);

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = Math.max(dx * dx + dy * dy, 0.0001);
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x) - reach - 2));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x) + reach + 2));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y) - reach - 2));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y) + reach + 2));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const ux = x - a.x;
        const uy = y - a.y;
        const segmentT = clamp01((ux * dx + uy * dy) / lenSq);
        const px = a.x + dx * segmentT;
        const py = a.y + dy * segmentT;
        const ddx = x - px;
        const ddy = y - py;
        const dSq = ddx * ddx + ddy * ddy;
        const index = y * width + x;
        if (dSq < distanceSq[index]) {
          distanceSq[index] = dSq;
          t[index] = a.t + (b.t - a.t) * segmentT;
        }
      }
    }
  }

  const distance = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    distance[i] = Number.isFinite(distanceSq[i]) ? Math.sqrt(distanceSq[i]) : Number.POSITIVE_INFINITY;
  }
  return { distance, t };
}

function sampleIconPath() {
  const samples = [];
  let total = 0;
  let last = null;
  for (let segment = 0; segment < ICON_PATH.length - 3; segment += 3) {
    const p0 = ICON_PATH[segment];
    const p1 = ICON_PATH[segment + 1];
    const p2 = ICON_PATH[segment + 2];
    const p3 = ICON_PATH[segment + 3];
    for (let i = 0; i <= 80; i += 1) {
      const t = i / 80;
      const point = cubic(p0, p1, p2, p3, t);
      if (last) total += Math.hypot(point.x - last.x, point.y - last.y);
      samples.push({ ...point, length: total });
      last = point;
    }
  }
  return samples.map((point) => ({ ...point, t: total ? point.length / total : 0 }));
}

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y,
  };
}

function ribbonColor(t) {
  if (t < 0.34) return mix(COLORS.cyan, COLORS.blue, t / 0.34);
  if (t < 0.7) return mix(COLORS.blue, COLORS.violet, (t - 0.34) / 0.36);
  return mix(COLORS.violet, COLORS.magenta, (t - 0.7) / 0.3);
}

function renderIcon(size) {
  const png = createPng(size, size, [0, 0, 0, 255]);
  drawBackground(png);
  drawSMark(png, { scale: size / 1024, stroke: size * 0.088 });
  drawEdgePolish(png);
  return png;
}

function renderSplash(size) {
  const png = createPng(size, size, [0, 0, 0, 0]);
  drawSMark(png, {
    scale: size / 1024,
    stroke: size * 0.092,
    glow: true,
    alpha: 0.98,
  });
  return png;
}

function renderAndroidForeground(size) {
  const png = createPng(size, size, [0, 0, 0, 0]);
  drawSMark(png, {
    scale: size / 1024,
    stroke: size * 0.082,
    glow: true,
    alpha: 1,
  });
  return png;
}

function renderAndroidBackground(size) {
  const png = createPng(size, size, [0, 0, 0, 255]);
  drawBackground(png, { quiet: false });
  return png;
}

function renderMonochrome(size) {
  const png = createPng(size, size, [0, 0, 0, 0]);
  drawSMark(png, {
    scale: size / 1024,
    stroke: size * 0.096,
    glow: false,
    monochrome: true,
  });
  return png;
}

function renderFavicon(size) {
  const png = createPng(size, size, [0, 0, 0, 255]);
  drawBackground(png, { quiet: true });
  drawSMark(png, {
    scale: size / 1024,
    stroke: size * 0.105,
    glow: false,
    alpha: 1,
  });
  return png;
}

function writeSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Serlo">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#111B34"/>
      <stop offset="54%" stop-color="#070A18"/>
      <stop offset="100%" stop-color="#020309"/>
    </radialGradient>
    <linearGradient id="mark" x1="220" y1="210" x2="760" y2="790" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2AEFFF"/>
      <stop offset="42%" stop-color="#3378FF"/>
      <stop offset="70%" stop-color="#8E59FF"/>
      <stop offset="100%" stop-color="#FF42AC"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="28" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.8 0 0 0 0 1 0 0 0 .45 0"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <path d="${SVG_PATH_D}" fill="none" stroke="url(#mark)" stroke-width="108" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
  <path d="${SVG_PATH_D}" fill="none" stroke="#F6FAFF" stroke-opacity=".38" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
  fs.writeFileSync(path.join(webPublicDir, 'icon.svg'), svg);
  console.log('wrote apps/web/public/icon.svg');
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function smoothstep(edge0, edge1, value) {
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

ensureDirs();
writePng('assets/icon.png', renderIcon(1024));
writePng('assets/splash-icon.png', renderSplash(1024));
writePng('assets/android-icon-foreground.png', renderAndroidForeground(1024));
writePng('assets/android-icon-background.png', renderAndroidBackground(512));
writePng('assets/android-icon-monochrome.png', renderMonochrome(432));
writePng('assets/favicon.png', renderFavicon(48));
writeSvg();

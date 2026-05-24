import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(repoRoot, 'assets');
const webPublicDir = path.join(repoRoot, 'apps/web/public');

const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

const MARK_PATH_D =
  'M641.8 100.4L649.2 102.1L677.8 133.1L696.5 161.7L705.5 185.4L708.0 209.0L699.8 209.9L696.5 213.1L695.7 222.9L697.4 235.2L700.6 238.4L713.7 240.1L714.5 271.9L703.9 281.7L703.1 293.2L739.0 648.4L745.5 652.5L966.0 652.5L970.1 656.5L970.1 661.4L967.7 664.7L730.8 665.5L728.4 663.9L690.0 282.5L690.0 276.8L703.1 264.6L703.9 258.0L699.0 250.7L687.6 249.9L686.7 240.9L684.3 200.9L693.3 196.8L694.1 190.3L690.0 176.4L679.4 156.8L658.2 129.8L648.4 120.0L645.1 119.2L640.2 120.0L623.9 137.2L608.4 158.4L598.6 177.2L594.5 193.5L597.7 199.2L603.5 200.9L600.2 249.1L588.8 250.7L583.9 258.0L584.7 264.6L597.7 276.0L597.7 280.1L571.6 537.3L538.9 896.6L536.5 902.3L531.6 900.7L530.8 894.2L485.1 456.5L481.0 421.4L476.9 414.8L468.7 414.8L464.6 421.4L440.1 551.2L418.9 678.6L414.8 677.8L383.0 547.9L375.6 542.2L371.5 543.0L367.5 547.9L334.8 661.4L331.5 665.5L62.1 665.5L58.8 663.9L58.0 655.7L61.2 652.5L322.6 651.6L328.3 641.0L374.8 484.2L378.1 484.2L379.7 486.7L406.7 592.8L410.7 596.9L418.1 596.1L421.4 592.8L423.0 585.5L471.2 324.2L473.6 319.3L478.5 319.3L494.0 433.6L525.9 737.4L530.0 743.9L538.9 743.9L542.2 738.2L585.5 288.3L584.7 282.5L572.4 271.1L574.1 240.1L586.3 238.4L589.6 235.2L591.2 228.6L591.2 213.1L587.9 209.9L580.6 209.0L583.9 182.1L589.6 167.4L611.6 132.3L624.7 116.8L641.8 101.3Z';

const MARK_POLYGON = parsePathPolygon(MARK_PATH_D);

function ensureDirs() {
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(webPublicDir, { recursive: true });
}

function writePng(relativePath, png) {
  const out = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    PNG.sync.write(png, {
      colorType: 6,
      deflateLevel: 9,
      deflateStrategy: 3,
      inputHasAlpha: true,
    }),
  );
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

function renderLogo(size, options = {}) {
  const { transparent = false } = options;
  const png = createPng(size, size, transparent ? [0, 0, 0, 0] : [...BLACK, 255]);
  const points = MARK_POLYGON.map((point) => ({
    x: point.x * (size / 1024),
    y: point.y * (size / 1024),
  }));
  const bounds = getBounds(points, size, 2);
  const antialiasWidth = Math.max(0.9, size / 1024);

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const sampleX = x + 0.5;
      const sampleY = y + 0.5;
      const inside = pointInPolygon(sampleX, sampleY, points);
      const distance = distanceToPolygon(sampleX, sampleY, points);
      const alpha = clamp01(0.5 + (inside ? distance : -distance) / antialiasWidth);
      if (alpha <= 0) continue;

      const index = (y * size + x) * 4;
      if (transparent) {
        png.data[index] = WHITE[0];
        png.data[index + 1] = WHITE[1];
        png.data[index + 2] = WHITE[2];
        png.data[index + 3] = Math.round(alpha * 255);
      } else {
        const value = Math.round(alpha * 255);
        png.data[index] = value;
        png.data[index + 1] = value;
        png.data[index + 2] = value;
      }
    }
  }

  return png;
}

function parsePathPolygon(d) {
  const tokens = d.match(/[MLZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const points = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === 'Z') break;
    if (token !== 'M' && token !== 'L') {
      throw new Error(`Unsupported SVG path token: ${token}`);
    }
    const x = Number(tokens[i + 1]);
    const y = Number(tokens[i + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid SVG path coordinate near token ${i}`);
    }
    points.push({ x, y });
    i += 2;
  }

  return points;
}

function getBounds(points, size, padding = 0) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX: Math.max(0, Math.floor(minX - padding)),
    minY: Math.max(0, Math.floor(minY - padding)),
    maxX: Math.min(size - 1, Math.ceil(maxX + padding)),
    maxY: Math.min(size - 1, Math.ceil(maxY + padding)),
  };
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    const intersects = a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToPolygon(x, y, points) {
  let minDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    minDistance = Math.min(minDistance, distanceToSegment(x, y, start, end));
  }
  return minDistance;
}

function distanceToSegment(x, y, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(x - start.x, y - start.y);
  const t = clamp01(((x - start.x) * dx + (y - start.y) * dy) / lengthSq);
  return Math.hypot(x - (start.x + dx * t), y - (start.y + dy * t));
}

function writeSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Serlo">
  <rect width="1024" height="1024" fill="#000"/>
  <path fill="#fff" fill-rule="evenodd" d="${MARK_PATH_D}"/>
</svg>
`;
  fs.writeFileSync(path.join(webPublicDir, 'icon.svg'), svg);
  console.log('wrote apps/web/public/icon.svg');
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

ensureDirs();

writePng('assets/icon.png', renderLogo(1024));
writePng('assets/splash-icon.png', renderLogo(1024, { transparent: true }));
writePng('assets/android-icon-foreground.png', renderLogo(1024, { transparent: true }));
writePng('assets/android-icon-background.png', createPng(512, 512, [...BLACK, 255]));
writePng('assets/android-icon-monochrome.png', renderLogo(432, { transparent: true }));
writePng('assets/notification-icon.png', renderLogo(96, { transparent: true }));
writePng('assets/favicon.png', renderLogo(48));
writePng('apps/web/public/icon-192.png', renderLogo(192));
writePng('apps/web/public/icon-512.png', renderLogo(512));
writePng('apps/web/public/apple-touch-icon.png', renderLogo(180));
writeSvg();

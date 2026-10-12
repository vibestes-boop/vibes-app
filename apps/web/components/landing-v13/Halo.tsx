'use client';

/* eslint-disable @next/next/no-img-element -- statische, vorab verkleinerte WebP-Dateien
   mit festen Maßen; Laden steuert die Landing selbst (lazy, Standbilder bei Bedarf). */

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Tile } from './data';
import { prefersReducedMotion, subscribe } from './store';

// Bildkranz im Einstieg. Die Kacheln laufen auf einer Bahn um den Text herum,
// immer ganz im Bild und nie hinter der Schrift. Sie sind leicht zur Mitte gekippt,
// als hingen sie innen in einer Kuppel. Unter der Maus wirkt eine Lupe: Die Kachel
// wächst (nur so weit, wie neben Text und Bildrand Platz ist), kippt zur Maus, der
// Ausschnitt unter dem Zeiger zoomt und das Video spielt.
// Ohne Maus zeigt ein Scheinwerfer nacheinander einzelne Kacheln. Auftakt: Die
// Kacheln fliegen aus der Mitte auf ihre Bahn. Beim Wegscrollen fliegen sie nach außen.
// Auf schmalen Bildschirmen laufen zwei Reihen über und unter dem Text.

type Box = { x0: number; y0: number; x1: number; y1: number };
type Track = { x0: number; y0: number; x1: number; y1: number; r: number; a: number; b: number; q: number; L: number };
type Layout = {
  mode: 'ring' | 'rows';
  w: number;
  h: number;
  cx: number;
  cy: number;
  tileW: number;
  tileH: number;
  sH: number;
  count: number;
  spacing: number;
  track: Track | null;
  rowY: [number, number];
  rowLen: [number, number];
  safe: Box;
};
type Place = { x: number; y: number; s: number; rx: number; ry: number };
// Lupe je Kachel: freier Streifen, Wachstum, Versatz und weicher Übergang beim Wechsel
type Lens = { room: number; grow: number; ox: number; oy: number; fx: number; fy: number; t: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Lupe: Wachstum, Zoom im Bild, Kippwinkel zur Maus
const LENS_GROW = 0.45;
const LENS_ZOOM = 0.3;
const LENS_TILT = 12;
// Kippen und Perspektive machen eine Kachel auf dem Schirm etwas größer als ihr Maß
const BULGE = 1.05;
// Neigung zur Mitte (Kuppel) in Grad
const FACE_Y = 16;
const FACE_X = 12;
const INTRO_MS = 2200;
const INTRO_DELAY = 450;
const SPOT_EVERY = 3400;
// Geschwindigkeit der Bahn (px pro Bild bei 60 Hz)
const SPEED = { ring: 0.36, rows: 0.45 };

function makeTrack(x0: number, y0: number, x1: number, y1: number, r: number): Track {
  const a = x1 - x0 - 2 * r;
  const b = y1 - y0 - 2 * r;
  const q = (Math.PI * r) / 2;
  return { x0, y0, x1, y1, r, a, b, q, L: 2 * a + 2 * b + 4 * q };
}

// Punkt auf der Bahn (Rechteck mit runden Ecken, im Uhrzeigersinn ab oben links).
// v = 0 auf waagerechten Stücken, 1 auf senkrechten, dazwischen in den Ecken.
function onTrack(t: Track, s: number) {
  const { x0, y0, x1, y1, r, a, b, q } = t;
  let d = ((s % t.L) + t.L) % t.L;
  if (d < a) return { x: x0 + r + d, y: y0, v: 0 };
  d -= a;
  if (d < q) {
    const u = d / q;
    const g = -Math.PI / 2 + (u * Math.PI) / 2;
    return { x: x1 - r + r * Math.cos(g), y: y0 + r + r * Math.sin(g), v: Math.sin((u * Math.PI) / 2) ** 2 };
  }
  d -= q;
  if (d < b) return { x: x1, y: y0 + r + d, v: 1 };
  d -= b;
  if (d < q) {
    const u = d / q;
    const g = (u * Math.PI) / 2;
    return { x: x1 - r + r * Math.cos(g), y: y1 - r + r * Math.sin(g), v: Math.cos((u * Math.PI) / 2) ** 2 };
  }
  d -= q;
  if (d < a) return { x: x1 - r - d, y: y1, v: 0 };
  d -= a;
  if (d < q) {
    const u = d / q;
    const g = Math.PI / 2 + (u * Math.PI) / 2;
    return { x: x0 + r + r * Math.cos(g), y: y1 - r + r * Math.sin(g), v: Math.sin((u * Math.PI) / 2) ** 2 };
  }
  d -= q;
  if (d < b) return { x: x0, y: y1 - r - d, v: 1 };
  d -= b;
  const u = d / q;
  const g = Math.PI + (u * Math.PI) / 2;
  return { x: x0 + r + r * Math.cos(g), y: y0 + r + r * Math.sin(g), v: Math.cos((u * Math.PI) / 2) ** 2 };
}

// Textzone in der Mitte, solange noch nichts gemessen ist (Server, erstes Bild)
function guessHole(w: number, h: number): Box {
  const hw = w < 700 ? w * 0.48 : Math.min(w * 0.26, 380);
  return { x0: w / 2 - hw, x1: w / 2 + hw, y0: h * 0.22, y1: h * 0.76 };
}

function makeLayout(w: number, h: number, hole: Box, total: number): Layout {
  const rail = w >= 1100 ? 58 : 0;
  const m = w < 700 ? 10 : 18;
  const safe = { x0: m, y0: m, x1: w - rail - m, y1: h - m };
  const left = hole.x0 - safe.x0;
  const right = safe.x1 - hole.x1;
  const top = hole.y0 - safe.y0;
  const bottom = safe.y1 - hole.y1;
  const pad = 12;
  if (Math.min(left, right) >= 170) {
    const tileW = Math.min(300, Math.min(left, right) - 2 * pad);
    const tileH = (tileW * 9) / 16;
    const sH = clamp((Math.min(top, bottom) - 2 * pad) / tileH, 0.5, 1);
    const xl = safe.x0 + left / 2;
    const xr = hole.x1 + right / 2;
    const yt = safe.y0 + top / 2;
    const yb = hole.y1 + bottom / 2;
    const track = makeTrack(xl, yt, xr, yb, Math.min(90, (xr - xl) / 5, (yb - yt) / 4));
    const step = Math.max(tileW * sH, tileH) + 22;
    const count = Math.min(total, Math.max(4, Math.floor(track.L / step)));
    return { mode: 'ring', w, h, cx: (xl + xr) / 2, cy: (yt + yb) / 2, tileW, tileH, sH, count, spacing: track.L / count, track, rowY: [yt, yb], rowLen: [0, 0], safe };
  }
  let tileW = Math.min(w * 0.56, 280);
  let tileH = (tileW * 9) / 16;
  const fit = Math.min(Math.max(0, top), Math.max(0, bottom)) - 2 * pad;
  if (fit < tileH) {
    tileH = Math.max(60, fit);
    tileW = (tileH * 16) / 9;
  }
  const spacing = tileW + 16;
  const perRow = Math.ceil((w + tileW + spacing) / spacing);
  const count = Math.min(total, perRow * 2);
  const n0 = Math.ceil(count / 2);
  const n1 = Math.floor(count / 2);
  const len = (n: number) => Math.max(n * spacing, w + tileW + 40);
  return {
    mode: 'rows',
    w,
    h,
    cx: w / 2,
    cy: (hole.y0 + hole.y1) / 2,
    tileW,
    tileH,
    sH: 1,
    count,
    spacing,
    track: null,
    rowY: [safe.y0 + Math.max(0, top) / 2, hole.y1 + Math.max(0, bottom) / 2],
    rowLen: [len(n0), len(n1)],
    safe,
  };
}

// Freie Flächen für eine wachsende Kachel: links, rechts, über und unter dem Text,
// jeweils innerhalb des sicheren Rands. Im Reihen-Modus nur über und unter dem
// Text, seitlich laufen die Reihen dort ohnehin durchs Bild.
function freeStrips(L: Layout, hole: Box): Box[] {
  const s = L.safe;
  if (L.mode === 'rows') {
    return [
      { x0: -1e5, y0: s.y0, x1: 1e5, y1: hole.y0 },
      { x0: -1e5, y0: hole.y1, x1: 1e5, y1: s.y1 },
    ];
  }
  return [
    { x0: s.x0, y0: s.y0, x1: hole.x0, y1: s.y1 },
    { x0: hole.x1, y0: s.y0, x1: s.x1, y1: s.y1 },
    { x0: s.x0, y0: s.y0, x1: s.x1, y1: hole.y0 },
    { x0: s.x0, y0: hole.y1, x1: s.x1, y1: s.y1 },
  ];
}

// Liegt die Kachel (Mitte x/y, halbe Maße bw/bh) im Streifen? 4 px Spiel für die Parallaxe.
const holds = (b: Box, x: number, y: number, bw: number, bh: number) =>
  x - bw >= b.x0 - 4 && x + bw <= b.x1 + 4 && y - bh >= b.y0 - 4 && y + bh <= b.y1 + 4;

// Wie stark die Kachel im Streifen höchstens wachsen kann
const roomIn = (b: Box, bw: number, bh: number) => Math.max(1, Math.min((b.x1 - b.x0) / (2 * bw), (b.y1 - b.y0) / (2 * bh)));

// Der Streifen, in dem die Kachel am größten werden kann, bei Gleichstand der mit
// dem kürzesten Weg. -1, wenn sie gerade in keinem ganz liegt (Auftakt, Scrollen).
function pickStrip(strips: Box[], x: number, y: number, bw: number, bh: number) {
  let best = -1;
  let bestK = 0;
  let bestD = Infinity;
  strips.forEach((b, k) => {
    if (!holds(b, x, y, bw, bh)) return;
    const g = Math.min(1 + LENS_GROW, roomIn(b, bw, bh));
    const d = Math.abs(clamp(x, b.x0 + g * bw, b.x1 - g * bw) - x) + Math.abs(clamp(y, b.y0 + g * bh, b.y1 - g * bh) - y);
    if (g > bestK + 0.01 || (g > bestK - 0.01 && d < bestD)) {
      best = k;
      bestK = Math.max(bestK, g);
      bestD = d;
    }
  });
  return best;
}

// Lage einer Kachel auf der Bahn (ohne Maus, Auftakt und Scrollen)
function place(L: Layout, i: number, s0: number): Place {
  if (L.mode === 'ring' && L.track) {
    const p = onTrack(L.track, s0 + i * L.spacing);
    const nx = clamp((p.x - L.cx) / ((L.track.x1 - L.track.x0) / 2), -1, 1);
    const ny = clamp((p.y - L.cy) / ((L.track.y1 - L.track.y0) / 2), -1, 1);
    return { x: p.x, y: p.y, s: lerp(L.sH, 1, p.v), rx: ny * FACE_X, ry: -nx * FACE_Y };
  }
  const row = i % 2;
  const idx = Math.floor(i / 2);
  const len = L.rowLen[row];
  const dir = row === 0 ? 1 : -1;
  const pos = (((dir * s0 + idx * L.spacing) % len) + len) % len;
  const x = pos - L.tileW / 2;
  const nx = clamp((x - L.cx) / (L.w / 2), -1, 1);
  return { x, y: L.rowY[row], s: 1, rx: row === 0 ? -10 : 10, ry: -nx * 10 };
}

// Startlage für den Server (ohne JavaScript bleibt der Kranz so stehen)
const SSR_W = 1440;
const SSR_H = 852;

export default function Halo({ tiles }: { tiles: Tile[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);

  const ssr = makeLayout(SSR_W, SSR_H, guessHole(SSR_W, SSR_H), tiles.length);

  useEffect(() => {
    const root = wrap.current;
    const canvas = cvs.current;
    if (!root || !canvas) return;
    const els = Array.from(root.querySelectorAll<HTMLDivElement>('.tile'));
    const inner = els.map((el) => el.firstElementChild as HTMLElement | null);
    const vids = els.map((el) => el.querySelector('video'));
    vids.forEach((v) => {
      if (v) v.muted = true;
    });
    const ctx = canvas.getContext('2d');
    const reduce = prefersReducedMotion();
    const html = document.documentElement;
    const core = root.parentElement?.querySelector<HTMLElement>('.hero-core') ?? null;

    let L: Layout = ssr;
    let hole: Box = guessHole(SSR_W, SSR_H);
    let dpr = 1;
    let mag: number[] = els.map(() => 0);
    let zoomed: boolean[] = els.map(() => false);
    // Lupe: freier Streifen und Wachstum je Kachel
    let strips: Box[] = [];
    const freshLens = (): Lens => ({ room: -1, grow: 1, ox: 0, oy: 0, fx: 0, fy: 0, t: 1 });
    let lens: Lens[] = els.map(freshLens);

    const resize = () => {
      const r = root.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const c = core?.getBoundingClientRect();
      hole = c
        ? { x0: c.left - r.left - 20, y0: c.top - r.top - 14, x1: c.right - r.left + 20, y1: c.bottom - r.top + 14 }
        : guessHole(r.width, r.height);
      L = makeLayout(r.width, r.height, hole, els.length);
      strips = freeStrips(L, hole);
      els.forEach((el, i) => {
        el.style.width = `${L.tileW}px`;
        el.style.height = `${L.tileH}px`;
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.display = i < L.count ? '' : 'none';
      });
      mag = els.map(() => 0);
      zoomed = els.map(() => false);
      lens = els.map(freshLens);
      inner.forEach((m) => {
        if (m) m.style.transform = '';
      });
    };

    let s0 = 0;
    let yaw = 0.4;
    let last = performance.now();
    let scrollK = 0;
    // Ohne Startskript (Client-Navigation) beginnt der Auftakt sofort
    let introStart = reduce ? -Infinity : html.classList.contains('sl-motion') ? 0 : performance.now();
    // Maus: Fensterkoordinaten, Parallaxe und ob die Lupe aktiv ist
    let px = -1e4;
    let py = -1e4;
    let user = 0;
    let userTarget = 0;
    let lastMove = -1e9;
    let parX = 0;
    let parY = 0;
    let tParX = 0;
    let tParY = 0;
    // Scheinwerfer, wenn niemand die Maus benutzt
    let spot = -1;
    let spotSince = 0;
    let spotCursor = 0;
    // Nächste Kachel für den Scheinwerfer: eine, die während ihres Auftritts im selben
    // freien Streifen bleibt, dort Platz zum Wachsen hat und im Bild ist. Sonst
    // einfach die übernächste.
    const nextSpot = (spread: number) => {
      const n = Math.max(1, L.count);
      const ahead = SPEED[L.mode] * (SPOT_EVERY / 16.67) * 1.2;
      const at = (i: number, f: number) => {
        const pl = place(L, i, s0 + ahead * f);
        const S = pl.s * (1 + scrollK * 0.4) * BULGE;
        return {
          x: L.cx + (pl.x - L.cx) * spread - parX * 14,
          y: L.cy + (pl.y - L.cy) * spread - parY * 10,
          bw: (L.tileW * S) / 2,
          bh: (L.tileH * S) / 2,
        };
      };
      for (let j = 0; j < n; j++) {
        const i = (spotCursor + 3 + j) % n;
        const a = at(i, 0);
        const k = pickStrip(strips, a.x, a.y, a.bw, a.bh);
        if (k < 0 || roomIn(strips[k], a.bw, a.bh) < 1.15) continue;
        const stays = [0, 0.5, 1].every((f) => {
          const p = f === 0 ? a : at(i, f);
          return holds(strips[k], p.x, p.y, p.bw, p.bh) && p.x > 0 && p.x < L.w;
        });
        if (stays) return (spotCursor = i);
      }
      return (spotCursor = (spotCursor + 3) % n);
    };

    const rings = [
      { a: 0.42, b: 0.0, accent: false },
      { a: 1.18, b: 2.1, accent: true },
      { a: -0.78, b: 4.1, accent: false },
    ];

    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 16.67;
      last = now;
      user += (userTarget - user) * Math.min(1, 0.1 * dt);
      parX += (tParX - parX) * Math.min(1, 0.05 * dt);
      parY += (tParY - parY) * Math.min(1, 0.05 * dt);
      if (introStart === 0 && html.classList.contains('sl-intro-go')) introStart = now + INTRO_DELAY;
      const ti = introStart === 0 ? 0 : clamp((now - introStart) / INTRO_MS, 0, 1);
      const ei = easeOut(ti);

      // Scheinwerfer wandert weiter, solange die Maus nicht im Bildkranz ist
      const idle = !reduce && userTarget === 0 && now - lastMove > 2200 && ti >= 1;
      if (idle) {
        if (spot < 0 || now - spotSince > SPOT_EVERY) {
          spot = nextSpot(1 + scrollK * 0.9);
          spotSince = now;
        }
      } else spot = -1;

      // Die Bahn läuft, langsamer solange die Lupe auf einer Kachel liegt
      let maxUser = 0;
      for (let i = 0; i < L.count; i++) maxUser = Math.max(maxUser, mag[i] * user);
      if (!reduce) s0 += SPEED[L.mode] * dt * (1 - 0.92 * maxUser);
      if (!reduce) yaw += 0.0011 * dt;

      const rect = root.getBoundingClientRect();
      const mx = px - rect.left;
      const my = py - rect.top;
      const sigma = L.tileW * 0.62;
      const spread = 1 + scrollK * 0.9;
      const fade = 1 - scrollK * 0.9;

      for (let i = 0; i < L.count; i++) {
        const el = els[i];
        const pl = place(L, i, s0);
        const en = reduce ? 1 : easeOut(clamp((ti - (i / L.count) * 0.45) / 0.55, 0, 1));
        // Auftakt: aus der Mitte mit leichter Drehung, beim Scrollen nach außen
        let dx0 = (pl.x - L.cx) * spread;
        let dy0 = (pl.y - L.cy) * spread;
        if (en < 1) {
          const g = (1 - en) * 0.9;
          const c = Math.cos(g);
          const sn = Math.sin(g);
          [dx0, dy0] = [(dx0 * c - dy0 * sn) * en, (dx0 * sn + dy0 * c) * en];
        }
        const x = L.cx + dx0 - parX * 14;
        const y = L.cy + dy0 - parY * 10;
        // Lupe: echte Maus oder Scheinwerfer
        let target = 0;
        if (userTarget > 0 || user > 0.01) {
          const ddx = mx - x;
          const ddy = my - y;
          target = Math.exp(-(ddx * ddx + ddy * ddy) / (2 * sigma * sigma)) * user;
        } else if (i === spot) target = 0.72;
        mag[i] += (target - mag[i]) * Math.min(1, 0.14 * dt);
        const m = mag[i] < 0.002 ? 0 : mag[i];
        const S0 = pl.s * (0.3 + 0.7 * en) * (1 + scrollK * 0.4);
        // Die Lupe wächst nur, soweit neben Text und Bildrand Platz ist: Die Kachel
        // bleibt in einem freien Streifen und rückt darin bei Bedarf etwas ab.
        // Verlässt sie den Streifen, schrumpft sie erst und wechselt dann. Der Versatz
        // gleitet dabei in gut 0,2 s in die neue Lage, damit nichts springt.
        const ln = lens[i];
        if (m > 0 || ln.grow > 1.002 || Math.abs(ln.ox) + Math.abs(ln.oy) > 0.05) {
          const bw = (L.tileW * S0 * BULGE) / 2;
          const bh = (L.tileH * S0 * BULGE) / 2;
          let want = 1 + LENS_GROW * m;
          let next = ln.room;
          if (next < 0 || !holds(strips[next], x, y, bw, bh)) {
            if (next >= 0 && ln.grow > 1.01) want = 1;
            else next = m > 0 ? pickStrip(strips, x, y, bw, bh) : -1;
          }
          if (next !== ln.room) {
            ln.room = next;
            ln.fx = ln.ox;
            ln.fy = ln.oy;
            ln.t = 0;
          }
          const b = next >= 0 ? strips[next] : null;
          const cap = b ? roomIn(b, bw, bh) : 1;
          const goal = Math.min(want, cap);
          ln.grow = Math.min(cap, ln.grow + (goal - ln.grow) * Math.min(1, (goal < ln.grow ? 0.3 : 0.2) * dt));
          const tx = b ? clamp(x, b.x0 + ln.grow * bw, b.x1 - ln.grow * bw) - x : 0;
          const ty = b ? clamp(y, b.y0 + ln.grow * bh, b.y1 - ln.grow * bh) - y : 0;
          ln.t = Math.min(1, ln.t + dt / 12);
          const e = easeOut(ln.t);
          ln.ox = lerp(ln.fx, tx, e);
          ln.oy = lerp(ln.fy, ty, e);
        } else if (ln.room !== -1 || ln.grow !== 1 || ln.ox !== 0 || ln.oy !== 0) {
          Object.assign(ln, freshLens());
        }
        const gx = x + ln.ox;
        const gy = y + ln.oy;
        const S = S0 * ln.grow;
        const hw = (L.tileW * S) / 2;
        const hh = (L.tileH * S) / 2;
        const lx = userTarget > 0 || user > 0.01 ? mx - gx : 0;
        const ly = userTarget > 0 || user > 0.01 ? my - gy : 0;
        const rx = lerp(pl.rx - parY * 5, -clamp(ly / (hh + 60), -1, 1) * LENS_TILT, m);
        const ry = lerp(pl.ry + parX * 6, clamp(lx / (hw + 60), -1, 1) * LENS_TILT, m);
        el.style.transform = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0) translate(-50%,-50%) perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${S.toFixed(3)})`;
        el.style.opacity = (en * fade).toFixed(3);
        el.style.zIndex = String(10 + Math.round(m * 100));
        el.style.setProperty('--m', m.toFixed(3));
        const media = inner[i];
        if (media) {
          if (m > 0.002) {
            const ox = clamp((lx + hw) / (2 * hw), 0, 1) * 100;
            const oy = clamp((ly + hh) / (2 * hh), 0, 1) * 100;
            media.style.transformOrigin = `${ox.toFixed(1)}% ${oy.toFixed(1)}%`;
            media.style.transform = `scale(${(1 + LENS_ZOOM * m).toFixed(3)})`;
            zoomed[i] = true;
          } else if (zoomed[i]) {
            media.style.transform = '';
            zoomed[i] = false;
          }
        }
        // Video spielt unter der Lupe und hält an, wenn sie weiterzieht
        const v = vids[i];
        if (v && !reduce) {
          if (m > 0.35 && v.paused) v.play().catch(() => {});
          else if (m < 0.12 && !v.paused) v.pause();
        }
      }

      if (!ctx) return;
      const w = L.w;
      const h = L.h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      const R = (L.track ? (L.track.x1 - L.track.x0) / 2 : w * 0.62) * 1.06 * spread * (0.06 + 0.94 * ei);
      const squash = L.track ? (L.track.y1 - L.track.y0) / (L.track.x1 - L.track.x0) : 0.9;
      const f = R * 2.6;
      const cY = Math.cos(yaw);
      const sY = Math.sin(yaw);
      for (const ring of rings) {
        const ca = Math.cos(ring.a);
        const sa = Math.sin(ring.a);
        const cb = Math.cos(ring.b);
        const sb = Math.sin(ring.b);
        let lx0 = 0;
        let ly0 = 0;
        for (let t = 0; t <= 120; t++) {
          const g = (t / 120) * Math.PI * 2;
          const x0 = Math.cos(g);
          const z0 = Math.sin(g);
          const y1 = -z0 * sa;
          const z1 = z0 * ca;
          const lxr = x0 * cb + z1 * sb;
          const lzr = -x0 * sb + z1 * cb;
          const qx = lxr * cY + lzr * sY;
          const qz = -lxr * sY + lzr * cY;
          const s = f / Math.max(f * 0.2, f + qz * R);
          const xx = L.cx + qx * R * s - parX * 8;
          const yy = L.cy + y1 * R * squash * s - parY * 6;
          if (t > 0) {
            const a = (0.035 + (1 - (qz + 1) / 2) * 0.16) * fade * ei * (ring.accent ? 1.7 : 1);
            ctx.strokeStyle = ring.accent ? `rgba(205,187,151,${a.toFixed(3)})` : `rgba(255,255,255,${a.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(lx0, ly0);
            ctx.lineTo(xx, yy);
            ctx.stroke();
          }
          lx0 = xx;
          ly0 = yy;
        }
      }
    };

    resize();
    draw(performance.now());

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(root);
    if (core) ro.observe(core);
    if (reduce) return () => ro.disconnect();

    let raf = 0;
    let running = false;
    let inView = true;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const update = () => {
      const want = inView && !document.hidden;
      if (want && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else if (!want && running) {
        running = false;
        cancelAnimationFrame(raf);
        vids.forEach((v) => v?.pause());
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(root);
    document.addEventListener('visibilitychange', update);
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      tParX = e.clientX / window.innerWidth - 0.5;
      tParY = e.clientY / window.innerHeight - 0.5;
      const r = root.getBoundingClientRect();
      const lx = px - r.left;
      const ly = py - r.top;
      const inside = lx >= 0 && ly >= 0 && lx <= r.width && ly <= r.height;
      // Über dem Text (Schriftzug, Knöpfe) bleibt die Lupe aus
      const overText = lx > hole.x0 && lx < hole.x1 && ly > hole.y0 && ly < hole.y1;
      userTarget = inside && !overText ? 1 : 0;
      lastMove = performance.now();
    };
    const leave = () => {
      userTarget = 0;
    };
    window.addEventListener('pointermove', move, { passive: true });
    html.addEventListener('mouseleave', leave);
    const unsub = subscribe((s) => {
      scrollK = clamp(s.y / Math.max(1, L.h), 0, 1);
    });
    update();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pointermove', move);
      html.removeEventListener('mouseleave', leave);
      unsub();
    };
    // ssr ist nur die Startlage für den Server
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

  return (
    <div className="orbit" ref={wrap} aria-hidden="true">
      <canvas className="orbit-rings" ref={cvs} />
      {tiles.map((t, i) => {
        const pl = place(ssr, i, 0);
        const style: CSSProperties =
          i < ssr.count
            ? {
                width: ssr.tileW,
                height: ssr.tileH,
                left: `${((pl.x / SSR_W) * 100).toFixed(2)}%`,
                top: `${((pl.y / SSR_H) * 100).toFixed(2)}%`,
                transform: `translate(-50%,-50%) perspective(900px) rotateX(${pl.rx.toFixed(1)}deg) rotateY(${pl.ry.toFixed(1)}deg) scale(${pl.s.toFixed(3)})`,
              }
            : { display: 'none' };
        return (
          <div key={t.src} className={`tile tile-${t.kind}`} style={style}>
            {t.video ? (
              <video src={t.video} poster={t.src} width={t.w} height={t.h} muted loop playsInline preload="metadata" />
            ) : (
              <img src={t.src} alt="" width={t.w} height={t.h} decoding="async" />
            )}
          </div>
        );
      })}
    </div>
  );
}

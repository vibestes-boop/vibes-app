'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Chapter } from './data';
import { getState, prefersReducedMotion, scrollToY, subscribe } from './store';

// Kapitel-Anzeige rechts: vergangene Kapitel oben klein, das aktuelle groß, die
// kommenden unten. Beim Wechsel fliegen die Buchstaben einzeln am rechten Rand
// entlang. Der Schriftzug im Einstieg fliegt beim ersten Scrollen nach oben rechts.
// Dazu die Skala mit Prozentzähler am rechten Rand.

type Zone = 'hero' | 'cur' | 'past' | 'next';
type Pose = { x: number; y: number; s: number; r: number; o: number };
type Flight = {
  from: Pose;
  to: Pose;
  c1: [number, number];
  c2: [number, number];
  rot: number;
  t0: number;
  dur: number;
  live?: () => Pose | null;
  onEnd?: () => void;
};

const CUR = 26; // Schriftgröße des aktuellen Kapitels (wie .hc in landing.css)
const DIM = 0.42; // Deckkraft vergangener und kommender Kapitel
const STEP = 14; // Pixel je Prozent auf der Skala

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};
// 0 → 1 → 0 mit Plateau, für die Drehung während des Flugs
const bump = (t: number) => (t < 0.28 ? ease(t / 0.28) : t > 0.66 ? 1 - ease((t - 0.66) / 0.34) : 1);

function apply(el: HTMLElement, p: Pose) {
  el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) translate(-50%,-50%) rotate(${p.r.toFixed(1)}deg) scale(${p.s.toFixed(3)})`;
  el.style.opacity = p.o.toFixed(3);
}

const glyph = (ch: string) => (ch === ' ' ? ' ' : ch);

export default function Hud({ chapters }: { chapters: Chapter[] }) {
  const [st, setSt] = useState({ ch: 0, docked: false, v: 0 });
  const layoutRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  const odoRef = useRef<HTMLSpanElement>(null);

  const poses = useRef(new Map<string, Pose>());
  const flights = useRef(new Map<string, Flight>());
  const zones = useRef<Zone[] | null>(null);
  const lastV = useRef(-1);
  const lastSig = useRef('');
  const els = useRef<Map<string, HTMLElement> | null>(null);
  const raf = useRef(0);
  const running = useRef(false);

  useEffect(
    () =>
      subscribe((s) =>
        setSt((p) => (p.ch === s.chapter && p.docked === s.docked ? p : { ...p, ch: s.chapter, docked: s.docked })),
      ),
    [],
  );

  // Neu messen bei Größenänderung und sobald die Schriften geladen sind
  useEffect(() => {
    const remeasure = () => setSt((p) => ({ ...p, v: p.v + 1 }));
    window.addEventListener('resize', remeasure);
    document.fonts?.ready.then(remeasure);
    return () => window.removeEventListener('resize', remeasure);
  }, []);

  const heroMode = st.ch === 0 && !st.docked;

  const tick = (now: number) => {
    const map = els.current;
    if (!map) {
      running.current = false;
      return;
    }
    let active = false;
    flights.current.forEach((fl, key) => {
      const el = map.get(key);
      if (!el) {
        flights.current.delete(key);
        return;
      }
      if (fl.live) {
        const p = fl.live();
        if (p) fl.to = { ...p, o: 1 };
      }
      const tt = (now - fl.t0) / fl.dur;
      if (tt <= 0) {
        active = true;
        return;
      }
      const t = Math.min(1, tt);
      const e = ease(t);
      const p: Pose = {
        x: bez(fl.from.x, fl.c1[0], fl.c2[0], fl.to.x, e),
        y: bez(fl.from.y, fl.c1[1], fl.c2[1], fl.to.y, e),
        s: lerp(fl.from.s, fl.to.s, e),
        r: fl.rot * bump(t),
        o: lerp(fl.from.o, fl.to.o, e),
      };
      poses.current.set(key, p);
      apply(el, p);
      if (t >= 1) {
        flights.current.delete(key);
        fl.onEnd?.();
      } else active = true;
    });
    if (active) raf.current = requestAnimationFrame(tick);
    else running.current = false;
  };

  useLayoutEffect(() => {
    const layer = lettersRef.current;
    const layout = layoutRef.current;
    if (!layer || !layout) return;
    const hero = document.querySelector<HTMLElement>('.sl .wordmark');
    if (!window.matchMedia('(min-width: 1100px)').matches) {
      hero?.classList.remove('is-docked');
      zones.current = null;
      return;
    }
    // Buchstaben jedes Mal neu einsammeln: nach einem Sprachwechsel ändern sich die Wörter
    els.current = new Map();
    layer.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => els.current!.set(el.dataset.k!, el));
    const map = els.current;
    const heroLetters = hero ? Array.from(hero.querySelectorAll<HTMLElement>('.wm-ch')) : [];
    const zoneOf = (i: number): Zone => (i === 0 && heroMode ? 'hero' : i < st.ch ? 'past' : i === st.ch ? 'cur' : 'next');
    const measure = (i: number, j: number, z: Zone): Pose | null => {
      const el = z === 'hero' ? heroLetters[j] : layout.querySelector<HTMLElement>(`[data-k="${i}-${j}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(el).fontSize) || CUR;
      // Im Einstieg bleibt die Liste der kommenden Kapitel verborgen (dort läuft der Bildkranz)
      const o = z === 'past' ? DIM : z === 'next' ? (heroMode ? 0 : DIM) : 1;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: fs / CUR, r: 0, o };
    };

    const next = chapters.map((_, i) => zoneOf(i));
    const sig = chapters.map((c) => c.label).join('|');
    const snap = zones.current === null || lastV.current !== st.v || lastSig.current !== sig || prefersReducedMotion();
    lastV.current = st.v;
    lastSig.current = sig;
    const now = performance.now();
    const edgeX = window.innerWidth - 70;

    chapters.forEach((c, i) => {
      const z = next[i];
      const pz = zones.current?.[i] ?? z;
      const n = c.label.length;
      for (let j = 0; j < n; j++) {
        const key = `${i}-${j}`;
        const el = map.get(key);
        const to = measure(i, j, z);
        if (!el || !to) continue;
        if (z === 'hero') to.o = 0; // im Einstieg zeigt die Seite selbst den Schriftzug
        if (snap) {
          flights.current.delete(key);
          poses.current.set(key, to);
          apply(el, to);
          continue;
        }
        if (pz === 'hero' && z === 'hero') continue;
        const now0 = poses.current.get(key);
        if (pz === z && now0 && !flights.current.has(key) && Math.abs(now0.x - to.x) < 0.5 && Math.abs(now0.y - to.y) < 0.5 && Math.abs(now0.o - to.o) < 0.01) continue;

        let kind: 'up' | 'down' | 'dock' | 'undock' | 'direct' = 'direct';
        if (pz === 'next' && z === 'cur') kind = 'up';
        else if (pz === 'cur' && z === 'next') kind = 'down';
        else if (pz === 'hero') kind = 'dock';
        else if (z === 'hero') kind = 'undock';

        let from = now0 ?? to;
        if (kind === 'dock') {
          const hp = measure(0, j, 'hero');
          if (hp) from = { ...hp, o: 1 };
        }
        const target = kind === 'undock' ? { ...to, o: 1 } : to;
        let c1: [number, number] = [lerp(from.x, target.x, 1 / 3), lerp(from.y, target.y, 1 / 3)];
        let c2: [number, number] = [lerp(from.x, target.x, 2 / 3), lerp(from.y, target.y, 2 / 3)];
        let rot = 0;
        let dur = 650;
        let delay = j * 18;
        if (kind === 'up') {
          c1 = [edgeX, from.y];
          c2 = [edgeX, target.y + 150];
          rot = -90;
          dur = 1150;
          delay = (n - 1 - j) * 42;
        } else if (kind === 'down') {
          c1 = [edgeX, from.y + 150];
          c2 = [edgeX, target.y];
          rot = -90;
          dur = 1150;
          delay = j * 42;
        } else if (kind === 'dock') {
          c1 = [lerp(from.x, target.x, 0.2), from.y - 170];
          c2 = [target.x - 140, target.y + 230];
          rot = j % 2 ? 16 : -16;
          dur = 1050;
          delay = j * 48;
          hero?.classList.add('is-docked');
        } else if (kind === 'undock') {
          c1 = [from.x - 140, from.y + 230];
          c2 = [lerp(target.x, from.x, 0.2), target.y - 170];
          rot = j % 2 ? 16 : -16;
          dur = 1000;
          delay = (n - 1 - j) * 40;
        }

        const fl: Flight = { from, to: target, c1, c2, rot, t0: now + delay, dur };
        if (kind === 'undock') {
          fl.live = () => measure(0, j, 'hero');
          if (j === 0) {
            // j = 0 startet zuletzt und landet zuletzt: dann übernimmt der echte Schriftzug
            fl.onEnd = () => {
              if (zones.current?.[0] !== 'hero') return;
              hero?.classList.remove('is-docked');
              for (let k = 0; k < n; k++) {
                const e2 = map.get(`0-${k}`);
                const p2 = poses.current.get(`0-${k}`);
                if (e2 && p2) apply(e2, { ...p2, o: 0 });
                if (p2) p2.o = 0;
              }
            };
          }
        }
        apply(el, from);
        flights.current.set(key, fl);
      }
    });

    if (snap) {
      if (heroMode) hero?.classList.remove('is-docked');
      else hero?.classList.add('is-docked');
    }
    zones.current = next;
    if (flights.current.size && !running.current) {
      running.current = true;
      raf.current = requestAnimationFrame(tick);
    }
    // tick liest nur Refs; bewusst nicht als Abhängigkeit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, chapters, heroMode]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Skala und Prozentzähler
  useEffect(() => {
    let lastPct = -1;
    return subscribe((s) => {
      const tape = tapeRef.current;
      const rail = railRef.current;
      if (!tape || !rail) return;
      const readY = rail.clientHeight * 0.3;
      tape.style.transform = `translate3d(0,${(readY - s.progress * 100 * STEP).toFixed(1)}px,0)`;
      const pct = Math.round(s.progress * 100);
      if (pct === lastPct || !odoRef.current) return;
      lastPct = pct;
      const digits = String(pct).padStart(3, '0');
      odoRef.current.querySelectorAll<HTMLElement>('.odo-strip').forEach((strip, k) => {
        strip.style.transform = `translateY(${-Number(digits[k]) * 10}%)`;
      });
    });
  }, []);

  // Klick auf die Skala springt zur angeklickten Marke
  const onRail = (e: MouseEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail) return;
    const r = rail.getBoundingClientRect();
    const s = getState();
    const p = Math.min(1, Math.max(0, s.progress + (e.clientY - r.top - r.height * 0.3) / (100 * STEP)));
    scrollToY(p * s.max);
  };

  const letters = (c: Chapter, i: number) =>
    c.label.split('').map((ch, j) => (
      <span key={j} data-k={`${i}-${j}`}>
        {glyph(ch)}
      </span>
    ));
  const past = chapters.slice(0, st.ch).map((c, i) => ({ c, i }));
  const cur = heroMode ? null : { c: chapters[st.ch], i: st.ch };
  const upcoming = chapters.slice(st.ch + 1).map((c, k) => ({ c, i: st.ch + 1 + k }));

  return (
    <>
      <div className={heroMode ? 'hud is-hero' : 'hud'} aria-hidden="true">
        <div className="hud-layout" ref={layoutRef}>
          <div className="hud-top">
            {past.map(({ c, i }) => (
              <a key={c.id} href={`#${c.id}`} tabIndex={-1} className="hl hl-past">
                {letters(c, i)}
              </a>
            ))}
            {cur && (
              <a key={cur.c.id} href={`#${cur.c.id}`} tabIndex={-1} className="hl hl-cur">
                {letters(cur.c, cur.i)}
              </a>
            )}
          </div>
          <div className="hud-bottom">
            {upcoming.map(({ c, i }) => (
              <a key={c.id} href={`#${c.id}`} tabIndex={-1} className="hl hl-next">
                {letters(c, i)}
              </a>
            ))}
          </div>
        </div>
        <div className="hud-letters" ref={lettersRef}>
          {chapters.map((c, i) => (
            <Fragment key={c.id}>
              {c.label.split('').map((ch, j) => (
                <span key={j} className="hc" data-k={`${i}-${j}`}>
                  {glyph(ch)}
                </span>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="rail" ref={railRef} aria-hidden="true" onClick={onRail}>
        <div className="rail-tape" ref={tapeRef}>
          {Array.from({ length: 21 }, (_, k) => (
            <span key={k} style={{ top: k * 5 * STEP }}>
              {String(k * 5).padStart(2, '0')}
            </span>
          ))}
        </div>
        <div className="rail-read">
          <span className="odo" ref={odoRef}>
            {[0, 1, 2].map((k) => (
              <span key={k} className="odo-col">
                <span className="odo-strip">
                  {'0123456789'.split('').map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </span>
              </span>
            ))}
            <b>%</b>
          </span>
        </div>
      </div>
    </>
  );
}

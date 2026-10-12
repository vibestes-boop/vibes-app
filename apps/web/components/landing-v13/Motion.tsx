'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { getState, prefersReducedMotion, setLenis, setState, subscribe } from './store';

// Weiches Scrollen, Kapitel-Erkennung, Einblendungen beim Hineinscrollen, die
// Markierung in der Navigation und die kleinen Bewegungen der Seite: Laufband im
// Takt des Scrollens, Telefone kippen zur Maus, Lupe über den Landschaften,
// Beschriftungen entschlüsseln sich beim Erscheinen. Rendert nichts.

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/';

// Mono-Beschriftung: Zeichen erscheinen von links nach rechts erst als Zufallszeichen
function decode(el: HTMLElement) {
  if (el.dataset.decoding) return;
  const text = el.dataset.text ?? el.textContent ?? '';
  if (!text.trim()) return;
  el.dataset.text = text;
  el.dataset.decoding = '1';
  el.setAttribute('aria-label', text);
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / 620);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const from = (i / text.length) * 0.7;
      if (ch === ' ' || t >= from + 0.3) out += ch;
      else if (t >= from) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      else out += ' ';
    }
    el.textContent = out;
    if (t < 1) requestAnimationFrame(step);
    else {
      el.textContent = text;
      delete el.dataset.decoding;
      el.removeAttribute('aria-label');
    }
  };
  requestAnimationFrame(step);
}

// Laufband: läuft ruhig, wird beim Scrollen schneller und dreht mit der Richtung
function setupMarquee() {
  const track = document.querySelector<HTMLElement>('.sl .marquee-track');
  const box = track?.parentElement;
  if (!track || !box) return null;
  track.classList.add('is-driven');
  let half = track.scrollWidth / 2;
  let x = 0;
  let speed = 38;
  let dir = 1;
  let visible = true;
  let hover = false;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
  });
  io.observe(box);
  const ro = new ResizeObserver(() => {
    half = track.scrollWidth / 2;
  });
  ro.observe(track);
  const enter = () => {
    hover = true;
  };
  const leave = () => {
    hover = false;
  };
  box.addEventListener('pointerenter', enter);
  box.addEventListener('pointerleave', leave);
  return {
    tick(dt: number, velocity: number) {
      if (!visible || half <= 0) return;
      if (Math.abs(velocity) > 0.3) dir = velocity > 0 ? 1 : -1;
      const target = (hover ? 8 : 38) + Math.min(900, Math.abs(velocity) * 26);
      speed += (target - speed) * Math.min(1, dt * 4);
      x -= dir * speed * dt;
      if (x <= -half) x += half;
      else if (x > 0) x -= half;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    },
    destroy() {
      io.disconnect();
      ro.disconnect();
      box.removeEventListener('pointerenter', enter);
      box.removeEventListener('pointerleave', leave);
      track.classList.remove('is-driven');
      track.style.transform = '';
    },
  };
}

// Kleine Helfer für Maus-Effekte auf vielen Elementen
function onMouse(els: HTMLElement[], move: (el: HTMLElement, nx: number, ny: number) => void, leave: (el: HTMLElement) => void) {
  const offs = els.map((el) => {
    const mv = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      move(el, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    const lv = () => leave(el);
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerleave', lv);
    return () => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerleave', lv);
    };
  });
  return () => offs.forEach((off) => off());
}

export default function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    // Zustände der Landing liegen als sl-Klassen auf <html>. Kam die Seite per
    // Client-Navigation, lief das Startskript nicht: dann ohne Auftakt, alles sichtbar.
    root.classList.add('sl-js', 'sl-motion-ready');
    const page = document.querySelector<HTMLElement>('.sl') ?? document.body;
    const reduce = prefersReducedMotion();

    const lenis = reduce ? null : new Lenis({ lerp: 0.085, anchors: { offset: -96 }, autoRaf: false });
    setLenis(lenis);

    const sections = Array.from(page.querySelectorAll<HTMLElement>('[data-chapter]'));
    let tops: number[] = [];

    const measure = () => {
      const y = window.scrollY;
      tops = sections.map((s) => s.getBoundingClientRect().top + y);
      setState({ vh: window.innerHeight, max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight) });
    };

    const onScroll = (y: number, velocity: number) => {
      const s = getState();
      const line = y + s.vh * 0.45;
      let chapter = 0;
      for (let i = 0; i < tops.length; i++) if (tops[i] <= line) chapter = i;
      if (s.max > 0 && y >= s.max - 2) chapter = tops.length - 1;
      setState({
        y,
        velocity,
        progress: s.max > 0 ? Math.min(1, Math.max(0, y / s.max)) : 0,
        chapter,
        docked: chapter > 0 || y > s.vh * 0.06,
      });
    };

    measure();
    onScroll(window.scrollY, 0);

    const marquee = reduce ? null : setupMarquee();
    let raf = 0;
    const nativeScroll = () => onScroll(window.scrollY, 0);
    if (lenis) {
      lenis.on('scroll', (l: Lenis) => onScroll(l.scroll, l.velocity));
      let lastT = performance.now();
      const loop = (t: number) => {
        lenis.raf(t);
        const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
        lastT = t;
        marquee?.tick(dt, lenis.velocity);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else {
      window.addEventListener('scroll', nativeScroll, { passive: true });
    }

    const ro = new ResizeObserver(() => {
      measure();
      onScroll(window.scrollY, 0);
    });
    ro.observe(document.body);

    // Einmalige Einblendung, sobald ein Element ins Bild kommt; Zellen entschlüsseln
    // danach ihre Beschriftung
    const timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.add('is-in');
          io.unobserve(el);
          if (!reduce && el.dataset.reveal === 'cell') {
            const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
            timers.push(window.setTimeout(() => el.querySelectorAll<HTMLElement>('.cell-bar > span').forEach(decode), d * 110 + 260));
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    page.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

    // Abschnittsleisten entschlüsseln ihre Beschriftung, sobald sie erscheinen
    const bio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.querySelectorAll<HTMLElement>('b, :scope > span:last-child').forEach(decode);
          bio.unobserve(e.target);
        }
      },
      { threshold: 1 },
    );
    if (!reduce) page.querySelectorAll('.bar').forEach((b) => bio.observe(b));

    // Bewegtbilder laufen nur, solange sie zu sehen sind; bei reduzierter Bewegung bleibt das Standbild
    const vio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            v.muted = true;
            v.play().catch(() => {});
          } else v.pause();
        }
      },
      { threshold: 0.2 },
    );
    if (!reduce) page.querySelectorAll('video[data-autoplay]').forEach((v) => vio.observe(v));

    // Standbilder der Videos weiter unten erst kurz vor dem Erscheinen laden
    const pio = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const v = e.target as HTMLVideoElement;
          if (v.dataset.poster) v.poster = v.dataset.poster;
          pio.unobserve(v);
        }
      },
      { rootMargin: '900px 0px' },
    );
    page.querySelectorAll('video[data-poster]').forEach((v) => pio.observe(v));

    // Telefone kippen leicht zur Maus
    const offTilt = reduce
      ? () => {}
      : onMouse(
          Array.from(page.querySelectorAll<HTMLElement>('.media-stage')),
          (el, nx, ny) => {
            const phone = el.querySelector<HTMLElement>('.phone');
            phone?.style.setProperty('--ry', `${((nx - 0.5) * 18).toFixed(2)}deg`);
            phone?.style.setProperty('--rx', `${((0.5 - ny) * 12).toFixed(2)}deg`);
          },
          (el) => {
            const phone = el.querySelector<HTMLElement>('.phone');
            phone?.style.setProperty('--ry', '0deg');
            phone?.style.setProperty('--rx', '0deg');
          },
        );

    // Lupe über den Landschaften: zoomt in den Ausschnitt unter dem Zeiger
    const offLens = reduce
      ? () => {}
      : onMouse(
          Array.from(page.querySelectorAll<HTMLElement>('[data-lens]')),
          (el, nx, ny) => {
            el.style.setProperty('--lx', `${(nx * 100).toFixed(1)}%`);
            el.style.setProperty('--ly', `${(ny * 100).toFixed(1)}%`);
            el.classList.add('is-lens');
          },
          (el) => el.classList.remove('is-lens'),
        );

    // Aktiver Abschnitt in der Navigation
    const links = Array.from(page.querySelectorAll<HTMLAnchorElement>('[data-nav]'));
    let lastChapter = -1;
    const unsub = subscribe((s) => {
      if (s.chapter === lastChapter) return;
      lastChapter = s.chapter;
      const id = sections[s.chapter]?.id;
      links.forEach((a) => {
        const on = a.dataset.nav === id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', nativeScroll);
      lenis?.destroy();
      setLenis(null);
      marquee?.destroy();
      ro.disconnect();
      io.disconnect();
      bio.disconnect();
      vio.disconnect();
      pio.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      offTilt();
      offLens();
      unsub();
      root.classList.remove('sl-js', 'sl-motion', 'sl-intro-go', 'sl-motion-ready');
    };
  }, []);

  return null;
}

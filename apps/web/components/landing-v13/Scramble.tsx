'use client';

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './store';

// Ein Satz in drei Sprachen. Beim Wechsel lösen sich die Zeichen von links nach
// rechts aus einem Buchstabengewirr in den neuen Satz auf.

type Item = { lang: string; label: string; text: string };

const GLYPHS = 'abcdefghijklmnopqrstuvwxyzабвгдежзиклмнопрстуфхцчшэюя';

export default function Scramble({ items, soon, group }: { items: Item[]; soon: { label: string; note: string }; group: string }) {
  const [active, setActive] = useState(0);
  const lineRef = useRef<HTMLSpanElement>(null);
  const goRef = useRef<(to: number) => void>(() => {});

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const reduce = prefersReducedMotion();
    let idx = 0;
    let raf = 0;
    let timer = 0;
    let visible = false;

    const go = (to: number) => {
      if (to === idx) return;
      cancelAnimationFrame(raf);
      setActive(to);
      el.lang = items[to].lang;
      if (reduce) {
        el.textContent = items[to].text;
        idx = to;
        return;
      }
      const from = items[idx].text;
      const target = items[to].text;
      const len = Math.max(from.length, target.length);
      const order = Array.from({ length: len }, (_, i) => (i / len) * 0.65 + Math.random() * 0.3);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 950);
        let out = '';
        for (let i = 0; i < len; i++) {
          if (t >= order[i]) out += target[i] ?? '';
          else if (t >= order[i] - 0.3) out += target[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          else out += from[i] ?? '';
        }
        el.textContent = out;
        if (t < 1) raf = requestAnimationFrame(step);
        else {
          el.textContent = target;
          idx = to;
        }
      };
      raf = requestAnimationFrame(step);
    };
    goRef.current = go;

    if (reduce) return () => cancelAnimationFrame(raf);

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (visible && !document.hidden) go((idx + 1) % items.length);
        schedule();
      }, 3400);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    }, { threshold: 0.4 });
    io.observe(el);
    schedule();
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [items]);

  return (
    <div className="scramble">
      <p className="scramble-line" aria-hidden="true">
        <span ref={lineRef} lang={items[0].lang}>
          {items[0].text}
        </span>
      </p>
      <ul className="sr-only">
        {items.map((it) => (
          <li key={it.lang} lang={it.lang}>
            {it.text}
          </li>
        ))}
      </ul>
      <div className="lang-tabs" role="group" aria-label={group}>
        {items.map((it, i) => (
          <button key={it.lang} type="button" lang={it.lang} aria-pressed={active === i} onClick={() => goRef.current(i)}>
            {it.label}
          </button>
        ))}
        <span className="lang-soon" lang="ce">
          {soon.label}
          <i>{soon.note}</i>
        </span>
      </div>
    </div>
  );
}

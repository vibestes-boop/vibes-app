'use client';

/* eslint-disable @next/next/no-img-element -- statische, vorab verkleinerte WebP-Dateien
   mit festen Maßen; Laden steuert die Landing selbst (lazy, Standbilder bei Bedarf). */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Dict } from './i18n';
import { prefersReducedMotion } from './store';

// Selbst gebaute Handy-Ansichten im Stil der Serlo App (dunkel). Sie sind
// Beispielansichten mit erfundenen Namen und KI-Bildern; alles läuft nur, solange
// das Handy zu sehen ist, und steht bei reduzierter Bewegung still.

type P = Dict['phones'];

const ICONS: Record<string, ReactNode> = {
  heart: <path d="M12 20s-7-4.4-9.3-8.6C1 8.2 2.6 4.8 6 4.8c2 0 3.3 1.1 4 2.4.7-1.3 2-2.4 4-2.4 3.4 0 5 3.4 3.3 6.6C19 15.6 12 20 12 20z" />,
  comment: <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5A8.5 8.5 0 1 1 21 11.5z" />,
  share: <path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M12 3v12M7 8l5-5 5 5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  send: <path d="M21 3L10 14M21 3l-6.5 18-4.5-7-7-4.5L21 3z" />,
  userPlus: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8v6M16 11h6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </>
  ),
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3a3 3 0 0 1-3 3M7 6H4a3 3 0 0 0 3 3" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  bag: <path d="M5 7h14l-1 13H6L5 7zM9 7a3 3 0 0 1 6 0" />,
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3z" />,
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  bars: <path d="M6 20V10M12 20V4M18 20v-7" />,
};

function Icon({ name, fill = false }: { name: keyof typeof ICONS; fill?: boolean }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function Avatar({ name }: { name: string }) {
  // Graustufen statt bunter Kreise, leicht unterschiedlich je Name
  const tone = 34 + ((name.charCodeAt(0) * 7 + name.length * 13) % 4) * 9;
  return (
    <span className="av" style={{ background: `hsl(30 6% ${tone}%)` } as CSSProperties}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function StatusBar() {
  return (
    <div className="sb">
      <span>9:41</span>
      <svg className="sb-r" viewBox="0 0 66 12" aria-hidden="true">
        <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
        <rect x="5" y="6" width="3" height="6" rx="1" fill="currentColor" />
        <rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" />
        <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" />
        <path d="M24 4.5a9 9 0 0 1 12 0M26.5 7.2a5 5 0 0 1 7 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="30" cy="10.2" r="1.4" fill="currentColor" />
        <rect x="41" y="1" width="21" height="10" rx="3" fill="none" stroke="currentColor" strokeOpacity=".5" />
        <rect x="43" y="3" width="15" height="6" rx="1.5" fill="currentColor" />
        <rect x="63.2" y="4" width="1.8" height="4" rx=".9" fill="currentColor" fillOpacity=".5" />
      </svg>
    </div>
  );
}

function TabBar({ active }: { active: 'home' | 'clan' | 'shop' }) {
  return (
    <div className="tabs">
      <span className={active === 'home' ? 'on' : ''}><Icon name="home" /></span>
      <span className={active === 'clan' ? 'on' : ''}><Icon name="users" /></span>
      <span className="tab-plus"><Icon name="plus" /></span>
      <span className={active === 'shop' ? 'on' : ''}><Icon name="bag" /></span>
      <span><Icon name="user" /></span>
    </div>
  );
}

// Läuft nur, solange das Element zu sehen ist (und nie bei reduzierter Bewegung)
function useActive(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return active;
}

function useTicker(active: boolean, ms: number, fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => fnRef.current(), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
}

function Frame({ children, sr, label }: { children: ReactNode; sr: string; label: string }) {
  return (
    <div className="device" role="img" aria-label={sr}>
      <div className="phone">
        <div className={`screen ui ui-${label}`} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Livestream ────────────────────────────────────────────── */

export function LivePhone({ t }: { t: P['live'] }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const [msgs, setMsgs] = useState<{ id: number; k: number }[]>(() => [0, 1, 2, 3].map((k) => ({ id: k, k })));
  const [hearts, setHearts] = useState<{ id: number; x: number; d: number }[]>([]);
  const [poll, setPoll] = useState(62);
  const next = useRef(4);
  const hid = useRef(0);

  useTicker(active, 1700, () => {
    const id = next.current++;
    setMsgs((m) => [...m.slice(-4), { id, k: id % t.chat.length }]);
  });
  useTicker(active, 650, () => {
    const id = hid.current++;
    setHearts((h) => [...h.filter((x) => x.id > id - 6), { id, x: Math.random() * 30, d: 2 + Math.random() * 1.2 }]);
  });
  useTicker(active, 2600, () => setPoll((p) => Math.max(52, Math.min(74, p + (Math.random() > 0.5 ? 3 : -2)))));

  return (
    <div ref={ref}>
      <Frame sr={t.sr} label="live">
        <video className="ui-bg" src="/landing/media/schlucht-640.mp4" data-poster="/landing/media/schlucht-poster-640.webp" muted loop playsInline preload="none" data-autoplay="" />
        <div className="ui-scrim" />
        <StatusBar />
        <div className="lv-top">
          <Avatar name={t.host} />
          <span className="lv-who">
            <b>{t.host}</b>
            <small>{t.place}</small>
          </span>
          <span className="lv-live">LIVE</span>
          <span className="lv-view"><Icon name="eye" />{t.viewers}</span>
          <span className="lv-x"><Icon name="x" /></span>
        </div>
        <div className="lv-poll">
          <p><Icon name="bars" />{t.poll}</p>
          {t.options.map((o, i) => {
            const v = i === 0 ? poll : 100 - poll;
            return (
              <div key={o} className="lv-opt">
                <i style={{ width: `${v}%` }} />
                <span>{o}</span>
                <b>{v}%</b>
              </div>
            );
          })}
        </div>
        <div className="lv-side">
          <span><Icon name="heart" fill /></span>
          <span><Icon name="comment" /></span>
          <span><Icon name="share" /></span>
        </div>
        <div className="lv-hearts">
          {hearts.map((h) => (
            <span key={h.id} style={{ right: `${h.x}%`, animationDuration: `${h.d}s` } as CSSProperties}>
              <Icon name="heart" fill />
            </span>
          ))}
        </div>
        <ul className="lv-chat">
          {msgs.map((m) => (
            <li key={m.id}>
              <Avatar name={t.chat[m.k][0]} />
              <span>
                <b>{t.chat[m.k][0]}</b>
                {t.chat[m.k][1]}
              </span>
            </li>
          ))}
        </ul>
        <div className="lv-input">
          <span>{t.input}</span>
          <Icon name="send" />
        </div>
      </Frame>
    </div>
  );
}

/* ── Clan ──────────────────────────────────────────────────── */

export function ClanPhone({ t }: { t: P['clan'] }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const n = t.posts.length;
  const [feed, setFeed] = useState<{ id: number; k: number }[]>(() => [1, 2, 3].map((k) => ({ id: k, k })));
  const [fresh, setFresh] = useState(-1);
  const next = useRef(4);

  useTicker(active, 4600, () => {
    const id = next.current++;
    setFeed((f) => [{ id, k: id % n }, ...f.slice(0, 2)]);
    setFresh(id);
  });

  return (
    <div ref={ref}>
      <Frame sr={t.sr} label="clan">
        <StatusBar />
        <div className="cl-head">
          <div>
            <b>{t.title}</b>
            <small><Icon name="users" />{t.members}</small>
          </div>
          <span className="cl-invite"><Icon name="userPlus" />{t.invite}</span>
          <span className="cl-trophy"><Icon name="trophy" /></span>
        </div>
        <div className="cl-feed">
          {feed.map((f, pos) => {
            const p = t.posts[f.k];
            const time = t.posts[pos].time;
            return (
              <div key={f.id} className={f.id === fresh ? 'cl-wrap is-new' : 'cl-wrap'}>
                <article className="cl-post">
                  <header>
                    <Avatar name={p.name} />
                    <b>{p.name}</b>
                    <small>{time}</small>
                    {f.id === fresh && <em>{t.fresh}</em>}
                  </header>
                  <img src={`/landing/media/${p.img}-640.webp`} alt="" width={640} height={360} loading="lazy" decoding="async" />
                  <p>{p.caption}</p>
                  <footer>
                    <span><Icon name="heart" />{p.likes}</span>
                    <span><Icon name="comment" />{p.comments}</span>
                    <span className="cl-bm"><Icon name="bookmark" /></span>
                  </footer>
                </article>
              </div>
            );
          })}
        </div>
        <TabBar active="clan" />
      </Frame>
    </div>
  );
}

/* ── Shop ──────────────────────────────────────────────────── */

const START = 42;
const END = 64;

export function ShopPhone({ t, names }: { t: P['shop']; names: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const [count, setCount] = useState(START + 9);
  const [toast, setToast] = useState<{ id: number; name: string } | null>(null);
  const tid = useRef(0);

  useTicker(active, 1300, () => {
    setCount((c) => {
      const nextCount = c >= END ? START : c + 1;
      if (nextCount % 3 === 0) {
        const id = tid.current++;
        setToast({ id, name: names[id % names.length] });
      }
      return nextCount;
    });
  });

  return (
    <div ref={ref}>
      <Frame sr={t.sr} label="shop">
        <StatusBar />
        <div className="sh-head">
          <b>{t.title}</b>
          <span><Icon name="bag" /></span>
        </div>
        <div className="sh-search"><Icon name="search" />{t.search}</div>
        <div className="sh-chips">
          {t.chips.map((c, i) => (
            <span key={c} className={i === 0 ? 'on' : ''}>{c}</span>
          ))}
        </div>
        <div className="sh-round">
          <img src="/landing/media/shop/parfum.webp" alt="" width={400} height={400} loading="lazy" decoding="async" />
          <div className="sh-round-body">
            <b>{t.round}</b>
            <div className="sh-bar"><i style={{ width: `${(count / 80) * 100}%` }} /></div>
            <small>
              <span className="sh-num">{t.progress.replace('{n}', String(count))}</span>
              <span>{t.days}</span>
            </small>
          </div>
          <span className="sh-btn">{t.reserve}</span>
        </div>
        <p className="sh-pay">{t.pay}</p>
        <div className="sh-grid">
          {t.products.map((p) => (
            <div key={p.img} className="sh-card">
              <span className="sh-img">
                <img src={`/landing/media/shop/${p.img}.webp`} alt="" width={400} height={400} loading="lazy" decoding="async" />
                {p.preorder && <em>{t.preorder}</em>}
              </span>
              <b>{p.name}</b>
              <small>{p.price}</small>
            </div>
          ))}
        </div>
        {toast && (
          <div key={toast.id} className="sh-toast">
            {t.toast.replace('{name}', toast.name)}
          </div>
        )}
        <TabBar active="shop" />
      </Frame>
    </div>
  );
}

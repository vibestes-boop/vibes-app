/* eslint-disable @next/next/no-img-element -- statische, vorab verkleinerte WebP-Dateien
   mit festen Maßen; Laden steuert die Landing selbst (lazy, Standbilder bei Bedarf). */
import Link from 'next/link';
import type { Route } from 'next';
import { Fragment } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Archivo, Cormorant_Garamond, Geist_Mono, Instrument_Serif } from 'next/font/google';

import 'lenis/dist/lenis.css';
import './landing.css';

import Hud from './Hud';
import Motion from './Motion';
import Halo from './Halo';
import Scramble from './Scramble';
import { ClanPhone, LivePhone, ShopPhone } from './Phones';
import { LangSwitch } from './LangSwitch';
import { MARK_PATH, credits, tiles } from './data';
import { dicts } from './i18n';
import type { Item, Lang, Part } from './i18n';

// Öffentliche Landing für Gäste (V13, aus apps/heritage-preview übernommen).
// Bewegungsideen nach getartcraft.com (Bildkranz mit Lupe, fliegende Kapitel,
// Skala, Laufband), Inhalte und Umsetzung eigen. Alle Styles hängen an `.sl`,
// Zustände des Auftakts als `sl-…`-Klassen auf <html> (siehe landing.css).
// Jede Aussage ist am App-Code geprüft; nicht beworben werden Coin-Kauf und
// Geschenke, Tschetschenisch als fertige Sprache und Live-Aufzeichnungen.

const archivo = Archivo({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-mono', display: 'swap' });
const instrument = Instrument_Serif({ subsets: ['latin', 'latin-ext'], weight: '400', style: ['normal', 'italic'], variable: '--font-instrument', display: 'swap' });
// Kursiver Akzent für russische Überschriften (Instrument Serif hat kein Kyrillisch)
const cormorant = Cormorant_Garamond({ subsets: ['latin', 'cyrillic'], style: ['italic'], weight: ['500'], variable: '--font-cormorant', display: 'swap' });

const APP_STORE = 'https://apps.apple.com/app/serlo/id6760790424';
const SECTION_IDS = ['start', 'live', 'clans', 'shop', 'heimat', 'sicherheit', 'app'] as const;

// Läuft beim ersten Laden vor dem ersten Bild: schaltet Bewegung nur ein, wenn sie
// erwünscht ist, startet den Auftakt nach dem Laden der Schriften und gibt nach
// 5 Sekunden alles frei, falls das Seitenskript nicht ankommt.
const BOOT = `(function(){var d=document.documentElement;d.classList.add('sl-js');if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('sl-motion');var go=function(){d.classList.add('sl-intro-go')};var f=document.fonts&&document.fonts.ready;Promise.race([f||Promise.resolve(),new Promise(function(r){setTimeout(r,900)})]).then(function(){requestAnimationFrame(go)});setTimeout(function(){if(!d.classList.contains('sl-motion-ready')){d.classList.remove('sl-motion');go()}},5000)})();`;

function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
      <path fill="currentColor" fillRule="evenodd" d={MARK_PATH} />
    </svg>
  );
}

// Überschrift, Wort für Wort einblendbar. Kursive Teile als Serifen-Akzent.
function Title({ as: Tag = 'h2', parts, id, intro = false }: { as?: 'h1' | 'h2' | 'h3'; parts: Part[]; id?: string; intro?: boolean }) {
  let n = 0;
  const out: ReactNode[] = [];
  parts.forEach((p, pi) => {
    const text = typeof p === 'string' ? p : p.em;
    const words = text.split(' ').map((w, wi) => (
      <span key={wi} className="w" style={{ '--i': n++ } as CSSProperties}>
        {w}
      </span>
    ));
    const joined = words.flatMap((w, k) => (k ? [' ', w] : [w]));
    out.push(typeof p === 'string' ? <Fragment key={pi}>{joined}</Fragment> : <em key={pi}>{joined}</em>);
    if (pi < parts.length - 1) out.push(' ');
  });
  return (
    <Tag id={id} className="title" data-reveal={intro ? undefined : 'words'} data-intro={intro ? '' : undefined}>
      {out}
    </Tag>
  );
}

function Bar({ n, label, right }: { n: string; label: string; right: string }) {
  return (
    <div className="bar">
      <span>
        {n} / <b>{label}</b>
      </span>
      <span>{right}</span>
    </div>
  );
}

function CellBar({ label, note }: { label: string; note: string }) {
  return (
    <div className="cell-bar">
      <span>{label}</span>
      <span>{note}</span>
    </div>
  );
}

// Bewegtbild oder Standbild. Videos starten erst im Bild (Motion.tsx), das
// Standbild lädt kurz vor dem Erscheinen; bei reduzierter Bewegung bleibt es stehen.
function Media({ video, poster, src, alt, w, h }: { video?: string; poster?: string; src?: string; alt: string; w: number; h: number }) {
  if (video) return <video src={video} data-poster={poster} width={w} height={h} muted loop playsInline preload="none" data-autoplay="" aria-label={alt || undefined} />;
  return <img src={src} alt={alt} width={w} height={h} loading="lazy" decoding="async" />;
}

function Feature({ id, n, label, right, title, body, media, mediaLabel, mediaNote, items, flip = false }: {
  id: string;
  n: string;
  label: string;
  right: string;
  title: Part[];
  body: string;
  media: ReactNode;
  mediaLabel: string;
  mediaNote: string;
  items: Item[];
  flip?: boolean;
}) {
  return (
    <section className="sec" id={id} data-chapter={id} aria-labelledby={`${id}-title`}>
      <Bar n={n} label={label} right={right} />
      <div className="intro">
        <Title id={`${id}-title`} parts={title} />
        <p data-reveal="blur">{body}</p>
      </div>
      <div className={flip ? 'grid2 flip' : 'grid2'}>
        <article className="cell media" data-reveal="cell">
          <CellBar label={mediaLabel} note={mediaNote} />
          <div className="media-stage">
            <span className="media-rings" aria-hidden="true" />
            {media}
          </div>
        </article>
        <div className="stack">
          {items.map((it, k) => (
            <article key={it.title} className="cell feat" data-reveal="cell" style={{ '--d': k + 1 } as CSSProperties}>
              <CellBar label={it.tag} note={`0${k + 1}`} />
              <div className="feat-body">
                <h3>{it.title}</h3>
                <p>{it.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingV13({ lang }: { lang: Lang }) {
  const t = dicts[lang];
  const chapters = SECTION_IDS.map((id) => ({ id, label: t.chapters[id] }));
  const sectionNames: Record<string, string> = {
    live: t.live.label,
    clans: t.clans.label,
    shop: t.shop.label,
    heimat: t.heimat.label,
    sicherheit: t.safety.label,
    app: t.cta.label,
  };
  const scramble = [
    { lang: 'de', label: 'Deutsch', text: 'Hier sind deine Leute' },
    { lang: 'ru', label: 'Русский', text: 'Здесь твои люди' },
    { lang: 'en', label: 'English', text: 'Your people are here' },
  ];
  // Die Sprache der Seite steht vorn
  scramble.sort((a, b) => (a.lang === lang ? -1 : b.lang === lang ? 1 : 0));
  const shopNames = t.phones.live.chat.map((c) => c[0]);

  return (
    <div
      className={`sl ${archivo.variable} ${mono.variable} ${instrument.variable} ${cormorant.variable}`}
      lang={lang}
      data-testid="public-landing"
    >
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />

      <header className="nav">
        <a className="nav-logo" href="#start" aria-label={t.nav.home}>
          <Mark />
        </a>
        <nav className="nav-links" aria-label={t.nav.aria}>
          <a href="#live" data-nav="live">{t.nav.live}</a>
          <a href="#clans" data-nav="clans">{t.nav.clans}</a>
          <a href="#shop" data-nav="shop">{t.nav.shop}</a>
          <a href="#sicherheit" data-nav="sicherheit">{t.nav.safety}</a>
        </nav>
        <div className="nav-right">
          <LangSwitch lang={lang} label={t.nav.langs} />
          <Link className="nav-login" href={'/login' as Route}>
            {t.nav.login}
          </Link>
          <a className="nav-cta" href="#app">
            {t.nav.cta}
          </a>
        </div>
      </header>

      <main>
        <section className="hero" id="start" data-chapter="start" aria-labelledby="hero-title">
          <Halo tiles={tiles} />
          <div className="hero-core">
            <div className="wordmark" role="img" aria-label="Serlo">
              <Mark className="wm-mark" />
              <span className="wm-letters" aria-hidden="true">
                {'SERLO'.split('').map((c, j) => (
                  <span key={j} className="wm-ch" data-j={j} style={{ '--j': j } as CSSProperties}>
                    {c}
                  </span>
                ))}
              </span>
            </div>
            <Title as="h1" id="hero-title" intro parts={t.hero.title} />
            <p className="hero-lead" data-intro="">
              {t.hero.lead}
            </p>
            <div className="hero-cta" data-intro="">
              <a className="btn btn-solid" href={APP_STORE} target="_blank" rel="noreferrer">
                {t.hero.cta}
              </a>
              <Link className="btn btn-line" href={'/explore' as Route}>
                {t.hero.browser}
              </Link>
            </div>
            <p className="hero-meta" data-intro="">
              {t.hero.meta.map((m, i) => (
                <Fragment key={m}>
                  {i > 0 && <i>·</i>}
                  {m}
                </Fragment>
              ))}
            </p>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...t.marquee, ...t.marquee].map((m, k) => (
              <span key={k}>{m}</span>
            ))}
          </div>
        </div>

        <div className="frame">
          <Feature
            id="live"
            n="01"
            label={t.live.label}
            right={t.example}
            title={t.live.title}
            body={t.live.body}
            mediaLabel={t.live.media}
            mediaNote={t.exampleShort}
            media={<LivePhone t={t.phones.live} />}
            items={t.live.items}
          />

          <Feature
            id="clans"
            n="02"
            label={t.clans.label}
            right={t.example}
            flip
            title={t.clans.title}
            body={t.clans.body}
            mediaLabel={t.clans.media}
            mediaNote={t.exampleShort}
            media={<ClanPhone t={t.phones.clan} />}
            items={t.clans.items}
          />

          <Feature
            id="shop"
            n="03"
            label={t.shop.label}
            right={t.example}
            title={t.shop.title}
            body={t.shop.body}
            mediaLabel={t.shop.media}
            mediaNote={t.exampleShort}
            media={<ShopPhone t={t.phones.shop} names={shopNames} />}
            items={t.shop.items}
          />

          <section className="sec" id="heimat" data-chapter="heimat" aria-labelledby="heimat-title">
            <Bar n="04" label={t.heimat.label} right={t.heimat.right} />
            <div className="intro center">
              <Title id="heimat-title" parts={t.heimat.title} />
              <p data-reveal="blur">{t.heimat.body}</p>
            </div>
            <figure className="cell wide" data-reveal="cell">
              <CellBar label={t.heimat.band} note="01" />
              <div className="wide-img" data-lens="">
                <div className="lens">
                  <Media video="/landing/media/wolkenmeer-1280.mp4" poster="/landing/media/wolkenmeer-poster-960.webp" alt={t.heimat.bandAlt} w={1280} h={720} />
                </div>
              </div>
            </figure>
            <div className="gallery">
              {[
                { video: '/landing/media/schlucht-960.mp4', poster: '/landing/media/schlucht-poster-960.webp' },
                { video: '/landing/media/bergsee-960.mp4', poster: '/landing/media/bergsee-poster-960.webp' },
                { video: '/landing/media/wasserfall-960.mp4', poster: '/landing/media/wasserfall-poster-960.webp' },
              ].map((m, k) => (
                <figure key={m.video} className="cell" data-reveal="cell" style={{ '--d': k } as CSSProperties}>
                  <CellBar label={t.heimat.gallery[k].label} note={`0${k + 2}`} />
                  <div className="gallery-media" data-lens="">
                    <div className="lens">
                      <Media video={m.video} poster={m.poster} alt={t.heimat.gallery[k].alt} w={960} h={540} />
                    </div>
                  </div>
                </figure>
              ))}
            </div>
            <div className="langs">
              <div className="langs-head">
                <Title as="h3" parts={t.langs.title} />
                <p data-reveal="blur">{t.langs.body}</p>
              </div>
              <Scramble items={scramble} soon={{ label: 'Нохчийн', note: t.langs.soon }} group={t.langs.group} />
            </div>
          </section>

          <section className="sec" id="sicherheit" data-chapter="sicherheit" aria-labelledby="sicherheit-title">
            <Bar n="05" label={t.safety.label} right={t.safety.right} />
            <div className="safety-top">
              <div className="intro">
                <Title id="sicherheit-title" parts={t.safety.title} />
                <p data-reveal="blur">{t.safety.body}</p>
              </div>
              <figure className="cell photo" data-reveal="cell">
                <CellBar label={t.safety.photo} note={t.safety.photoNote} />
                <div className="photo-img" data-lens="">
                  <div className="lens">
                    <img src="/landing/art/tazbichi.webp" alt={t.safety.photoAlt} width={900} height={1200} loading="lazy" decoding="async" />
                  </div>
                </div>
              </figure>
            </div>
            <div className="grid3">
              {t.safety.items.map((it, k) => (
                <article key={it.tag} className="cell feat" data-reveal="cell" style={{ '--d': k } as CSSProperties}>
                  <CellBar label={it.tag} note={`0${k + 1}`} />
                  <div className="feat-body">
                    <h3>{it.title}</h3>
                    <p>{it.text}</p>
                    {k === 2 && (
                      <Link className="btn btn-line btn-small" href={'/kinderschutz' as Route}>
                        {t.safety.more}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="sec cta" id="app" data-chapter="app" aria-labelledby="app-title">
            <Bar n="06" label={t.cta.label} right={t.cta.right} />
            <div className="cta-bg" aria-hidden="true">
              <Media video="/landing/media/sternennacht-1280.mp4" poster="/landing/media/sternennacht-poster-960.webp" alt="" w={1280} h={720} />
            </div>
            <div className="cta-core">
              <Title id="app-title" parts={t.cta.title} />
              <p data-reveal="blur">{t.cta.body}</p>
              <div className="cta-row" data-reveal="up">
                <a className="store" href={APP_STORE} target="_blank" rel="noreferrer">
                  <img src="/badges/app-store-de.svg" alt={t.cta.storeAlt} width={144} height={48} />
                </a>
                <Link className="btn btn-line" href={'/explore' as Route}>
                  {t.cta.browser}
                </Link>
              </div>
              <div className="qr" data-reveal="up">
                <img src="/landing/app-qr.svg" alt={t.cta.qrAlt} width={88} height={88} />
                <p>
                  {t.cta.qr[0]}
                  <br />
                  {t.cta.qr[1]}
                </p>
              </div>
              <p className="cta-note">{t.cta.android}</p>
            </div>
          </section>
        </div>
      </main>

      <footer className="foot">
        <div className="foot-grid">
          <div className="foot-col foot-brand">
            <a className="foot-logo" href="#start" aria-label={t.nav.home}>
              <Mark />
              <span>serlo</span>
            </a>
            <p>{t.foot.about}</p>
          </div>
          <div className="foot-col">
            <h2>{t.foot.app}</h2>
            <ul>
              <li><a href={APP_STORE} target="_blank" rel="noreferrer">{t.foot.appStore}</a></li>
              <li><Link href={'/explore' as Route}>{t.foot.browser}</Link></li>
            </ul>
          </div>
          <div className="foot-col">
            <h2>{t.foot.legal}</h2>
            <ul>
              <li><Link href={'/imprint' as Route}>{t.foot.imprint}</Link></li>
              <li><Link href={'/privacy' as Route}>{t.foot.privacy}</Link></li>
              <li><Link href={'/terms' as Route}>{t.foot.terms}</Link></li>
              <li><Link href={'/kinderschutz' as Route}>{t.foot.child}</Link></li>
              <li><Link href={'/konto-loeschen' as Route}>{t.foot.remove}</Link></li>
            </ul>
          </div>
          <div className="foot-col">
            <h2>{t.foot.sections}</h2>
            <ul>
              {SECTION_IDS.slice(1).map((id) => (
                <li key={id}><a href={`#${id}`}>{sectionNames[id]}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <details className="foot-credits">
          <summary>{t.foot.credits}</summary>
          <ul className="credits">
            {credits.map((c) => (
              <li key={c.url}>
                {/* einziger Nachweis ist das Turmfoto; Titel in der Sprache der Seite */}
                <a href={c.url} target="_blank" rel="noreferrer">{lang === 'de' ? c.title : t.safety.photo}</a>
                <span>
                  {c.author} · <a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a>
                </span>
              </li>
            ))}
          </ul>
          <p className="credits-note">{t.foot.note}</p>
        </details>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} Serlo</span>
          <LangSwitch lang={lang} label={t.nav.langs} className="foot-lang" />
        </div>
      </footer>

      <Hud chapters={chapters} />
      <Motion />
    </div>
  );
}

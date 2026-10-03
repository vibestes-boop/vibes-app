'use client';

import { useRef, type PointerEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { ArrowDown, ArrowUpRight, MapPin, Plus, Search, SunMoon, Mountain } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

export function DiscoverToolbar() {
  const { t } = useI18n();
  return <header className="discover-toolbar">
    <Link href="/explore" className="discover-mobile-brand" aria-label="Serlo"><span>serlo<span>.</span></span></Link>
    <span className="discover-toolbar-title">{t('nav.explore')}<span>/</span><small>{t('explore.toolbarCommunity')}</small></span>
    <form action="/search" role="search" className="discover-search"><Search size={17} aria-hidden="true" /><input name="q" type="search" minLength={2} required aria-label={t('explore.searchPlaceholder')} placeholder={t('explore.searchPlaceholder')} /><button type="submit" aria-label={t('sidebar.searchAria')}><ArrowUpRight size={17} /></button></form>
    <ThemeToggle className="discover-theme-toggle" />
  </header>;
}

function ThemeToggle({ className }: { className: string }) {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  return <button type="button" className={className} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label={t('explore.themeToggle')} title={t('explore.themeToggle')}><SunMoon size={20} strokeWidth={1.6} /></button>;
}

export function DiscoverHero() {
  const { t } = useI18n();
  const hero = useRef<HTMLElement>(null);
  function move(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
    hero.current?.style.setProperty('--photo-x', `${(x - .5) * -12}px`);
    hero.current?.style.setProperty('--photo-y', `${(y - .5) * -8}px`);
    hero.current?.style.setProperty('--light-x', `${x * 100}%`);
  }
  function reset() {
    hero.current?.style.setProperty('--photo-x', '0px');
    hero.current?.style.setProperty('--photo-y', '0px');
    hero.current?.style.setProperty('--light-x', '80%');
  }
  return <section className="discover-hero" ref={hero} onPointerMove={move} onPointerLeave={reset} aria-labelledby="discover-title">
    <div className="discover-hero-photo"><Image src="/discover/sharoy.webp" alt={t('explore.heroAlt')} fill priority sizes="(max-width: 1279px) 100vw, (max-width: 1680px) calc(100vw - 290px), 1384px" /></div>
    <div className="discover-hero-light" aria-hidden="true" />
    <div className="discover-hero-copy">
      <p className="discover-hero-eyebrow"><Mountain size={17} strokeWidth={1.6} />{t('explore.heroEyebrow')}</p>
      <h1 id="discover-title">{t('explore.heroTitle')}<span>{t('explore.heroTitleAccent')}</span></h1>
      <p className="discover-hero-description">{t('explore.heroDescription')}</p>
      <div className="discover-hero-actions"><Link href="#community-posts" className="discover-primary-cta">{t('explore.heroCta')}<ArrowDown size={16} /></Link><Link href="/create" className="discover-secondary-cta"><Plus size={16} />{t('explore.heroShare')}</Link></div>
    </div>
    <div className="discover-location"><MapPin size={15} /><span>Шарой · Sharoy<small>{t('explore.location')}</small></span></div>
  </section>;
}

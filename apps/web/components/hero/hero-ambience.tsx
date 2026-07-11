'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

// -----------------------------------------------------------------------------
// HeroAmbience — dezenter Berg-Sound-Toggle im Landing-Hero.
//
// Browser erlauben Autoplay mit Ton NICHT (Scroll zaehlt ausdruecklich nicht
// als Nutzer-Geste) — der Klang startet deshalb per Klick. Genau das nutzen
// wir als Lazy-Loading: der ~1,4-MB-Loop wird erst beim ersten Start geladen.
//
// Entdeckbarkeit + Wiederkehr:
//  • Erstbesucher sehen fuer einige Sekunden einen Puls-Ring + Mini-Label
//    am Button (statt aufdringlichem Auto-Sound).
//  • Wer den Sound einmal eingeschaltet hat (localStorage-Opt-in), bekommt
//    ihn beim naechsten Besuch automatisch mit der ERSTEN echten Geste
//    (Tap/Klick irgendwo) wieder — die legale Variante von "beim Scrollen an".
// -----------------------------------------------------------------------------

const AMBIENCE_SRC = '/hero/mountain-ambience.m4a';
const TARGET_VOLUME = 0.35;
const OPTIN_KEY = 'serlo-ambience';
const HINT_MS = 8000;

export function HeroAmbience() {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const onRef = useRef(false);
  const [on, setOn] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    onRef.current = on;
  }, [on]);

  const fadeTo = (target: number, ms: number, then?: () => void) => {
    const a = audioRef.current;
    if (!a) return;
    if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
    const from = a.volume;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      a.volume = from + (target - from) * p;
      if (p < 1) fadeRef.current = requestAnimationFrame(step);
      else then?.();
    };
    fadeRef.current = requestAnimationFrame(step);
  };

  const startPlayback = () => {
    let a = audioRef.current;
    if (!a) {
      a = new Audio(AMBIENCE_SRC);
      a.loop = true;
      a.volume = 0;
      audioRef.current = a;
    }
    void a.play().catch(() => {});
    fadeTo(TARGET_VOLUME, 1500);
    setOn(true);
    setHint(false);
    try { localStorage.setItem(OPTIN_KEY, '1'); } catch { /* private mode */ }
  };

  const stopPlayback = () => {
    fadeTo(0, 450, () => audioRef.current?.pause());
    setOn(false);
    try { localStorage.setItem(OPTIN_KEY, '0'); } catch { /* private mode */ }
  };

  // Erstbesuch: Hinweis-Label + Puls zeigen. Wiederkehrer mit Opt-in:
  // beim ersten Tap/Klick irgendwo automatisch starten (echte Geste ->
  // play() ist erlaubt). Klick auf den Button selbst uebernimmt onClick.
  useEffect(() => {
    let optedIn = false;
    try { optedIn = localStorage.getItem(OPTIN_KEY) === '1'; } catch { /* private mode */ }

    if (!optedIn) {
      setHint(true);
      const timer = setTimeout(() => setHint(false), HINT_MS);
      return () => clearTimeout(timer);
    }

    const onFirstGesture = (e: Event) => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      if (onRef.current) return;
      if (btnRef.current && e.target instanceof Node && btnRef.current.contains(e.target)) return;
      startPlayback();
    };
    window.addEventListener('pointerdown', onFirstGesture);
    window.addEventListener('keydown', onFirstGesture);
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab in den Hintergrund -> pausieren; zurueck -> weiterspielen (wenn an).
  useEffect(() => {
    const onVis = () => {
      const a = audioRef.current;
      if (!a) return;
      if (document.hidden) a.pause();
      else if (on) void a.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [on]);

  // Unmount (Navigation weg von der Landing) -> Klang stoppen.
  useEffect(
    () => () => {
      if (fadeRef.current) cancelAnimationFrame(fadeRef.current);
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const label = on ? t('landing.soundOff') : t('landing.soundOn');
  const Icon = on ? Volume2 : VolumeX;

  const showHint = hint && !on;

  return (
    <div className="absolute bottom-5 right-5 z-10 flex items-center gap-2">
      {showHint && (
        <span className="pointer-events-none rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur-md">
          {t('landing.soundHint')}
        </span>
      )}
      <button
        ref={btnRef}
        type="button"
        onClick={on ? stopPlayback : startPlayback}
        aria-pressed={on}
        aria-label={label}
        title={label}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/75 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {showHint && (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-full bg-white/20 motion-reduce:hidden"
          />
        )}
        <Icon className="relative h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

// -----------------------------------------------------------------------------
// HeroAmbience — dezenter Berg-Sound-Toggle im Landing-Hero.
//
// Browser erlauben Autoplay mit Ton grundsaetzlich NICHT — der Klang startet
// deshalb erst auf Klick. Genau das nutzen wir als Lazy-Loading: das Audio-
// Element (und damit der ~1,4-MB-Loop) wird erst beim ersten Tap erzeugt.
// Vor dem Klick kostet der Button 0 Bytes Netz — Seite bleibt schnell, und
// bei schlechtem Internet laedt nichts Ungewolltes.
//
// Loop ist im File nahtlos vorgeschnitten (Crossfade beim Encoding).
// Sanfte Volume-Rampe rein/raus; Tab versteckt -> Pause.
// -----------------------------------------------------------------------------

const AMBIENCE_SRC = '/hero/mountain-ambience.m4a';
const TARGET_VOLUME = 0.35;

export function HeroAmbience() {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const [on, setOn] = useState(false);

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

  const toggle = () => {
    if (!on) {
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
    } else {
      fadeTo(0, 450, () => audioRef.current?.pause());
      setOn(false);
    }
  };

  const label = on ? t('landing.soundOff') : t('landing.soundOn');
  const Icon = on ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className="absolute bottom-5 right-5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/75 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

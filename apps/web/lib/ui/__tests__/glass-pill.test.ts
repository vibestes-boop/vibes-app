/**
 * @jest-environment node
 *
 * Unit-Tests für `lib/ui/glass-pill.ts` (v1.w.UI.13).
 *
 * Scope: verifiziert dass die zentralen Glass-Pill-Utilities alle kritischen
 * State-Selectors und Motion-Tokens enthalten. Die Tests sind bewusst simpel
 * String-Assertions — das Ziel ist einen Regression-Guard gegen versehentliche
 * Entfernung eines State-Selectors (z.B. jemand droppt `data-[state=open]`
 * bei einem Refactor und merkt nicht, dass der Dropdown-Open-Look dann tot ist).
 *
 * Keine Rendering-Tests: die Utilities sind reine String-Konstanten, und
 * TopRightActions ist eine async Server-Component (Awkward in RTL + benötigt
 * volle Auth-Session-Mocks). Visual-QA auf Vercel-Preview fängt den Rest.
 */

import {
  glassPillBase,
  glassAvatarFallback,
  glassPillStrong,
  glassSurface,
  glassSurfaceDense,
  glassPillSolid,
} from '@/lib/ui/glass-pill';

describe('glassPillBase', () => {
  it('enthält die Surface-Basis (bg-black/40 + ring-white/10 + backdrop-blur-md)', () => {
    expect(glassPillBase).toContain('bg-black/40');
    expect(glassPillBase).toContain('ring-1');
    expect(glassPillBase).toContain('ring-white/10');
    expect(glassPillBase).toContain('backdrop-blur-md');
  });

  it('nutzt duration-base + ease-out-expo als Motion-Kurve (v1.w.UI.1 Tokens)', () => {
    expect(glassPillBase).toContain('transition-colors');
    expect(glassPillBase).toContain('duration-base');
    expect(glassPillBase).toContain('ease-out-expo');
  });

  it('definiert Hover-State mit höherer Bg-/Ring-Opacity', () => {
    expect(glassPillBase).toContain('hover:bg-black/60');
    expect(glassPillBase).toContain('hover:ring-white/20');
  });

  it('spiegelt Hover-State auf Radix-Open-State (data-[state=open])', () => {
    // Kritisch: ohne diese Selectors würde der Avatar-Dropdown-Trigger nach
    // dem Klick visuell wieder in den Ruhezustand zurückfallen, obwohl das
    // Dropdown offen ist.
    expect(glassPillBase).toContain('data-[state=open]:bg-black/60');
    expect(glassPillBase).toContain('data-[state=open]:ring-white/20');
  });

  it('override den Focus-Ring für schwebende Elemente (kein ring-offset)', () => {
    // Globale Baseline in globals.css setzt `ring-offset-2 ring-offset-background`
    // — auf einem schwebenden Glass-Pill sieht das aus als wäre der Pill zweigeteilt.
    // Explizites `ring-offset-0`-Override hier ist das Mittel dagegen.
    expect(glassPillBase).toContain('focus-visible:outline-none');
    expect(glassPillBase).toContain('focus-visible:ring-2');
    expect(glassPillBase).toContain('focus-visible:ring-white/50');
    expect(glassPillBase).toContain('focus-visible:ring-offset-0');
  });

  it('ist ein einzeiliger String ohne Leer-Segmente', () => {
    expect(typeof glassPillBase).toBe('string');
    expect(glassPillBase.length).toBeGreaterThan(0);
    // Keine double-spaces (Indikator für versehentlich leer gefallene Array-Items)
    expect(glassPillBase).not.toMatch(/\s{2,}/);
    // Kein trailing whitespace
    expect(glassPillBase).toBe(glassPillBase.trim());
  });
});

describe('glassAvatarFallback', () => {
  it('nutzt halb-transparentes Weiß statt opakem bg-muted', () => {
    // Der shadcn-AvatarFallback-Default ist `bg-muted` (opaque) — auf der
    // Glass-Pill-Oberfläche würde das als Button-Stamp wirken. `bg-white/10`
    // erbt die Transparenz-Ästhetik des umgebenden Pills.
    expect(glassAvatarFallback).toContain('bg-white/10');
    expect(glassAvatarFallback).not.toContain('bg-muted');
    expect(glassAvatarFallback).not.toContain('bg-zinc-800');
  });

  it('hält Text-Farbe & Weight konsistent mit Pill-Interior', () => {
    expect(glassAvatarFallback).toContain('text-white/90');
    expect(glassAvatarFallback).toContain('font-medium');
    expect(glassAvatarFallback).toContain('text-sm');
  });
});

describe('glassPillStrong (v1.w.UI.14 — interactive über Video-Canvas)', () => {
  it('ist dichter als glassPillBase (bg-black/55 statt /40)', () => {
    // Über dem Live-Video-Canvas reicht /40 nicht — helle Daylight-Frames
    // lassen den Pill sonst verschwinden. /55 + /75-Hover gibt mehr Kontrast
    // ohne den Glass-Look zu brechen.
    expect(glassPillStrong).toContain('bg-black/55');
    expect(glassPillStrong).not.toContain('bg-black/40');
  });

  it('erbt Ring + Blur-Rezeptur von glassPillBase', () => {
    expect(glassPillStrong).toContain('ring-1');
    expect(glassPillStrong).toContain('ring-white/10');
    expect(glassPillStrong).toContain('backdrop-blur-md');
  });

  it('nutzt stärkeren Hover (bg-black/75) für Video-Canvas-Kontrast', () => {
    expect(glassPillStrong).toContain('hover:bg-black/75');
    expect(glassPillStrong).toContain('hover:ring-white/20');
  });

  it('spiegelt Hover auf data-[state=open] wie glassPillBase', () => {
    expect(glassPillStrong).toContain('data-[state=open]:bg-black/75');
    expect(glassPillStrong).toContain('data-[state=open]:ring-white/20');
  });

  it('behält Motion-Tokens + Focus-Override (konsistent mit glassPillBase)', () => {
    expect(glassPillStrong).toContain('transition-colors');
    expect(glassPillStrong).toContain('duration-base');
    expect(glassPillStrong).toContain('ease-out-expo');
    expect(glassPillStrong).toContain('focus-visible:ring-offset-0');
  });
});

describe('glassSurface (v1.w.UI.14 — non-interaktiver Wrapper)', () => {
  it('hat Surface ohne Interactivity-Tokens', () => {
    // Poll-Wrapper und Action-Bar-Wrapper stylen ihre Kinder selbst — die
    // Hülle trägt nur Glass-Surface. Kein Transition, kein Hover, kein Focus:
    // der Wrapper ist nicht direkt interaktiv.
    expect(glassSurface).toContain('bg-black/55');
    expect(glassSurface).toContain('ring-1');
    expect(glassSurface).toContain('ring-white/10');
    expect(glassSurface).toContain('backdrop-blur-md');
  });

  it('hat KEINE Hover/Focus/Transition-Tokens (non-interaktiv)', () => {
    expect(glassSurface).not.toContain('hover:');
    expect(glassSurface).not.toContain('focus-visible:');
    expect(glassSurface).not.toContain('transition');
    expect(glassSurface).not.toContain('data-[state=');
  });

  it('setzt keinen Text-Color-Default (Kinder bestimmen Typo)', () => {
    // glassPillBase setzt `text-white` als Default — Surface lässt die Wahl
    // beim Konsumenten. Poll-Panel und Action-Bar haben eigene Text-Colors.
    expect(glassSurface).not.toContain('text-white');
  });
});

describe('glassSurfaceDense (v1.w.UI.14 — content-dense Islands)', () => {
  it('ist dichter als glassSurface (bg-black/70)', () => {
    // Viewer-Count-Pill + LiveHostPill-Wrapper tragen kleine Texte/Icons
    // (11px + 3×3 Icons). Auf komplexen Video-Frames braucht das /70-BG
    // für Lesbarkeit.
    expect(glassSurfaceDense).toContain('bg-black/70');
  });

  it('behält Ring + Blur-Rezeptur', () => {
    expect(glassSurfaceDense).toContain('ring-1');
    expect(glassSurfaceDense).toContain('ring-white/10');
    expect(glassSurfaceDense).toContain('backdrop-blur-md');
  });

  it('ist wie glassSurface non-interaktiv (kein Hover/Focus/Transition)', () => {
    expect(glassSurfaceDense).not.toContain('hover:');
    expect(glassSurfaceDense).not.toContain('focus-visible:');
    expect(glassSurfaceDense).not.toContain('transition');
    expect(glassSurfaceDense).not.toContain('data-[state=');
  });
});

describe('glassPillSolid (v1.w.UI.15 — primäre Video-Controls)', () => {
  it('ist maximal dicht (bg-black/80 statt /55 oder /40)', () => {
    // Mute + Fullscreen im LiveVideoPlayer müssen aus Armlänge auf jedem
    // Szenen-Hintergrund erkennbar sein. /80 ist die Antwort auf den in
    // v1.w.UI.1-B4 dokumentierten „Buttons gingen auf hellen Daylight-
    // Szenen unter"-Regress.
    expect(glassPillSolid).toContain('bg-black/80');
    expect(glassPillSolid).not.toContain('bg-black/55');
    expect(glassPillSolid).not.toContain('bg-black/40');
  });

  it('erbt Ring + Blur-Rezeptur von der restlichen Glass-Familie', () => {
    expect(glassPillSolid).toContain('ring-1');
    expect(glassPillSolid).toContain('ring-white/10');
    expect(glassPillSolid).toContain('backdrop-blur-md');
  });

  it('nutzt /95-Hover für klaren Affordance-Shift (fast vollschwarz)', () => {
    expect(glassPillSolid).toContain('hover:bg-black/95');
    expect(glassPillSolid).toContain('hover:ring-white/20');
  });

  it('spiegelt Hover auf data-[state=open] (konsistent mit Base/Strong)', () => {
    expect(glassPillSolid).toContain('data-[state=open]:bg-black/95');
    expect(glassPillSolid).toContain('data-[state=open]:ring-white/20');
  });

  it('behält Motion-Tokens + Focus-Override', () => {
    expect(glassPillSolid).toContain('transition-colors');
    expect(glassPillSolid).toContain('duration-base');
    expect(glassPillSolid).toContain('ease-out-expo');
    expect(glassPillSolid).toContain('focus-visible:ring-offset-0');
  });
});

describe('Glass-Utility-Familie — Konsistenz-Checks', () => {
  it('alle fünf Varianten sind nicht-leere Strings', () => {
    expect(glassPillBase.length).toBeGreaterThan(0);
    expect(glassPillStrong.length).toBeGreaterThan(0);
    expect(glassPillSolid.length).toBeGreaterThan(0);
    expect(glassSurface.length).toBeGreaterThan(0);
    expect(glassSurfaceDense.length).toBeGreaterThan(0);
  });

  it('alle Varianten trimmen sauber (keine double-spaces, kein trailing WS)', () => {
    for (const cls of [
      glassPillBase,
      glassPillStrong,
      glassPillSolid,
      glassSurface,
      glassSurfaceDense,
    ]) {
      expect(cls).not.toMatch(/\s{2,}/);
      expect(cls).toBe(cls.trim());
    }
  });

  it('alle Varianten nutzen backdrop-blur-md als gemeinsame Glass-Signatur', () => {
    // Der Blur ist das kennzeichnende Merkmal — ohne ihn ist es kein Glass.
    for (const cls of [
      glassPillBase,
      glassPillStrong,
      glassPillSolid,
      glassSurface,
      glassSurfaceDense,
    ]) {
      expect(cls).toContain('backdrop-blur-md');
    }
  });

  it('Dichte-Skala interaktiv: Base (/40) < Strong (/55) < Solid (/80)', () => {
    // Guard damit niemand versehentlich die Dichte-Hierarchie umdreht
    // (z.B. Base auf /60 bumpt und damit überlappt mit Strong).
    expect(glassPillBase).toContain('bg-black/40');
    expect(glassPillStrong).toContain('bg-black/55');
    expect(glassPillSolid).toContain('bg-black/80');
  });
});

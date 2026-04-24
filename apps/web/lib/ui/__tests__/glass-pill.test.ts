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

import { glassPillBase, glassAvatarFallback } from '@/lib/ui/glass-pill';

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

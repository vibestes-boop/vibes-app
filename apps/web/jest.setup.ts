// -----------------------------------------------------------------------------
// Post-environment Setup (apps/web).
//
// Läuft nach jsdom + Jest-Framework. Hier kommen Matcher-Extensions und
// globale Stubs rein die das jsdom-Modell komplettieren.
// -----------------------------------------------------------------------------

import '@testing-library/jest-dom';

// IntersectionObserver existiert in jsdom nicht. FeedList beobachtet Karten
// darüber, um den "aktiven" Post zu bestimmen. Wir stubben mit einer No-op
// Implementation — Tests die echte Intersection-Events brauchen müssen sich
// ihren eigenen Mock injizieren.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// ResizeObserver ebenfalls — einige Radix/Framer-Komponenten rufen ihn am
// Mount. Same No-op.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// matchMedia Stub — next-themes und Tailwind-Breakpoints rufen's am Mount.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// sonner (Toast) — nicht mocken, aber Test-Umgebung muss `window.HTMLElement`
// nicht speziell patchen. Wenn eine Assertion Toast-Text prüft, muss das
// Test-File selbst auf sonner zugreifen.

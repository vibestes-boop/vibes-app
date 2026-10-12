// Gemeinsamer Scroll-Zustand für alle Bewegungs-Bausteine (ein Lenis, ein Takt).
import type Lenis from 'lenis';

export type ScrollState = {
  y: number;
  vh: number;
  max: number;
  progress: number;
  velocity: number;
  chapter: number;
  docked: boolean;
};

const state: ScrollState = { y: 0, vh: 0, max: 0, progress: 0, velocity: 0, chapter: 0, docked: false };
const subs = new Set<(s: ScrollState) => void>();
let lenis: Lenis | null = null;

export const getState = () => state;

export function setState(patch: Partial<ScrollState>) {
  Object.assign(state, patch);
  subs.forEach((fn) => fn(state));
}

export function subscribe(fn: (s: ScrollState) => void) {
  subs.add(fn);
  fn(state);
  return () => {
    subs.delete(fn);
  };
}

export const getLenis = () => lenis;
export const setLenis = (l: Lenis | null) => {
  lenis = l;
};

export function scrollToY(y: number) {
  if (lenis) lenis.scrollTo(y, { duration: 1.4 });
  else window.scrollTo({ top: y });
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

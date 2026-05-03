/**
 * fonts.ts — Font-Loading für Serlo Remotion-Compositions
 *
 * Lädt Inter (700/800/900) via Google Fonts + delayRender/continueRender,
 * damit alle Frames erst gerendert werden wenn die Fonts verfügbar sind.
 *
 * Aufruf: einmalig in src/index.ts:
 *   import { loadFonts } from './lib/fonts';
 *   loadFonts();
 *
 * Font-Variablen (für CSS):
 *   --font-sans:    Inter — Fließtext, Labels, UI
 *   --font-display: Inter — Headlines, große Zahlen
 *
 * Wenn Remotion offline rendert (kein Internet), fällt es auf System-Fonts zurück.
 * Für Production-Renders: Font-Dateien lokal ablegen (siehe unten).
 */

import { delayRender, continueRender, cancelRender } from 'remotion';

// ─── Font-Stacks ──────────────────────────────────────────────────────────────

/** Inter + System-Fallbacks — für alle Texte */
export const FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Inter mit Display-Tuning für große Headlines */
export const FONT_DISPLAY =
  "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";

// ─── Google Fonts URL ─────────────────────────────────────────────────────────

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';

// ─── Loader ───────────────────────────────────────────────────────────────────

let fontsLoaded = false;
let renderHandle: ReturnType<typeof delayRender> | null = null;

/**
 * Initialisiert den Font-Loader.
 * Muss EINMALIG beim Start von index.ts aufgerufen werden — vor dem Rendering.
 *
 * In Remotion Studio: Fonts werden on-demand geladen.
 * In render-Skripten: Wartet bis Fonts geladen sind (via delayRender).
 */
export function loadFonts(): void {
  // Server-Umgebung (Node.js ohne DOM) — überspringen
  if (typeof document === 'undefined') return;
  // Schon geladen — nichts tun
  if (fontsLoaded) return;

  renderHandle = delayRender('Loading Inter font from Google Fonts');

  // Preconnect für schnelleres Laden
  appendLink({ rel: 'preconnect', href: 'https://fonts.googleapis.com' });
  appendLink({ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' });

  // Stylesheet
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_URL;

  link.onload = () => {
    fontsLoaded = true;
    if (renderHandle !== null) {
      continueRender(renderHandle);
      renderHandle = null;
    }
  };

  link.onerror = (e) => {
    // Nicht fatal — Render läuft mit System-Fonts weiter
    console.warn('[Serlo Fonts] Google Fonts konnte nicht geladen werden, nutze System-Fonts.', e);
    fontsLoaded = true;
    if (renderHandle !== null) {
      continueRender(renderHandle);
      renderHandle = null;
    }
  };

  document.head.appendChild(link);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function appendLink(attrs: {
  rel: string;
  href: string;
  crossOrigin?: string;
}): void {
  if (document.querySelector(`link[href="${attrs.href}"]`)) return;
  const link = document.createElement('link');
  link.rel = attrs.rel;
  link.href = attrs.href;
  if (attrs.crossOrigin) link.crossOrigin = attrs.crossOrigin;
  document.head.appendChild(link);
}

// ─── Lokale Fonts (Optional für Offline-Renders) ──────────────────────────────
//
// Für zuverlässige CI/CD-Renders ohne Google-Fonts-Abhängigkeit:
//
// 1. Inter von https://fonts.google.com/specimen/Inter herunterladen
// 2. Dateien unter public/fonts/ ablegen:
//    public/fonts/Inter-Regular.woff2
//    public/fonts/Inter-Medium.woff2
//    public/fonts/Inter-SemiBold.woff2
//    public/fonts/Inter-Bold.woff2
//    public/fonts/Inter-ExtraBold.woff2
//    public/fonts/Inter-Black.woff2
//
// 3. Dann diese Funktion statt loadFonts() nutzen:
//
// export function loadLocalFonts(): void {
//   const style = document.createElement('style');
//   style.textContent = `
//     @font-face {
//       font-family: 'Inter';
//       font-weight: 400;
//       src: url(${staticFile('fonts/Inter-Regular.woff2')}) format('woff2');
//     }
//     @font-face {
//       font-family: 'Inter';
//       font-weight: 700;
//       src: url(${staticFile('fonts/Inter-Bold.woff2')}) format('woff2');
//     }
//     @font-face {
//       font-family: 'Inter';
//       font-weight: 900;
//       src: url(${staticFile('fonts/Inter-Black.woff2')}) format('woff2');
//     }
//   `;
//   document.head.appendChild(style);
// }

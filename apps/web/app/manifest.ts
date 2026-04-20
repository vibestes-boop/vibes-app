import type { MetadataRoute } from 'next';

// -----------------------------------------------------------------------------
// Web-App-Manifest — erlaubt Install-to-Homescreen auf iOS/Android/Desktop,
// Standalone-Mode (ohne Browser-Chrome) und liefert Theme-Info für die
// OS-Splashscreens.
//
// Der `start_url` ist absichtlich auf „/?utm_source=pwa" gesetzt — so können
// wir in PostHog sehen, wie viele Sessions aus dem installierten PWA-Kontext
// kommen. Das erleichtert das Tracken der Feature-Adoption ohne zusätzlichen
// Code.
//
// Icons zeigen auf `/icon-*.png` in `/public/` — die PNGs sind Placeholder
// und müssen vor Go-Live durch echte Brand-Assets ersetzt werden.
// Falls sie fehlen, liefert Next.js automatisch `app/icon.svg` als Fallback
// (siehe Next 15 App-Router-Konvention).
// -----------------------------------------------------------------------------

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Serlo — Live, Feed, Shop',
    short_name: 'Serlo',
    description:
      'Serlo — die Social-Video-Plattform. Live-Streaming, Community-Feed und Marktplatz.',
    start_url: '/?utm_source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'de',
    dir: 'ltr',
    background_color: '#050508',
    theme_color: '#050508',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['social', 'entertainment', 'shopping'],
    shortcuts: [
      {
        name: 'Feed',
        url: '/',
        description: 'Direkt in den For-You-Feed springen.',
      },
      {
        name: 'Live',
        url: '/live',
        description: 'Aktive Live-Streams entdecken.',
      },
      {
        name: 'Neues Video',
        url: '/create',
        description: 'Ein neues Video erstellen.',
      },
      {
        name: 'Messages',
        url: '/messages',
        description: 'Deine Direktnachrichten öffnen.',
      },
    ],
  };
}

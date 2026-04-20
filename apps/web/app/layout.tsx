import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Toaster } from 'sonner';

import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { PostHogProvider } from '@/providers/posthog-provider';
import { SiteHeader } from '@/components/site-header';
import { ConsentBanner } from '@/components/consent/consent-banner';
import { AnalyticsConsentGate } from '@/components/consent/analytics-consent-gate';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default:  'Serlo — Live, Feed, Shop',
    template: '%s · Serlo',
  },
  description:
    'Serlo — die Social-Video-Plattform. Live-Streaming vom PC, Marktplatz für Händler, Community-Feed.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    type:      'website',
    siteName:  'Serlo',
    locale:    'de_DE',
  },
  twitter: {
    // Default-Card für alle Pages ohne eigenes `generateMetadata`-Twitter-Override.
    // `summary_large_image` ist das sicherste Default — Text-only-Pages fallen
    // auf das Default-OG-Image zurück, Video/Product/Live-Pages setzen
    // individuell ihre eigenen (player / summary_large_image).
    card:    'summary_large_image',
    site:    '@serloapp',
    creator: '@serloapp',
  },
  robots: {
    index:  true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5F5' },
    { media: '(prefers-color-scheme: dark)',  color: '#050508' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <Suspense fallback={null}>
              <PostHogProvider>
                {/*
                 * Skip-to-Content-Link (WCAG 2.4.1 Bypass Blocks). Per Default
                 * visuell via `sr-only` versteckt, springt bei Keyboard-Focus
                 * (Tab von Top) sichtbar oben-links herein. Ziel ist das
                 * `#main-content` Wrapper-Element unten, das dank `tabIndex={-1}`
                 * programmatisch fokussierbar ist (ohne in die Tab-Reihenfolge
                 * aufgenommen zu werden).
                 */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  Zum Hauptinhalt springen
                </a>
                <SiteHeader />
                {/*
                 * `id="main-content"` ist das Skip-Link-Target. KEIN `<main>`-
                 * Tag hier, weil einzelne Pages (settings, studio, shop, explore,
                 * search, u/[username], s/[storyId]) eigene `<main>`-Landmarks
                 * haben — nested `<main>` wäre invalid HTML und Duplicate-
                 * Landmark-Warning in Axe. `tabIndex={-1}` macht den Div zum
                 * programmatischen Focus-Target ohne ihn in die normale
                 * Tab-Reihenfolge zu hängen.
                 */}
                <div id="main-content" tabIndex={-1} className="outline-none">
                  {children}
                </div>
                <AnalyticsConsentGate />
                <ConsentBanner />
                <ServiceWorkerRegistrar />
              </PostHogProvider>
            </Suspense>
            <Toaster position="top-right" richColors />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

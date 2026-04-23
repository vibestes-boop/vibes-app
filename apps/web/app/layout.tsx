import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { PostHogProvider } from '@/providers/posthog-provider';
import { SiteHeader } from '@/components/site-header';
import { ConsentBanner } from '@/components/consent/consent-banner';
import { AnalyticsConsentGate } from '@/components/consent/analytics-consent-gate';
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { getUser, getProfile } from '@/lib/auth/session';
import { I18nProvider } from '@/lib/i18n/client';
import { getI18n } from '@/lib/i18n/server';
import { LOCALE_HTML_LANG } from '@/lib/i18n/config';

import './globals.css';

/**
 * Inter als Primary-Font über next/font/google. next/font/google bündelt
 * das Font-File self-hosted (keine externen font.googleapis-Requests zur
 * Runtime, damit kein CLS durch externe Font-Latency und kein GDPR-Thema
 * durch Google-Server-Hit).
 *
 * `variable: '--font-inter'` setzt eine CSS-Var, die wir im <html>-Root
 * mounten und in tailwind.config.ts als ersten Eintrag in `fontFamily.sans`
 * referenzieren. So erbt jeder Tailwind-Utility (`font-sans`, Default auf
 * `<body>`) automatisch Inter, mit System-Font-Stack als Fallback falls die
 * Font gerade lädt oder blockiert wird.
 *
 * `display: 'swap'` — Fallback-Text rendert sofort, wird bei Font-Ready
 * ausgetauscht. Kein FOIT (Flash of Invisible Text).
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
  // Nur die tatsächlich genutzten Gewichte laden — die Typography-Hierarchie
  // braucht 400 (Body), 500 (Label), 600 (Subhead), 700 (Heading/CTA).
  weight: ['400', '500', '600', '700'],
});

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // i18n: Cookie → Locale → Messages. Muss synchron in der RSC-Pass laufen
  // damit der initial Render bereits die richtigen Übersetzungen zeigt
  // (kein Flash-of-Untranslated-Content beim Client-Mount).
  const { locale, messages } = await getI18n();

  // Mobile-Bottom-Nav braucht Auth-State + Profile-Href für den „Profil"-Slot.
  // Beide Lookups sind in der RSC-Pass günstig gecacht (getUser liest den
  // Supabase-Cookie-Session-Check, getProfile ist nur nötig wenn eingeloggt).
  // Fallback-Href `/onboarding` deckt den Edge-Case ab, dass ein Account
  // existiert aber noch keinen `username` hat.
  const bottomNavUser = await getUser();
  const bottomNavProfile = bottomNavUser ? await getProfile() : null;
  const profileHref = bottomNavProfile?.username
    ? `/u/${bottomNavProfile.username}`
    : '/onboarding';
  return (
    <html
      lang={LOCALE_HTML_LANG[locale]}
      suppressHydrationWarning
      className={inter.variable}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider locale={locale} messages={messages}>
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
                 *
                 * `pb-[...]` unter md: verhindert, dass die letzte Scroll-Zeile
                 * einer Seite unter der fixed MobileBottomNav verschwindet.
                 * Kombiniert die Tab-Bar-Höhe (h-14 = 3.5rem) mit der iOS-
                 * Safe-Area (`env(safe-area-inset-bottom)`).
                 */}
                <div
                  id="main-content"
                  tabIndex={-1}
                  className="outline-none pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
                >
                  {children}
                </div>
                <MobileBottomNav
                  isAuthed={!!bottomNavUser}
                  profileHref={profileHref}
                />
                <AnalyticsConsentGate />
                <ConsentBanner />
                <ServiceWorkerRegistrar />
              </PostHogProvider>
            </Suspense>
            <Toaster position="top-right" richColors />
          </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

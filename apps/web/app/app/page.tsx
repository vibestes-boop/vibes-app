import type { Metadata } from 'next';

import { getT } from '@/lib/i18n/server';
import { AppStoreRedirect } from './redirect';

// -----------------------------------------------------------------------------
// /app — teilbarer App-Store-Link mit Serlo-Branding.
//
// Problem: Der rohe apps.apple.com-Link unfurlt in WhatsApp/Telegram mit
// Apples generischer Vorschau (kein Logo, kein Marken-Text). Diese Seite
// liefert eigene OG-Tags (+ opengraph-image.tsx daneben) und leitet Menschen
// client-seitig in den App Store weiter.
//
// → Zum Teilen IMMER https://www.serlo.ch/app verwenden, nicht den Apple-Link.
// -----------------------------------------------------------------------------

const APP_STORE_URL = 'https://apps.apple.com/app/serlo/id6760790424';

// Metadata bewusst statisch deutsch — Crawler senden keinen Locale-Cookie,
// und ein stabiles Unfurl ist wichtiger als Übersetzung (wie überall im Web).
export const metadata: Metadata = {
  title: 'Serlo — Jetzt im App Store',
  description: 'Videos, Live-Streams & Marktplatz aus der Community. Lade Serlo kostenlos für dein iPhone.',
  openGraph: {
    title: 'Serlo — Jetzt im App Store',
    description: 'Videos, Live-Streams & Marktplatz aus der Community.',
    url: 'https://www.serlo.ch/app',
    siteName: 'Serlo',
    type: 'website',
  },
};

export default async function AppSharePage() {
  const t = await getT();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0a12] px-6 text-center">
      <AppStoreRedirect url={APP_STORE_URL} />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="Serlo" className="h-24 w-24 rounded-[22%] shadow-2xl shadow-purple-900/40" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white">{t('landing.appShareTitle')}</h1>
        <p className="text-sm text-white/60">{t('landing.appShareSub')}</p>
      </div>

      <a href={APP_STORE_URL} className="mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/badges/app-store-de.svg" alt={t('landing.appShareCta')} className="h-12 w-auto" />
      </a>

      <p className="text-xs text-white/35">{t('landing.appShareRedirect')}</p>
    </main>
  );
}

import type { MetadataRoute } from 'next';

// -----------------------------------------------------------------------------
// /robots.txt — generiert von Next.js aus diesem File.
// Wichtig: /settings, /onboarding, /auth/callback vom Crawl ausschließen —
// sind authentifizierte / transient Routes.
// -----------------------------------------------------------------------------

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/u/', '/p/'],
        disallow: [
          '/api/',
          '/auth/',
          '/settings',
          '/onboarding',
          '/s/',          // Stories sind ephemer — keine Indexierung.
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

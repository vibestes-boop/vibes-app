import type { MetadataRoute } from 'next';

// -----------------------------------------------------------------------------
// /robots.txt — generiert von Next.js aus diesem File.
//
// Explizit erlaubt: alle öffentlichen Discovery-Seiten.
// Explizit verboten: Auth-transiente und nutzerspezifische Bereiche.
//
// Hinweis: Ohne `Disallow: /` gilt alles Nicht-Disallowed als crawlbar.
// Die `allow`-Einträge dienen als eindeutiger Signal-Layer für Googlebots
// longest-match-Algorithmus — besonders wichtig wenn im gleichen Segment
// öffentliche und private Sub-Routen koexistieren (z.B. /settings vs /).
// -----------------------------------------------------------------------------

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/u/',       // Public profiles + /u/[username]/shop
          '/p/',       // Post detail pages
          '/explore',  // Discovery
          '/shop/',    // Product catalog + detail pages
          '/live',     // Live listing
          '/guilds',   // Pod discovery
          '/t/',       // Hashtag pages
          '/g/',       // Guild detail pages
          '/terms',
          '/privacy',
          '/imprint',
        ],
        disallow: [
          '/api/',
          '/auth/',
          '/settings',  // Auth-gated — enthält billing/notifications/etc.
          '/onboarding',
          '/studio',    // Creator-only, kein SEO-Wert
          '/create',    // Upload-Flow, kein SEO-Wert
          '/messages',  // Private DMs
          '/following', // Per-User-Feed
          '/saved',     // Bookmarks, per-User
          '/notifications', // Per-User
          '/coin-shop', // Checkout — kein indexierbarer Wert
          '/s/',        // Stories sind ephemer
          '/stories/',  // Story-Creator/-Viewer
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

// -----------------------------------------------------------------------------
// Zentrale Web-URLs fürs Teilen NACH AUSSEN (WhatsApp/Telegram/Instagram/…).
//
// WICHTIG: Nur diese https-Links zur LIVE-Web-Domain unfurlen mit Vorschaubild
// (serlo-web hat OG-Tags + gebrandete OG-Bilder). `vibes://`-Deeplinks und tote/
// alte Domains (vibes.app, vibes-web-nine.vercel.app) erzeugen in Messengern nur
// nackten Text ohne Vorschau. Pfade müssen den Web-Routen entsprechen:
//   Post/Video → /p/<id>   (NICHT /post/)
//   Produkt    → /shop/<id>
//   Profil     → /u/<username>
// -----------------------------------------------------------------------------

export const WEB_BASE = 'https://serlo-web.vercel.app';

export const webPostUrl = (postId: string) => `${WEB_BASE}/p/${postId}`;
export const webProductUrl = (productId: string) => `${WEB_BASE}/shop/${productId}`;
export const webProfileUrl = (username: string) => `${WEB_BASE}/u/${username}`;

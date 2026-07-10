'use client';

import { useEffect } from 'react';

// Client-seitige Weiterleitung in den App Store. BEWUSST kein server-seitiges
// redirect(): Link-Crawler (WhatsApp/Telegram) würden dem 3xx zu Apple folgen
// und deren Vorschau ziehen — diese Seite muss mit 200 + eigenen OG-Tags
// antworten, damit das Serlo-Unfurl erscheint. Menschen leitet der Effekt um.
export function AppStoreRedirect({ url }: { url: string }) {
  useEffect(() => {
    const t = setTimeout(() => window.location.replace(url), 400);
    return () => clearTimeout(t);
  }, [url]);
  return null;
}

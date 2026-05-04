'use client';

import { useEffect } from 'react';

// -----------------------------------------------------------------------------
// <ServiceWorkerRegistrar /> — registriert `/sw.js` einmalig beim ersten Mount
// auf dem Client.
//
//  - Läuft NUR in Production (`process.env.NODE_ENV === 'production'`), damit
//    Dev-Reloads nicht durch gecachte Chunks verwirrt werden.
//  - Keine automatische Update-Prompt-UI — bei neuer SW-Version greift die
//    `skipWaiting()`-Logik im SW, und der nächste Page-Reload holt die frische
//    Version. Wer mehr will, kann später ein „Reload"-Toast via `controllerchange`
//    hinzufügen.
//
// Consent-Relevanz: Der SW speichert nur ein Offline-Page-Fallback + Icons +
// JS/CSS-Chunks der App. Keine User-Daten, keine Tracking-Events. Daher kein
// separates Consent-Gate notwendig (analog zu Browser-Standards wie HTTP-Cache).
// -----------------------------------------------------------------------------

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Manifest + Service Worker erst nach dem Load-Event einhängen. Lighthouse
    // hatte `/manifest.webmanifest` sonst im initialen Network-Dependency-Tree;
    // Installability bleibt erhalten, aber sie konkurriert nicht mit LCP.
    const afterLoad = () => {
      if (!document.querySelector('link[rel="manifest"]')) {
        const manifest = document.createElement('link');
        manifest.rel = 'manifest';
        manifest.href = '/manifest.webmanifest';
        document.head.appendChild(manifest);
      }

      if (process.env.NODE_ENV !== 'production') return;
      if (!('serviceWorker' in navigator)) return;

      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          // Silent fail — SW-Registrierung ist Progressive Enhancement, kein
          // Blocker. In Dev/Tools-Situationen (Privat-Modus, Disable-SW-Flag)
          // ist der Fehler erwartbar.
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[SW] Registrierung fehlgeschlagen:', err);
          }
        });
    };

    if (document.readyState === 'complete') {
      afterLoad();
    } else {
      window.addEventListener('load', afterLoad, { once: true });
      return () => window.removeEventListener('load', afterLoad);
    }
  }, []);

  return null;
}

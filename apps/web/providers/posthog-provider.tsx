'use client';

/**
 * PostHog-Provider — Consent-First-Load (v1.w.12.5).
 *
 * -----------------------------------------------------------------------------
 * Verhalten VORHER (bis v1.w.12.4):
 *   Top-Level `import posthog from 'posthog-js'` → Bundle-Chunk ging in jeden
 *   Client-Bundle, und `posthog.init()` lief im ersten `useEffect` — VOR dem
 *   AnalyticsConsentGate. Unter DSGVO: First-Ping + Bundle-Fetch ohne
 *   Consent → grenzwertig; unter strenger Auslegung (Belgien/Frankreich-DPA):
 *   bereits Verstoß.
 *
 * Verhalten JETZT:
 *   - posthog-js wird erst DYNAMISCH importiert (eigener Chunk), nachdem
 *     `hasAnalyticsConsent() === true` gilt. Vor Opt-In: 0 bytes PostHog,
 *     0 Netzwerk-Requests.
 *   - Listener auf `serlo:consent-change` CustomEvent: wenn User im Banner
 *     „Analytics erlaubt" klickt, wird in dieser Session lazy-geladen und
 *     initialisiert — kein Reload nötig.
 *   - Wenn User später auf „Analytics verbieten" wechselt, rufen wir
 *     `posthog.opt_out_capturing()` + setzen ein lokales Flag, damit wir
 *     nicht weiter capturen (kompletter Reset und Lib-Unload wäre SPA-
 *     technisch nicht trivial und würde 1 Reload sparen — pragmatischer
 *     Trade-off).
 *   - Page-View-Tracking weiterhin manuell (Next App Router triggert kein
 *     `popstate`), aber gated hinter `loaded && consent`.
 *
 * Bundle-Effekt:
 *   posthog-js (~55kb gz) wandert aus dem entry-Bundle in einen eigenen
 *   async chunk der nur auf Consent geladen wird. Für Erst-Besucher ohne
 *   Consent-Entscheidung: First-Paint-JS deutlich kleiner.
 * -----------------------------------------------------------------------------
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { hasAnalyticsConsent, onConsentChange } from '@/lib/consent';

// posthog-js-Typen ohne den Laufzeit-Import. Wir brauchen nur ein paar
// Method-Signaturen — `any` wäre billiger, aber der strict-Mode frisst
// das nicht sauber durch alle Call-Sites.
type PostHogLib = typeof import('posthog-js').default;

export function PostHogProvider({ children }: { children?: ReactNode }) {
  const phRef = useRef<PostHogLib | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [consentOk, setConsentOk] = useState(false);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // -------------------------------------------------------------------------
  // Consent-Listener + initiale Evaluation
  //
  // Eintritt: (a) bereits gesetzter Consent auf Page-Load, (b) erst gerade
  // im Banner bestätigt, (c) später wieder entzogen.
  // -------------------------------------------------------------------------
  useEffect(() => {
    setConsentOk(hasAnalyticsConsent());
    const unsub = onConsentChange((state) => {
      const next = state?.analytics === true;
      setConsentOk(next);
      if (!next && phRef.current) {
        // User hat Analytics deaktiviert → stop capturing. Lib selbst bleibt
        // geladen (SPA-Unload wäre Overkill), aber es werden keine Events
        // mehr raus geschickt.
        try {
          phRef.current.opt_out_capturing();
        } catch {
          // best-effort
        }
      } else if (next && phRef.current) {
        // Re-Opt-In: captures wieder an, Lib ist schon geladen.
        try {
          phRef.current.opt_in_capturing();
        } catch {
          // best-effort
        }
      }
    });
    return unsub;
  }, []);

  // -------------------------------------------------------------------------
  // Lazy-Init nach Consent.
  //
  // Läuft genau einmal pro Session beim ersten Consent=true. Der zweite
  // Guard (`loaded`) schützt gegen Re-Init wenn der User den Consent
  // toggelt.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!consentOk) return;
    if (loaded) return;

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
    if (!key) return;

    let cancelled = false;
    (async () => {
      try {
        // Dynamic-Import — erzeugt einen separaten Webpack/Turbopack-Chunk,
        // der NICHT im initialen Bundle landet.
        const mod = await import('posthog-js');
        if (cancelled) return;
        const posthog = mod.default;

        if (!posthog.__loaded) {
          posthog.init(key, {
            api_host: host,
            capture_pageview: false, // manuell, siehe Route-Effect
            capture_pageleave: true,
            persistence: 'localStorage+cookie',
            person_profiles: 'identified_only',
          });
        }
        phRef.current = posthog;
        setLoaded(true);
      } catch {
        // Import-Fail (Netzwerk, Adblock) ist non-fatal — die App läuft
        // komplett ohne PostHog weiter.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [consentOk, loaded]);

  // -------------------------------------------------------------------------
  // Page-View-Tracking — gated hinter loaded && consentOk.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!loaded || !consentOk) return;
    const ph = phRef.current;
    if (!ph) return;
    const url = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
    try {
      ph.capture('$pageview', { $current_url: url });
    } catch {
      // best-effort
    }
  }, [pathname, searchParams, loaded, consentOk]);

  return children ? <>{children}</> : null;
}

/**
 * Cookie-/Tracking-Consent — client-side, DSGVO-konform.
 *
 * Drei Kategorien:
 *   - essential: IMMER true (Session-Cookies, CSRF, Auth — ohne geht die App nicht)
 *   - analytics: PostHog, Produkt-Analytics
 *   - marketing: Conversion-Pixel, Remarketing (aktuell keine aktiv, Platzhalter)
 *
 * Persistenz: localStorage. Entscheidung ist mit Version gekoppelt — wenn wir
 * später die Kategorien ändern, bumpen wir `CONSENT_VERSION` und der Banner
 * erscheint erneut.
 *
 * Kein SSR-Zugriff: alle Helpers checken `typeof window !== 'undefined'`.
 */

export const CONSENT_VERSION = 1;
const STORAGE_KEY = 'serlo:consent:v1';
const EVENT = 'serlo:consent-change';

export interface ConsentState {
  version: number;
  decidedAt: string; // ISO
  essential: true;
  analytics: boolean;
  marketing: boolean;
}

export type ConsentChoices = Omit<ConsentState, 'version' | 'decidedAt' | 'essential'>;

/**
 * Liest den aktuellen Consent-State aus localStorage.
 * Returns null wenn noch keine Entscheidung getroffen wurde oder Version veraltet.
 */
export function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (typeof parsed.decidedAt !== 'string') return null;
    return {
      version: CONSENT_VERSION,
      decidedAt: parsed.decidedAt,
      essential: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
    };
  } catch {
    return null;
  }
}

/**
 * Schreibt eine Consent-Entscheidung und triggert ein Custom-Event damit
 * Listener (z.B. PostHog-Gate) reagieren können.
 */
export function writeConsent(choices: ConsentChoices): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    essential: true,
    analytics: choices.analytics,
    marketing: choices.marketing,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
    } catch {
      // noop — localStorage geblockt (Privacy-Modus etc.)
    }
  }
  return state;
}

/**
 * Zurücksetzen — Banner erscheint beim nächsten Reload wieder.
 */
export function resetConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
  } catch {
    // noop
  }
}

/**
 * Subscription-API für Reaktionen auf Consent-Änderungen.
 */
export function onConsentChange(
  listener: (state: ConsentState | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ConsentState | null>).detail;
    listener(detail);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/**
 * Convenience: hat der User Analytics erlaubt?
 */
export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

/**
 * Convenience: hat der User Marketing erlaubt?
 */
export function hasMarketingConsent(): boolean {
  return readConsent()?.marketing === true;
}

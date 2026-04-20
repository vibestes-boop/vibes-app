'use client';

// -----------------------------------------------------------------------------
// <AnalyticsConsentGate /> — Legacy-Wrapper, ab v1.w.12.5 No-Op.
//
// Historie:
//   Pre-v1.w.12.5 hat der PostHog-Provider die Lib immer statisch importiert
//   und initialisiert, und dieser Gate darüber per `opt_out_capturing()` die
//   Events blockiert. Seit v1.w.12.5 macht der Provider selbst den Consent-
//   First-Load: posthog-js wird per `await import('posthog-js')` DYNAMISCH
//   erst nach Consent geladen, und der Consent-Zustand wird im Provider
//   direkt verarbeitet (opt_in / opt_out bei Consent-Change).
//
// Diese Komponente bleibt als Legacy-Wrapper bestehen, damit existierende
// Einbindungen (z.B. `<AnalyticsConsentGate />` in `app/layout.tsx`) nicht
// brechen. Sie importiert posthog-js NICHT mehr — damit der Lazy-Chunk-
// Vorteil des neuen Providers nicht durch einen parallelen Top-Level-Import
// zerstört wird (Webpack würde posthog-js sonst in den gemeinsamen Client-
// Bundle wieder reinziehen).
//
// Entfernen kann man die Komponente sobald alle Call-Sites im Repo refactored
// sind. Bis dahin: stumm.
// -----------------------------------------------------------------------------

export function AnalyticsConsentGate() {
  return null;
}

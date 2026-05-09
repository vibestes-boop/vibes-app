'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { ShieldCheck, X } from 'lucide-react';

import {
  readConsent,
  writeConsent,
  onConsentChange,
} from '@/lib/consent';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// <ConsentBanner /> — DSGVO-konformer Cookie-Banner.
//
// Design-Grundsätze:
//   - Nur der Banner selbst rendert wenn noch keine Entscheidung vorliegt
//   - „Ablehnen" ist gleichwertig zu „Akzeptieren" (keine Dark-Pattern)
//   - Auswahl-Seite für granulare Toggles ist optional aufklappbar
//   - Footer-Link „Cookie-Einstellungen" forciert erneute Anzeige (global Event)
//
// Listener-Pattern: andere Consent-abhängige Systeme (PostHog, Pixel) registrieren
// sich via `onConsentChange()` und reagieren auf die Entscheidung.
// -----------------------------------------------------------------------------

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [marketingOn, setMarketingOn] = useState(false);
  const pathname = usePathname();
  const compactImmersiveBanner =
    !showDetails &&
    (pathname?.startsWith('/live/') || pathname?.startsWith('/s/'));

  // Mount: Entscheidung aus localStorage lesen — wenn null, Banner zeigen
  useEffect(() => {
    const existing = readConsent();
    if (!existing) {
      setVisible(true);
    }
    // Subscribe für externe „Neu öffnen"-Events (Footer-Link)
    const unsub = onConsentChange((state) => {
      if (state === null) {
        // reset → Banner erneut zeigen
        setVisible(true);
        setShowDetails(false);
      } else {
        setVisible(false);
      }
    });
    return () => unsub();
  }, []);

  const commit = (choices: { analytics: boolean; marketing: boolean }) => {
    writeConsent(choices);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
      className={cn(
        'fixed z-50 rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-lg',
        compactImmersiveBanner
          ? 'inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] p-2.5 md:inset-x-auto md:bottom-4 md:left-4 md:max-w-[360px] xl:bottom-5 xl:left-5'
          : 'inset-x-2 bottom-2 mx-auto max-w-3xl p-4 sm:inset-x-4 sm:p-5',
      )}
    >
      <div className={cn('flex items-start gap-3', compactImmersiveBanner && 'items-center')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold',
            compactImmersiveBanner ? 'hidden h-9 w-9 sm:flex' : 'h-10 w-10',
          )}
        >
          <ShieldCheck className={compactImmersiveBanner ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="consent-title"
            className={cn('font-semibold', compactImmersiveBanner ? 'text-sm' : 'text-base')}
          >
            Cookies & Datenschutz
          </h2>
          <p
            id="consent-desc"
            className={cn(
              'mt-1 text-muted-foreground',
              compactImmersiveBanner ? 'hidden text-xs sm:block' : 'text-sm',
            )}
          >
            {compactImmersiveBanner
              ? 'Essenzielle Cookies halten Login und Sicherheit am Laufen. Analytics nur mit Zustimmung.'
              : 'Wir nutzen technisch notwendige Cookies, damit Login, Session und Sicherheit funktionieren. Für Produkt-Analytics und Marketing brauchen wir deine Einwilligung. Die Wahl kannst du jederzeit in den Einstellungen ändern.'}
          </p>

          {showDetails && (
            <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-muted/40 p-3">
              <Row
                title="Essenziell"
                description="Session-Cookies, Anti-CSRF, Login-State. Ohne diese funktioniert die Plattform nicht."
                checked
                disabled
              />
              <Row
                title="Analytics"
                description="PostHog — anonymisierte Feature-Nutzung für Produktverbesserungen. EU-Hosting."
                checked={analyticsOn}
                onChange={setAnalyticsOn}
              />
              <Row
                title="Marketing"
                description="Conversion-Pixel und Remarketing. Aktuell inaktiv — du kannst dies vorab erlauben."
                checked={marketingOn}
                onChange={setMarketingOn}
              />
            </div>
          )}

          <div
            className={cn(
              'flex items-center justify-between gap-2',
              compactImmersiveBanner
                ? 'mt-2 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden'
                : 'mt-4 flex-wrap',
            )}
          >
            <Link
              href={'/privacy' as Route}
              className={cn(
                'shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline',
                compactImmersiveBanner && 'hidden sm:inline',
              )}
            >
              Datenschutzerklärung
            </Link>

            <div className={cn('flex items-center gap-2', (!compactImmersiveBanner || showDetails) && 'flex-wrap', compactImmersiveBanner && 'md:flex-wrap')}>
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted sm:px-3"
              >
                {showDetails ? 'Zusammenklappen' : compactImmersiveBanner ? 'Details' : 'Details anzeigen'}
              </button>
              <button
                type="button"
                onClick={() => commit({ analytics: false, marketing: false })}
                className="shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted sm:px-3"
              >
                {compactImmersiveBanner ? 'Essenziell' : 'Nur essenziell'}
              </button>
              {showDetails ? (
                <button
                  type="button"
                  onClick={() =>
                    commit({ analytics: analyticsOn, marketing: marketingOn })
                  }
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:px-3"
                >
                  Auswahl speichern
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => commit({ analytics: true, marketing: true })}
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:px-3"
                >
                  {compactImmersiveBanner ? 'Akzeptieren' : 'Alle akzeptieren'}
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => commit({ analytics: false, marketing: false })}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Banner schließen und nur essenzielle Cookies akzeptieren"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Toggle-Row ──────────────────────────────────────────────────────────

function Row({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors',
          checked
            ? 'bg-brand-gold/90 border-brand-gold'
            : 'bg-muted',
          disabled && 'cursor-not-allowed opacity-80',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">
          {title}
          {disabled && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[9px] uppercase tracking-wider">
              immer aktiv
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}

// ─── Footer-Link-Helper: öffne Banner erneut ───────────────────────────

export function OpenConsentSettingsButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        // Reset triggert Custom-Event → Banner remountet
        import('@/lib/consent').then((m) => m.resetConsent());
      }}
      className={className}
    >
      {children ?? 'Cookie-Einstellungen'}
    </button>
  );
}

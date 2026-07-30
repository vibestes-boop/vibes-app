'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useI18n, useOptionalI18n } from '@/lib/i18n/client';

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
  const { t } = useI18n();
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

  // Der Banner schwebt (position: fixed) über dem Inhalt. Auf reinen Textseiten
  // — Impressum, Datenschutz, AGB, Widerruf, Kinderschutz, Konto löschen —
  // verdeckte er dadurch dauerhaft die untersten Zeilen, bis man ihn wegklickt.
  // Lösung: die eigene Höhe messen und als CSS-Variable bereitstellen; nur
  // `article.prose` reserviert diesen Platz (globals.css). Vollbild-Layouts wie
  // der Feed bleiben unberührt, weil sie die Variable nicht verwenden.
  const bannerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bannerRef.current;
    const root = document.documentElement;
    if (!visible || !el) {
      root.style.setProperty('--consent-banner-h', '0px');
      return;
    }
    const apply = () => {
      root.style.setProperty('--consent-banner-h', `${Math.ceil(el.getBoundingClientRect().height) + 24}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--consent-banner-h', '0px');
    };
  }, [visible, showDetails]);

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
      className={cn(
        'fixed z-50 rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-lg',
        compactImmersiveBanner
          ? 'inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] p-2.5 md:inset-x-auto md:bottom-4 md:left-4 md:max-w-[360px] xl:bottom-5 xl:left-5'
          : 'inset-x-3 bottom-3 mx-auto max-h-[42dvh] max-w-2xl overflow-y-auto p-3 sm:inset-x-4 sm:max-h-none sm:p-5',
      )}
    >
      <div className={cn('flex items-start gap-3', compactImmersiveBanner && 'items-center')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-foreground',
            compactImmersiveBanner ? 'hidden h-9 w-9 sm:flex' : 'hidden h-10 w-10 sm:flex',
          )}
        >
          <ShieldCheck className={compactImmersiveBanner ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="consent-title"
            className={cn('font-semibold', compactImmersiveBanner ? 'text-sm' : 'text-base')}
          >
            {t('consent.title')}
          </h2>
          <p
            id="consent-desc"
            className={cn(
              'mt-1 text-muted-foreground',
              compactImmersiveBanner ? 'hidden text-xs sm:block' : 'line-clamp-2 text-xs leading-5 sm:line-clamp-none sm:text-sm',
            )}
          >
            {compactImmersiveBanner ? t('consent.descCompact') : t('consent.descFull')}
          </p>

          {showDetails && (
            <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-muted/40 p-3">
              <Row
                title={t('consent.rowEssential')}
                description={t('consent.rowEssentialDesc')}
                alwaysActiveLabel={t('consent.alwaysActive')}
                checked
                disabled
              />
              <Row
                title={t('consent.rowAnalytics')}
                description={t('consent.rowAnalyticsDesc')}
                checked={analyticsOn}
                onChange={setAnalyticsOn}
              />
              <Row
                title={t('consent.rowMarketing')}
                description={t('consent.rowMarketingDesc')}
                checked={marketingOn}
                onChange={setMarketingOn}
              />
            </div>
          )}

          <div
            className={cn(
              'gap-2',
              compactImmersiveBanner
                ? 'mt-2 flex items-center justify-between overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden'
                : 'mt-3 grid grid-cols-2 sm:mt-4 sm:flex sm:items-center sm:justify-between sm:flex-wrap',
            )}
          >
            <Link
              href={'/privacy' as Route}
              className={cn(
                'shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline',
                compactImmersiveBanner && 'hidden sm:inline',
              )}
            >
              {t('consent.privacyPolicy')}
            </Link>

            <div className={cn('col-span-2 grid grid-cols-2 gap-2 sm:flex sm:items-center', (!compactImmersiveBanner || showDetails) && 'sm:flex-wrap', compactImmersiveBanner && 'md:flex-wrap')}>
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="col-span-2 shrink-0 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted sm:col-span-1 sm:py-1.5 sm:px-3"
              >
                {showDetails ? t('consent.collapse') : compactImmersiveBanner ? t('consent.details') : (
                  <>
                    <span className="sm:hidden">{t('consent.details')}</span>
                    <span className="hidden sm:inline">{t('consent.detailsShow')}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => commit({ analytics: false, marketing: false })}
                className="shrink-0 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium hover:bg-muted sm:py-1.5 sm:px-3"
              >
                {compactImmersiveBanner ? t('consent.essentialShort') : (
                  <>
                    <span className="sm:hidden">{t('consent.essentialShort')}</span>
                    <span className="hidden sm:inline">{t('consent.essentialOnly')}</span>
                  </>
                )}
              </button>
              {showDetails ? (
                <button
                  type="button"
                  onClick={() =>
                    commit({ analytics: analyticsOn, marketing: marketingOn })
                  }
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:py-1.5 sm:px-3"
                >
                  {t('consent.saveSelection')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => commit({ analytics: true, marketing: true })}
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:py-1.5 sm:px-3"
                >
                  {compactImmersiveBanner ? t('consent.accept') : (
                    <>
                      <span className="sm:hidden">{t('consent.accept')}</span>
                      <span className="hidden sm:inline">{t('consent.acceptAll')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => commit({ analytics: false, marketing: false })}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label={t('consent.closeAria')}
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
  alwaysActiveLabel,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  /** Badge-Text für die deaktivierte Essenziell-Zeile (i18n vom Aufrufer). */
  alwaysActiveLabel?: string;
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
            ? 'bg-primary border-primary'
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
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">
              {alwaysActiveLabel ?? 'immer aktiv'}
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
  // useOptionalI18n: der Button lebt im Footer — falls er je außerhalb des
  // I18nProviders gerendert wird, fällt er auf den deutschen Text zurück.
  const i18n = useOptionalI18n();
  return (
    <button
      type="button"
      onClick={() => {
        // Reset triggert Custom-Event → Banner remountet
        import('@/lib/consent').then((m) => m.resetConsent());
      }}
      className={className}
    >
      {children ?? i18n?.t('consent.settings') ?? 'Cookie-Einstellungen'}
    </button>
  );
}

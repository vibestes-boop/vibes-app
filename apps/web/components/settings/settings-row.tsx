import type { ReactNode, ComponentType } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// <SettingsRow /> — v1.w.UI.18 D7.
//
// Apple-Settings/TikTok-Style flache Listen-Row mit Icon + Label + optionalem
// Subtitle + entweder ChevronRight (wenn navigierbar via `href`) oder einem
// rechten Slot (z.B. ThemeToggle, Locale-Label, Coming-Soon-Badge).
//
// Varianten-Design:
//   - "default" (implizit): normale Nav-Row
//   - "destructive": rot gefärbter Label + Icon, für Logout / Delete-Account
//   - "disabled": dimm + `aria-disabled`, kein `href` — für Features die noch
//     nicht gebaut sind (z.B. Profil-Editor = Phase 11), mit `right=<ComingSoon>`
//
// Render-Entscheidung: Wenn `href` gesetzt ist UND nicht disabled → `<Link>`,
// sonst `<div>`. Das erlaubt Rows die ausschließlich ein rechtes Control haben
// (z.B. ThemeToggle-Switch) ohne dass die ganze Row klickbar wird — der User
// klickt den Toggle direkt, nicht die Zeile.
// -----------------------------------------------------------------------------

export type SettingsRowVariant = 'default' | 'destructive';

export interface SettingsRowProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  subtitle?: string;
  /**
   * Wenn gesetzt → rendert als `<Link>`, ganze Row ist ein Navigations-Target
   * mit ChevronRight rechts. Wenn null/undefined → statische Row (für
   * Toggle-only Rows wie ThemeToggle, oder disabled-Rows).
   */
  href?: Route;
  /**
   * Rechter Slot. ChevronRight wird NICHT gerendert wenn `right` gesetzt ist.
   * Nutze dies für Inline-Controls (ThemeToggle), Info-Labels (`Deutsch`),
   * oder Status-Badges (ComingSoon).
   */
  right?: ReactNode;
  variant?: SettingsRowVariant;
  disabled?: boolean;
  /**
   * Optional: eigener `data-testid`. Wir setzen per default
   * `settings-row-{label}` slugified, aber das ist brüchig für i18n — in
   * Tests reichen wir lieber stabile ASCII-ids durch.
   */
  testId?: string;
}

export function SettingsRow({
  icon: Icon,
  label,
  subtitle,
  href,
  right,
  variant = 'default',
  disabled = false,
  testId,
}: SettingsRowProps) {
  const isDestructive = variant === 'destructive';
  const showChevron = !!href && !right && !disabled;

  // Gemeinsame Klassen zwischen Link-Row und Static-Row. Hover + Transition
  // nur für die Link-Variante (statische Rows sollen nicht „klickbar wirken").
  const baseClass = cn(
    'flex items-center gap-3 px-4 py-3 text-sm',
    // Destructive: Label + Icon rot. Hintergrund bleibt transparent; nur beim
    // Link-Hover wird er sanft rötlich (unten).
    isDestructive && 'text-red-600 dark:text-red-400',
    disabled && 'opacity-50 pointer-events-none select-none',
  );

  const interactiveClass = cn(
    'transition-colors duration-base ease-out-expo',
    isDestructive
      ? 'hover:bg-red-500/10 focus-visible:bg-red-500/10'
      : 'hover:bg-muted/60 focus-visible:bg-muted/60',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );

  const content = (
    <>
      <Icon
        className={cn(
          'h-5 w-5 shrink-0',
          isDestructive ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
        )}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'truncate font-medium',
            isDestructive ? 'text-red-600 dark:text-red-400' : 'text-foreground',
          )}
        >
          {label}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {right && (
        <div className="shrink-0 text-sm text-muted-foreground" data-settings-row-right>
          {right}
        </div>
      )}
      {showChevron && (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={cn(baseClass, interactiveClass)}
        data-testid={testId ?? `settings-row-link`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={baseClass}
      aria-disabled={disabled || undefined}
      data-testid={testId ?? `settings-row-static`}
    >
      {content}
    </div>
  );
}

// -----------------------------------------------------------------------------
// <ComingSoonBadge /> — kleines Rechts-Slot-Label für Rows die noch nicht
// aktivierbar sind. Bleibt bewusst dezent (muted-foreground, border-muted),
// damit sie nicht wie ein CTA aussieht.
// -----------------------------------------------------------------------------
export function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  );
}

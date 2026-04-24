'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// <ThemeToggleInline /> — v1.w.UI.18 D7.
//
// Kompakter Two-Tab-Switch für die Settings-Overview (rechter Slot der
// SettingsRow „Design"). Kein Dropdown wie im MoreMenu — auf einer Settings-
// Overview ist „klick auf die aktive Seite" schnellste Interaktion.
//
// Hydration-Safety: `next-themes` rendered SSR ein Placeholder weil die
// `theme`-Ref aus localStorage kommt. Wir gaten den visuellen Active-State
// hinter einem `mounted`-Flag — auf dem Server ist beides neutral, nach
// Hydration springt der richtige Tab aktiv. Das ist das Standard-Pattern aus
// der `next-themes`-Doku gegen das „flash of wrong theme"-Problem.
// -----------------------------------------------------------------------------

export interface ThemeToggleInlineProps {
  lightLabel: string;
  darkLabel: string;
}

export function ThemeToggleInline({ lightLabel, darkLabel }: ThemeToggleInlineProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <div
      role="radiogroup"
      aria-label={`${lightLabel} / ${darkLabel}`}
      data-testid="settings-theme-toggle"
      className="inline-flex items-center gap-1 rounded-full bg-muted p-0.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mounted ? !isDark : undefined}
        onClick={() => setTheme('light')}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-base ease-out-expo',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          mounted && !isDark
            ? 'bg-background text-foreground shadow-elevation-1'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        {lightLabel}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mounted ? isDark : undefined}
        onClick={() => setTheme('dark')}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-base ease-out-expo',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          mounted && isDark
            ? 'bg-background text-foreground shadow-elevation-1'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        {darkLabel}
      </button>
    </div>
  );
}

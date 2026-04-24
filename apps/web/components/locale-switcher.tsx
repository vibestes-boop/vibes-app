'use client';

// Locale-Switcher für den Avatar-Dropdown. Wird als DropdownMenuSub gerendert
// (verschachteltes Menü mit den 4 Sprachen). Klick → Server Action → Cookie
// gesetzt → Pfad revalidiert → Header re-rendert mit neuen Strings.
//
// Wir nutzen Radix' `DropdownMenuSub` statt eines Modals/Sheets weil der
// Switcher tief in einem bestehenden Dropdown lebt — ein Modal daraus zu
// öffnen würde den Dropdown schließen und den Fokus-Flow brechen.

import { usePathname, useRouter } from 'next/navigation';
import { Check, Languages } from 'lucide-react';
import { useTransition } from 'react';

import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { setLocale } from '@/app/actions/locale';
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type Locale,
} from '@/lib/i18n/config';
import { useI18n } from '@/lib/i18n/client';

export function LocaleSwitcher() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: Locale) {
    if (next === locale) return;
    // `startTransition` markiert den Server-Action-Call als non-blocking —
    // das Dropdown bleibt responsive, und React gibt uns `isPending` um
    // parallele Klicks visuell zu unterdrücken falls nötig.
    startTransition(async () => {
      await setLocale(next, pathname);
      // Next.js-15-Quirk: `revalidatePath('/', 'layout')` im Action invalidiert
      // den Server-Cache, aber der Client-Router merkt nicht zuverlässig dass
      // er die aktuelle Route neu fetchen muss — insbesondere wenn die Cookie-
      // Änderung nur Context-Werte beeinflusst (I18nProvider), keine URL.
      // `router.refresh()` zwingt einen RSC-Re-Fetch → Layout liest neuen
      // Cookie via `getI18n()` → I18nProvider mountet mit neuen Messages.
      router.refresh();
    });
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={isPending}>
        <Languages className="h-4 w-4" />
        <span>{t('menu.language')}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        {/*
         * v1.w.UI.13: min-w-52 (vorher 44) damit die längsten Native-Namen
         * (z.B. „Нохчийн") nebst der Parenthese nicht drücken; plus flex-
         * Spalte-Struktur für das Label-Pair damit der Native-Name visuell
         * über der deutschen Übersetzung steht — auf schmalen Viewports
         * lesbarer als ein Einzel-Zeilen-Label mit Klammer-Suffix.
         */}
        <DropdownMenuSubContent className="min-w-52">
          {SUPPORTED_LOCALES.map((code) => {
            const label = LOCALE_LABELS[code];
            const active = code === locale;
            return (
              <DropdownMenuItem
                key={code}
                onSelect={(e) => {
                  // Default verhindern — Radix schließt sonst das ganze Menü.
                  e.preventDefault();
                  handleSelect(code);
                }}
                className="cursor-pointer"
              >
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium leading-tight">{label.native}</span>
                  <span className="text-xs leading-tight text-muted-foreground">{label.de}</span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

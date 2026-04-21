'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { cn } from '@/lib/utils';
import type { Period } from '@/lib/data/studio';
import { useI18n } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

// -----------------------------------------------------------------------------
// PeriodTabs — 7T/28T/90T Selector, Pusht `?period=<n>` zum aktuellen Pfad.
//
// - Verwendet Plain-Links statt Button + router.push, damit der Selector ohne
//   JS funktioniert (Progressive Enhancement). Next wechselt die Page serverseitig
//   und der Cache respektiert den neuen Suchparameter.
// - Behält alle anderen Query-Params (sort, filter) bei, falls die einbettende
//   Seite welche nutzt.
// - Labels kommen aus dem i18n-Tree (`studio.period7/28/90`) — der Selector
//   läuft in allen vier Locales ohne Sub-Changes.
// -----------------------------------------------------------------------------

interface Props {
  period: Period;
  basePath: string;
}

const OPTIONS: Array<{ value: Period; labelKey: TranslationKey }> = [
  { value: 7, labelKey: 'studio.period7' },
  { value: 28, labelKey: 'studio.period28' },
  { value: 90, labelKey: 'studio.period90' },
];

export function PeriodTabs({ period, basePath }: Props) {
  const sp = useSearchParams();
  const { t } = useI18n();

  const build = (p: Period) => {
    const params = new URLSearchParams(sp.toString());
    params.set('period', String(p));
    return `${basePath}?${params.toString()}` as Route;
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1">
      {OPTIONS.map((o) => {
        const active = o.value === period;
        return (
          <Link
            key={o.value}
            href={build(o.value)}
            scroll={false}
            aria-pressed={active}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors tabular-nums',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(o.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}

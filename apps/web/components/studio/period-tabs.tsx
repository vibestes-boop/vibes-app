'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { cn } from '@/lib/utils';
import type { Period } from '@/lib/data/studio';

// -----------------------------------------------------------------------------
// PeriodTabs — 7T/28T/90T Selector, Pusht `?period=<n>` zum aktuellen Pfad.
//
// - Verwendet Plain-Links statt Button + router.push, damit der Selector ohne
//   JS funktioniert (Progressive Enhancement). Next wechselt die Page serverseitig
//   und der Cache respektiert den neuen Suchparameter.
// - Behält alle anderen Query-Params (sort, filter) bei, falls die einbettende
//   Seite welche nutzt.
// -----------------------------------------------------------------------------

interface Props {
  period: Period;
  basePath: string;
}

const OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 7, label: '7 Tage' },
  { value: 28, label: '28 Tage' },
  { value: 90, label: '90 Tage' },
];

export function PeriodTabs({ period, basePath }: Props) {
  const sp = useSearchParams();

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
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Flame, ChevronRight } from 'lucide-react';

import { useI18n } from '@/lib/i18n/client';
import { RollupNumber } from '@/components/ui/rollup-number';
import type { ActivePreorderRound } from '@/lib/data/shop';

// -----------------------------------------------------------------------------
// PreorderRoundCard — Web-Parität zur mobilen GuildRoundCard. Zeigt die laufende
// Sammelbestellungs-Runde als warme, handlungsleitende Karte. Kernzweck:
// WhatsApp→Web-NEUKUNDEN (oft anonym) landen auf serlo.ch/shop/[id] und sehen
// jetzt Fortschritt + Deadline + „Jetzt vorbestellen" — vorher unsichtbar.
//
// Kauf-Flow bleibt komplett in der BuyBar der Produktseite; die Karte navigiert
// nur dorthin (oder ist auf der Produktseite selbst reines Info-Panel).
// -----------------------------------------------------------------------------

function formatDeadline(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return null;
  return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function PreorderRoundCard({
  round,
  href,
}: {
  round: ActivePreorderRound;
  /** Wenn gesetzt, ist die ganze Karte ein Link (z.B. Shop-Liste → Produkt).
   *  Auf der Produktseite selbst weglassen → statisches Info-Panel. */
  href?: Route;
}) {
  const { t, locale } = useI18n();

  const target = round.target_qty > 0 ? round.target_qty : 1;
  const reserved = Math.max(0, round.reserved_qty);
  const pct = Math.min(100, Math.round((reserved / target) * 100));
  const goalReached = reserved >= target;
  const deadline = formatDeadline(round.closes_at, locale);
  const title = round.title ?? round.product?.title ?? '';

  const inner = (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.04] p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          <Flame className="h-3.5 w-3.5" />
          {t('shop.round.badge')}
        </span>
        {href && <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />}
      </div>

      {title && <div className="mt-2 text-sm font-semibold text-foreground">{title}</div>}

      {/* Fortschritt */}
      <div
        className="mt-3 flex items-baseline gap-1 text-sm font-semibold text-foreground"
        aria-label={t('shop.round.reservedOfTarget', { reserved, target })}
      >
        <RollupNumber value={reserved} className="tabular-nums text-amber-600 dark:text-amber-400" />
        <span className="text-muted-foreground">
          {' / '}
          {target}
        </span>
        {round.participant_count > 0 && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            · {t('shop.round.people', { count: round.participant_count })}
          </span>
        )}
      </div>

      {/* Balken */}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(6, pct)}%` }}
        />
      </div>

      {/* Deadline / Ziel */}
      <div className="mt-2.5 text-xs text-muted-foreground">
        {goalReached
          ? t('shop.round.goalReached')
          : deadline
            ? t('shop.round.untilDate', { date: deadline })
            : t('shop.round.endsSoon')}
      </div>

      <div className="mt-1 text-[11px] text-muted-foreground/80">{t('shop.round.hint')}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-transform duration-fast hover:-translate-y-0.5">
        {inner}
      </Link>
    );
  }
  return inner;
}

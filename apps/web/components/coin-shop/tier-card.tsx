'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Loader2, Sparkles } from 'lucide-react';

import { startCheckout } from '@/app/actions/payments';
import type { CoinPricingTier } from '@/lib/data/payments';

// -----------------------------------------------------------------------------
// CoinShopTierCard — einzelne Karte in der Pricing-Grid.
//
// Kauf-Flow:
//   1. Click → startCheckout(tierId) → erzeugt Order + Stripe Session URL
//   2. window.location.href = url (hard redirect, kein next/router, weil
//      Stripe Checkout läuft auf anderer Domain)
//   3. Nach Abschluss kommt der User über STRIPE_SUCCESS_URL zurück auf
//      /coin-shop/success?session_id=cs_... und wir matchen dort auf die
//      Order.
//
// UI:
//   - Badge oben wenn tier.badge_label gesetzt (Bestseller, Beste Wert, etc.)
//   - Bonus visuell als „+ X Bonus" in gold hervorgehoben
//   - Preis in EUR gross, Coins-per-Euro klein als Referenzwert
// -----------------------------------------------------------------------------

interface Props {
  tier: CoinPricingTier;
  signedIn: boolean;
  coinsPerEuro: number;
  total: number;
  priceLabel: string;
}

export function CoinShopTierCard({ tier, signedIn, coinsPerEuro, total, priceLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const bonusPct = tier.bonus_coins > 0 ? Math.round((tier.bonus_coins / tier.coins) * 100) : 0;
  const isHighlight = tier.badge_label === 'Bestseller' || tier.badge_label === 'Beste Wert';

  function onBuy() {
    setError(null);

    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent('/coin-shop')}`);
      return;
    }

    startTransition(async () => {
      const result = await startCheckout(tier.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Hard-Redirect zu Stripe — Next-Router würde den Client-Cache behalten
      // und das ist eine externe Domain.
      window.location.href = result.data.url;
    });
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 transition-shadow ${
        isHighlight
          ? 'border-brand-gold/50 bg-gradient-to-br from-brand-gold/10 via-card to-card shadow-sm'
          : 'border-border bg-card hover:shadow-sm'
      }`}
    >
      {tier.badge_label && (
        <div
          className={`absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            isHighlight
              ? 'bg-brand-gold text-background'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {isHighlight && <Sparkles className="h-2.5 w-2.5" />}
          {tier.badge_label}
        </div>
      )}

      {/* Coin-Count */}
      <div className="mb-1 flex items-baseline gap-2">
        <Coins className="h-5 w-5 text-brand-gold" />
        <span className="text-3xl font-bold tracking-tight">
          {total.toLocaleString('de-DE')}
        </span>
        <span className="text-sm font-medium text-muted-foreground">Coins</span>
      </div>

      {/* Bonus-Breakdown */}
      {tier.bonus_coins > 0 ? (
        <p className="text-xs text-muted-foreground">
          {tier.coins.toLocaleString('de-DE')} Coins
          <span className="ml-1 font-semibold text-brand-gold">
            + {tier.bonus_coins.toLocaleString('de-DE')} Bonus
          </span>
          {bonusPct > 0 && <span className="ml-1 text-brand-gold">({bonusPct}% extra)</span>}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {tier.coins.toLocaleString('de-DE')} Coins
        </p>
      )}

      {/* Preis */}
      <div className="mt-4 flex flex-col">
        <span className="text-2xl font-semibold tracking-tight">{priceLabel}</span>
        <span className="text-[11px] text-muted-foreground">
          ≈ {coinsPerEuro.toLocaleString('de-DE')} Coins pro Euro
        </span>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onBuy}
        disabled={pending}
        className={`mt-5 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
          isHighlight
            ? 'bg-brand-gold text-background hover:bg-brand-gold/90'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Weiterleitung…
          </>
        ) : signedIn ? (
          'Jetzt kaufen'
        ) : (
          'Einloggen & kaufen'
        )}
      </button>

      {error && (
        <p
          className="mt-2 text-xs text-rose-500"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

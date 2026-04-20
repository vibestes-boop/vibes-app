import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Coins, Check, Sparkles, ShieldCheck, CreditCard, Apple } from 'lucide-react';

import { getUser } from '@/lib/auth/session';
import {
  getCoinPricingTiers,
  getMyCoinBalance,
  formatPrice,
  totalCoins,
  coinsPerEuro,
} from '@/lib/data/payments';
import { CoinShopTierCard } from '@/components/coin-shop/tier-card';

// -----------------------------------------------------------------------------
// /coin-shop — öffentliche Pricing-Grid-Seite.
//
// Strategie:
//   - Public lesbar (Tiers sind `active=true` via RLS), aber Kauf-Flow verlangt
//     Login → Anon-User sehen „Jetzt einloggen" statt „Kaufen".
//   - Web-Incentive-Kommunikation ganz oben: explizit +20% Bonus gegenüber
//     der App-Version, damit der User einen klaren Grund hat hier statt in
//     der App zu kaufen.
//   - Zahlungsarten-Icons (Apple/Google/Card/Klarna/SEPA) als Trust-Signale.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Coin-Shop — Serlo',
  description:
    'Serlo Coins im Web-Shop kaufen — bis zu 20% mehr Coins als in der App. Sichere Bezahlung per Apple Pay, Google Pay, Kreditkarte oder Klarna.',
  alternates: { canonical: '/coin-shop' },
};

export const dynamic = 'force-dynamic';

export default async function CoinShopPage() {
  const [user, tiers, balance] = await Promise.all([
    getUser(),
    getCoinPricingTiers(),
    getMyCoinBalance(),
  ]);

  if (tiers.length === 0) {
    // Kein einziges Tier konfiguriert → fail-soft: Redirect auf Startseite
    // mit leerer UI wirkt unseriös, und Dev-Setup ohne Seed ist der
    // wahrscheinlichste Fall.
    redirect('/');
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-20 pt-6 lg:px-6 lg:pt-10">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <header className="mb-8 lg:mb-12">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-xs font-medium text-brand-gold">
          <Sparkles className="h-3 w-3" />
          Web-Bonus: bis zu +33% mehr Coins
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight lg:text-4xl">
          Coin-Shop
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground lg:text-base">
          Coins für Geschenke, Tips und Shop-Käufe. Weil der Web-Shop keine
          App-Store-Gebühr hat, gibt&nbsp;es hier jedes Paket mit spürbarem
          Bonus oben drauf.
        </p>

        {user && balance && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Coins className="h-4 w-4 text-brand-gold" />
            <span className="text-sm font-medium">
              Aktuell: {balance.coins.toLocaleString('de-DE')} Coins
            </span>
          </div>
        )}
      </header>

      {/* ─── Pricing-Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <CoinShopTierCard
            key={tier.id}
            tier={tier}
            signedIn={!!user}
            coinsPerEuro={coinsPerEuro(tier)}
            total={totalCoins(tier)}
            priceLabel={formatPrice(tier.price_cents, tier.currency)}
          />
        ))}
      </div>

      {/* ─── Zahlungsarten + Trust ────────────────────────────────────────── */}
      <section className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <ShieldCheck className="mb-2 h-5 w-5 text-emerald-500" />
          <h3 className="text-sm font-semibold">Sichere Zahlung</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Kein Konto bei uns nötig — alle Zahlungsdaten laufen direkt über
            Stripe. PCI-DSS Level&nbsp;1, 3-D&nbsp;Secure automatisch wo
            erforderlich.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Apple className="mb-2 h-5 w-5" />
          <h3 className="text-sm font-semibold">Apple / Google Pay</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ein Tap auf dem iPhone oder Android — Touch&nbsp;ID / Face&nbsp;ID
            statt Karten&shy;nummer tippen. Auch am Mac mit Safari.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <CreditCard className="mb-2 h-5 w-5" />
          <h3 className="text-sm font-semibold">Karte, Klarna, SEPA</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Kreditkarte (Visa, Mastercard, Amex), Klarna Sofort und Lastschrift
            verfügbar. Keine Abos — jeder Kauf einzeln.
          </p>
        </div>
      </section>

      {/* ─── Info-Block ───────────────────────────────────────────────────── */}
      <section className="mt-8 rounded-xl border border-border bg-muted/30 p-5 text-xs text-muted-foreground">
        <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            Coins werden sofort nach erfolgreicher Zahlung gutgeschrieben.
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            Rechnung + Beleg findest du unter&nbsp;
            <Link href="/settings/billing" className="underline hover:text-foreground">
              Einstellungen &rarr; Bezahlungen
            </Link>
            .
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            Coins sind synchron zwischen Web und App — kaufe hier, nutze im
            Stream.
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            Gekaufte Coins sind nicht übertragbar und nicht rücker&shy;stattbar
            nach Verwendung.
          </li>
        </ul>
      </section>
    </div>
  );
}

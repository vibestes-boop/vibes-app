/**
 * payout.test.ts — Geld-Mathe der Creator-Auszahlung.
 *
 * Höchstes finanzielles Risiko (echtes Geld verlässt das System): ein falscher Kurs
 * oder Rundungs-Drift = falsch ausgezahlte Beträge. Diese Tests sind der Regression-
 * Guard gegen versehentliche Kurs-/Rundungs-Änderungen.
 */
import {
  DIAMOND_RATE_EUR,
  MIN_PAYOUT_DIAMONDS,
  formatPayoutEuro,
  isPayoutEligible,
  payoutEuroAmount,
} from '@/lib/payout';

describe('payout — Geld-Mathe', () => {
  describe('payoutEuroAmount', () => {
    it('rechnet Diamanten → Euro mit dem festen Kurs (2 Cent/Diamant)', () => {
      expect(payoutEuroAmount(0)).toBe(0);
      expect(payoutEuroAmount(50)).toBe(1);                       // 50 × 0.02 = 1,00 €
      expect(payoutEuroAmount(100)).toBe(2);
      expect(payoutEuroAmount(MIN_PAYOUT_DIAMONDS)).toBe(50);     // 2500 × 0.02 = 50,00 €
      expect(payoutEuroAmount(12345)).toBe(246.9);
    });

    it('fängt Float-Drift via Rundung auf 2 Nachkommastellen ab', () => {
      // 7 × 0.02 = 0.14000000000000001 in JS-Float → muss 0.14 sein
      expect(payoutEuroAmount(7)).toBe(0.14);
      expect(payoutEuroAmount(2501)).toBe(50.02);
      // höchstens 2 Nachkommastellen
      expect((payoutEuroAmount(333).toString().split('.')[1] ?? '').length).toBeLessThanOrEqual(2);
    });

    it('Regression-Guard: Kurs ist und bleibt 0,02 €', () => {
      expect(DIAMOND_RATE_EUR).toBe(0.02);
    });
  });

  describe('isPayoutEligible', () => {
    it('ist erst ab dem Mindestbetrag (2500) erfüllt', () => {
      expect(isPayoutEligible(MIN_PAYOUT_DIAMONDS - 1)).toBe(false);
      expect(isPayoutEligible(MIN_PAYOUT_DIAMONDS)).toBe(true);
      expect(isPayoutEligible(MIN_PAYOUT_DIAMONDS + 1)).toBe(true);
      expect(isPayoutEligible(0)).toBe(false);
    });

    it('Mindestbetrag entspricht 50,00 €', () => {
      expect(MIN_PAYOUT_DIAMONDS).toBe(2500);
      expect(payoutEuroAmount(MIN_PAYOUT_DIAMONDS)).toBe(50);
    });
  });

  describe('formatPayoutEuro', () => {
    it('formatiert mit 2 Nachkommastellen und € (locale-tolerant)', () => {
      expect(formatPayoutEuro(MIN_PAYOUT_DIAMONDS)).toMatch(/50[.,]00\s*€/);
      expect(formatPayoutEuro(7)).toMatch(/0[.,]14\s*€/);
    });
  });
});

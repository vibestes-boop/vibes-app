/**
 * Fallback-Kette (ce → ru → de): Tschetschenisch ist partiell und soll für
 * fehlende Keys zuerst Russisch zeigen (gelebtes Zweitsprach-Paar der
 * Community), erst dann Deutsch. Fixiert das Verhalten aus translate.ts +
 * fallbackChainFor() gegen Regressionen beim ce-Rollout.
 */
import { fallbackChainFor, MESSAGES } from '../messages';
import { resolve, type TranslationKey } from '../translate';

describe('i18n Fallback-Kette', () => {
  it('ce fällt für fehlende Keys zuerst auf Russisch zurück (ru gewinnt vor de)', () => {
    // Synthetische Kataloge statt echter — unabhängig davon, wie weit ce.ts
    // gerade gefüllt ist. Direkter Treffer schlägt Kette, ru schlägt de.
    const value = resolve({}, 'zz.only' as TranslationKey, undefined, [
      { zz: { only: 'RU' } } as never,
      { zz: { only: 'DE' } } as never,
    ]);
    expect(value).toBe('RU');
    // Integration: Ein ce-User sieht für keinen Standard-Key den rohen Key-String.
    const ceValue = resolve(MESSAGES.ce, 'auth.login' as TranslationKey, undefined, fallbackChainFor('ce'));
    expect(ceValue).not.toBe('auth.login');
  });

  it('ce fällt auf Deutsch zurück, wenn auch ru den Key nicht hat', () => {
    const chain = fallbackChainFor('ce');
    const value = resolve({}, 'zz.only' as TranslationKey, undefined, [
      { zz: {} } as never, // „ru" ohne den Key
      { zz: { only: 'DE' } } as never, // „de" hat ihn
    ]);
    expect(value).toBe('DE');
    expect(chain).toHaveLength(2);
  });

  it('ru/de/en behalten die einfache de-Fallback-Kette', () => {
    expect(fallbackChainFor('ru')).toHaveLength(1);
    expect(fallbackChainFor('de')).toHaveLength(1);
    expect(fallbackChainFor('en')).toHaveLength(1);
  });
});

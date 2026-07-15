import type { DeepPartial } from '../translate';
import { ce } from './ce';
import { de } from './de';
import { en } from './en';
import { ru } from './ru';

export type Messages = typeof de;

export type AppLocale = 'de' | 'ru' | 'en' | 'ce';

export const MESSAGES: Record<AppLocale, DeepPartial<Messages>> = { de, ru, en, ce };

export const LOCALE_LABELS: Record<AppLocale, string> = {
  de: 'Deutsch',
  ru: 'Русский',
  en: 'English',
  ce: 'Нохчийн',
};

// Fallback-Kette pro Locale: Tschetschenisch fällt zuerst auf Russisch zurück
// (das gelebte Zweitsprach-Paar der Community), erst dann auf Deutsch.
export function fallbackChainFor(locale: AppLocale): DeepPartial<Messages>[] {
  return locale === 'ce' ? [ru, de] : [de];
}

export { de };

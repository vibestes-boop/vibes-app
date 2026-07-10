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

export { de };

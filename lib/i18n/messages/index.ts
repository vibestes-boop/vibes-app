import type { DeepPartial } from '../translate';
import { de } from './de';
import { ru } from './ru';

export type Messages = typeof de;

export type AppLocale = 'de' | 'ru';

export const MESSAGES: Record<AppLocale, DeepPartial<Messages>> = { de, ru };

export const LOCALE_LABELS: Record<AppLocale, string> = {
  de: 'Deutsch',
  ru: 'Русский',
};

export { de };

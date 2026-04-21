// Messages-Registry — mapped eine `Locale` auf ihr Messages-Object.
// Statisch importiert (kein dynamic-import), damit der Tree-Shaker beim
// Server-Render alle Sprachen im Bundle hat. Gesamtgröße aller 4 Locales
// ist aktuell <6 KB uncompressed — Aufwand für dynamic-import lohnt sich nicht.

import de from './de';
import ru from './ru';
import ce from './ce';
import en from './en';

import type { Locale } from '../config';
import type { Messages } from './de';

export const MESSAGES: Record<Locale, Messages> = {
  de,
  ru,
  ce,
  en,
};

export type { Messages };

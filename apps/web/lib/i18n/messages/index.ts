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
import type { DeepPartial } from '../translate';

// Deutsch ist strikt vollständig (Source-of-Truth); ru/ce/en dürfen partiell
// sein und fallen zur Laufzeit auf Deutsch zurück (siehe translate.ts).
export const MESSAGES: Record<Locale, DeepPartial<Messages>> = {
  de,
  ru,
  ce,
  en,
};

export type { Messages };

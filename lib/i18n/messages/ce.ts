// -----------------------------------------------------------------------------
// Нохчийн мотт (Tschetschenisch) — DeepPartial. Noch weitgehend LEER: fehlende
// Keys fallen automatisch auf Deutsch zurück (kein roher Key-String).
//
// ⚠️ ZUM AUSFÜLLEN: Zaur pflegt die Übersetzungen selbst. Die vollständige Liste
// aller zu übersetzenden Strings (Key · Deutsch) liegt als Tabelle unter
// docs/i18n-ce-todo.md — dort Zeile für Zeile die tschetschenische Spalte füllen
// und die Werte hierher übertragen (gleiche Namespaces/Keys wie in de.ts).
//
// Struktur-Beispiel:
//   common: { ok: 'OK', cancel: '…', … },
//   auth:   { login: '…', … },
// -----------------------------------------------------------------------------

import type { DeepPartial } from '../translate';
import type { Messages } from './index';

export const ce: DeepPartial<Messages> = {
  common: {
    ok: 'OK',
  },
  language: {
    de: 'Deutsch',
    ru: 'Русский',
  },
};

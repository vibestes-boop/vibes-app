import type { ReactNode } from 'react';

import { I18nProvider } from '@/lib/i18n/client';
import { MESSAGES } from '@/lib/i18n/messages';

// Test-Wrapper für Komponenten, die useI18n() nutzen — rendert mit dem
// strikten deutschen Katalog (Source of Truth), wie es app/layout.tsx
// in Produktion über den Server-Provider tut.
export function TestI18nProvider({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="de" messages={MESSAGES.de}>
      {children}
    </I18nProvider>
  );
}
